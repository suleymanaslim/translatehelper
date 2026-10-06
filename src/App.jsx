import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Check, ChevronDown, CircleAlert, Copy, Download, FileDown, FileJson, FileText, Languages, Maximize2, Minimize2, Pencil, Printer, Save, Trash2, Upload, X } from 'lucide-react';
import { Dialog, DocumentPreview, LANGUAGES, SegmentRow } from './components.jsx';
import { createSegments, segmentText, translatedText, wordCount } from './lib/segments.js';
import { backupDocument, EMPTY_DOCUMENT, loadDocument, STORAGE_KEY, validateDocument } from './lib/storage.js';
import { copyText, downloadFile, safeFilename } from './lib/download.js';
import { exportPdf } from './lib/pdf.js';

const EXAMPLES = {
  en: 'Dr. Smith believes that learning a language is a journey, not a race. Small, consistent steps make a big difference! For example, you can translate a short text every day.\n\nWhat did you learn today? Write it down and revisit it tomorrow.',
  tr: 'Dr. Yılmaz, dil öğrenmenin zaman ve düzenli çalışma gerektirdiğini söylüyor. Küçük adımlar büyük bir fark yaratır! Örneğin, her gün kısa bir metin çevirebilirsiniz.\n\nBugün ne öğrendiniz? Not alın ve yarın yeniden okuyun.',
};

export default function App() {
  const [initial] = useState(loadDocument);
  const [document, setDocument] = useState(initial.document);
  const [view, setView] = useState(initial.document.segments.length ? 'workspace' : 'input');
  const [saveStatus, setSaveStatus] = useState(initial.error ? 'error' : 'saved');
  const [activeId, setActiveId] = useState(initial.document.segments[0]?.id || null);
  const [focusMode, setFocusMode] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [toast, setToast] = useState(initial.error ? { message: initial.error, error: true } : null);
  const latest = useRef(document);
  const saved = useRef(initial.document);
  const targetRefs = useRef(new Map());
  const importRef = useRef(null);
  const pendingFocus = useRef(false);
  latest.current = document;

  const targetLanguage = document.sourceLanguage === 'en' ? 'tr' : 'en';
  const complete = document.segments.filter(segment => segment.target.trim()).length;
  const total = document.segments.length;
  const percent = total ? Math.round(complete / total * 100) : 0;
  const combined = useMemo(() => translatedText(document.segments), [document.segments]);
  const deferredSource = useDeferredValue(document.rawText);
  const previewParts = useMemo(() => segmentText(deferredSource, document.options), [deferredSource, document.options]);
  const shortcut = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/u.test(navigator.platform) ? '⌘' : 'Ctrl';

  const notify = useCallback((message, error = false) => setToast({ message, error, key: Date.now() }), []);
  const updateDocument = patch => setDocument(previous => ({ ...previous, ...patch }));

  const persist = useCallback(() => {
    if (latest.current === saved.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(latest.current));
      saved.current = latest.current;
      setSaveStatus('saved');
    } catch { setSaveStatus('error'); }
  }, []);

  useEffect(() => {
    if (document === saved.current) return;
    setSaveStatus('saving');
    const timer = setTimeout(persist, 300);
    return () => clearTimeout(timer);
  }, [document, persist]);

  useEffect(() => {
    const onVisibility = () => { if (globalThis.document.visibilityState === 'hidden') persist(); };
    window.addEventListener('pagehide', persist);
    globalThis.document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', persist);
      globalThis.document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [persist]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.error ? 6500 : 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (view === 'workspace' && pendingFocus.current) {
      pendingFocus.current = false;
      const next = document.segments.find(segment => !segment.target.trim()) || document.segments[0];
      if (next) targetRefs.current.get(next.id)?.focus({ preventScroll: true });
    }
  }, [view, document.segments]);

  useEffect(() => {
    const handleEscape = event => { if (event.key === 'Escape') setFocusMode(false); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    const closeMenus = event => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      globalThis.document.querySelectorAll('.download-menu details[open]').forEach(menu => {
        if (event.type === 'keydown' || !menu.contains(event.target)) menu.open = false;
      });
    };
    window.addEventListener('pointerdown', closeMenus);
    window.addEventListener('keydown', closeMenus);
    return () => { window.removeEventListener('pointerdown', closeMenus); window.removeEventListener('keydown', closeMenus); };
  }, []);

  function startTranslating() {
    const parts = segmentText(document.rawText, document.options);
    if (!parts.length) return;
    const segments = createSegments(parts, document.segments);
    const retained = new Set(segments.map(segment => segment.id));
    const lost = document.segments.filter(segment => segment.target.trim() && !retained.has(segment.id)).length;
    const start = () => {
      updateDocument({ segments });
      setActiveId(segments.find(segment => !segment.target.trim())?.id || segments[0].id);
      pendingFocus.current = true;
      setView('workspace');
    };
    if (lost) setConfirmation({ title: 'Cümleleri yeniden oluştur?',
      body: `Metin değiştiği için ${lost} cümlenin çevirisi eşleştirilemiyor ve kaldırılacak. Değişmeyen cümlelerin çevirileri korunacak.`,
      label: 'Yeniden oluştur', action: start });
    else start();
  }

  function changeTarget(id, target) {
    setDocument(previous => ({ ...previous,
      segments: previous.segments.map(segment => segment.id === id ? { ...segment, target } : segment),
    }));
  }

  function navigate(index, direction) {
    const next = document.segments[index + direction];
    if (!next) { notify(direction > 0 ? 'Son cümledesiniz.' : 'İlk cümledesiniz.'); return; }
    const textarea = targetRefs.current.get(next.id);
    textarea?.focus({ preventScroll: true });
    textarea?.closest('.segment-row')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  async function copy(value, success = 'Özgün cümle kopyalandı.') {
    try { await copyText(value); notify(success); } catch (error) { notify(error.message, true); }
  }

  function clearAll() {
    setConfirmation({ title: 'Tüm çalışmayı temizle?',
      body: 'Özgün metin ve bütün çeviriler silinecek. Saklamak isterseniz önce JSON yedeğini indirin.',
      label: 'Tümünü temizle', destructive: true,
      action: () => { setDocument({ ...EMPTY_DOCUMENT }); setView('input'); setActiveId(null); setFocusMode(false); notify('Çalışma temizlendi.'); },
    });
  }

  function downloadBackup() {
    downloadFile(backupDocument(document), `${safeFilename(document.title)}.json`, 'application/json;charset=utf-8');
    notify('JSON yedeği indirildi.');
  }

  function downloadTxt() {
    downloadFile('\uFEFF' + combined, `${safeFilename(document.title)}.txt`, 'text/plain;charset=utf-8');
    notify('Çeviri metni indirildi.');
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const imported = validateDocument(JSON.parse(await file.text()));
      const restore = () => {
        setDocument(imported); setView(imported.segments.length ? 'workspace' : 'input');
        setActiveId(imported.segments[0]?.id || null); setFocusMode(false); notify('JSON yedeği açıldı.');
      };
      if (document.rawText.trim() || total) setConfirmation({ title: 'Yedeği aç?',
        body: 'Açacağınız JSON yedeği mevcut çalışmanın yerini alacak. Mevcut çalışmayı saklamak için önce yedeğini indirin.',
        label: 'Yedeği aç', action: restore });
      else restore();
    } catch (error) { notify(error instanceof SyntaxError ? 'JSON dosyası okunamadı. Geçerli bir yedek seçin.' : error.message, true); }
  }

  async function handlePdf() {
    setPdfBusy(true);
    setPdfError('');
    try { await exportPdf(document, document.pdfLayout); notify('PDF indirildi.'); setPdfOpen(false); }
    catch (error) { setPdfError(error.message || 'PDF oluşturulamadı. Lütfen tekrar deneyin.'); }
    finally { setPdfBusy(false); }
  }

  return <>
    <div className={`app ${focusMode ? 'focus-mode' : ''}`}>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand" aria-label="Translate Helper">
            <span className="brand-mark"><Languages size={21} strokeWidth={1.8} /></span>
            <span>Translate<span className="brand-light">Helper</span><span className="brand-dot">.</span></span>
          </div>
          <span className="brand-description">Çeviri çalışma alanı</span>
          <div className={`save-status ${saveStatus}`} title="Çalışmanız bu cihazın tarayıcısında saklanır.">
            {saveStatus === 'error' ? <CircleAlert size={15} /> : saveStatus === 'saving' ? <Save size={15} /> : <Check size={15} />}
            <span>{saveStatus === 'error' ? 'Kayıt yapılamadı' : saveStatus === 'saving' ? 'Kaydediliyor…' : 'Bu tarayıcıda kaydedildi'}</span>
          </div>
        </div>
      </header>

      <main className={`main ${view === 'input' ? 'input-view' : 'workspace-view'}`}>
        {saveStatus === 'error' && <div className="storage-warning" role="alert"><CircleAlert size={18} />
          <span>Tarayıcı kaydı kullanılamıyor. Çalışmanızı kaybetmemek için JSON yedeğini indirin.</span>
          <button className="text-button" onClick={downloadBackup}>Yedeği indir</button>
        </div>}

        <div className="document-bar">
          <div className="title-field"><FileText size={18} /><input aria-label="Belge başlığı" placeholder="Adsız çeviri" value={document.title}
            maxLength={180} onChange={event => updateDocument({ title: event.target.value })} /></div>
          <div className="language-pair">
            <label className="source-language"><span className="language-code">{document.sourceLanguage.toUpperCase()}</span>
              <select aria-label="Kaynak dili" value={document.sourceLanguage} onChange={event => updateDocument({ sourceLanguage: event.target.value })}>
                <option value="en">İngilizce</option><option value="tr">Türkçe</option>
              </select><ChevronDown size={13} />
            </label>
            <ArrowLeftRight size={15} className="language-divider" />
            <span className="target-language"><span className="language-code">{targetLanguage.toUpperCase()}</span>{LANGUAGES[targetLanguage]}</span>
          </div>
        </div>

        {view === 'input' ? <section className="input-section">
          <div className="input-heading"><div><span className="eyebrow">01 / METNİ HAZIRLA</span><h1>Yeni çeviri</h1>
            <p>Metninizi yapıştırın, her cümleyi kendi alanında çevirin.</p></div>
            {!!total && <button className="button secondary" onClick={() => setView('workspace')}>Çeviriye dön</button>}
          </div>
          <div className="source-editor">
            <div className="editor-top"><label htmlFor="raw-source">Özgün metin</label>
              {!document.rawText.trim() && <button className="text-button sample-button" onClick={() => updateDocument({ rawText: EXAMPLES[document.sourceLanguage] })}>Örnek metin</button>}
              {!!document.rawText.trim() && <span className="text-stats">{wordCount(document.rawText)} kelime · {document.rawText.length} karakter</span>}
            </div>
            <textarea id="raw-source" className="raw-textarea" value={document.rawText} lang={document.sourceLanguage} spellCheck
              onChange={event => updateDocument({ rawText: event.target.value })}
              placeholder="İngilizce veya Türkçe metninizi buraya yapıştırın…" />
            <div className="segmentation-bar"><span className="segmentation-label">Cümlelere ayır</span>
              <label><input type="checkbox" checked={document.options.splitSentences}
                onChange={event => updateDocument({ options: { ...document.options, splitSentences: event.target.checked } })} />Nokta, ! ve ?</label>
              <label><input type="checkbox" checked={document.options.splitLines}
                onChange={event => updateDocument({ options: { ...document.options, splitLines: event.target.checked } })} />Satır sonları</label>
              <label><input type="checkbox" checked={document.options.protectAbbreviations} disabled={!document.options.splitSentences}
                onChange={event => updateDocument({ options: { ...document.options, protectAbbreviations: event.target.checked } })} />Kısaltmaları koru</label>
            </div>
          </div>
          <div className="input-actions"><button className="text-button muted-button" onClick={() => importRef.current.click()}><Upload size={16} />JSON yedeği aç</button>
            <div className="start-action"><span className="segment-preview-count">{previewParts.length ? `${previewParts.length} cümle hazır` : 'Metin ekleyerek başlayın'}</span>
              <button className="button primary" disabled={!document.rawText.trim()} onClick={startTranslating}>Çeviriye başla</button>
            </div>
          </div>
          <div className="input-footnote"><Save size={14} /><span>Çalışmanız otomatik kaydedilir. Metniniz bu tarayıcıda kalır.</span></div>
        </section> : <section className="workspace" aria-label="Çeviri çalışma alanı">
          <div className="workspace-toolbar">
            <div className="progress-summary"><div className="progress-text"><span><strong>{complete}</strong><span className="progress-total"> / {total}</span> tamamlandı</span><span className="percent">%{percent}</span></div>
              <div className="progress-track" role="progressbar" aria-label="Çeviri ilerlemesi" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${percent}%` }} /></div>
            </div>
            <div className="workspace-actions">
              <button className="button icon-action secondary focus-toggle" onClick={() => setFocusMode(!focusMode)} aria-pressed={focusMode} title={focusMode ? 'Odaktan çık (Esc)' : 'Odak modu'}>
                {focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}<span>{focusMode ? 'Odaktan çık' : 'Odaklan'}</span>
              </button>
              <button className="button secondary hide-in-focus copy-all" disabled={!complete} onClick={() => copy(combined, 'Tüm çeviriler kopyalandı.')} title="Tüm çevirileri kopyala"><Copy size={16} /><span>Çeviriyi kopyala</span></button>
              <div className="download-menu hide-in-focus">
                <details><summary className="button secondary" aria-label="TXT ve JSON dosyaları"><Download size={16} /><span>Dosya</span><ChevronDown size={13} /></summary>
                  <div className="menu-popover">
                    <button disabled={!complete} onClick={event => { event.currentTarget.closest('details').open = false; downloadTxt(); }}><FileText size={16} />Çeviri metni (.txt)</button>
                    <button onClick={event => { event.currentTarget.closest('details').open = false; downloadBackup(); }}><FileJson size={16} />JSON yedeği indir</button>
                    <button onClick={event => { event.currentTarget.closest('details').open = false; importRef.current.click(); }}><Upload size={16} />JSON yedeği aç</button>
                  </div>
                </details>
              </div>
              <button className="button primary" onClick={() => { setPdfError(''); setPdfOpen(true); }}><FileDown size={17} /><span>PDF indir</span></button>
            </div>
          </div>
          <div className="workspace-subbar hide-in-focus"><button className="text-button muted-button" onClick={() => setView('input')}><Pencil size={14} />Metni düzenle</button>
            <span className="keyboard-hint"><kbd>{shortcut}</kbd><span>+</span><kbd>Enter</kbd><span>sonraki cümle</span></span>
            <button className="text-button clear-button" onClick={clearAll}><Trash2 size={14} /><span>Tümünü temizle</span></button>
          </div>
          <div className="segment-list">
            <div className="column-headings"><div><span>ÖZGÜN METİN</span><span className="column-language">{LANGUAGES[document.sourceLanguage]}</span></div>
              <div><span>ÇEVİRİNİZ</span><span className="column-language">{LANGUAGES[targetLanguage]}</span></div>
            </div>
            {document.segments.map((segment, index) => <SegmentRow key={segment.id} segment={segment} index={index}
              active={activeId === segment.id} targetLanguage={targetLanguage} onChange={changeTarget} onFocus={setActiveId}
              onNavigate={navigate} onCopy={copy} registerRef={(id, element) => { if (element) targetRefs.current.set(id, element); else targetRefs.current.delete(id); }} />)}
          </div>
          <div className="workspace-footer"><span>{percent === 100 ? <><Check size={15} />Tüm cümleler çevrildi. PDF’niz hazır.</> : `${total - complete} cümle çeviri bekliyor`}</span>
            <span className="hide-in-focus">PDF: özgün metin üstte, çeviri altta</span>
            {focusMode && <span className="keyboard-hint"><kbd>{shortcut}</kbd> + <kbd>Enter</kbd> sonraki cümle</span>}
          </div>
        </section>}
      </main>
      <input ref={importRef} type="file" accept=".json,application/json" className="visually-hidden" tabIndex={-1} aria-label="JSON yedeği seç" onChange={importBackup} />

      {pdfOpen && <Dialog title="PDF olarak indir" onClose={() => { if (!pdfBusy) setPdfOpen(false); }} className="export-dialog">
        <p className="dialog-description">Belgenizin düzenini seçin.</p>
        <div className="pdf-layout-options" role="radiogroup" aria-label="PDF düzeni">
          {[
            { value: 'stacked', label: 'Alt alta', description: 'Özgün metin üstte, çeviri altta', icon: 'stacked' },
            { value: 'columns', label: 'Yan yana', description: 'İki sütunlu çift dilli belge', icon: 'columns' },
            { value: 'target', label: 'Yalnızca çeviri', description: 'Tek parça çevrilmiş metin', icon: 'target' },
          ].map(option => <label className={`pdf-layout-option ${document.pdfLayout === option.value ? 'selected' : ''}`} key={option.value}>
            <input type="radio" name="pdf-layout" value={option.value} checked={document.pdfLayout === option.value}
              onChange={() => updateDocument({ pdfLayout: option.value })} />
            <span className={`layout-icon ${option.icon}`} aria-hidden="true"><i /><i /></span>
            <span><strong>{option.label}</strong><small>{option.description}</small></span>
            {document.pdfLayout === option.value && <Check size={15} />}
          </label>)}
        </div>
        <DocumentPreview document={document} layout={document.pdfLayout} />
        {pdfError && <p className="pdf-error" role="alert"><CircleAlert size={16} />{pdfError}</p>}
        {complete < total && <p className="export-note"><CircleAlert size={15} />{total - complete} çeviri boş. {document.pdfLayout === 'target' ? 'Yalnızca yazdığınız çeviriler eklenecek.' : 'Boş çeviriler “—” ile gösterilecek.'}</p>}
        <div className="dialog-footer"><button className="button secondary" disabled={pdfBusy || (document.pdfLayout === 'target' && !complete)} onClick={() => window.print()}><Printer size={16} />Yazdır</button>
          <button className="button primary" disabled={pdfBusy || (document.pdfLayout === 'target' && !complete)} onClick={handlePdf}>
            <FileDown size={17} />{pdfBusy ? 'PDF hazırlanıyor…' : 'PDF indir'}
          </button>
        </div>
      </Dialog>}

      {confirmation && <Dialog title={confirmation.title} onClose={() => setConfirmation(null)}>
        <p className="confirmation-description">{confirmation.body}</p>
        <div className="dialog-footer"><button className="button secondary" onClick={() => setConfirmation(null)}>Vazgeç</button>
          <button className={`button ${confirmation.destructive ? 'danger' : 'primary'}`} onClick={() => { confirmation.action(); setConfirmation(null); }}>{confirmation.label}</button>
        </div>
      </Dialog>}
      <div className="toast-region" aria-live="polite" aria-atomic="true">{toast && <div className={`toast ${toast.error ? 'error' : ''}`}>
        {toast.error ? <CircleAlert size={17} /> : <Check size={17} />}<span>{toast.message}</span>
        <button className="icon-button" aria-label="Bildirimi kapat" onClick={() => setToast(null)}><X size={15} /></button>
      </div>}</div>
    </div>
    <DocumentPreview document={document} layout={document.pdfLayout} print />
  </>;
}
