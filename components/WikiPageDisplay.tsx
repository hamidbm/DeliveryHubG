
import React, { useMemo, useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { WikiPage, WikiTheme, WikiSpace } from '../types';
import { BUNDLES, APPLICATIONS, MILESTONES } from '../constants';

interface WikiPageDisplayProps {
  page: WikiPage;
  onNavigate?: (id: string) => void;
}

const WikiPageDisplay: React.FC<WikiPageDisplayProps> = ({ page, onNavigate }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [activeTheme, setActiveTheme] = useState<WikiTheme | null>(null);

  useEffect(() => {
    const resolveTheme = async () => {
      try {
        const [themesRes, spaceRes] = await Promise.all([
          fetch('/api/wiki/themes?active=true'),
          fetch(`/api/wiki/spaces`)
        ]);
        const themes: WikiTheme[] = await themesRes.json();
        const spaces: WikiSpace[] = await spaceRes.json();
        const currentSpace = spaces.find(s => s._id === page.spaceId || s.id === page.spaceId);

        const themeKey = page.themeKey || currentSpace?.defaultThemeKey;
        let theme = themes.find(t => t.key === themeKey);
        
        if (!theme) {
          theme = themes.find(t => t.isDefault);
        }
        
        setActiveTheme(theme || null);
      } catch (err) {
        console.error("Theme resolution failed:", err);
      }
    };
    resolveTheme();
  }, [page]);

  const htmlContent = useMemo(() => {
    if (!page.content) return '';
    try {
      // Basic sanitization: strip script tags for MVP
      const sanitized = page.content.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");
      return marked.parse(sanitized, {
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
        if (id && onNavigate) onNavigate(id);
      }
    };
    const container = contentRef.current;
    if (container) container.addEventListener('click', handleLinkClick);
    return () => { if (container) container.removeEventListener('click', handleLinkClick); };
  }, [onNavigate, htmlContent]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const bundle = BUNDLES.find(b => b.id === page.bundleId);
  const application = APPLICATIONS.find(a => a.id === page.applicationId);
  const milestone = MILESTONES.find(m => m.id === page.milestoneId);

  return (
    <article className="animate-fadeIn w-full pb-32">
      {/* Dynamic Scoped Theme Injection */}
      {activeTheme && (
        <style dangerouslySetInnerHTML={{ __html: activeTheme.css }} />
      )}

      <header className="mb-16">
        <div className="flex flex-wrap items-center gap-3 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900 text-white rounded-full border border-slate-800 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-widest">Version {page.version || '1.0'}</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-widest">{page.status || 'Published'}</span>
          </div>
          {page.category && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-100 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-widest">{page.category}</span>
            </div>
          )}
          {activeTheme && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-50 text-purple-600 rounded-full border border-purple-100 shadow-sm">
              <i className="fas fa-palette text-[8px]"></i>
              <span className="text-[10px] font-black uppercase tracking-widest">{activeTheme.name} Theme</span>
            </div>
          )}
        </div>
        
        <h1 className="text-6xl font-black text-slate-900 tracking-tighter leading-none mb-12">
          {page.title}
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 py-10 border-y border-slate-100 mb-12">
          <div className="space-y-1">
             <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Author</span>
             <p className="text-sm font-bold text-slate-700">{page.author || 'System'}</p>
          </div>
          <div className="space-y-1">
             <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Last Modified</span>
             <p className="text-sm font-bold text-slate-700">{page.lastModifiedBy || 'System'}</p>
          </div>
          <div className="space-y-1">
             <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Provisioned</span>
             <p className="text-sm font-bold text-slate-500">{formatDate(page.createdAt)}</p>
          </div>
          <div className="space-y-1">
             <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Sync Hash</span>
             <p className="text-sm font-mono text-slate-400 font-bold uppercase tracking-tighter">{Math.random().toString(36).substring(7)}</p>
          </div>
        </div>

        {(bundle || application || milestone) && (
          <div className="flex flex-wrap gap-4 p-8 bg-slate-50/50 rounded-[2rem] border border-slate-100 mb-16">
            {bundle && (
              <div className="bg-white px-4 py-2 rounded-2xl border border-slate-200 flex items-center gap-3">
                 <i className="fas fa-layer-group text-blue-500 text-xs"></i>
                 <div className="flex flex-col">
                   <span className="text-[8px] font-black text-slate-300 uppercase">Bundle</span>
                   <span className="text-xs font-black text-slate-700">{bundle.name}</span>
                 </div>
              </div>
            )}
            {application && (
              <div className="bg-white px-4 py-2 rounded-2xl border border-slate-200 flex items-center gap-3">
                 <i className="fas fa-cube text-indigo-500 text-xs"></i>
                 <div className="flex flex-col">
                   <span className="text-[8px] font-black text-slate-300 uppercase">Application</span>
                   <span className="text-xs font-black text-slate-700">{application.name}</span>
                 </div>
              </div>
            )}
            {milestone && (
              <div className="bg-white px-4 py-2 rounded-2xl border border-slate-200 flex items-center gap-3">
                 <i className="fas fa-flag-checkered text-emerald-500 text-xs"></i>
                 <div className="flex flex-col">
                   <span className="text-[8px] font-black text-slate-300 uppercase">Milestone</span>
                   <span className="text-xs font-black text-slate-700">{milestone.name}</span>
                 </div>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Scoped content container - Removed Tailwind 'prose' to ensure custom theme CSS is the primary styling source */}
      <div 
        ref={contentRef}
        className={`wiki-content theme-${activeTheme?.key || 'default'} max-w-none`}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </article>
  );
};

export default WikiPageDisplay;
