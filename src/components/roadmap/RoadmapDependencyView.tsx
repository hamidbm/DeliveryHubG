import React, { useMemo } from 'react';
import { buildDependencyGraph, RoadmapDependencyEdge, RoadmapMilestoneVM } from './roadmapViewModels';

const RoadmapDependencyView: React.FC<{
  milestones: RoadmapMilestoneVM[];
  dependencies: RoadmapDependencyEdge[];
}> = ({ milestones, dependencies }) => {
  const graph = useMemo(() => buildDependencyGraph(dependencies, milestones), [dependencies, milestones]);

  if (!milestones.length) {
    return <div className="text-sm text-slate-400">No milestones available for dependency view.</div>;
  }

  if (!dependencies.length) {
    return <div className="text-sm text-slate-400">No cross-milestone dependencies detected.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="text-[11px] text-slate-500">Milestone dependency map (aggregated).</div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {graph.nodes.map((node) => {
          const milestone = milestones.find((m) => m.id === node.id);
          const intel = milestone?.intelligence;
          return (
            <div key={`node-${node.id}`} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Milestone</div>
              <div className="text-sm font-semibold text-slate-700">{node.label}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-widest">
                <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                  Inbound {intel?.dependencyInbound ?? 0}
                </span>
                <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                  Outbound {intel?.dependencyOutbound ?? 0}
                </span>
                <span className={`px-2 py-1 rounded-full ${
                  intel?.riskLevel === 'HIGH' ? 'bg-rose-50 text-rose-700' :
                  intel?.riskLevel === 'MEDIUM' ? 'bg-amber-50 text-amber-700' :
                  'bg-emerald-50 text-emerald-700'
                }`}>
                  Risk {intel?.riskLevel || '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {graph.edges.map((edge) => {
          const from = graph.nodes.find((n) => n.id === edge.fromMilestoneId);
          const to = graph.nodes.find((n) => n.id === edge.toMilestoneId);
          return (
            <div key={`${edge.fromMilestoneId}-${edge.toMilestoneId}`} className="border border-slate-200 rounded-2xl p-4 bg-white">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Dependency</div>
              <div className="text-sm font-semibold text-slate-700">{from?.label || edge.fromMilestoneId} → {to?.label || edge.toMilestoneId}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-widest">
                <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700">Links {edge.count}</span>
                <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">Blockers {edge.blockerCount}</span>
                <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">Blocked {edge.blockedCount}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RoadmapDependencyView;
