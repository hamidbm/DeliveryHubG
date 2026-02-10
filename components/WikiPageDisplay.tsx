import React, { useEffect, useRef, useState } from 'react';
import { WikiPage, WikiTheme, Bundle, Application, TaxonomyCategory, TaxonomyDocumentType } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

interface WikiPageDisplayProps {
  page: WikiPage;
  onNavigate?: (target: string) => void;
  bundles: Bundle[];
  applications: Application[];
}

const WikiPageDisplay: React.FC<WikiPageDisplayProps> = ({ page, onNavigate, bundles = [], applications = [] }) => {
  const [activeTheme, setActiveTheme] = useState<WikiTheme | null>(null);
  const [taxCat, setTaxCat] = useState<TaxonomyCategory | null>(null);
  const [taxType, setTaxType] = useState<TaxonomyDocumentType | null>(null);
  const [summary, setSummary] = useState<string | null>(page.summary || null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaError, setQaError] = useState<string | null>(null);
  const [isQaLoading, setIsQaLoading] = useState(false);
  const [qaItems, setQaItems] = useState<{ question: string; answer: string }[]>([]);
  const [qaHistoryItems, setQaHistoryItems] = useState<{ question: string; answer: string; createdAt?: string }[]>([]);
  const [isQaHistoryOpen, setIsQaHistoryOpen] = useState(false);
  const [isQaHistoryLoading, setIsQaHistoryLoading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [thRes, catRes, typRes] = await Promise.all([
          fetch('/api/wiki/themes?active=true'),
          fetch('/api/taxonomy/categories?active=true'),
          fetch('/api/taxonomy/document-types?active=true')
        ]);
        const themes = await thRes.json();
        const categories = await catRes.json();
        const types = await typRes.json();

        const type = types.find((t: any) => t._id === page.documentTypeId);
        setTaxType(type || null);
        if (type) setTaxCat(categories.find((c: any) => c._id === type.categoryId) || null);
        
        setActiveTheme(themes.find((t: any) => t.key === page.themeKey) || themes.find((t: any) => t.isDefault) || null);
      } catch (err) {}
    };
    loadMetadata();
  }, [page]);

  useEffect(() => {
    setSummary(page.summary || null);
    setSummaryError(null);
    setIsSummaryLoading(false);
    setQaQuestion('');
    setQaError(null);
    setIsQaLoading(false);
    setQaItems([]);
    setQaHistoryItems([]);
    setIsQaHistoryOpen(false);
    setIsQaHistoryLoading(false);
  }, [page._id, page.content, page.summary]);

  // Intercept internal links
  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href) return;

    // Check for internal link patterns
    let internalTarget = '';
    if (href.startsWith('/wiki/')) {
      internalTarget = href.replace('/wiki/', '');
    } else if (href.startsWith('wiki:')) {
      internalTarget = href.replace('wiki:', '');
    } else if (href.startsWith('#wiki-')) {
      internalTarget = href.replace('#wiki-', '');
    }

    if (internalTarget && onNavigate) {
      e.preventDefault();
      onNavigate(internalTarget);
    } else if (href.startsWith('http')) {
      // Force external links to open in new tab
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener noreferrer');
    }
  };

  const bundle = bundles.find(b => b._id === page.bundleId);
  const app = applications.find(a => a._id === page.applicationId || a.id === page.applicationId);

  const handleSummary = async () => {
    setIsSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await fetch('/api/wiki/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'summary',
          title: page.title,
          format: 'markdown',
          content: page.content
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setSummaryError(data.error || 'Summary generation failed.');
        return;
      }
      const nextSummary = data.result || null;
      setSummary(nextSummary);
      const pageId = page._id || page.id;
      if (pageId && nextSummary) {
        await fetch('/api/wiki', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            _id: pageId,
            summary: nextSummary
          })
        });
      }
    } catch (err) {
      setSummaryError('Summary generation failed.');
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const handleQaSubmit = async () => {
    if (!qaQuestion.trim()) return;
    setIsQaLoading(true);
    setQaError(null);
    try {
      const res = await fetch('/api/wiki/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: page._id || page.id,
          question: qaQuestion.trim(),
          title: page.title,
          content: page.content
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setQaError(data.error || 'Q&A failed.');
        return;
      }
      const answer = data.result || 'AI response unavailable.';
      setQaItems((items) => [{ question: qaQuestion.trim(), answer }, ...items]);
      setQaQuestion('');
    } catch (err) {
      setQaError('Q&A failed.');
    } finally {
      setIsQaLoading(false);
    }
  };

  const loadQaHistory = async () => {
    const pageId = page._id || page.id;
    if (!pageId) return;
    setIsQaHistoryLoading(true);
    try {
      const res = await fetch(`/api/wiki/qa?pageId=${encodeURIComponent(pageId)}&limit=10`);
      const data = await res.json();
      setQaHistoryItems((data.history || []).map((item: any) => ({
        question: item.question,
        answer: item.answer,
        createdAt: item.createdAt
      })));
    } catch (err) {
      setQaHistoryItems([]);
    } finally {
      setIsQaHistoryLoading(false);
    }
  };

  return (
    <article className="w-full">
      {activeTheme && <style dangerouslySetInnerHTML={{ __html: activeTheme.css }} />}
      <section className="mb-12 flex flex-wrap gap-4">
        <MetaItem label="Category" value={taxCat?.name || 'General'} icon={taxCat?.icon || 'fa-tag'} />
        <MetaItem label="Doc Type" value={taxType?.name || 'Artifact'} icon="fa-file-contract" />
        <MetaItem label="Cluster" value={bundle?.name || 'General'} icon="fa-boxes-stacked" />
        <MetaItem label="App" value={app?.name || 'No App'} icon="fa-cube" />
        <div className="ml-auto flex items-center gap-2">
           <span className="px-3 py-1 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest">v{page.version || 1}</span>
           <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-100">{page.status || 'Published'}</span>
        </div>
      </section>
      <header className="mb-12">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h1 className="text-6xl font-black text-slate-900 tracking-tighter">{page.title}</h1>
            {page.slug && <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-2">slug: {page.slug}</p>}
          </div>
          <button
            onClick={handleSummary}
            disabled={isSummaryLoading}
            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              isSummaryLoading
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : 'bg-slate-900 text-white shadow-lg hover:bg-slate-800'
            }`}
          >
            {isSummaryLoading ? 'Summarizing...' : 'Generate Summary'}
          </button>
        </div>
        {summaryError && (
          <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-fadeIn">
            <i className="fas fa-circle-exclamation"></i>
            {summaryError}
          </div>
        )}
        {summary && (
          <div className="mt-6 p-6 bg-blue-50/70 border border-blue-100 rounded-3xl">
            <div className="flex items-center gap-2 mb-3 text-blue-700">
              <i className="fas fa-wand-magic-sparkles text-sm"></i>
              <span className="text-[9px] font-black uppercase tracking-widest">AI Summary</span>
            </div>
            <div className="text-sm text-slate-700">
              <MarkdownRenderer content={summary} />
            </div>
          </div>
        )}
        <div className="mt-8 p-6 bg-slate-50 border border-slate-100 rounded-3xl">
          <div className="flex items-center gap-2 mb-4 text-slate-600">
            <i className="fas fa-comments text-sm"></i>
            <span className="text-[9px] font-black uppercase tracking-widest">Ask This Page</span>
            <button
              onClick={() => {
                const next = !isQaHistoryOpen;
                setIsQaHistoryOpen(next);
                if (next) loadQaHistory();
              }}
              className="ml-auto text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
            >
              {isQaHistoryOpen ? 'Hide History' : 'Show History'}
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={qaQuestion}
              onChange={(e) => setQaQuestion(e.target.value)}
              placeholder="Ask a question about this page..."
              className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
            />
            <button
              onClick={handleQaSubmit}
              disabled={isQaLoading || !qaQuestion.trim()}
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                isQaLoading || !qaQuestion.trim()
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-900 text-white shadow-lg hover:bg-slate-800'
              }`}
            >
              {isQaLoading ? 'Answering...' : 'Ask'}
            </button>
          </div>
          {qaError && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-2xl text-amber-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-fadeIn">
              <i className="fas fa-circle-exclamation"></i>
              {qaError}
            </div>
          )}
          {qaItems.length > 0 && (
            <div className="mt-6 space-y-4">
              {qaItems.map((item, idx) => (
                <div key={`${item.question}-${idx}`} className="bg-white border border-slate-100 rounded-2xl p-4">
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Q</div>
                  <div className="text-sm font-semibold text-slate-800">{item.question}</div>
                  <div className="mt-3 text-[9px] font-black uppercase tracking-widest text-slate-400">A</div>
                  <div className="text-sm text-slate-700 mt-1">
                    <MarkdownRenderer content={item.answer} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {isQaHistoryOpen && (
            <div className="mt-6 border-t border-slate-200 pt-4">
              <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Recent History</div>
              {isQaHistoryLoading ? (
                <div className="text-[10px] text-slate-400 font-medium">Loading...</div>
              ) : qaHistoryItems.length > 0 ? (
                <div className="space-y-4">
                  {qaHistoryItems.map((item, idx) => (
                    <div key={`${item.question}-${idx}`} className="bg-white border border-slate-100 rounded-2xl p-4">
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Q</div>
                      <div className="text-sm font-semibold text-slate-800">{item.question}</div>
                      <div className="mt-3 text-[9px] font-black uppercase tracking-widest text-slate-400">A</div>
                      <div className="text-sm text-slate-700 mt-1">
                        <MarkdownRenderer content={item.answer} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-slate-400 font-medium">No history yet.</div>
              )}
            </div>
          )}
        </div>
      </header>
      <div 
        ref={contentRef}
        onClick={handleContentClick}
        className={`wiki-content theme-${activeTheme?.key || 'default'}`} 
      >
        <MarkdownRenderer content={page.content} />
      </div>
    </article>
  );
};

const MetaItem = ({ label, value, icon }: any) => (
  <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 px-4 py-2 rounded-2xl">
    <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm"><i className={`fas ${icon} text-xs`}></i></div>
    <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</span><span className="text-xs font-bold text-slate-700">{value}</span></div>
  </div>
);

export default WikiPageDisplay;
