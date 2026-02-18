import React, { useEffect, useMemo, useState } from 'react';

const AdminAdmins: React.FC = () => {
  const [admins, setAdmins] = useState<any[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/admins');
      const data = await res.json();
      setAdmins(Array.isArray(data) ? data : []);
    } catch {
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const searchUsers = async (q: string) => {
    if (!q.trim()) {
      setUserResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setUserResults(Array.isArray(data) ? data : []);
    } catch {
      setUserResults([]);
    }
  };

  const handleAddAdmin = async () => {
    if (!selectedUser) return;
    await fetch('/api/admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: String(selectedUser._id || selectedUser.id) })
    });
    setSelectedUser(null);
    setUserQuery('');
    setUserResults([]);
    fetchAdmins();
  };

  const handleRemoveAdmin = async (userId: string) => {
    await fetch(`/api/admin/admins/${encodeURIComponent(userId)}`, { method: 'DELETE' });
    fetchAdmins();
  };

  const adminUserIds = useMemo(() => new Set(admins.map((a) => String(a.userId))), [admins]);

  return (
    <div className="p-10 max-w-5xl mx-auto animate-fadeIn">
      <header className="mb-8">
        <h3 className="text-3xl font-black text-slate-900 tracking-tight">Admins</h3>
        <p className="text-slate-500 text-sm font-medium mt-2">Manage privileged admin access.</p>
      </header>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8">
        <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4">Add Admin</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">User</label>
            <input
              value={userQuery}
              onChange={(e) => {
                setUserQuery(e.target.value);
                searchUsers(e.target.value);
              }}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              placeholder="Search users..."
            />
            {userResults.length > 0 && (
              <div className="mt-2 border border-slate-200 rounded-xl max-h-40 overflow-y-auto bg-white">
                {userResults.map((u) => {
                  const uid = String(u._id || u.id);
                  return (
                    <button
                      key={uid}
                      onClick={() => {
                        setSelectedUser(u);
                        setUserQuery(u.name || u.email);
                        setUserResults([]);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
                    >
                      <div className="font-bold text-slate-700">
                        {u.name || 'User'} {adminUserIds.has(uid) && <span className="text-[10px] text-emerald-600 ml-2">(Admin)</span>}
                      </div>
                      <div className="text-[10px] text-slate-400">{u.email} · {u.role}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="text-right">
            <button
              onClick={handleAddAdmin}
              disabled={!selectedUser}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
            >
              Add Admin
            </button>
          </div>
        </div>
        {selectedUser && (
          <div className="mt-3 text-xs text-slate-500">
            Selected user: <span className="font-semibold">{selectedUser.name}</span> ({selectedUser.email})
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest">Admin Registry</h4>
          <span className="text-xs text-slate-400">{admins.length} admins</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400">
              <tr>
                <th className="px-6 py-3">User ID</th>
                <th className="px-6 py-3">Created At</th>
                <th className="px-6 py-3">Created By</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="px-6 py-6 text-center text-slate-400">Loading admins...</td>
                </tr>
              )}
              {!loading && admins.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-6 text-center text-slate-400">No admins found.</td>
                </tr>
              )}
              {!loading && admins.map((a) => (
                <tr key={String(a._id)} className="border-t border-slate-100">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-700">{a.user?.name || a.userId}</div>
                    {a.user?.email && <div className="text-[10px] text-slate-400">{a.user.email}</div>}
                  </td>
                  <td className="px-6 py-4 text-[11px] text-slate-400">
                    {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4 text-[11px] text-slate-400">{a.createdBy || 'system'}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleRemoveAdmin(String(a.userId))}
                      className="text-[10px] font-bold text-red-500 hover:text-red-600"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminAdmins;
