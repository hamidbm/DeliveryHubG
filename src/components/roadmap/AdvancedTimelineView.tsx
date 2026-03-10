import React, { useMemo, useRef, useState } from 'react';
import type { MilestoneForecast, MilestoneProbabilisticForecast, PlanningEnvironmentEntry } from '../../types';
import type { RoadmapMilestoneVM, RoadmapDependencyEdge, MilestoneIntelligence } from './roadmapViewModels';
import TimelineZoomControls, { TimelineZoomLevel } from './TimelineZoomControls';
import TimelineGrid from './TimelineGrid';
import MilestoneBar from './MilestoneBar';
import DependencyLayer from './DependencyLayer';
import EnvironmentOverlay from './EnvironmentOverlay';

type Bounds = { min: number; max: number; span: number };
type GroupBy = 'none' | 'application' | 'bundle' | 'owner' | 'theme';

const zoomPixels: Record<TimelineZoomLevel, number> = {
  quarter: 2,
  month: 4,
  sprint: 8,
  week: 14
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const startOfQuarter = (date: Date) => new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);

const formatMonth = (date: Date) => date.toLocaleString('en-US', { month: 'short' });
const formatQuarter = (date: Date) => `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
const formatWeek = (date: Date) => `${formatMonth(date)} ${date.getDate()}`;

const buildTicks = (bounds: Bounds, zoom: TimelineZoomLevel, width: number) => {
  const ticks: Array<{ date: Date; label: string; left: number }> = [];
  if (!bounds) return ticks;
  const minDate = new Date(bounds.min);
  const maxDate = new Date(bounds.max);
  let cursor: Date;
  if (zoom === 'quarter') {
    cursor = startOfQuarter(minDate);
    while (cursor <= maxDate) {
      const left = ((cursor.getTime() - bounds.min) / bounds.span) * width;
      ticks.push({ date: new Date(cursor), label: formatQuarter(cursor), left });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 3, 1);
    }
  } else if (zoom === 'month') {
    cursor = startOfMonth(minDate);
    while (cursor <= maxDate) {
      const left = ((cursor.getTime() - bounds.min) / bounds.span) * width;
      ticks.push({ date: new Date(cursor), label: `${formatMonth(cursor)} ${cursor.getFullYear()}`, left });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  } else if (zoom === 'sprint') {
    cursor = new Date(minDate);
    while (cursor <= maxDate) {
      const left = ((cursor.getTime() - bounds.min) / bounds.span) * width;
      ticks.push({ date: new Date(cursor), label: `Sprint ${formatWeek(cursor)}`, left });
      cursor = new Date(cursor.getTime() + 14 * 24 * 60 * 60 * 1000);
    }
  } else {
    cursor = new Date(minDate);
    while (cursor <= maxDate) {
      const left = ((cursor.getTime() - bounds.min) / bounds.span) * width;
      ticks.push({ date: new Date(cursor), label: formatWeek(cursor), left });
      cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }
  return ticks;
};

const computeBounds = (
  milestones: RoadmapMilestoneVM[],
  forecastByMilestone: Record<string, MilestoneForecast>,
  probabilisticByMilestone: Record<string, MilestoneProbabilisticForecast>
) => {
  let min = Infinity;
  let max = -Infinity;
  milestones.forEach((m) => {
    if (m.startDate) min = Math.min(min, new Date(m.startDate).getTime());
    if (m.endDate) max = Math.max(max, new Date(m.endDate).getTime());
    const deterministic = forecastByMilestone[m.id];
    if (deterministic) {
      min = Math.min(min, new Date(deterministic.bestCaseDate).getTime());
      max = Math.max(max, new Date(deterministic.worstCaseDate).getTime());
    }
    const probabilistic = probabilisticByMilestone[m.id];
    if (probabilistic) {
      min = Math.min(min, new Date(probabilistic.p50Date).getTime());
      max = Math.max(max, new Date(probabilistic.p90Date).getTime());
    }
  });
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return null;
  return { min, max, span: max - min };
};

const AdvancedTimelineView: React.FC<{
  milestones: RoadmapMilestoneVM[];
  dependencies: RoadmapDependencyEdge[];
  intelligenceByMilestone?: Record<string, MilestoneIntelligence>;
  forecastByMilestone?: Record<string, MilestoneForecast>;
  probabilisticForecastByMilestone?: Record<string, MilestoneProbabilisticForecast>;
  environments?: PlanningEnvironmentEntry[];
  goLiveDate?: string | null;
}> = ({
  milestones,
  dependencies,
  intelligenceByMilestone = {},
  forecastByMilestone = {},
  probabilisticForecastByMilestone = {},
  environments = [],
  goLiveDate
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState<TimelineZoomLevel>('month');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const bounds = useMemo(() => computeBounds(milestones, forecastByMilestone, probabilisticForecastByMilestone), [
    milestones,
    forecastByMilestone,
    probabilisticForecastByMilestone
  ]);

  const width = useMemo(() => {
    if (!bounds) return 800;
    const days = Math.max(1, bounds.span / (1000 * 60 * 60 * 24));
    return Math.max(900, Math.round(days * zoomPixels[zoom]));
  }, [bounds, zoom]);

  const rows = useMemo(() => {
    const sorted = [...milestones].sort((a, b) => {
      const aDate = a.startDate ? new Date(a.startDate).getTime() : 0;
      const bDate = b.startDate ? new Date(b.startDate).getTime() : 0;
      return aDate - bDate;
    });
    return sorted;
  }, [milestones]);

  const groupedRows = useMemo(() => {
    if (groupBy === 'none') {
      return [{ id: 'all', label: 'All Milestones', milestones: rows }];
    }
    const map = new Map<string, { id: string; label: string; milestones: RoadmapMilestoneVM[] }>();
    rows.forEach((m) => {
      let key = 'Unassigned';
      if (groupBy === 'application') key = m.applicationId || 'Unassigned';
      if (groupBy === 'bundle') key = m.bundleId || 'Unassigned';
      if (groupBy === 'owner') key = m.ownerEmail || 'Unassigned';
      if (groupBy === 'theme') key = m.themeLabel || m.name || 'Unassigned';
      if (!map.has(key)) {
        const labelPrefix = groupBy === 'application' ? 'Application'
          : groupBy === 'bundle' ? 'Bundle'
            : groupBy === 'owner' ? 'Owner'
              : groupBy === 'theme' ? 'Theme'
                : 'Group';
        map.set(key, { id: key, label: `${labelPrefix}: ${key}`, milestones: [] });
      }
      map.get(key)!.milestones.push(m);
    });
    return Array.from(map.values());
  }, [rows, groupBy]);

  if (!milestones.length) {
    return <div className="text-sm text-slate-400">No milestones available for timeline view.</div>;
  }

  if (!bounds) {
    return <div className="text-sm text-slate-400">Timeline bounds unavailable.</div>;
  }

  const renderRows = useMemo(() => {
    let cursor = 0;
    const rowsToRender: Array<{ type: 'label' | 'milestone'; id: string; label?: string; milestone?: RoadmapMilestoneVM; top: number }> = [];
    groupedRows.forEach((group) => {
      rowsToRender.push({ type: 'label', id: `label-${group.id}`, label: group.label, top: 20 + cursor * 48 });
      cursor += 1;
      group.milestones.forEach((milestone) => {
        rowsToRender.push({ type: 'milestone', id: milestone.id, milestone, top: 20 + cursor * 48 });
        cursor += 1;
      });
    });
    return rowsToRender;
  }, [groupedRows]);

  const positions = useMemo(() => {
    const map: Record<string, { id: string; xStart: number; xEnd: number; y: number }> = {};
    if (!bounds) return map;
    renderRows.forEach((row) => {
      if (row.type !== 'milestone' || !row.milestone) return;
      const m = row.milestone;
      const start = m.startDate ? new Date(m.startDate).getTime() : bounds.min;
      const end = m.endDate ? new Date(m.endDate).getTime() : bounds.max;
      const left = ((start - bounds.min) / bounds.span) * width;
      const right = ((end - bounds.min) / bounds.span) * width;
      map[m.id] = { id: m.id, xStart: left, xEnd: right, y: row.top + 9 };
    });
    return map;
  }, [renderRows, bounds, width]);

  const ticks = buildTicks(bounds, zoom, width);
  const totalRows = groupedRows.reduce((acc, group) => acc + group.milestones.length, 0);
  const timelineHeight = 140 + totalRows * 48 + groupedRows.length * 24;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-slate-500">
          Timeline spans {new Date(bounds.min).toISOString().split('T')[0]} → {new Date(bounds.max).toISOString().split('T')[0]}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="bg-slate-50 border border-slate-200 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500"
          >
            <option value="none">Group: None</option>
            <option value="application">Group: Application</option>
            <option value="bundle">Group: Bundle</option>
            <option value="owner">Group: Owner</option>
            <option value="theme">Group: Theme</option>
          </select>
          <TimelineZoomControls zoom={zoom} onChange={setZoom} />
        </div>
      </div>

      <div ref={containerRef} className="border border-slate-200 rounded-3xl bg-white overflow-x-auto">
        <div className="relative p-6" style={{ width }}>
          <div className="relative mb-6">
            <TimelineGrid width={width} height={40} ticks={ticks} />
          </div>

          <EnvironmentOverlay environments={environments} bounds={bounds} width={width} goLiveDate={goLiveDate} />

          <div className="relative mt-6" style={{ height: timelineHeight }}>
            <DependencyLayer width={width} height={timelineHeight} edges={dependencies} positions={positions} />
            {renderRows.map((row) => {
              if (row.type === 'label') {
                return (
                  <div key={row.id} className="absolute left-0 right-0" style={{ top: row.top }}>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{row.label}</div>
                  </div>
                );
              }
              const milestone = row.milestone!;
              const start = milestone.startDate ? new Date(milestone.startDate).getTime() : bounds.min;
              const end = milestone.endDate ? new Date(milestone.endDate).getTime() : bounds.max;
              const left = ((start - bounds.min) / bounds.span) * width;
              const barWidth = Math.max(6, ((end - start) / bounds.span) * width);
              const probabilistic = probabilisticForecastByMilestone[milestone.id];
              const forecastLeft = probabilistic
                ? ((new Date(probabilistic.p50Date).getTime() - bounds.min) / bounds.span) * width
                : null;
              const forecastWidth = probabilistic
                ? ((new Date(probabilistic.p90Date).getTime() - new Date(probabilistic.p50Date).getTime()) / bounds.span) * width
                : null;

              return (
                <div key={row.id} className="absolute left-0 right-0" style={{ top: row.top, height: 18 }}>
                  <MilestoneBar
                    milestone={milestone}
                    intelligence={intelligenceByMilestone[milestone.id]}
                    forecast={forecastByMilestone[milestone.id]}
                    probabilistic={probabilistic}
                    left={left}
                    width={barWidth}
                    height={18}
                    forecastLeft={forecastLeft}
                    forecastWidth={forecastWidth}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedTimelineView;
