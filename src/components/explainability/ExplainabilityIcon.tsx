import React, { useEffect, useRef, useState } from 'react';
import { EXPLAINABILITY_REGISTRY } from '../../lib/explainabilityRegistry';
import ExplainabilityPopover from './ExplainabilityPopover';
import ExplainabilityDrawer from './ExplainabilityDrawer';

type ExplainabilityIconProps = {
  explainabilityKey: string;
  size?: 'sm' | 'md';
};

const ExplainabilityIcon: React.FC<ExplainabilityIconProps> = ({ explainabilityKey, size = 'sm' }) => {
  const content = EXPLAINABILITY_REGISTRY[explainabilityKey];
  const [open, setOpen] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!ref.current) return;
      if (ref.current.contains(event.target as Node)) return;
      setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!content) return null;

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label={`Explain ${content.title}`}
        className={`rounded-full border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 transition ${
          size === 'sm' ? 'w-4 h-4 text-[10px]' : 'w-5 h-5 text-[11px]'
        } flex items-center justify-center`}
        onClick={() => setOpen((prev) => !prev)}
      >
        i
      </button>
      {open && (
        <ExplainabilityPopover
          content={content}
          onClose={() => setOpen(false)}
          onShowMore={() => {
            setOpen(false);
            setShowDrawer(true);
          }}
        />
      )}
      {showDrawer && (
        <ExplainabilityDrawer content={content} onClose={() => setShowDrawer(false)} />
      )}
    </div>
  );
};

export default ExplainabilityIcon;
