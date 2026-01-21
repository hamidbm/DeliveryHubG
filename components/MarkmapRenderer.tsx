
'use client';

import React, { useEffect, useRef } from 'react';
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';

interface MarkmapRendererProps {
  content: string;
  theme?: 'light' | 'dark';
}

const MarkmapRenderer: React.FC<MarkmapRendererProps> = ({ content, theme = 'light' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const markmapRef = useRef<Markmap | null>(null);
  const transformerRef = useRef<Transformer>(new Transformer());

  // 1. Initialize Markmap instance
  useEffect(() => {
    if (!svgRef.current) return;

    if (!markmapRef.current) {
      markmapRef.current = Markmap.create(svgRef.current, {
        autoFit: true,
        duration: 500,
        paddingX: 32,
      });
    }
  }, []);

  // 2. Handle Data Updates
  useEffect(() => {
    if (!markmapRef.current) return;

    const { root } = transformerRef.current.transform(content || '# Start Typing...');
    markmapRef.current.setData(root);
    
    // Ensure fit runs after data is set and rendered
    requestAnimationFrame(() => {
      markmapRef.current?.fit();
    });
  }, [content]);

  // 3. Handle Container Resizing (Sidebar toggle, window resize)
  useEffect(() => {
    if (!containerRef.current || !markmapRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      // Small delay to allow the layout to settle before refitting
      requestAnimationFrame(() => {
        markmapRef.current?.fit();
      });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // 4. Handle manual fit view events
  useEffect(() => {
    const handleFit = () => {
      markmapRef.current?.fit();
    };
    window.addEventListener('markmap-fit', handleFit);
    return () => window.removeEventListener('markmap-fit', handleFit);
  }, []);

  return (
    <div ref={containerRef} className={`w-full h-full markmap-container theme-${theme} relative overflow-hidden bg-white`}>
      <svg 
        ref={svgRef} 
        className="markmap" 
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      <div className="absolute bottom-4 left-4 flex gap-2 pointer-events-none z-10">
        <div className="px-3 py-1 bg-white/50 backdrop-blur-sm rounded-full text-[8px] font-black text-slate-400 uppercase tracking-widest border border-slate-100">
           D3 Radial Engine v1.0
        </div>
      </div>
    </div>
  );
};

export default MarkmapRenderer;
