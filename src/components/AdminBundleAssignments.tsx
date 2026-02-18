import React, { useEffect, useMemo, useState } from 'react';
import { AssignmentType, BundleAssignment } from '../types';

const ASSIGNMENT_TYPES: AssignmentType[] = [
  'assigned_cmo',
  'cmo_reviewer',
  'bundle_owner',
  'svp',
  'observer'
];

const AdminBundleAssignments: React.FC = () => {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [bundles, setBundles] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<BundleAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    bundleId: 'all',
    userId: '',
    type: 'all',
    active: 'true'
  });

  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  const [form, setForm] = useState({
    bundleId: '',
    assignmentType: 'assigned_cmo' as AssignmentType,
    active: true,
    isPrimary: false,
    startAt: '',
    endAt: '',
    notes: ''
  });

  const userMap = useMemo(() => {
    const map = new Map<string, any>();
    userResults.forEach((u) => map.set(String(u._id || u.id), u));
    return map;
  }, [userResults]);

  const fetchAdminStatus = async () => {
    try {
      const res = await fetch('/api/admin/check');
      if (!res.ok) {
        setIsAdmin(false);
        return;
      }
      const data = await res.json();
      setIsAdmin(Boolean(data?.isAdmin));
    } catch {
      setIsAdmin(false);
    }
  };

  const fetchBundles = async () => {
    try {
      const res = await fetch('/api/bundles?active=true');
      const data = await res.json();
      setBundles(Array.isArray(data) ? data : []);
    } catch {
      setBundles([]);
    }
  };

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.bundleId && filters.bundleId !== 'all') params.set('bundleId', filters.bundleId);
      if (filters.userId) params.set('userId', filters.userId);
      if (filters.type && filters.type !== 'all') params.set('type', filters.type);
      if (filters.active !== '') params.set('active', filters.active);
      const res = await fetch(`/api/admin/bundle-assignments?${params.toString()}`);
      const data = await res.json();
      setAssignments(Array.isArray(data) ? data : []);
    } catch {
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminStatus();
    fetchBundles();
  }, []);

  useEffect(() => {
    if (isAdmin) fetchAssignments();
  }, [isAdmin, filters]);

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

  const handleCreate = async () => {
    if (!form.bundleId || !selectedUser) return;
    const payload = {
      bundleId: form.bundleId,
      userId: String(selectedUser._id || selectedUser.id),
      assignmentType: form.assignmentType,
      active: form.active,
      isPrimary: form.isPrimary,
      startAt: form.startAt ? new Date(form.startAt).toISOString() : undefined,
      endAt: form.endAt ? new Date(form.endAt).toISOString() : undefined,
      notes: form.notes || undefined
    };
    const res = await fetch('/api/admin/bundle-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      setForm({
        bundleId: '',
        assignmentType: 'assigned_cmo',
        active: true,
        isPrimary: false,
        startAt: '',
        endAt: '',
        notes: ''
      });
      setSelectedUser(null);
      setUserQuery('');
      setUserResults([]);
      fetchAssignments();
    }
  };

  const toggleActive = async (assignment: BundleAssignment) => {
    if (!assignment._id) return;
    await fetch(`/api/admin/bundle-assignments/${assignment._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !assignment.active })
    });
    fetchAssignments();
  };

  const togglePrimary = async (assignment: BundleAssignment) => {
    if (!assignment._id) return;
    await fetch(`/api/admin/bundle-assignments/${assignment._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPrimary: !assignment.isPrimary })
    });
    fetchAssignments();
  };

  if (isAdmin === false) {
    return (
      <div className="p-12">
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
          You do not have access to Bundle Assignments.
        </div>
      </div>
    );
  }

  return (
    <div className="p-10 max-w-6xl mx-auto animate-fadeIn">
      <header className="mb-8">
        <h3 className="text-3xl font-black text-slate-900 tracking-tight">Bundle Assignments</h3>
        <p className="text-slate-500 text-sm font-medium mt-2">Map bundle ownership and review responsibility.</p>
      </header>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bundle</label>
            <select
              value={filters.bundleId}
              onChange={(e) => setFilters({ ...filters, bundleId: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            >
              <option value="all">All Bundles</option>
              {bundles.map((b) => (
                <option key={String(b._id || b.id)} value={String(b._id || b.id)}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">User ID</label>
            <input
              value={filters.userId}
              onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              placeholder="Filter by userId"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            >
              <option value="all">All Types</option>
              {ASSIGNMENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active</label>
            <select
              value={filters.active}
              onChange={(e) => setFilters({ ...filters, active: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
              <option value="">All</option>
            </select>
          </div>
          <div className="text-right">
            <button
              onClick={fetchAssignments}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8">
        <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4">Add Assignment</h4>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bundle</label>
            <select
              value={form.bundleId}
              onChange={(e) => setForm({ ...form, bundleId: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            >
              <option value="">Select bundle</option>
              {bundles.map((b) => (
                <option key={String(b._id || b.id)} value={String(b._id || b.id)}>{b.name}</option>
              ))}
            </select>
          </div>
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
                {userResults.map((u) => (
                  <button
                    key={String(u._id || u.id)}
                    onClick={() => {
                      setSelectedUser(u);
                      setUserQuery(u.name || u.email);
                      setUserResults([]);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
                  >
                    <div className="font-bold text-slate-700">{u.name || 'User'}</div>
                    <div className="text-[10px] text-slate-400">{u.email} · {u.role}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</label>
            <select
              value={form.assignmentType}
              onChange={(e) => setForm({ ...form, assignmentType: e.target.value as AssignmentType })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            >
              {ASSIGNMENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Primary</label>
            <select
              value={form.isPrimary ? 'true' : 'false'}
              onChange={(e) => setForm({ ...form, isPrimary: e.target.value === 'true' })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
          <div className="text-right">
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
            >
              Add
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
          <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest">Assignments</h4>
          <span className="text-xs text-slate-400">{assignments.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400">
              <tr>
                <th className="px-6 py-3">Bundle</th>
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Primary</th>
                <th className="px-6 py-3">Active</th>
                <th className="px-6 py-3">Updated</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-6 text-center text-slate-400">Loading assignments...</td>
                </tr>
              )}
              {!loading && assignments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-6 text-center text-slate-400">No assignments found.</td>
                </tr>
              )}
              {!loading && assignments.map((a) => {
                const bundle = bundles.find((b) => String(b._id || b.id) === String(a.bundleId));
                const user = userMap.get(String(a.userId));
                return (
                  <tr key={String(a._id)} className="border-t border-slate-100">
                    <td className="px-6 py-4 font-semibold text-slate-700">{bundle?.name || a.bundleId}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {user ? `${user.name} (${user.email})` : a.userId}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{a.assignmentType}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${a.isPrimary ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                        {a.isPrimary ? 'Primary' : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${a.active ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                        {a.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[11px] text-slate-400">
                      {a.updatedAt ? new Date(a.updatedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => togglePrimary(a)}
                        className="text-[10px] font-bold text-slate-500 hover:text-emerald-600"
                      >
                        Toggle Primary
                      </button>
                      <button
                        onClick={() => toggleActive(a)}
                        className="text-[10px] font-bold text-slate-500 hover:text-blue-600"
                      >
                        {a.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminBundleAssignments;
