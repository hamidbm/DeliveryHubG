
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

const MindMapNode = ({ data, sourcePosition, targetPosition }: NodeProps) => {
  const accentColor = data.style?.accent || '#3b82f6';
  const background = data.style?.bg || '#ffffff';
  const textColor = data.style?.text || '#1e293b';
  const isRoot = data.isRoot;

  return (
    <div 
      className={`relative flex flex-col justify-center rounded-2xl transition-all duration-300 ${isRoot ? 'ring-4 ring-blue-500/20 shadow-2xl' : 'shadow-lg'}`}
      style={{
        background: background, // Using background instead of backgroundColor for gradients
        color: textColor,
        width: data.width || 220,
        height: data.height || 68,
        border: `1px solid ${data.style?.border || '#e2e8f0'}`,
      }}
    >
      {/* Visual Accent Bar */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl z-10"
        style={{ backgroundColor: accentColor }}
      ></div>

      <div className="p-3 pl-5 z-10 flex flex-col justify-center h-full overflow-hidden">
        <div className="flex items-center gap-2">
          {data.icon && <span className="text-xl shrink-0">{data.icon}</span>}
          <div className="min-w-0 flex-1">
            <h4 
              className={`text-sm leading-tight whitespace-pre-line truncate-multiline ${data.style?.bold ? 'font-black' : 'font-bold'}`}
              style={{ 
                fontSize: data.style?.fontSize ? `${data.style.fontSize}px` : '13px',
                lineHeight: '1.2'
              }}
            >
              {data.label}
            </h4>
          </div>
        </div>

        {data.tags && data.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5 overflow-hidden">
            {data.tags.map((tag: string) => (
              <span 
                key={tag} 
                className="px-1.5 py-0.5 rounded-md bg-black/5 text-[7px] font-black uppercase tracking-tighter border border-black/5 whitespace-nowrap"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Logic Handles - hidden but functional for Bezier routing */}
      <Handle type="target" position={targetPosition || Position.Top} className="w-0 h-0 border-none bg-transparent opacity-0" />
      <Handle type="source" position={sourcePosition || Position.Bottom} className="w-0 h-0 border-none bg-transparent opacity-0" />
      
      <style dangerouslySetInnerHTML={{ __html: `
        .truncate-multiline {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}} />
    </div>
  );
};

export default memo(MindMapNode);
