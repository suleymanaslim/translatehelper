import { translatedText } from './segments.js';
import { downloadFile, safeFilename } from './download.js';

const LANGUAGE = { en: 'İngilizce', tr: 'Türkçe' };
let fontPromise;

async function fontBase64(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('PDF yazı tipi yüklenemedi. Lütfen tekrar deneyin.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return btoa(binary);
}

async function getFonts() {
  if (!fontPromise) {
    fontPromise = Promise.all([
      fontBase64(`${import.meta.env?.BASE_URL || '/'}fonts/DejaVuSans.ttf`),
      fontBase64(`${import.meta.env?.BASE_URL || '/'}fonts/DejaVuSans-Bold.ttf`),
    ]).catch(error => { fontPromise = null; throw error; });
  }
  return fontPromise;
}

export async function createPdf(document, layout = 'stacked') {
  const [{ jsPDF }, [regular, bold]] = await Promise.all([import('jspdf'), getFonts()]);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  pdf.addFileToVFS('DejaVuSans.ttf', regular);
  pdf.addFont('DejaVuSans.ttf', 'DejaVu', 'normal');
  pdf.addFileToVFS('DejaVuSans-Bold.ttf', bold);
  pdf.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold');
  pdf.setProperties({ title: document.title.trim() || 'Çeviri çalışması', creator: 'Translate Helper', subject: 'Cümle cümle çeviri' });

  const left = 16;
  const width = 178;
  const bottom = 278;
  const lineHeight = 4.8;
  const title = document.title.trim() || 'Çeviri çalışması';
  const targetLanguage = document.sourceLanguage === 'en' ? 'tr' : 'en';
  const date = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const ink = [29, 36, 53];
  const muted = [111, 119, 136];
  const accent = [71, 63, 190];
  let y;
  let contentTop;

  function font(size = 10.4, weight = 'normal', color = ink) {
    pdf.setFont('DejaVu', weight);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
  }

  function header() {
    font(8, 'bold', accent);
    pdf.text('TRANSLATE HELPER', left, 15);
    font(16, 'bold');
    const titleLines = pdf.splitTextToSize(title, width);
    pdf.text(titleLines, left, 24, { lineHeightFactor: 1.2 });
    const headerY = 26 + titleLines.length * 6.8;
    font(8.2, 'normal', muted);
    pdf.text(`${date}  ·  ${document.segments.length} cümle  ·  ${LANGUAGE[document.sourceLanguage]} → ${LANGUAGE[targetLanguage]}`, left, headerY);
    pdf.setDrawColor(222, 225, 233);
    pdf.line(left, headerY + 5, left + width, headerY + 5);
    y = headerY + 10;
    if (layout === 'columns') {
      font(8.2, 'bold', muted);
      pdf.text(`ÖZGÜN METİN · ${LANGUAGE[document.sourceLanguage]}`, left + 10, y);
      pdf.text(`ÇEVİRİ · ${LANGUAGE[targetLanguage]}`, left + 99, y);
      y += 6;
    }
    contentTop = y;
  }

  function newPage() { pdf.addPage(); header(); }
  function ensure(height) { if (y + height > bottom) newPage(); }
  function lines(text, availableWidth) { font(); return pdf.splitTextToSize(text || '—', availableWidth); }

  header();

  if (layout === 'target') {
    const paragraphs = translatedText(document.segments).split(/\n\s*\n/u).filter(Boolean);
    for (const paragraph of paragraphs) {
      const wrapped = lines(paragraph, width);
      // Keep ordinary paragraphs together; oversized paragraphs continue at line boundaries.
      if (wrapped.length * lineHeight <= bottom - contentTop) ensure(wrapped.length * lineHeight + 5);
      for (const line of wrapped) {
        ensure(lineHeight + 2);
        font();
        pdf.text(line, left, y + 4);
        y += lineHeight;
      }
      y += 5;
    }
  } else {
    for (const [index, segment] of document.segments.entries()) {
      const textWidth = layout === 'columns' ? 76 : 160;
      const sources = lines(segment.source, textWidth);
      const targets = lines(segment.target.trim(), textWidth);
      const wholeHeight = layout === 'columns'
        ? Math.max(sources.length, targets.length) * lineHeight + 10
        : (sources.length + targets.length) * lineHeight + 18;
      if (wholeHeight <= bottom - contentTop) ensure(wholeHeight);
      else if (y > contentTop) newPage();

      let sourceIndex = 0;
      let targetIndex = 0;
      let continuation = false;
      while (sourceIndex < sources.length || targetIndex < targets.length) {
        const capacity = layout === 'columns'
          ? Math.max(1, Math.floor((bottom - contentTop - 10) / lineHeight))
          : Math.max(1, Math.floor((bottom - contentTop - 18) / (2 * lineHeight)));
        const sourceChunk = sources.slice(sourceIndex, sourceIndex + capacity);
        const targetChunk = targets.slice(targetIndex, targetIndex + capacity);
        const height = layout === 'columns'
          ? Math.max(sourceChunk.length, targetChunk.length) * lineHeight + 10
          : (sourceChunk.length + targetChunk.length) * lineHeight + 18;
        ensure(height);
        font(7.5, 'bold', muted);
        pdf.text(`${String(index + 1).padStart(2, '0')}${continuation ? '*' : ''}`, left, y + 5);
        if (layout === 'columns') {
          pdf.setFillColor(247, 248, 251);
          pdf.rect(left + 8, y, 83, height - 3, 'F');
          font();
          sourceChunk.forEach((line, row) => pdf.text(line, left + 12, y + 5 + row * lineHeight));
          font(10.4, 'normal', segment.target.trim() ? ink : muted);
          targetChunk.forEach((line, row) => pdf.text(line, left + 101, y + 5 + row * lineHeight));
        } else {
          font(7.4, 'bold', muted);
          pdf.text(`ÖZGÜN METİN · ${LANGUAGE[document.sourceLanguage]}${continuation ? ' (devam)' : ''}`, left + 11, y + 4);
          font();
          sourceChunk.forEach((line, row) => pdf.text(line, left + 11, y + 9 + row * lineHeight));
          const targetY = y + 10 + sourceChunk.length * lineHeight;
          font(7.4, 'bold', accent);
          pdf.text(`ÇEVİRİ · ${LANGUAGE[targetLanguage]}${continuation ? ' (devam)' : ''}`, left + 11, targetY);
          font(10.4, 'normal', segment.target.trim() ? ink : muted);
          targetChunk.forEach((line, row) => pdf.text(line, left + 11, targetY + 5 + row * lineHeight));
          pdf.setDrawColor(233, 235, 241);
          pdf.line(left + 11, y + height - 2, left + width, y + height - 2);
        }
        y += height;
        sourceIndex += sourceChunk.length;
        targetIndex += targetChunk.length;
        continuation = true;
      }
    }
  }

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(222, 225, 233);
    pdf.line(left, 283, left + width, 283);
    font(7.5, 'normal', muted);
    pdf.text('Translate Helper', left, 288);
    pdf.text(`${page} / ${pageCount}`, left + width, 288, { align: 'right' });
  }
  return pdf.output('blob');
}

export async function exportPdf(document, layout) {
  const blob = await createPdf(document, layout);
  downloadFile(blob, `${safeFilename(document.title)}.pdf`, 'application/pdf');
}

export async function openPdfForPrinting(document, layout) {
  // Keep the popup in the click gesture; use the PDF viewer rather than window.print in the sandboxed frame.
  let viewer = null;
  try { viewer = window.open('', '_blank'); if (viewer) viewer.opener = null; }
  catch { /* Popups can be blocked by the embedding page or browser. */ }
  try {
    const blob = await createPdf(document, layout);
    if (!viewer || viewer.closed) {
      downloadFile(blob, `${safeFilename(document.title)}.pdf`, 'application/pdf');
      return false;
    }
    const url = URL.createObjectURL(blob);
    try { viewer.location.replace(url); }
    catch {
      viewer.close();
      URL.revokeObjectURL(url);
      downloadFile(blob, `${safeFilename(document.title)}.pdf`, 'application/pdf');
      return false;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return true;
  } catch (error) { viewer?.close(); throw error; }
}
