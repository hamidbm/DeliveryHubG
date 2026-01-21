
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { DEFAULT_MARKMAP_MD } from '../lib/markmapDsl';
import { toPng, toSvg } from 'html-to-image';

const MarkmapRenderer = dynamic(() => import('./MarkmapRenderer'), { ssr: false });

interface MindMapMarkdownEditorProps {
  initialContent: string;
  onSave: (content: string) => void;
  readOnly?: boolean;
}

const MindMapMarkdownEditor: React.FC<MindMapMarkdownEditorProps> = ({ initialContent, onSave, readOnly = false }) => {
  const [content, setContent] = useState(initialContent || DEFAULT_MARKMAP_MD);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isSidebarOpen, setIsSidebarOpen] = useState(!readOnly);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleContentChange = (val: string) => {
    setContent(val);
  };

  const handleFitView = () => {
    window.dispatchEvent(new CustomEvent('markmap-fit'));
  };

  const handleExportSvg = async () => {
    const svgEl = document.querySelector('.markmap');
    if (!svgEl) return;
    
    try {
      const dataUrl = await toSvg(svgEl as HTMLElement, { backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff' });
      const link = document.createElement('a');
      link.download = `nexus-blueprint-${Date.now()}.svg`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Export Failed', e);
    }
  };

  const handleExportPng = async () => {
    const svgEl = document.querySelector('.markmap');
    if (!svgEl) return;
    
    try {
      const dataUrl = await toPng(svgEl as HTMLElement, { 
        backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
        pixelRatio: 2
      });
      const link = document.createElement('a');
      link.download = `nexus-blueprint-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Export Failed', e);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden h-full w-full bg-slate-50 relative">
      {!readOnly && (
        <div className={`transition-all duration-500 ease-in-out border-r border-slate-200 bg-slate-900 flex flex-col shrink-0 z-50 ${isSidebarOpen ? 'w-[450px]' : 'w-0 opacity-0'}`}>
          <header className="px-8 py-6 border-b border-white/10 flex items-center justify-between bg-black/20">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Markdown Logic</span>
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Markmap Engine v1.0</span>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setContent(DEFAULT_MARKMAP_MD)} 
                className="text-[10px] font-black text-slate-400 hover:text-white uppercase transition-colors"
              >
                Reset Sample
              </button>
            </div>
          </header>
          
          <div className="flex-1 overflow-hidden">
            <textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              className="w-full h-full bg-transparent text-emerald-400 font-mono text-sm p-10 outline-none resize-none custom-scrollbar selection:bg-emerald-500/20"
              spellCheck={false}
              placeholder="# Start with a Level 1 Heading..."
            />
          </div>

          <footer className="p-8 border-t border-white/5 bg-black/30">
             <button 
              onClick={() => onSave(content)}
              className="w-full py-4 bg-blue-600 text-white text-[11px] font-black rounded-2xl uppercase tracking-widest shadow-2xl hover:bg-blue-500 transition-all active:scale-95"
             >
               Commit Blueprint
             </button>
          </footer>
        </div>
      )}

      <div className="flex-1 relative bg-white h-full w-full overflow-hidden flex flex-col" ref={containerRef}>
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-1.5 bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl shadow-slate-200/50">
           <ToolbarButton icon="fa-compress" label="Fit View" onClick={handleFitView} />
           <div className="w-[1px] h-4 bg-slate-100 mx-1"></div>
           <ToolbarButton icon={theme === 'light' ? 'fa-moon' : 'fa-sun'} label="Theme" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} />
           <div className="w-[1px] h-4 bg-slate-100 mx-1"></div>
           <ToolbarButton icon="fa-file-export" label="SVG" onClick={handleExportSvg} />
           <ToolbarButton icon="fa-image" label="PNG" onClick={handleExportPng} />
           {!readOnly && (
             <>
               <div className="w-[1px] h-4 bg-slate-100 mx-1"></div>
               <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={`p-2 rounded-xl transition-all ${isSidebarOpen ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 <i className={`fas fa-code-branch text-xs`}></i>
               </button>
             </>
           )}
        </div>

        <div className="flex-1 h-full min-h-0">
          <MarkmapRenderer content={content} theme={theme} />
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}} />
    </div>
  );
};

const ToolbarButton = ({ icon, label, onClick }: any) => (
  <button 
    onClick={onClick}
    className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-all text-slate-500 hover:text-slate-900 group"
  >
    <i className={`fas ${icon} text-[10px]`}></i>
    <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

export default MindMapMarkdownEditor;
