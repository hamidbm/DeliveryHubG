import React from 'react';
import { HealthScore } from '../../types/ai';

const scoreColor = (score: number) => {
  if (score >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (score >= 60) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
};

const Bar = ({ label, value }: { label: string; value: number }) => {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
        <span>{label}</span>
        <span className="font-semibold">{safe}/100</span>
      </div>
      <div className="h-2 rounded bg-slate-200 overflow-hidden">
        <div
          className={`h-full ${safe >= 80 ? 'bg-emerald-500' : safe >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
          style={{ width: `${safe}%` }}
        />
      </div>
    </div>
  );
};

const HealthScoreCard = ({
  score,
  onWatchThreshold
}: {
  score?: HealthScore;
  onWatchThreshold?: (threshold: number) => void;
}) => {
  if (!score) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
        Health score is not available for this report.
      </div>
    );
  }

  return (
    <article className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-800">Portfolio Health</p>
        <span className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-bold ${scoreColor(score.overall)}`}>
          {score.overall} / 100
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Bar label="Unassigned" value={score.components.unassigned} />
        <Bar label="Blocked" value={score.components.blocked} />
        <Bar label="Overdue" value={score.components.overdue} />
        <Bar label="Active" value={score.components.active} />
        <Bar label="Critical Apps" value={score.components.criticalApps} />
        <Bar label="Milestone Overdue" value={score.components.milestoneOverdue} />
      </div>
      {onWatchThreshold && (
        <div className="pt-1">
          <button
            onClick={() => onWatchThreshold(60)}
            className="px-2 py-1 rounded border border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700 hover:bg-blue-100"
          >
            Watch health {'<='} 60
          </button>
        </div>
      )}
    </article>
  );
};

export default HealthScoreCard;
