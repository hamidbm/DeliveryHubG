
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

const MindMapNode = ({ data }: NodeProps) => {
  const accentColor = data.style?.accent || '#3b82f6';
  const bgColor = data.style?.bg || '#ffffff';
  const textColor = data.style?.text || '#1e293b';

  return (
    <div 
      className="relative group min-w-[220px] max-w-[300px]"
      style={{
        backgroundColor: bgColor,
        color: textColor,
      }}
    >
      <div className="absolute inset-0 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 group-hover:shadow-xl group-hover:shadow-slate-200/50 transition-all duration-300"></div>
      
      {/* Accent Bar */}
      <div 
        className="absolute left-0 top-4 bottom-4 w-1.5 rounded-r-full z-10"
        style={{ backgroundColor: accentColor }}
      ></div>

      <div className="relative p-5 z-10">
        <div className="flex items-start gap-3 mb-3">
          {data.icon && (
            <span className="text-xl shrink-0 grayscale group-hover:grayscale-0 transition-all duration-300">
              {data.icon}
            </span>
          )}
          <div className="min-w-0">
            <h4 className="text-sm font-black tracking-tight leading-snug truncate">
              {data.label}
            </h4>
            {data.owner && (
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">
                {data.owner}
              </span>
            )}
          </div>
        </div>

        {(data.tags?.length > 0 || data.status || data.milestone) && (
          <div className="flex flex-wrap gap-1.5 pt-3 border-t border-slate-50">
            {data.status && (
              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[8px] font-black uppercase tracking-tighter border border-blue-100/50">
                {data.status.replace(/_/g, ' ')}
              </span>
            )}
            {data.milestone && (
              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 text-[8px] font-black uppercase tracking-tighter border border-amber-100/50">
                {data.milestone}
              </span>
            )}
            {data.tags?.map((tag: string) => (
              <span key={tag} className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-400 text-[8px] font-bold uppercase tracking-tighter border border-slate-200/30">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Top} className="opacity-0 pointer-events-none" />
      <Handle type="source" position={Position.Bottom} className="opacity-0 pointer-events-none" />
    </div>
  );
};

export default memo(MindMapNode);
