'use client';

import React from 'react';
import { ExecutiveSummary, ForecastSignal, RiskPropagationSignal } from '../../types/ai';
import ExecutiveSummaryCard from './ExecutiveSummaryCard';
import ForecastPanel from './ForecastPanel';
import RiskPropagationPanel from './RiskPropagationPanel';

type ApiResponse = {
  status: 'success' | 'error';
  executiveSummary?: ExecutiveSummary;
  metadata?: {
    generatedAt?: string;
    freshnessStatus?: 'fresh' | 'stale';
    cached?: boolean;
  };
  error?: string;
};

type ForecastApiResponse = {
  status: 'success' | 'error';
  forecastSignals?: ForecastSignal[];
  error?: string;
};

type PropagationApiResponse = {
  status: 'success' | 'error';
  riskPropagationSignals?: RiskPropagationSignal[];
  error?: string;
};

const severityStyle = (severity: string) => {
  if (severity === 'critical') return 'bg-rose-50 border-rose-200 text-rose-700';
  if (severity === 'high') return 'bg-amber-50 border-amber-200 text-amber-700';
  if (severity === 'medium') return 'bg-sky-50 border-sky-200 text-sky-700';
  return 'bg-slate-50 border-slate-200 text-slate-700';
};

const ExecutiveInsightsPage: React.FC = () => {
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [summary, setSummary] = React.useState<ExecutiveSummary | null>(null);
  const [meta, setMeta] = React.useState<ApiResponse['metadata']>({});
  const [forecastSignals, setForecastSignals] = React.useState<ForecastSignal[]>([]);
  const [forecastLoading, setForecastLoading] = React.useState(false);
  const [forecastError, setForecastError] = React.useState('');
  const [propagationSignals, setPropagationSignals] = React.useState<RiskPropagationSignal[]>([]);
  const [propagationLoading, setPropagationLoading] = React.useState(false);
  const [propagationError, setPropagationError] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setForecastLoading(true);
    setPropagationLoading(true);
    setError('');
    setForecastError('');
    setPropagationError('');
    try {
      const [summaryRes, forecastRes, propagationRes] = await Promise.all([
        fetch('/api/ai/executive-summary'),
        fetch('/api/ai/portfolio-forecast'),
        fetch('/api/ai/risk-propagation')
      ]);
      const summaryData = await summaryRes.json() as ApiResponse;
      const forecastData = await forecastRes.json() as ForecastApiResponse;
      const propagationData = await propagationRes.json() as PropagationApiResponse;

      if (!summaryRes.ok) {
        setError(summaryData?.error || 'Failed to load executive insights.');
        setSummary(null);
      } else {
        setSummary(summaryData.executiveSummary || null);
        setMeta(summaryData.metadata || {});
      }

      if (!forecastRes.ok) {
        setForecastError(forecastData?.error || 'Failed to load forecast signals.');
        setForecastSignals([]);
      } else {
        setForecastSignals(Array.isArray(forecastData?.forecastSignals) ? forecastData.forecastSignals : []);
      }

      if (!propagationRes.ok) {
        setPropagationError(propagationData?.error || 'Failed to load propagation signals.');
        setPropagationSignals([]);
      } else {
        setPropagationSignals(Array.isArray(propagationData?.riskPropagationSignals) ? propagationData.riskPropagationSignals : []);
      }
    } catch {
      setError('Failed to load executive insights.');
      setSummary(null);
      setForecastError('Failed to load forecast signals.');
      setForecastSignals([]);
      setPropagationError('Failed to load propagation signals.');
      setPropagationSignals([]);
    } finally {
      setLoading(false);
      setForecastLoading(false);
      setPropagationLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const regenerate = async () => {
    setBusy(true);
    setError('');
    setForecastError('');
    setPropagationError('');
    try {
      const [summaryRes, forecastRes, propagationRes] = await Promise.all([
        fetch('/api/ai/executive-summary', { method: 'POST' }),
        fetch('/api/ai/portfolio-forecast', { method: 'POST' }),
        fetch('/api/ai/risk-propagation', { method: 'POST' })
      ]);
      const summaryData = await summaryRes.json() as ApiResponse;
      const forecastData = await forecastRes.json() as ForecastApiResponse;
      const propagationData = await propagationRes.json() as PropagationApiResponse;

      if (!summaryRes.ok) {
        setError(summaryData?.error || 'Failed to regenerate executive insights.');
      } else {
        setSummary(summaryData.executiveSummary || null);
        setMeta(summaryData.metadata || {});
      }

      if (!forecastRes.ok) {
        setForecastError(forecastData?.error || 'Failed to regenerate forecast signals.');
      } else {
        setForecastSignals(Array.isArray(forecastData?.forecastSignals) ? forecastData.forecastSignals : []);
      }

      if (!propagationRes.ok) {
        setPropagationError(propagationData?.error || 'Failed to regenerate propagation signals.');
      } else {
        setPropagationSignals(Array.isArray(propagationData?.riskPropagationSignals) ? propagationData.riskPropagationSignals : []);
      }
    } catch {
      setError('Failed to regenerate executive insights.');
      setForecastError('Failed to regenerate forecast signals.');
      setPropagationError('Failed to regenerate propagation signals.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Executive Insights</h1>
            <p className="text-sm text-slate-600 mt-1">Strategic portfolio summary derived from latest structured DeliveryHub signals.</p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100">Back</a>
            <button onClick={regenerate} disabled={busy} className="px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              {busy ? 'Regenerating...' : 'Regenerate'}
            </button>
          </div>
        </header>

        {meta?.generatedAt && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            Generated: {new Date(meta.generatedAt).toLocaleString()} {meta?.freshnessStatus === 'stale' ? '(stale)' : ''}
          </div>
        )}

        {loading && <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-slate-500">Loading executive summary...</div>}
        {!loading && error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 text-sm">{error}</div>}

        {!loading && !error && summary && (
          <>
            <ExecutiveSummaryCard summary={summary} />

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Active Alerts</p>
                {summary.topAlerts.length === 0 ? (
                  <p className="text-sm text-slate-500">No active alerts in the current executive window.</p>
                ) : (
                  <div className="space-y-2">
                    {summary.topAlerts.map((alert) => (
                      <article key={alert.id} className={`rounded-lg border p-3 ${severityStyle(alert.severity)}`}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm break-words">{alert.title}</p>
                          <span className="text-[10px] font-black uppercase tracking-widest">{alert.severity}</span>
                        </div>
                        <p className="text-xs mt-1 break-words">{alert.summary}</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Trend Highlights</p>
                {summary.trendHighlights.length === 0 ? (
                  <p className="text-sm text-slate-500">No significant trend changes detected.</p>
                ) : (
                  <div className="space-y-2">
                    {summary.trendHighlights.map((trend) => (
                      <article key={`${trend.metric}-${trend.direction}-${trend.delta}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm text-slate-800 break-words">{trend.metric}</p>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            {trend.direction} ({trend.delta >= 0 ? '+' : ''}{trend.delta})
                          </span>
                        </div>
                        {trend.summary && <p className="text-xs text-slate-600 mt-1 break-words">{trend.summary}</p>}
                        <p className="text-[11px] text-slate-500 mt-1">Window: {trend.timeframeDays} days</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <ForecastPanel
              signals={forecastSignals}
              loading={forecastLoading}
              error={forecastError}
            />

            <RiskPropagationPanel
              signals={propagationSignals}
              loading={propagationLoading}
              error={propagationError}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default ExecutiveInsightsPage;
