import React from 'react';
import type { PortfolioDependencyGraph } from './portfolioViewModels';

const riskDot = (risk?: string) => {
  if (risk === 'HIGH') return 'bg-rose-500';
  if (risk === 'MEDIUM') return 'bg-amber-400';
  return 'bg-emerald-400';
};

const PortfolioDependencyView: React.FC<{ graph: PortfolioDependencyGraph }> = ({ graph }) => {
  if (!graph.nodes.length) {
    return <div className="text-sm text-slate-500">No dependency data available.</div>;
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Milestone Nodes</h3>
        <div className="space-y-2">
          {graph.nodes.map((node) => (
            <div key={node.id} className="flex items-center justify-between bg-white border border-slate-100 rounded-xl px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${riskDot(node.riskLevel)}`}></span>
                <div>
                  <div className="text-sm font-semibold text-slate-800">{node.label}</div>
                  <div className="text-[10px] text-slate-500">{node.planName}</div>
                </div>
              </div>
              <div className="text-[10px] text-slate-500">
                In {node.inbound} · Out {node.outbound}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Dependency Edges</h3>
        <div className="space-y-2">
          {graph.edges.length === 0 ? (
            <div className="text-sm text-slate-500">No cross-plan dependency edges found.</div>
          ) : (
            graph.edges.map((edge, idx) => {
              const from = graph.nodes.find((n) => n.id === edge.fromMilestoneId);
              const to = graph.nodes.find((n) => n.id === edge.toMilestoneId);
              return (
                <div key={`${edge.fromMilestoneId}-${edge.toMilestoneId}-${idx}`} className="bg-white border border-slate-100 rounded-xl px-3 py-2">
                  <div className="text-sm text-slate-700">
                    {from?.label || edge.fromMilestoneId} → {to?.label || edge.toMilestoneId}
                  </div>
                  <div className="text-[10px] text-slate-500">Links: {edge.count}</div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default PortfolioDependencyView;
