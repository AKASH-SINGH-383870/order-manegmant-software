import React, { useState, useEffect } from 'react';
import { Users as UsersIcon, Plus, Edit2, Shield, Phone, Mail, X, RefreshCw, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const Users: React.FC = () => {
  const [usersList, setUsersList] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role_id: '',
    mobile: '',
    employee_id: '',
    status: 'active'
  });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsersAndRoles = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const [uRes, rRes] = await Promise.all([
        fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/roles', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (uRes.ok) {
        const uJson = await uRes.json();
        setUsersList(uJson.users || []);
      }
      if (rRes.ok) {
        const rJson = await rRes.json();
        setRoles(rJson.roles || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndRoles();
  }, []);

  const handleOpenAdd = () => {
    setEditingUserId(null);
    setUserForm({
      name: '',
      email: '',
      password: '',
      role_id: roles.length > 0 ? roles[0].id.toString() : '1',
      mobile: '',
      employee_id: `EMP-${Math.floor(100 + Math.random() * 900)}`,
      status: 'active'
    });
    setShowModal(true);
  };

  const handleOpenEdit = (u: any) => {
    setEditingUserId(u.id);
    setUserForm({
      name: u.name,
      email: u.email,
      password: '',
      role_id: u.role_id.toString(),
      mobile: u.mobile || '',
      employee_id: u.employee_id || '',
      status: u.status || 'active'
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const url = editingUserId ? `/api/users/${editingUserId}` : '/api/users';
      const method = editingUserId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm)
      });
      if (res.ok) {
        setShowModal(false);
        fetchUsersAndRoles();
      } else {
        const j = await res.json();
        alert(j.error || 'Operation failed');
      }
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UsersIcon className="w-6 h-6 text-amber-500" />
            User Access & Personnel Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Provision user accounts, configure employee IDs, assign access roles, and control active status.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchUsersAndRoles}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs rounded-lg shadow-xs transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create User</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Employee ID</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Mobile</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">Loading personnel list...</td>
                </tr>
              ) : (
                usersList.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{u.employee_id || '—'}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{u.name}</td>
                    <td className="py-3 px-4 text-slate-600">{u.email}</td>
                    <td className="py-3 px-4 text-slate-600">{u.mobile || '—'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800 font-semibold">{u.role_name}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="p-1.5 text-slate-400 hover:text-slate-800 transition"
                        title="Edit credentials"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-slate-900">
                {editingUserId ? 'Edit User Credentials' : 'Create New User Account'}
              </h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  className="w-full p-2 bg-slate-50 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Email / Username *</label>
                <input
                  type="email"
                  required
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full p-2 bg-slate-50 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  {editingUserId ? 'Reset Password (Leave blank to keep current)' : 'Password *'}
                </label>
                <input
                  type="password"
                  required={!editingUserId}
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full p-2 bg-slate-50 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Role Assignment *</label>
                  <select
                    value={userForm.role_id}
                    onChange={(e) => setUserForm({ ...userForm, role_id: e.target.value })}
                    className="w-full p-2 bg-slate-50 border rounded-lg font-semibold"
                  >
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Employee ID</label>
                  <input
                    type="text"
                    value={userForm.employee_id}
                    onChange={(e) => setUserForm({ ...userForm, employee_id: e.target.value })}
                    className="w-full p-2 bg-slate-50 border rounded-lg font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Mobile Contact</label>
                  <input
                    type="text"
                    value={userForm.mobile}
                    onChange={(e) => setUserForm({ ...userForm, mobile: e.target.value })}
                    className="w-full p-2 bg-slate-50 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Account Status</label>
                  <select
                    value={userForm.status}
                    onChange={(e) => setUserForm({ ...userForm, status: e.target.value })}
                    className="w-full p-2 bg-slate-50 border rounded-lg"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2">Cancel</button>
                <button type="submit" disabled={actionLoading} className="px-5 py-2 bg-amber-500 text-slate-950 font-bold rounded-lg">
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
