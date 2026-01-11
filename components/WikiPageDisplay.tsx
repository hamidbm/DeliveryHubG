
import React, { useMemo, useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { WikiPage, WikiTheme, WikiSpace } from '../types';
import { BUNDLES, APPLICATIONS, MILESTONES } from '../constants';

interface WikiPageDisplayProps {
  page: WikiPage;
  onNavigate?: (id: string) => void;
}

// Security: Create a hardened marked renderer that blocks all raw HTML input
const renderer = new (marked as any).Renderer();
renderer.html = () => ''; // Return empty string for any raw HTML blocks

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
  }, [page.spaceId, page.themeKey]);

  // Security: Harden the Markdown pipeline with DOMPurify sanitization
  const htmlContent = useMemo(() => {
    if (!page.content) return '';
    try {
      // 1. Convert Markdown to HTML using hardened renderer (no raw HTML allowed)
      const rawHtml = marked.parse(page.content, {
        gfm: true,
        breaks: true,
        renderer,
      }) as string;

      // 2. Sanitize the output to remove dangerous tags, attributes, and URI schemes
      return DOMPurify.sanitize(rawHtml, {
        FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'link', 'meta', 'svg', 'math'],
        FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick', 'onmouseover'],
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      });
    } catch (err) {
      console.error("Markdown parsing error:", err);
      return 'Error rendering document content securely.';
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
  
  // Fix: Unique Sync Hash derived from document ID rather than random
  const syncHash = useMemo(() => {
    const id = page._id || page.id || 'new';
    return id.substring(id.length - 8).toUpperCase();
  }, [page._id, page.id]);

  return (
    <article className="animate-fadeIn w-full pb-32">
      {/* Dynamic Scoped Theme Injection - Trusted source from Admin control */}
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
             <p className="text-sm font-mono text-slate-400 font-bold uppercase tracking-tighter">{syncHash}</p>
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

      {/* Scoped content container - Securely rendered and themed */}
      <div 
        ref={contentRef}
        className={`wiki-content theme-${activeTheme?.key || 'default'} max-w-none`}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </article>
  );
};

export default WikiPageDisplay;
