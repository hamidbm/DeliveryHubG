
import React, { useMemo, useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import { WikiPage, WikiTheme, WikiSpace } from '../types';
import { BUNDLES, APPLICATIONS, MILESTONES } from '../constants';

interface WikiPageDisplayProps {
  page: WikiPage;
  onNavigate?: (id: string) => void;
}

const WikiPageDisplay: React.FC<WikiPageDisplayProps> = ({ page, onNavigate }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [activeTheme, setActiveTheme] = useState<WikiTheme | null>(null);
  const [isMetaExpanded, setIsMetaExpanded] = useState(true);

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

  const htmlContent = useMemo(() => {
    const raw = (page.content || "").trim();
    if (!raw) return "";

    try {
      const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(raw);
      const sanitizeOptions = {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ["script", "iframe", "object", "embed", "link", "meta", "style"],
        FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "style"],
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      };

      if (looksLikeHtml) {
        return DOMPurify.sanitize(raw, sanitizeOptions);
      }

      const rendered = marked.parse(raw, { 
        gfm: true, 
        breaks: true 
      }) as string;

      return DOMPurify.sanitize(rendered, sanitizeOptions);
    } catch (err) {
      console.error("Rendering pipeline error:", err);
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
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  /* Fix: Property 'id' does not exist on type 'Bundle'. Using '_id' instead. */
  const bundle = BUNDLES.find(b => b._id === page.bundleId);
  const application = APPLICATIONS.find(a => a.id === page.applicationId);
  const milestone = MILESTONES.find(m => m.id === page.milestoneId);
  
  const syncHash = useMemo(() => {
    const id = page._id || page.id || 'new';
    return id.substring(id.length - 8).toUpperCase();
  }, [page._id, page.id]);

  return (
    <article className="animate-fadeIn w-full pb-32">
      {activeTheme && (
        <style dangerouslySetInnerHTML={{ __html: activeTheme.css }} />
      )}

      {/* Artifact Intelligence Layer (Above Title) */}
      <section className="mb-10 group/meta">
        <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isMetaExpanded ? 'max-h-[500px] opacity-100 mb-6' : 'max-h-0 opacity-0 mb-0'}`}>
          <div className="bg-slate-50/50 rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Personnel */}
              <div className="space-y-4">
                <MetaItem label="Author" value={page.author || 'System'} icon="fa-user-ninja" />
                <MetaItem label="Last Modified By" value={page.lastModifiedBy || 'System'} icon="fa-user-pen" />
              </div>
              
              {/* Timeline & Identifiers */}
              <div className="space-y-4">
                <MetaItem label="Provisioned" value={formatDate(page.createdAt)} icon="fa-calendar-day" />
                <MetaItem label="Sync Hash" value={syncHash} icon="fa-fingerprint" font="font-mono" />
              </div>

              {/* Business Context */}
              <div className="space-y-4">
                <MetaItem label="Business Bundle" value={bundle?.name || 'Unassigned'} icon="fa-layer-group" />
                <MetaItem label="Application" value={application?.name || 'General Context'} icon="fa-cube" />
              </div>

              {/* Status & Milestones */}
              <div className="space-y-4">
                <MetaItem label="Milestone" value={milestone?.name || 'Ongoing'} icon="fa-flag-checkered" />
                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge text={`v${page.version || '1.0'}`} color="bg-slate-900 text-white" />
                  <Badge text={page.status || 'Published'} color="bg-emerald-50 text-emerald-600 border border-emerald-100" />
                  {page.category && <Badge text={page.category} color="bg-blue-50 text-blue-600 border border-blue-100" />}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Intelligence Bar Toggle */}
        <div className="flex items-center justify-between px-2">
          <button 
            onClick={() => setIsMetaExpanded(!isMetaExpanded)}
            className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-blue-600 transition-colors group/btn"
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center border border-slate-200 group-hover/btn:border-blue-200 transition-all ${isMetaExpanded ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-white'}`}>
              <i className={`fas ${isMetaExpanded ? 'fa-chevron-up' : 'fa-info-circle'} scale-75 transition-transform`}></i>
            </div>
            {isMetaExpanded ? 'Collapse Artifact DNA' : 'Expand Metadata'}
          </button>
          
          <div className={`flex items-center gap-4 transition-opacity duration-300 ${isMetaExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
             <div className="flex items-center gap-2 text-[9px] font-bold text-slate-300 uppercase tracking-widest">
                <i className="fas fa-fingerprint text-blue-500/30"></i>
                <span>{syncHash}</span>
             </div>
             <div className="h-3 w-[1px] bg-slate-100"></div>
             <div className="flex items-center gap-2 text-[9px] font-bold text-slate-300 uppercase tracking-widest">
                <i className="fas fa-cube text-indigo-500/30"></i>
                <span>{application?.name || 'General'}</span>
             </div>
          </div>
        </div>
      </section>

      {/* Main Title - Anchored to content */}
      <header className="mb-8">
        <h1 className="text-6xl font-black text-slate-900 tracking-tighter leading-tight">
          {page.title}
        </h1>
      </header>

      {/* Primary Content Container */}
      <div 
        ref={contentRef}
        className={`wiki-content theme-${activeTheme?.key || 'default'} max-w-none prose`}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </article>
  );
};

const MetaItem = ({ label, value, icon, font = "font-bold" }: { label: string, value: string, icon: string, font?: string }) => (
  <div className="flex items-center gap-4 group/item">
    <div className="w-8 h-8 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-300 group-hover/item:text-blue-500 group-hover/item:border-blue-100 transition-all shadow-sm">
      <i className={`fas ${icon} text-[10px]`}></i>
    </div>
    <div className="flex flex-col">
      <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-tight">{label}</span>
      <span className={`text-xs ${font} text-slate-700 tracking-tight`}>{value}</span>
    </div>
  </div>
);

const Badge = ({ text, color }: { text: string, color: string }) => (
  <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${color}`}>
    {text}
  </span>
);

export default WikiPageDisplay;
