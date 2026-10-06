import { useEffect, useLayoutEffect, useRef } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { translatedText } from './lib/segments.js';

export const LANGUAGES = { en: 'İngilizce', tr: 'Türkçe' };

export function Dialog({ title, children, onClose, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog.open) dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className={`dialog ${className}`} onCancel={onClose}
    onClick={event => { if (event.target === ref.current) onClose(); }} aria-labelledby="dialog-title">
    <div className="dialog-body">
      <div className="dialog-header"><h2 id="dialog-title">{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Pencereyi kapat"><X size={19} /></button>
      </div>
      {children}
    </div>
  </dialog>;
}

export function SegmentRow({ segment, index, active, targetLanguage, onChange, onFocus, onNavigate, onCopy, registerRef }) {
  const ref = useRef(null);
  const complete = !!segment.target.trim();
  useLayoutEffect(() => {
    const textarea = ref.current;
    textarea.style.height = '0px';
    textarea.style.height = `${Math.max(70, textarea.scrollHeight)}px`;
  }, [segment.target]);
  return <article className={`segment-row ${active ? 'active' : ''} ${complete ? 'complete' : ''}`} aria-label={`Cümle ${index + 1}`}>
    <div className="source-cell">
      <span className="segment-number" title={complete ? 'Çeviri yazıldı' : 'Çeviri bekliyor'}>
        {complete ? <Check size={13} strokeWidth={2.5} /> : String(index + 1).padStart(2, '0')}
      </span>
      <p className="source-content" lang={targetLanguage === 'tr' ? 'en' : 'tr'}>{segment.source}</p>
      <button className="icon-button copy-source" onClick={() => onCopy(segment.source)} aria-label={`${index + 1}. özgün cümleyi kopyala`} title="Özgün cümleyi kopyala"><Copy size={15} /></button>
    </div>
    <div className="target-cell">
      <textarea ref={element => { ref.current = element; registerRef(segment.id, element); }} value={segment.target}
        lang={targetLanguage} spellCheck onChange={event => onChange(segment.id, event.target.value)}
        onFocus={() => onFocus(segment.id)}
        onKeyDown={event => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            onNavigate(index, event.shiftKey ? -1 : 1);
          }
        }}
        aria-label={`${index + 1}. cümlenin ${LANGUAGES[targetLanguage]} çevirisi`}
        placeholder="Çevirinizi yazın…" rows={2} className="translation-input" />
    </div>
  </article>;
}

export function DocumentPreview({ document, layout = 'stacked', print = false }) {
  const targetLanguage = document.sourceLanguage === 'en' ? 'tr' : 'en';
  const segments = print ? document.segments : document.segments.slice(0, 2);
  return <section className={`${print ? 'print-document' : 'pdf-preview'} layout-${layout}`} aria-label={print ? undefined : 'PDF önizlemesi'}>
    <header className="paper-header">
      <span className="paper-brand">TRANSLATE HELPER</span>
      <h2>{document.title.trim() || 'Çeviri çalışması'}</h2>
      <p>{new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long' }).format(new Date())} · {document.segments.length} cümle</p>
    </header>
    {layout === 'target'
      ? <div className="target-document">{(print ? translatedText(document.segments) : translatedText(segments)) || 'Çevirileriniz burada görünecek.'}</div>
      : <div className="paper-segments">{segments.map((segment, index) => <article className="print-segment" key={segment.id}>
        <span className="paper-number">{String(index + 1).padStart(2, '0')}</span>
        <div className="paper-pair">
          <div className="paper-source"><span className="paper-label">Özgün metin · {LANGUAGES[document.sourceLanguage]}</span><p>{segment.source}</p></div>
          <div className="paper-target"><span className="paper-label">Çeviri · {LANGUAGES[targetLanguage]}</span><p>{segment.target.trim() || '—'}</p></div>
        </div>
      </article>)}</div>}
    {!print && document.segments.length > 2 && <div className="preview-more">+ {document.segments.length - 2} cümle daha</div>}
  </section>;
}
