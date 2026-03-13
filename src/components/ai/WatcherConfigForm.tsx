import React, { useEffect, useState } from 'react';
import { PortfolioRiskSeverity, WatcherType } from '../../types/ai';

type Payload = {
  type: WatcherType;
  targetId: string;
  condition: Record<string, any>;
  enabled: boolean;
  deliveryPreferences?: {
    email?: {
      enabled: boolean;
      severityMin?: PortfolioRiskSeverity;
    };
    in_app?: {
      enabled: boolean;
    };
    slack?: {
      enabled: boolean;
      webhookUrl?: string;
      severityMin?: 'medium' | 'high' | 'critical';
    };
    teams?: {
      enabled: boolean;
      webhookUrl?: string;
      severityMin?: 'medium' | 'high' | 'critical';
    };
    digest?: {
      enabled: boolean;
      frequency: 'hourly' | 'daily';
    };
  };
};

type Props = {
  initial?: Partial<Payload>;
  usage?: { used: number; max: number };
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

const WatcherConfigForm: React.FC<Props> = ({ initial, usage, onSubmit, onCancel }) => {
  const [type, setType] = useState<WatcherType>(initial?.type || 'trend');
  const [targetId, setTargetId] = useState(initial?.targetId || '');
  const [enabled, setEnabled] = useState(initial?.enabled !== false);
  const [conditionText, setConditionText] = useState(stringifyCondition(initial?.condition));
  const initialDelivery = initial?.deliveryPreferences as NonNullable<Payload['deliveryPreferences']> | undefined;
  const [inAppEnabled, setInAppEnabled] = useState(initialDelivery?.in_app?.enabled !== false);
  const [emailEnabled, setEmailEnabled] = useState(Boolean(initialDelivery?.email?.enabled));
  const [emailSeverityMin, setEmailSeverityMin] = useState<PortfolioRiskSeverity>(
    (initialDelivery?.email?.severityMin as PortfolioRiskSeverity) || 'low'
  );
  const [slackEnabled, setSlackEnabled] = useState(Boolean(initialDelivery?.slack?.enabled));
  const [slackWebhookUrl, setSlackWebhookUrl] = useState(String(initialDelivery?.slack?.webhookUrl || ''));
  const [slackSeverityMin, setSlackSeverityMin] = useState<'medium' | 'high' | 'critical'>(
    (initialDelivery?.slack?.severityMin as 'medium' | 'high' | 'critical') || 'medium'
  );
  const [teamsEnabled, setTeamsEnabled] = useState(Boolean(initialDelivery?.teams?.enabled));
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState(String(initialDelivery?.teams?.webhookUrl || ''));
  const [teamsSeverityMin, setTeamsSeverityMin] = useState<'medium' | 'high' | 'critical'>(
    (initialDelivery?.teams?.severityMin as 'medium' | 'high' | 'critical') || 'medium'
  );
  const [digestEnabled, setDigestEnabled] = useState(Boolean(initialDelivery?.digest?.enabled));
  const [digestFrequency, setDigestFrequency] = useState<'hourly' | 'daily'>(
    (initialDelivery?.digest?.frequency as 'hourly' | 'daily') || 'daily'
  );
  const [busy, setBusy] = useState(false);
  const quotaUsed = Number(usage?.used || 0);
  const quotaMax = Number(usage?.max || 100);
  const quotaReached = quotaUsed >= quotaMax;

  useEffect(() => {
    setType(initial?.type || 'trend');
    setTargetId(initial?.targetId || '');
    setEnabled(initial?.enabled !== false);
    setConditionText(stringifyCondition(initial?.condition));
    const nextDelivery = initial?.deliveryPreferences || {};
    setInAppEnabled(nextDelivery.in_app?.enabled !== false);
    setEmailEnabled(Boolean(nextDelivery.email?.enabled));
    setEmailSeverityMin((nextDelivery.email?.severityMin as PortfolioRiskSeverity) || 'low');
    setSlackEnabled(Boolean(nextDelivery.slack?.enabled));
    setSlackWebhookUrl(String(nextDelivery.slack?.webhookUrl || ''));
    setSlackSeverityMin((nextDelivery.slack?.severityMin as 'medium' | 'high' | 'critical') || 'medium');
    setTeamsEnabled(Boolean(nextDelivery.teams?.enabled));
    setTeamsWebhookUrl(String(nextDelivery.teams?.webhookUrl || ''));
    setTeamsSeverityMin((nextDelivery.teams?.severityMin as 'medium' | 'high' | 'critical') || 'medium');
    setDigestEnabled(Boolean(nextDelivery.digest?.enabled));
    setDigestFrequency((nextDelivery.digest?.frequency as 'hourly' | 'daily') || 'daily');
  }, [initial]);

  const submit = async () => {
    if (!targetId.trim() || quotaReached) return;
    setBusy(true);
    try {
      await onSubmit({
        type,
        targetId: targetId.trim(),
        condition: parseCondition(conditionText),
        enabled,
        deliveryPreferences: {
          in_app: { enabled: inAppEnabled },
          email: {
            enabled: emailEnabled,
            severityMin: emailEnabled ? emailSeverityMin : undefined
          },
          slack: {
            enabled: slackEnabled,
            webhookUrl: slackEnabled ? slackWebhookUrl.trim() : undefined,
            severityMin: slackEnabled ? slackSeverityMin : undefined
          },
          teams: {
            enabled: teamsEnabled,
            webhookUrl: teamsEnabled ? teamsWebhookUrl.trim() : undefined,
            severityMin: teamsEnabled ? teamsSeverityMin : undefined
          },
          digest: {
            enabled: digestEnabled,
            frequency: digestFrequency
          }
        }
      });
      setTargetId('');
      setConditionText('{}');
      setType('trend');
      setEnabled(true);
      setInAppEnabled(true);
      setEmailEnabled(false);
      setEmailSeverityMin('low');
      setSlackEnabled(false);
      setSlackWebhookUrl('');
      setSlackSeverityMin('medium');
      setTeamsEnabled(false);
      setTeamsWebhookUrl('');
      setTeamsSeverityMin('medium');
      setDigestEnabled(false);
      setDigestFrequency('daily');
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

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">Delivery Preferences</p>
        <label className="inline-flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={inAppEnabled}
            onChange={(e) => setInAppEnabled(e.target.checked)}
          />
          Send in-app notifications
        </label>
        <label className="inline-flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={emailEnabled}
            onChange={(e) => setEmailEnabled(e.target.checked)}
          />
          Send email notifications
        </label>
        <label className="text-xs text-slate-600 block">
          Email Severity Minimum
          <select
            value={emailSeverityMin}
            onChange={(e) => setEmailSeverityMin(e.target.value as PortfolioRiskSeverity)}
            disabled={!emailEnabled}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:opacity-60"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={slackEnabled}
            onChange={(e) => setSlackEnabled(e.target.checked)}
          />
          Send Slack notifications
        </label>
        <label className="text-xs text-slate-600 block">
          Slack Webhook URL
          <input
            value={slackWebhookUrl}
            onChange={(e) => setSlackWebhookUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            disabled={!slackEnabled}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:opacity-60"
          />
        </label>
        <label className="text-xs text-slate-600 block">
          Slack Severity Minimum
          <select
            value={slackSeverityMin}
            onChange={(e) => setSlackSeverityMin(e.target.value as 'medium' | 'high' | 'critical')}
            disabled={!slackEnabled}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:opacity-60"
          >
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={teamsEnabled}
            onChange={(e) => setTeamsEnabled(e.target.checked)}
          />
          Send Teams notifications
        </label>
        <label className="text-xs text-slate-600 block">
          Teams Webhook URL
          <input
            value={teamsWebhookUrl}
            onChange={(e) => setTeamsWebhookUrl(e.target.value)}
            placeholder="https://outlook.office.com/webhook/..."
            disabled={!teamsEnabled}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:opacity-60"
          />
        </label>
        <label className="text-xs text-slate-600 block">
          Teams Severity Minimum
          <select
            value={teamsSeverityMin}
            onChange={(e) => setTeamsSeverityMin(e.target.value as 'medium' | 'high' | 'critical')}
            disabled={!teamsEnabled}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:opacity-60"
          >
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={digestEnabled}
            onChange={(e) => setDigestEnabled(e.target.checked)}
          />
          Send as digest
        </label>
        <label className="text-xs text-slate-600 block">
          Digest Frequency
          <select
            value={digestFrequency}
            onChange={(e) => setDigestFrequency(e.target.value as 'hourly' | 'daily')}
            disabled={!digestEnabled}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:opacity-60"
          >
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
          </select>
        </label>
      </div>

      <div>
        <button
          onClick={submit}
          disabled={busy || !targetId.trim() || quotaReached}
          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? 'Saving...' : 'Save Watcher'}
        </button>
        {quotaReached && (
          <p className="text-xs text-rose-600 mt-2">Watcher quota exceeded ({quotaUsed}/{quotaMax}). Delete or disable existing watchers before creating a new one.</p>
        )}
      </div>
    </section>
  );
};

export default WatcherConfigForm;
