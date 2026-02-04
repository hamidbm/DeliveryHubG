import React, { useMemo, useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import { WikiPage, WikiTheme, WikiSpace, Bundle, Application, TaxonomyCategory, TaxonomyDocumentType } from '../types';

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

  const htmlContent = useMemo(() => {
    if (!page.content) return "";
    // Normalize newlines
    const rawMd = page.content.replace(/\\n/g, '\n').replace(/\\r/g, '').trim();
    const rendered = marked.parse(rawMd, { gfm: true, breaks: true }) as string;
    return DOMPurify.sanitize(rendered);
  }, [page.content]);

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
        <h1 className="text-6xl font-black text-slate-900 tracking-tighter">{page.title}</h1>
        {page.slug && <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-2">slug: {page.slug}</p>}
      </header>
      <div 
        ref={contentRef}
        onClick={handleContentClick}
        className={`wiki-content prose max-w-none theme-${activeTheme?.key || 'default'} prose-headings:block`} 
        dangerouslySetInnerHTML={{ __html: htmlContent }} 
      />
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