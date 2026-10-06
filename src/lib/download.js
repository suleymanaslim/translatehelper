export function safeFilename(title) {
  return (title.trim() || 'ceviri-calismasi').replace(/[<>:"/\\|?*\u0000-\u001F]/gu, '').trim().slice(0, 100) || 'ceviri-calismasi';
}

export function downloadFile(content, filename, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return; }
  } catch { /* Fall back for browsers that restrict Clipboard API access. */ }
  const previous = document.activeElement;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.cssText = 'position:fixed;opacity:0;top:0;left:0;pointer-events:none';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  previous?.focus({ preventScroll: true });
  if (!copied) throw new Error('Kopyalanamadı. Tarayıcınızın pano iznini kontrol edin.');
}
