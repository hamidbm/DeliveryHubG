import React from 'react';

export type RoadmapViewKey = 'execution' | 'timeline' | 'swimlane' | 'dependency';

const tabs: Array<{ key: RoadmapViewKey; label: string }> = [
  { key: 'execution', label: 'Execution Board' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'swimlane', label: 'Swimlane' },
  { key: 'dependency', label: 'Dependency' }
];

const RoadmapTabs: React.FC<{
  active: RoadmapViewKey;
  onChange: (key: RoadmapViewKey) => void;
}> = ({ active, onChange }) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
              isActive ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export default RoadmapTabs;
