import React from 'react';

type NotificationSettings = {
  enabledTypes: Record<string, boolean>;
  routing: {
    includeAdmins: boolean;
    includeBundleOwners: boolean;
    includeActorOnBlocked: boolean;
  };
  digest: {
    enabled: boolean;
    cadence: 'DAILY';
    hourLocal: number;
  };
  updatedAt?: string;
  updatedBy?: string;
};

type NotificationSettingsPatch = Omit<Partial<NotificationSettings>, 'routing' | 'digest'> & {
  routing?: Partial<NotificationSettings['routing']>;
  digest?: Partial<NotificationSettings['digest']>;
};

const AdminNotificationPolicy: React.FC = () => {
  const [settings, setSettings] = React.useState<NotificationSettings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/notification-settings');
      const data = await res.json();
      if (res.ok) {
        setSettings(data?.settings || data);
      } else {
        setMessage(data?.error || 'Failed to load settings');
      }
    } catch (err: any) {
      setMessage(err?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { load(); }, []);

  const updateSetting = (patch: NotificationSettingsPatch) => {
    if (!settings) return;
    setSettings({
      ...settings,
      ...patch,
      routing: { ...settings.routing, ...patch.routing },
      digest: { ...settings.digest, ...patch.digest }
    });
  };

  const toggleType = (type: string) => {
    if (!settings) return;
    const next = { ...settings.enabledTypes, [type]: !settings.enabledTypes[type] };
    setSettings({ ...settings, enabledTypes: next });
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/notification-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (res.ok) {
        setSettings(data?.settings || settings);
        setMessage('Notification policy saved.');
      } else {
        setMessage(data?.error || 'Failed to save settings');
      }
    } catch (err: any) {
      setMessage(err?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-slate-400 text-sm">Loading notification policy…</div>;
  }

  if (!settings) {
    return <div className="p-12 text-slate-400 text-sm">No settings found.</div>;
  }

  const types = Object.keys(settings.enabledTypes || {}).sort();

  return (
    <div className="flex flex-col h-full bg-white">
      <header className="px-12 py-10 border-b border-slate-100 bg-white sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
            <i className="fas fa-bell text-xl"></i>
          </div>
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Admin • Settings</div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">Notification Policy</h3>
            <p className="text-sm text-slate-500 font-medium mt-2">Control global notification routing and digest behavior.</p>
          </div>
        </div>
      </header>

      <div className="p-12 space-y-8">
        {message && (
          <div className="bg-slate-50 border border-slate-200 text-slate-600 text-sm rounded-2xl px-4 py-3">
            {message}
          </div>
        )}

        <section className="bg-white border border-slate-200 rounded-3xl p-6">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Notification Types</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {types.map((type) => (
              <label key={type} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                <div className="text-sm font-semibold text-slate-700">{type}</div>
                <input type="checkbox" checked={Boolean(settings.enabledTypes[type])} onChange={() => toggleType(type)} />
              </label>
            ))}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-3xl p-6">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Routing Rules</div>
          <div className="flex flex-col gap-3 text-sm text-slate-600">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.routing.includeAdmins}
                onChange={(e) => updateSetting({ routing: { includeAdmins: e.target.checked } })}
              />
              Include Admin/CMO recipients
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.routing.includeBundleOwners}
                onChange={(e) => updateSetting({ routing: { includeBundleOwners: e.target.checked } })}
              />
              Include bundle owners
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.routing.includeActorOnBlocked}
                onChange={(e) => updateSetting({ routing: { includeActorOnBlocked: e.target.checked } })}
              />
              Include actor on readiness blocked
            </label>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-3xl p-6">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Digest</div>
          <div className="flex flex-col gap-4 text-sm text-slate-600">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.digest.enabled}
                onChange={(e) => updateSetting({ digest: { enabled: e.target.checked } })}
              />
              Enable daily digest
            </label>
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-500">Delivery hour (local)</label>
              <input
                type="number"
                min={0}
                max={23}
                value={settings.digest.hourLocal}
                onChange={(e) => updateSetting({ digest: { hourLocal: Number(e.target.value || 0) } })}
                className="w-20 px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
              <span className="text-xs text-slate-400">Cadence: {settings.digest.cadence}</span>
            </div>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl bg-slate-900 text-white shadow-lg hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Policy'}
          </button>
          <button
            onClick={load}
            disabled={saving}
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminNotificationPolicy;
