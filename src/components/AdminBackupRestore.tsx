import React from 'react';

type BackupSummary = {
  mode: string;
  collections: Record<string, { collection: string; creates: number; upserts: number; skipped: number; diffs: any[] }>;
  errors?: string[];
};

const DEFAULT_COLLECTIONS = [
  { key: 'policies', label: 'Delivery Policy' },
  { key: 'overrides', label: 'Policy Overrides' },
  { key: 'notification_settings', label: 'Notification Settings' },
  { key: 'notification_prefs', label: 'Notification User Prefs' },
  { key: 'bundles', label: 'Bundles' },
  { key: 'assignments', label: 'Bundle Assignments' },
  { key: 'milestones', label: 'Milestones' },
  { key: 'scope-requests', label: 'Scope Change Requests' }
];

const AdminBackupRestore: React.FC = () => {
  const [selected, setSelected] = React.useState<Record<string, boolean>>(
    DEFAULT_COLLECTIONS.reduce((acc, item) => ({ ...acc, [item.key]: ['policies', 'overrides', 'bundles', 'assignments', 'milestones', 'scope-requests'].includes(item.key) }), {})
  );
  const [exportJson, setExportJson] = React.useState('');
  const [exportLoading, setExportLoading] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [importJson, setImportJson] = React.useState('');
  const [importLoading, setImportLoading] = React.useState(false);
  const [importError, setImportError] = React.useState<string | null>(null);
  const [importResult, setImportResult] = React.useState<BackupSummary | null>(null);
  const [confirmPhrase, setConfirmPhrase] = React.useState('');
  const [applyMode, setApplyMode] = React.useState(false);
  const [options, setOptions] = React.useState({
    allowUpsert: true,
    overwritePolicies: false,
    overwriteOverrides: false
  });

  const buildInclude = () => Object.entries(selected).filter(([, value]) => value).map(([key]) => key);

  const handleExport = async () => {
    setExportLoading(true);
    setExportError(null);
    try {
      const include = buildInclude();
      const params = new URLSearchParams();
      if (include.length) params.set('include', include.join(','));
      const res = await fetch(`/api/admin/backup/export?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setExportError(data?.error || 'Export failed.');
        return;
      }
      const pretty = JSON.stringify(data, null, 2);
      setExportJson(pretty);
    } catch (err: any) {
      setExportError(err?.message || 'Export failed.');
    } finally {
      setExportLoading(false);
    }
  };

  const downloadExport = () => {
    if (!exportJson) return;
    const blob = new Blob([exportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deliveryhub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const runImport = async (mode: 'DRY_RUN' | 'APPLY') => {
    setImportLoading(true);
    setImportError(null);
    setImportResult(null);
    try {
      const bundle = JSON.parse(importJson);
      const res = await fetch('/api/admin/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundle,
          mode,
          options,
          confirmation: mode === 'APPLY' ? { phrase: confirmPhrase } : undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data?.error || 'Import failed.');
        return;
      }
      setImportResult(data);
    } catch (err: any) {
      setImportError(err?.message || 'Import failed.');
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <header className="px-12 py-10 border-b border-slate-100 bg-white sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
            <i className="fas fa-database text-xl"></i>
          </div>
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Admin • Operations</div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">Backup & Restore</h3>
            <p className="text-sm text-slate-500 font-medium mt-2">Export or restore configuration and planning metadata safely.</p>
          </div>
        </div>
      </header>

      <div className="p-12 space-y-10">
        <section className="border border-slate-100 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-600">Export</h4>
              <p className="text-xs text-slate-500">Select collections to export.</p>
            </div>
            <button
              onClick={handleExport}
              disabled={exportLoading}
              className="px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white disabled:opacity-50"
            >
              {exportLoading ? 'Exporting…' : 'Run Export'}
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-slate-600">
            {DEFAULT_COLLECTIONS.map((item) => (
              <label key={item.key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!selected[item.key]}
                  onChange={(e) => setSelected((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                />
                {item.label}
              </label>
            ))}
          </div>
          {exportError && <div className="text-sm text-rose-600">{exportError}</div>}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-slate-500">Export JSON</div>
              <button onClick={downloadExport} disabled={!exportJson} className="text-xs text-blue-600 hover:underline">
                Download
              </button>
            </div>
            <textarea
              value={exportJson}
              onChange={(e) => setExportJson(e.target.value)}
              rows={8}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-mono text-slate-700"
              placeholder="Export output will appear here."
            />
          </div>
        </section>

        <section className="border border-slate-100 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-600">Import</h4>
              <p className="text-xs text-slate-500">Paste a backup bundle and run dry-run or apply.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => runImport('DRY_RUN')}
                disabled={importLoading || !importJson.trim()}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 disabled:opacity-50"
              >
                Dry Run
              </button>
              <button
                onClick={() => runImport('APPLY')}
                disabled={importLoading || !importJson.trim() || confirmPhrase !== 'IMPORT_BACKUP'}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-rose-600 text-white disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-xs text-slate-600">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.allowUpsert}
                onChange={(e) => setOptions((prev) => ({ ...prev, allowUpsert: e.target.checked }))}
              />
              Allow upserts
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.overwritePolicies}
                onChange={(e) => setOptions((prev) => ({ ...prev, overwritePolicies: e.target.checked }))}
              />
              Overwrite policies
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.overwriteOverrides}
                onChange={(e) => setOptions((prev) => ({ ...prev, overwriteOverrides: e.target.checked }))}
              />
              Overwrite overrides
            </label>
          </div>
          <textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            rows={8}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-mono text-slate-700"
            placeholder="Paste backup JSON here."
          />
          <div className="flex items-center justify-between text-xs text-slate-500">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={applyMode}
                onChange={(e) => setApplyMode(e.target.checked)}
              />
              Show apply controls
            </label>
            {applyMode && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest">Type</span>
                <input
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  className="px-3 py-1 rounded-lg border border-slate-200 text-xs"
                  placeholder="IMPORT_BACKUP"
                />
              </div>
            )}
          </div>
          {importError && <div className="text-sm text-rose-600">{importError}</div>}
          {importResult && (
            <div className="border border-slate-100 rounded-2xl p-4 bg-white">
              <div className="text-xs font-semibold text-slate-500 mb-2">Result ({importResult.mode})</div>
              <div className="space-y-2 text-xs text-slate-600">
                {Object.values(importResult.collections || {}).map((entry) => (
                  <div key={entry.collection} className="flex items-center justify-between">
                    <span>{entry.collection}</span>
                    <span className="text-slate-500">create {entry.creates} • upsert {entry.upserts} • skipped {entry.skipped}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default AdminBackupRestore;

