
import React, { useMemo, useEffect, useRef } from 'react';
import { marked } from 'marked';
import { WikiPage } from '../types';

interface WikiPageDisplayProps {
  page: WikiPage;
  onNavigate?: (id: string) => void;
}

const WikiPageDisplay: React.FC<WikiPageDisplayProps> = ({ page, onNavigate }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  const htmlContent = useMemo(() => {
    if (!page.content) return '';
    try {
      return marked.parse(page.content, {
        gfm: true,
        breaks: true,
      });
    } catch (err) {
      console.error("Markdown parsing error:", err);
      return 'Error rendering document content.';
    }
  }, [page.content]);

  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (anchor && anchor.getAttribute('href')?.startsWith('#wiki-')) {
        e.preventDefault();
        const id = anchor.getAttribute('href')?.replace('#wiki-', '');
        if (id && onNavigate) {
          onNavigate(id);
        }
      }
    };

    const container = contentRef.current;
    if (container) {
      container.addEventListener('click', handleLinkClick);
    }
    return () => {
      if (container) {
        container.removeEventListener('click', handleLinkClick);
      }
    };
  }, [onNavigate, htmlContent]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusStyle = (status?: string) => {
    switch (status) {
      case 'Published': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'Draft': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'Archived': return 'bg-slate-100 text-slate-500 border-slate-200';
      default: return 'bg-blue-50 text-blue-600 border-blue-100';
    }
  };

  return (
    <article className="animate-fadeIn w-full pb-32">
      <header className="mb-12">
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900 text-white rounded-full border border-slate-800 shadow-sm">
            <i className="fas fa-fingerprint text-[10px]"></i>
            <span className="text-[10px] font-black uppercase tracking-widest">v{page.version || '1.0'}</span>
          </div>

          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border shadow-sm ${getStatusStyle(page.status)}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${page.status === 'Published' ? 'bg-emerald-500' : 'bg-current'} animate-pulse`}></div>
            <span className="text-[10px] font-black uppercase tracking-widest">{page.status || 'Published'}</span>
          </div>

          <div className="h-4 w-[1px] bg-slate-200 mx-1"></div>
          
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-100 shadow-sm">
            <i className="fas fa-file-lines text-[10px]"></i>
            <span className="text-[10px] font-black uppercase tracking-widest">Registry Node</span>
          </div>
          
          {page.category && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100 shadow-sm">
              <i className="fas fa-folder-open text-[10px]"></i>
              <span className="text-[10px] font-black uppercase tracking-widest">{page.category}</span>
            </div>
          )}
          
          {page.readingTime && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-50 text-slate-500 rounded-full border border-slate-100 shadow-sm">
              <i className="fas fa-stopwatch text-[10px]"></i>
              <span className="text-[10px] font-black uppercase tracking-widest">{page.readingTime} min read</span>
            </div>
          )}
        </div>
        
        <h1 className="text-6xl font-black text-slate-900 tracking-tighter leading-[1.1] mb-10">
          {page.title || 'Untitled Document'}
        </h1>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-8 py-8 border-y border-slate-100">
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Primary Author</span>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                 <i className="fas fa-user-pen text-blue-600 text-[10px]"></i>
              </div>
              <span className="text-sm font-bold text-slate-700">{page.author || 'System'}</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Last Modified By</span>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center">
                 <i className="fas fa-user-edit text-indigo-500 text-[10px]"></i>
              </div>
              <span className="text-sm font-bold text-slate-700">{page.lastModifiedBy || page.author || 'System'}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Provision Date</span>
            <div className="flex items-center gap-2.5">
              <i className="fas fa-calendar-check text-slate-300 text-[12px]"></i>
              <span className="text-sm font-bold text-slate-500">{formatDate(page.createdAt)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Sync Timestamp</span>
            <div className="flex items-center gap-2.5">
              <i className="fas fa-arrows-rotate text-slate-300 text-[12px]"></i>
              <span className="text-sm font-bold text-slate-500">{formatDate(page.updatedAt)}</span>
            </div>
          </div>
        </div>

        {page.tags && page.tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {page.tags.map((tag, i) => (
              <span key={i} className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </header>

      <div 
        ref={contentRef}
        className="prose prose-slate prose-xl max-w-none transition-all duration-300"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />

      {(!page.content || page.content.trim() === '') && (
        <div className="py-24 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[3rem] text-slate-300 bg-slate-50/30">
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm mb-4">
            <i className="fas fa-feather-pointed text-2xl text-blue-200"></i>
          </div>
          <p className="font-black uppercase tracking-widest text-[10px]">Drafting in progress. No content published yet.</p>
        </div>
      )}

      <footer className="mt-24 pt-10 border-t border-slate-50 flex flex-col sm:flex-row items-center justify-between gap-6 text-slate-300">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"></div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Nexus Registry Verified Node</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-[9px] font-black uppercase tracking-widest opacity-50">v4.1 Governance</span>
          <div className="flex gap-4">
            <i className="fab fa-markdown text-xl opacity-50 hover:opacity-100 transition-opacity cursor-help" title="Markdown Enabled"></i>
            <i className="fas fa-print text-sm opacity-50 hover:opacity-100 transition-opacity cursor-pointer"></i>
          </div>
        </div>
      </footer>
    </article>
  );
};

export default WikiPageDisplay;
