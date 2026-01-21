
import React, { memo } from 'react';
import { Handle, NodeProps } from 'reactflow';

const MindMapNode = ({ data, sourcePosition, targetPosition }: NodeProps) => {
  const accentColor = data.style?.accent || '#3b82f6';
  // Use 'background' instead of 'backgroundColor' to support linear-gradient strings
  const background = data.style?.bg || '#ffffff';
  const textColor = data.style?.text || '#1e293b';
  const isRoot = data.isRoot;

  return (
    <div 
      className={`relative flex flex-col justify-center rounded-2xl transition-all duration-500 overflow-hidden ${isRoot ? 'ring-4 ring-offset-4 ring-slate-100' : ''}`}
      style={{
        background: background,
        color: textColor,
        width: data.width || 220,
        height: data.height || 68,
        border: `1px solid ${data.style?.border || '#e2e8f0'}`,
        boxShadow: data.style?.shadow || '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        whiteSpace: 'pre-line' // Crucial for \n in labels
      }}
    >
      {/* Dynamic Accent Bar */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-1.5 z-10"
        style={{ backgroundColor: accentColor }}
      ></div>

      <div className="relative p-4 pl-6 z-10 flex flex-col justify-center h-full">
        <div className="flex items-center gap-3">
          {data.icon && (
            <span className="text-xl shrink-0 group-hover:scale-110 transition-transform">
              {data.icon}
            </span>
          )}
          <div className="min-w-0">
            <h4 
              className={`tracking-tight leading-tight ${data.style?.bold ? 'font-black' : 'font-bold'}`} 
              style={{ fontSize: data.style?.fontSize ? `${data.style.fontSize}px` : '13px' }}
            >
              {data.label}
            </h4>
            {data.owner && (
              <span className="text-[8px] font-black opacity-50 uppercase tracking-widest block mt-0.5">
                {data.owner}
              </span>
            )}
          </div>
        </div>

        {data.tags && data.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {data.tags.map((tag: string) => (
              <span key={tag} className="px-1.5 py-0.5 rounded-md bg-black/5 text-[7px] font-black uppercase tracking-tighter border border-black/5">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* React Flow Handles - Quadrant specific positions set by layout engine */}
      <Handle type="target" position={targetPosition} className="opacity-0 w-0 h-0" />
      <Handle type="source" position={sourcePosition} className="opacity-0 w-0 h-0" />
    </div>
  );
};

export default memo(MindMapNode);
