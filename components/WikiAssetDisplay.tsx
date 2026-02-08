import React, { useState, useEffect } from 'react';
import { WikiAsset, Bundle, Application, TaxonomyCategory, TaxonomyDocumentType, WikiTheme } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import WikiAssetSpreadsheetPreview from './WikiAssetSpreadsheetPreview';
import WikiAssetDashboardView from './WikiAssetDashboardView';

interface WikiAssetDisplayProps {
  asset: WikiAsset;
  bundles: Bundle[];
  applications: Application[];
}

const WikiAssetDisplay: React.FC<WikiAssetDisplayProps> = ({ asset, bundles = [], applications = [] }) => {
  const [taxCat, setTaxCat] = useState<TaxonomyCategory | null>(null);
  const [taxType, setTaxType] = useState<TaxonomyDocumentType | null>(null);
  const [activeTheme, setActiveTheme] = useState<WikiTheme | null>(null);
  const [showDashboards, setShowDashboards] = useState(false);

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
        const type = types.find((t: any) => t._id === asset.documentTypeId);
        setTaxType(type || null);
        if (type) setTaxCat(categories.find((c: any) => c._id === type.categoryId) || null);
        setActiveTheme(themes.find((t: any) => t.key === asset.themeKey) || themes.find((t: any) => t.isDefault) || null);
      } catch (err) {}
    };
    loadMetadata();
  }, [asset]);


  const bundle = bundles.find(b => b._id === asset.bundleId);
  const app = applications.find(a => a._id === asset.applicationId || a.id === asset.applicationId);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = `data:${asset.file.mimeType};base64,${asset.storage.objectKey}`;
    link.download = asset.file.originalName;
    link.click();
  };

  const renderPreview = () => {
    if (asset.preview.status === 'pending') {
      return (
        <div className="py-32 flex flex-col items-center justify-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-100">
           <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
           <h4 className="text-xl font-black text-slate-800 tracking-tight uppercase">Normalizing Artifact Preview</h4>
           <p className="text-slate-400 font-medium">Nexus is preparing the document for secure inline reading...</p>
        </div>
      );
    }

    if (asset.preview.status === 'failed') {
      return (
        <div className="py-24 flex flex-col items-center justify-center bg-red-50 rounded-[3rem] border border-red-100">
           <i className="fas fa-circle-exclamation text-4xl text-red-300 mb-6"></i>
           <h4 className="text-xl font-black text-red-800 tracking-tight uppercase">Conversion Fault Detected</h4>
           <p className="text-red-400 font-medium mb-10">Inline visualization failed. The original source file remains safe.</p>
           <button onClick={handleDownload} className="px-10 py-4 bg-white text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-slate-50 transition-all flex items-center gap-3">
              <i className="fas fa-download"></i> Download Original
           </button>
        </div>
      );
    }

    if (asset.preview.kind === 'markdown' && asset.preview.objectKey) {
      return (
        <div
          className={`wiki-content theme-${activeTheme?.key || 'default'} bg-white border border-slate-100 p-12 rounded-[2.5rem] shadow-inner overflow-x-auto`}
        >
           <MarkdownRenderer content={asset.preview.objectKey} />
        </div>
      );
    }

    if (asset.preview.kind === 'sheet' && asset.preview.objectKey) {
      if (showDashboards) {
        return <WikiAssetDashboardView asset={asset} />;
      }
      return (
        <WikiAssetSpreadsheetPreview asset={asset} />
      );
    }

    if (asset.preview.kind === 'pdf') {
      return (
        <div className="w-full h-[800px] bg-slate-100 rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-inner">
           <iframe src={`data:application/pdf;base64,${asset.storage.objectKey}`} className="w-full h-full border-none" />
        </div>
      );
    }

    if (asset.preview.kind === 'images') {
      return (
        <div className="w-full flex items-center justify-center bg-slate-50 p-10 rounded-[2.5rem] border border-slate-100">
           <img src={`data:${asset.file.mimeType};base64,${asset.storage.objectKey}`} className="max-w-full rounded-2xl shadow-2xl" alt={asset.title} />
        </div>
      );
    }

    return (
      <div className="py-24 flex flex-col items-center justify-center bg-slate-950 rounded-[3rem] text-white overflow-hidden relative shadow-2xl">
         <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
         <i className="fas fa-file-shield text-6xl text-blue-500/30 mb-8"></i>
         <h4 className="text-2xl font-black tracking-tight mb-2 uppercase">Protocol Restricted Asset</h4>
         <p className="text-slate-400 font-medium mb-10">The format ({asset.file.ext}) requires local execution for viewing.</p>
         <button onClick={handleDownload} className="px-10 py-4 bg-white text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-blue-50 transition-all flex items-center gap-3">
            <i className="fas fa-download"></i> Fetch Source File
         </button>
      </div>
    );
  };

  return (
    <article className="w-full animate-fadeIn">
      {activeTheme && <style dangerouslySetInnerHTML={{ __html: activeTheme.css }} />}
      <section className="mb-12 flex flex-wrap gap-4">
        <MetaChip label="Category" value={taxCat?.name || 'General'} icon={taxCat?.icon || 'fa-tag'} />
        <MetaChip label="Blueprint" value={taxType?.name || 'Artifact'} icon="fa-file-contract" />
        <MetaChip label="Cluster" value={bundle?.name || 'Enterprise'} icon="fa-boxes-stacked" />
        <MetaChip label="Context" value={app?.name || 'Shared'} icon="fa-cube" />
        <MetaChip label="Format" value={asset.file.ext.toUpperCase()} icon="fa-file-code" color="bg-blue-50 text-blue-600 border-blue-100" />
        <MetaChip label="Size" value={`${(asset.file.sizeBytes / 1024).toFixed(1)} KB`} icon="fa-weight-hanging" />
        <div className="ml-auto flex items-center gap-2">
           <span className="px-3 py-1 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest">VER {asset.version}</span>
           <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${asset.preview.status === 'ready' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : asset.preview.status === 'failed' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse'}`}>
             {asset.preview.status === 'ready' ? 'Preview Live' : asset.preview.status === 'failed' ? 'Conversion Error' : 'Normalizing'}
           </span>
        </div>
      </section>

      <header className="mb-12 flex justify-between items-end">
        <div>
           <h1 className="text-6xl font-black text-slate-900 tracking-tighter">{asset.title}</h1>
           <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-3 flex items-center gap-2">
             <i className="fas fa-fingerprint text-[8px]"></i> SHA-256: {asset.file.checksumSha256 || 'SYSTEM_VERIFIED_REGISTRY_ID'}
           </p>
        </div>
        <div className="flex items-center gap-3">
          {asset.preview.kind === 'sheet' && asset.preview.objectKey && (
            <button
              onClick={() => setShowDashboards((prev) => !prev)}
              className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black uppercase rounded-xl border border-slate-900 hover:bg-slate-800 transition-all flex items-center gap-2"
            >
              <i className="fas fa-chart-column"></i> {showDashboards ? 'View Data' : 'Dashboards'}
            </button>
          )}
          <button
            onClick={handleDownload}
            className="px-8 py-3 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-xl border border-slate-200 hover:bg-white hover:shadow-xl transition-all flex items-center gap-2"
          >
            <i className="fas fa-file-download"></i> Get Source
          </button>
        </div>
      </header>

      <div className="wiki-preview-registry">
         {renderPreview()}
      </div>

      <footer className="mt-20 pt-10 border-t border-slate-100 flex justify-between items-center text-slate-400">
         <div className="flex items-center gap-6">
            <div className="flex flex-col">
               <span className="text-[8px] font-black uppercase tracking-widest mb-1">Custodian</span>
               <span className="text-[10px] font-bold text-slate-600">{asset.author}</span>
            </div>
            <div className="flex flex-col">
               <span className="text-[8px] font-black uppercase tracking-widest mb-1">Last Update</span>
               <span className="text-[10px] font-bold text-slate-600">{new Date(asset.updatedAt).toLocaleString()}</span>
            </div>
         </div>
         <div className="text-[9px] font-black uppercase tracking-widest opacity-50">REGISTRY ID: {asset._id || asset.id}</div>
      </footer>
    </article>
  );
};

const MetaChip = ({ label, value, icon, color = "bg-slate-50 text-slate-600 border-slate-100" }: any) => (
  <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border shadow-sm ${color}`}>
    <div className="w-8 h-8 rounded-xl bg-white/50 flex items-center justify-center text-[10px]"><i className={`fas ${icon}`}></i></div>
    <div className="flex flex-col">
       <span className="text-[7px] font-black uppercase tracking-tighter opacity-60 leading-none mb-1">{label}</span>
       <span className="text-[10px] font-black uppercase tracking-widest leading-none truncate max-w-[120px]">{value}</span>
    </div>
  </div>
);

export default WikiAssetDisplay;
