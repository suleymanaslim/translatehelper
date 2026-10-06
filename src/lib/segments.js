const TITLES = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'sn', 'av', 'doç', 'yrd', 'uzm', 'op', 'ord']);
const CONTINUATIONS = new Set(['vs', 'e.g', 'i.e', 'cf', 'fig', 'no', 'bkz', 'örn', 't.c', 'm.ö', 'm.s']);
const ENDABLE = new Set(['etc', 'approx', 'inc', 'ltd', 'co', 'corp', 'vb', 'vd', 'a.m', 'p.m']);
const CLOSERS = /["'”’»\)\]\}]/u;

function isProtectedPeriod(text, index) {
  const previous = text[index - 1] || '';
  const next = text[index + 1] || '';
  if (/\d/u.test(previous) && /\d/u.test(next)) return true;
  // Internal dots in domains, email addresses, initials and abbreviations.
  if (/[\p{L}\p{N}]/u.test(previous) && /[\p{L}\p{N}]/u.test(next)) return true;
  const prefix = text.slice(0, index);
  const token = prefix.match(/([\p{L}]+(?:\.[\p{L}]+)*)$/u)?.[1] || '';
  const lower = token.toLocaleLowerCase('en');
  const following = text.slice(index + 1).replace(/^[\s"'“‘(\[\{]+/u, '');
  if (!following) return false;
  if (TITLES.has(lower) || CONTINUATIONS.has(lower)) return true;
  if (ENDABLE.has(lower)) return /^[\p{Ll}\d,;:]/u.test(following);
  // A. Smith; U.S. policy. Acronyms at a sentence end may still split.
  if (/^\p{Lu}$/u.test(token) && /^\p{Lu}(?:\p{Ll}|\.)/u.test(following)) return true;
  if (/^(?:\p{L}\.)+\p{L}$/u.test(token)) return /^\p{Ll}/u.test(following);
  return false;
}

function splitIntoSentences(text, protectAbbreviations) {
  const sentences = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (!/[.!?]/u.test(text[index])) continue;
    if (text[index] === '.' && protectAbbreviations && isProtectedPeriod(text, index)) continue;
    let end = index + 1;
    while (/[.!?]/u.test(text[end] || '\0')) end += 1;
    // Keep a lower-case continuation after an ellipsis in the same sentence.
    if (protectAbbreviations && text.slice(index, end).startsWith('...') && /^\s*\p{Ll}/u.test(text.slice(end))) {
      index = end - 1;
      continue;
    }
    while (CLOSERS.test(text[end] || '\0')) end += 1;
    const source = text.slice(start, end).trim();
    if (source) sentences.push(source);
    start = end;
    index = end - 1;
  }
  const remaining = text.slice(start).trim();
  if (remaining) sentences.push(remaining);
  return sentences;
}

export function segmentText(rawText, options = {}) {
  const { splitSentences = true, splitLines = true, protectAbbreviations = true } = options;
  const text = rawText.replace(/\r\n?/gu, '\n').trim();
  if (!text) return [];
  const blocks = splitLines ? text.split('\n') : [text];
  const result = [];
  let newParagraph = false;
  for (const block of blocks) {
    if (!block.trim()) { newParagraph = result.length > 0; continue; }
    const parts = splitSentences ? splitIntoSentences(block, protectAbbreviations) : [block.trim()];
    for (const [index, source] of parts.entries()) {
      result.push({ source, paragraphBreakBefore: index === 0 && newParagraph });
    }
    newParagraph = false;
  }
  return result;
}

export function createSegments(parts, existing = []) {
  const matches = new Map();
  for (const segment of existing) {
    if (!matches.has(segment.source)) matches.set(segment.source, []);
    matches.get(segment.source).push(segment);
  }
  return parts.map(part => {
    const match = matches.get(part.source)?.shift();
    const id = match?.id || globalThis.crypto?.randomUUID?.() || `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    return { id, ...part, target: match?.target || '' };
  });
}

export function translatedText(segments) {
  let output = '';
  let paragraphBreak = false;
  for (const segment of segments) {
    paragraphBreak ||= segment.paragraphBreakBefore;
    const target = segment.target.trim();
    if (!target) continue;
    output += (output ? paragraphBreak ? '\n\n' : ' ' : '') + target;
    paragraphBreak = false;
  }
  return output;
}

export function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/u).length : 0;
}
