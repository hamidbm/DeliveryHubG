import React, { useEffect, useState } from 'react';
import { WatcherType } from '../../types/ai';

type Payload = {
  type: WatcherType;
  targetId: string;
  condition: Record<string, any>;
  enabled: boolean;
};

type Props = {
  initial?: Partial<Payload>;
  onSubmit: (payload: Payload) => Promise<void>;
  onCancel?: () => void;
};

const parseCondition = (raw: string) => {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const stringifyCondition = (value: Record<string, any> | undefined) => {
  try {
    return JSON.stringify(value || {}, null, 2);
  } catch {
    return '{}';
  }
};

const WatcherConfigForm: React.FC<Props> = ({ initial, onSubmit, onCancel }) => {
  const [type, setType] = useState<WatcherType>(initial?.type || 'trend');
  const [targetId, setTargetId] = useState(initial?.targetId || '');
  const [enabled, setEnabled] = useState(initial?.enabled !== false);
  const [conditionText, setConditionText] = useState(stringifyCondition(initial?.condition));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setType(initial?.type || 'trend');
    setTargetId(initial?.targetId || '');
    setEnabled(initial?.enabled !== false);
    setConditionText(stringifyCondition(initial?.condition));
  }, [initial]);

  const submit = async () => {
    if (!targetId.trim()) return;
    setBusy(true);
    try {
      await onSubmit({
        type,
        targetId: targetId.trim(),
        condition: parseCondition(conditionText),
        enabled
      });
      setTargetId('');
      setConditionText('{}');
      setType('trend');
      setEnabled(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">Watcher Config</p>
        {onCancel && (
          <button onClick={onCancel} className="text-xs font-semibold text-slate-600 hover:text-slate-800">Close</button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <label className="text-xs text-slate-600">
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value as WatcherType)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="alert">Alert</option>
            <option value="investigation">Investigation</option>
            <option value="trend">Trend</option>
            <option value="health">Health</option>
          </select>
        </label>
        <label className="text-xs text-slate-600">
          Target ID
          <input
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            placeholder="e.g. blockedWorkItems or healthScore"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <label className="text-xs text-slate-600 block">
        Condition JSON
        <textarea
          value={conditionText}
          onChange={(e) => setConditionText(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-mono"
        />
      </label>

      <label className="inline-flex items-center gap-2 text-xs text-slate-700">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Enabled
      </label>

      <div>
        <button
          onClick={submit}
          disabled={busy || !targetId.trim()}
          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? 'Saving...' : 'Save Watcher'}
        </button>
      </div>
    </section>
  );
};

export default WatcherConfigForm;
