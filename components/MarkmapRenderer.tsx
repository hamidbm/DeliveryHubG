
'use client';

import React, { useEffect, useRef } from 'react';
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';

interface MarkmapRendererProps {
  content: string;
  theme?: 'light' | 'dark';
}

const MarkmapRenderer: React.FC<MarkmapRendererProps> = ({ content, theme = 'light' }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const markmapRef = useRef<Markmap | null>(null);
  const transformerRef = useRef<Transformer>(new Transformer());

  useEffect(() => {
    if (!svgRef.current) return;

    // Initialize Markmap instance if it doesn't exist
    if (!markmapRef.current) {
      markmapRef.current = Markmap.create(svgRef.current, {
        autoFit: true,
        duration: 500,
        paddingX: 16,
      });
    }

    // Transform and update
    const { root } = transformerRef.current.transform(content || '# Start Typing...');
    markmapRef.current.setData(root);
    markmapRef.current.fit();

  }, [content]);

  // Handle manual fit view via exposing method or just internal logic
  useEffect(() => {
    const handleFit = () => {
      markmapRef.current?.fit();
    };
    window.addEventListener('markmap-fit', handleFit);
    return () => window.removeEventListener('markmap-fit', handleFit);
  }, []);

  return (
    <div className={`w-full h-full markmap-container theme-${theme} relative`}>
      <svg ref={svgRef} className="markmap" />
      <div className="absolute bottom-4 left-4 flex gap-2 pointer-events-none">
        <div className="px-3 py-1 bg-white/50 backdrop-blur-sm rounded-full text-[8px] font-black text-slate-400 uppercase tracking-widest border border-slate-100">
           D3 Engine Active
        </div>
      </div>
    </div>
  );
};

export default MarkmapRenderer;
