import React from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { marked } from 'marked';

interface WorkItemAiPanelProps {
  aiResult: string | null;
  isAiProcessing: boolean;
  onRunTool: (endpoint: string) => void;
  onCommit: (value: string) => void;
  onDiscard: () => void;
}

const WorkItemAiPanel: React.FC<WorkItemAiPanelProps> = ({
  aiResult,
  isAiProcessing,
  onRunTool,
  onCommit,
  onDiscard
}) => {
  return (
    <div className="p-10 space-y-10 animate-fadeIn">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Work Plan', icon: 'fa-map-location-dot', endpoint: '/api/ai/refine-task' },
          { label: 'Standup Digest', icon: 'fa-microphone-lines', endpoint: '/api/ai/standup-digest' },
          { label: 'Load Rebalance', icon: 'fa-scale-balanced', endpoint: '/api/ai/suggest-reassignment' }
        ].map(tool => (
          <button
            key={tool.label}
            onClick={() => onRunTool(tool.endpoint)}
            disabled={isAiProcessing}
            className="bg-white border border-slate-100 p-6 rounded-[2rem] hover:shadow-2xl hover:shadow-blue-500/5 transition-all text-center group flex flex-col items-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl mb-4 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
              <i className={`fas ${tool.icon}`}></i>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{tool.label}</span>
          </button>
        ))}
      </div>

      <div className="bg-slate-900 rounded-[2.5rem] p-10 min-h-[400px] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <header className="flex items-center gap-4 mb-8">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
          <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">AI Intelligence Terminal</h4>
        </header>

        <div className="prose prose-invert max-w-none">
          {isAiProcessing ? (
            <div className="space-y-6">
              <div className="h-4 bg-white/5 rounded-full w-3/4 animate-pulse"></div>
              <div className="h-4 bg-white/5 rounded-full w-1/2 animate-pulse"></div>
              <div className="h-4 bg-white/5 rounded-full w-2/3 animate-pulse"></div>
            </div>
          ) : aiResult ? (
            <div className="text-blue-50/80 font-medium leading-relaxed selection:bg-blue-500/30" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(aiResult) as string) }} />
          ) : (
            <div className="py-20 flex flex-col items-center text-center opacity-40">
              <i className="fas fa-brain text-5xl text-blue-500/50 mb-6"></i>
              <p className="text-blue-100 font-bold uppercase tracking-widest text-xs">Awaiting Execution Command...</p>
            </div>
          )}
        </div>

        {aiResult && !isAiProcessing && (
          <div className="mt-10 pt-10 border-t border-white/5 flex justify-end gap-3">
            <button onClick={onDiscard} className="px-6 py-2 text-[10px] font-black text-slate-500 uppercase">Discard</button>
            <button onClick={() => onCommit(aiResult)} className="px-6 py-2 bg-blue-600 text-white text-[10px] font-black uppercase rounded-xl shadow-lg shadow-blue-500/20">Commit to Record</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkItemAiPanel;
