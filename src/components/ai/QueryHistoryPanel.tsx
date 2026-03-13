import React from 'react';
import { PortfolioQueryResponse } from '../../types/ai';

export type QueryHistoryItem = {
  id: string;
  question: string;
  timestamp: string;
  result: PortfolioQueryResponse;
};

const QueryHistoryPanel: React.FC<{
  items: QueryHistoryItem[];
  onRunAgain: (question: string) => void;
  onSave: (item: QueryHistoryItem) => void;
}> = ({ items, onRunAgain, onSave }) => {
  if (!items.length) return null;
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-3">Query History</h3>
      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
        {items.map((item) => (
          <div key={item.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
            <p className="text-sm font-semibold text-slate-800 break-words">{item.question}</p>
            <p className="text-xs text-slate-600 mt-1 line-clamp-2">{item.result.answer}</p>
            <p className="text-[11px] text-slate-500 mt-1">{new Date(item.timestamp).toLocaleString()}</p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => onRunAgain(item.question)}
                className="px-2 py-1 rounded border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Run again
              </button>
              <button
                onClick={() => onSave(item)}
                className="px-2 py-1 rounded border border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                Save investigation
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default QueryHistoryPanel;
