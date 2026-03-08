import React from 'react';
import type { ApplicationPlanningMetadata } from '../../types';

interface ScheduleDefaultsPanelProps {
  metadata: ApplicationPlanningMetadata;
  editable?: boolean;
  onPlanningDefaultsChange?: (updates: Partial<NonNullable<ApplicationPlanningMetadata['planningDefaults']>>) => void;
  onCapacityDefaultsChange?: (updates: Partial<NonNullable<ApplicationPlanningMetadata['capacityDefaults']>>) => void;
  onNotesChange?: (value: string | null) => void;
  derivedMilestoneDurationWeeks?: number | null;
  inheritance?: {
    planningDefaults?: Record<string, boolean>;
    capacityDefaults?: Record<string, boolean>;
    notes?: boolean;
  };
}

const ScheduleDefaultsPanel: React.FC<ScheduleDefaultsPanelProps> = ({
  metadata,
  editable,
  onPlanningDefaultsChange,
  onCapacityDefaultsChange,
  onNotesChange,
  derivedMilestoneDurationWeeks,
  inheritance
}) => {
  const planning = metadata.planningDefaults || {};
  const capacity = metadata.capacityDefaults || {};
  const showInherited = (flag?: boolean) => flag ? <div className="text-[9px] uppercase tracking-widest text-slate-400">inherited</div> : null;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Planning Defaults</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
          <label className="space-y-1">Milestones
            {editable ? (
              <input type="number" min={1} value={planning.milestoneCount ?? ''} onChange={(e) => onPlanningDefaultsChange?.({ milestoneCount: e.target.value ? Number(e.target.value) : null })} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs" />
            ) : (
              <div className="space-y-1">
                <div className="text-slate-700">{planning.milestoneCount ?? '—'}</div>
                {showInherited(inheritance?.planningDefaults?.milestoneCount)}
              </div>
            )}
          </label>
          <label className="space-y-1">Sprint Duration (weeks)
            {editable ? (
              <input type="number" min={1} value={planning.sprintDurationWeeks ?? ''} onChange={(e) => onPlanningDefaultsChange?.({ sprintDurationWeeks: e.target.value ? Number(e.target.value) : null })} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs" />
            ) : (
              <div className="space-y-1">
                <div className="text-slate-700">{planning.sprintDurationWeeks ?? '—'}</div>
                {showInherited(inheritance?.planningDefaults?.sprintDurationWeeks)}
              </div>
            )}
          </label>
          <label className="space-y-1">Milestone Duration (weeks)
            <div className="space-y-1">
              <div className="text-slate-700">{typeof derivedMilestoneDurationWeeks === 'number' ? derivedMilestoneDurationWeeks : (planning.milestoneDurationWeeks ?? '—')}</div>
              {showInherited(inheritance?.planningDefaults?.milestoneDurationWeeks)}
              <div className="text-[10px] text-slate-400">Derived from timeline</div>
            </div>
          </label>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Capacity Defaults</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
          <label className="space-y-1">Capacity Model
            {editable ? (
              <select value={capacity.capacityModel || ''} onChange={(e) => onCapacityDefaultsChange?.({ capacityModel: e.target.value ? (e.target.value as any) : null })} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs">
                <option value="">Select</option>
                <option value="TEAM_VELOCITY">Team velocity</option>
                <option value="DIRECT_SPRINT_CAPACITY">Direct sprint capacity</option>
              </select>
            ) : (
              <div className="space-y-1">
                <div className="text-slate-700">{capacity.capacityModel || '—'}</div>
                {showInherited(inheritance?.capacityDefaults?.capacityModel)}
              </div>
            )}
          </label>
          <label className="space-y-1">Teams
            {editable ? (
              <input type="number" min={1} value={capacity.deliveryTeams ?? ''} onChange={(e) => onCapacityDefaultsChange?.({ deliveryTeams: e.target.value ? Number(e.target.value) : null })} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs" />
            ) : (
              <div className="space-y-1">
                <div className="text-slate-700">{capacity.deliveryTeams ?? '—'}</div>
                {showInherited(inheritance?.capacityDefaults?.deliveryTeams)}
              </div>
            )}
          </label>
          <label className="space-y-1">Velocity / Team
            {editable ? (
              <input type="number" min={1} value={capacity.sprintVelocityPerTeam ?? ''} onChange={(e) => onCapacityDefaultsChange?.({ sprintVelocityPerTeam: e.target.value ? Number(e.target.value) : null })} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs" />
            ) : (
              <div className="space-y-1">
                <div className="text-slate-700">{capacity.sprintVelocityPerTeam ?? '—'}</div>
                {showInherited(inheritance?.capacityDefaults?.sprintVelocityPerTeam)}
              </div>
            )}
          </label>
          <label className="space-y-1">Direct Sprint Capacity
            {editable ? (
              <input type="number" min={1} value={capacity.directSprintCapacity ?? ''} onChange={(e) => onCapacityDefaultsChange?.({ directSprintCapacity: e.target.value ? Number(e.target.value) : null })} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs" />
            ) : (
              <div className="space-y-1">
                <div className="text-slate-700">{capacity.directSprintCapacity ?? '—'}</div>
                {showInherited(inheritance?.capacityDefaults?.directSprintCapacity)}
              </div>
            )}
          </label>
          <label className="space-y-1">Team Size
            {editable ? (
              <input type="number" min={1} value={capacity.teamSize ?? ''} onChange={(e) => onCapacityDefaultsChange?.({ teamSize: e.target.value ? Number(e.target.value) : null })} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs" />
            ) : (
              <div className="space-y-1">
                <div className="text-slate-700">{capacity.teamSize ?? '—'}</div>
                {showInherited(inheritance?.capacityDefaults?.teamSize)}
              </div>
            )}
          </label>
          <label className="space-y-1">Project Size
            {editable ? (
              <select value={capacity.projectSize || ''} onChange={(e) => onCapacityDefaultsChange?.({ projectSize: e.target.value ? (e.target.value as any) : null })} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs">
                <option value="">Select</option>
                <option value="SMALL">Small</option>
                <option value="MEDIUM">Medium</option>
                <option value="LARGE">Large</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
            ) : (
              <div className="space-y-1">
                <div className="text-slate-700">{capacity.projectSize || '—'}</div>
                {showInherited(inheritance?.capacityDefaults?.projectSize)}
              </div>
            )}
          </label>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notes</div>
        {editable ? (
          <textarea
            value={metadata.notes || ''}
            onChange={(e) => onNotesChange?.(e.target.value || null)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs min-h-[90px]"
          />
        ) : (
          <div className="space-y-1">
            <div className="text-sm text-slate-600 whitespace-pre-wrap">{metadata.notes || '—'}</div>
            {showInherited(inheritance?.notes)}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScheduleDefaultsPanel;
