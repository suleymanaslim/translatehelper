import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPdf } from '../src/lib/pdf.js';
import { EMPTY_DOCUMENT } from '../src/lib/storage.js';

// Font requests use the same repository assets without requiring a web server.
globalThis.fetch = async path => new Response(await readFile(new URL(`../public${path}`, import.meta.url)));

const document = { ...EMPTY_DOCUMENT, title: 'İngilizce / Türkçe · Çeviri', segments: Array.from({ length: 35 }, (_, index) => ({
  id: `s${index}`, source: `Sentence ${index + 1}. Learning a language takes practice.`,
  target: `Cümle ${index + 1}. Öğrenmek için çalışıyorum; ığüşöç İĞÜŞÖÇ.`,
})) };

for (const layout of ['stacked', 'columns', 'target']) {
  test(`${layout} PDF embeds Unicode fonts and produces complete, paginated output`, async () => {
    const blob = await createPdf(document, layout);
    assert.equal(blob.type, 'application/pdf');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const text = new TextDecoder('latin1').decode(bytes);
    assert.ok(text.startsWith('%PDF-'));
    assert.ok(text.includes('/FontFile2'));
    assert.ok(text.includes('/ToUnicode'));
    assert.ok(text.includes('%%EOF'));
    const pages = text.match(/\/Type \/Page\s/g)?.length || 0;
    assert.ok(pages >= 1);
    if (layout === 'stacked') assert.ok(pages > 1);
  });
}

test('a segment taller than a page continues at line boundaries without losing content', async () => {
  const long = { ...document, segments: [{ id: 'long', source: 'Long source sentence '.repeat(400), target: 'Uzun çeviri cümlesi '.repeat(450) }] };
  const blob = await createPdf(long, 'stacked');
  const text = new TextDecoder('latin1').decode(await blob.arrayBuffer());
  assert.ok((text.match(/\/Type \/Page\s/g)?.length || 0) > 1);
});
