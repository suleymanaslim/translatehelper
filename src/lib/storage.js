export const STORAGE_KEY = 'translatehelper:workspace:v1';

export const EMPTY_DOCUMENT = {
  version: 1,
  title: '',
  sourceLanguage: 'en',
  rawText: '',
  options: { splitSentences: true, splitLines: true, protectAbbreviations: true },
  segments: [],
  pdfLayout: 'stacked',
};

export function validateDocument(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.segments) ||
      typeof value.rawText !== 'string' || typeof value.title !== 'string' ||
      !['en', 'tr'].includes(value.sourceLanguage)) {
    throw new Error('Geçerli bir Translate Helper JSON yedeği seçin.');
  }
  const ids = new Set();
  for (const segment of value.segments) {
    if (!segment || typeof segment.id !== 'string' || !segment.id || ids.has(segment.id) ||
        typeof segment.source !== 'string' || !segment.source.trim() || typeof segment.target !== 'string') {
      throw new Error('Yedekteki cümleler okunamadı. Dosya bozulmuş olabilir.');
    }
    ids.add(segment.id);
  }
  return {
    ...EMPTY_DOCUMENT,
    title: value.title,
    sourceLanguage: value.sourceLanguage,
    rawText: value.rawText,
    options: Object.fromEntries(Object.entries(EMPTY_DOCUMENT.options).map(([key, fallback]) =>
      [key, typeof value.options?.[key] === 'boolean' ? value.options[key] : fallback])),
    segments: value.segments.map(({ id, source, target, paragraphBreakBefore }) =>
      ({ id, source, target, paragraphBreakBefore: !!paragraphBreakBefore })),
    pdfLayout: ['stacked', 'columns', 'target'].includes(value.pdfLayout) ? value.pdfLayout : 'stacked',
  };
}

export function loadDocument() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return { document: value ? validateDocument(JSON.parse(value)) : { ...EMPTY_DOCUMENT }, error: null };
  } catch {
    return { document: { ...EMPTY_DOCUMENT }, error: 'Kayıtlı çalışma okunamadı. Varsa JSON yedeğinizi açabilirsiniz.' };
  }
}

export function backupDocument(document) {
  return JSON.stringify({ ...document, exportedAt: new Date().toISOString() }, null, 2);
}
