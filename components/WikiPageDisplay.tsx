
import React, { useMemo, useEffect, useRef } from 'react';
import { marked } from 'marked';
import { WikiPage } from '../types';
import { BUNDLES, APPLICATIONS, MILESTONES } from '../constants';

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

  // Metadata labels
  const bundle = BUNDLES.find(b => b.id === page.bundleId);
  const application = APPLICATIONS.find(a => a.id === page.applicationId);
  const milestone = MILESTONES.find(m => m.id === page.milestoneId);

  return (
    <article className="animate-fadeIn w-full pb-32">
      <header className="mb-12">
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900 text-white rounded-full border border-slate-800 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-widest">v{page.version || '1.0'}</span>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-100 shadow-sm">
            <i className="fas fa-layer-group text-[10px]"></i>
            <span className="text-[10px] font-black uppercase tracking-widest">Registry node</span>
          </div>
          
          {page.category && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-widest">{page.category}</span>
            </div>
          )}
        </div>
        
        <h1 className="text-6xl font-black text-slate-900 tracking-tighter leading-[1.1] mb-10">
          {page.title || 'Untitled Document'}
        </h1>
        
        {/* Business Context Chips */}
        {(bundle || application || milestone) && (
          <div className="flex flex-wrap gap-4 mb-10 pb-10 border-b border-slate-100">
            {bundle && (
              <div className="flex flex-col gap-1">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Business Bundle</span>
                <div className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-2">
                  <i className="fas fa-box-archive text-blue-500"></i>
                  {bundle.name}
                </div>
              </div>
            )}
            {application && (
              <div className="flex flex-col gap-1">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Target Application</span>
                <div className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-2">
                  <i className="fas fa-cube text-indigo-500"></i>
                  {application.name}
                </div>
              </div>
            )}
            {milestone && (
              <div className="flex flex-col gap-1">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Delivery Milestone</span>
                <div className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-2">
                  <i className="fas fa-flag-checkered text-emerald-500"></i>
                  {milestone.name}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-8 py-8 border-b border-slate-100">
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Primary Author</span>
            <span className="text-sm font-bold text-slate-700">{page.author || 'System'}</span>
          </div>
          
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Last Modifier</span>
            <span className="text-sm font-bold text-slate-700">{page.lastModifiedBy || page.author || 'System'}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Provisioned</span>
            <span className="text-sm font-bold text-slate-500">{formatDate(page.createdAt)}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Modified</span>
            <span className="text-sm font-bold text-slate-500">{formatDate(page.updatedAt)}</span>
          </div>
        </div>
      </header>

      <div 
        ref={contentRef}
        className="prose prose-slate prose-xl max-w-none transition-all duration-300"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </article>
  );
};

export default WikiPageDisplay;
