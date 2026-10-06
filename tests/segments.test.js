import test from 'node:test';
import assert from 'node:assert/strict';
import { createSegments, segmentText, translatedText } from '../src/lib/segments.js';
import { backupDocument, EMPTY_DOCUMENT, validateDocument } from '../src/lib/storage.js';

const sources = (text, options) => segmentText(text, options).map(segment => segment.source);

test('English titles and sentence-ending abbreviations do not create spurious segments', () => {
  assert.deepEqual(sources('Mr. Smith met Mrs. Brown and Dr. Jones. They discussed books, etc. It was useful!'),
    ['Mr. Smith met Mrs. Brown and Dr. Jones.', 'They discussed books, etc.', 'It was useful!']);
});

test('examples, comparisons and initials remain attached to their sentences', () => {
  assert.deepEqual(sources('J. R. R. Tolkien used words, e.g. names. Cats vs. dogs? Try i.e. examples.'),
    ['J. R. R. Tolkien used words, e.g. names.', 'Cats vs. dogs?', 'Try i.e. examples.']);
});

test('Turkish abbreviations, decimal numbers, dates, email and URLs are protected', () => {
  assert.deepEqual(sources('T.C. Milli Eğitim Bakanlığı 06.10.2026 tarihinde açıkladı. Dr. Yılmaz 3.14 dedi. Visit https://example.com or a.b@example.com.'),
    ['T.C. Milli Eğitim Bakanlığı 06.10.2026 tarihinde açıkladı.', 'Dr. Yılmaz 3.14 dedi.', 'Visit https://example.com or a.b@example.com.']);
});

test('repeated punctuation, ellipses and closing quotes stay with their sentence', () => {
  assert.deepEqual(sources('She asked, “Ready?!” Wait... maybe later. Done!'),
    ['She asked, “Ready?!”', 'Wait... maybe later.', 'Done!']);
});

test('line splitting preserves paragraph breaks and normalizes CRLF', () => {
  const result = segmentText('First line\r\nSecond line\r\n\r\nThird paragraph.');
  assert.deepEqual(result.map(segment => segment.source), ['First line', 'Second line', 'Third paragraph.']);
  assert.deepEqual(result.map(segment => segment.paragraphBreakBefore), [false, false, true]);
});

test('segmentation settings independently control punctuation and line breaks', () => {
  assert.deepEqual(sources('First. Second!\nThird?', { splitSentences: false }), ['First. Second!', 'Third?']);
  assert.deepEqual(sources('First\nSecond.', { splitLines: false }), ['First\nSecond.']);
  assert.deepEqual(sources('Dr. Smith.', { protectAbbreviations: false }), ['Dr.', 'Smith.']);
  assert.deepEqual(sources(' \n\t '), []);
});

test('resegmentation preserves duplicate sentences and their individual translations in order', () => {
  const existing = [
    { id: 'a', source: 'Hello.', target: 'Merhaba.' },
    { id: 'b', source: 'Hello.', target: 'Selam.' },
  ];
  const result = createSegments(segmentText('Hello. Hello. New.'), existing);
  assert.equal(result[0].id, 'a');
  assert.equal(result[1].id, 'b');
  assert.deepEqual(result.map(segment => segment.target), ['Merhaba.', 'Selam.', '']);
  assert.ok(result[2].id);
});

test('translated text joins sentences, excludes blanks and retains paragraph boundaries', () => {
  assert.equal(translatedText([
    { target: ' Merhaba. ' }, { target: 'Nasılsınız?' },
    { target: '', paragraphBreakBefore: true }, { target: ' İyiyim. ' },
  ]), 'Merhaba. Nasılsınız?\n\nİyiyim.');
});

test('segment IDs also work in HTTP previews without crypto.randomUUID', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
    const segments = createSegments(segmentText('First. Second.'));
    assert.ok(segments.every(segment => segment.id));
    assert.notEqual(segments[0].id, segments[1].id);
  } finally { Object.defineProperty(globalThis, 'crypto', descriptor); }
});

test('JSON backup round-trips Turkish text and all workspace settings', () => {
  const document = { ...EMPTY_DOCUMENT, title: 'İngilizce çalışması', rawText: 'Hello.',
    segments: [{ id: 'one', source: 'Hello.', target: 'İyi günler, Şükrü.' }], pdfLayout: 'columns' };
  assert.deepEqual(validateDocument(JSON.parse(backupDocument(document))), {
    ...document, segments: [{ ...document.segments[0], paragraphBreakBefore: false }],
  });
});

test('broken JSON structure and duplicate IDs are rejected instead of losing work', () => {
  assert.throws(() => validateDocument({ segments: [] }));
  assert.throws(() => validateDocument({ ...EMPTY_DOCUMENT, segments: [{ id: 'one', source: 'Hello.', target: 3 }] }));
  assert.throws(() => validateDocument({ ...EMPTY_DOCUMENT, segments: [
    { id: 'one', source: 'Hello.', target: '' }, { id: 'one', source: 'Bye.', target: '' },
  ] }));
});
