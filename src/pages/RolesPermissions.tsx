import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, Check, RefreshCw, AlertCircle, CheckCircle2, Lock,
  Users, CheckSquare, Square, Save, RotateCcw, Info, Plus, Edit2, Trash2, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

interface PermissionItem {
  id: number;
  module: string;
  action: string;
  code: string;
  description?: string;
}

interface RoleItem {
  id: number;
  name: string;
  slug: string;
  description: string;
  is_system: number;
  permissions: { id: number; code: string }[];
}

const MATRIX_COLUMNS = [
  { key: 'view', label: 'View', matchPatterns: ['view', 'view_all', 'view_own'] },
  { key: 'create', label: 'Create', matchPatterns: ['create', 'add'] },
  { key: 'edit', label: 'Edit', matchPatterns: ['edit', 'update', 'update_delivery'] },
  { key: 'delete', label: 'Delete', matchPatterns: ['delete', 'cancel'] },
  { key: 'approve', label: 'Approve', matchPatterns: ['approve', 'complete'] },
  { key: 'verify', label: 'Verify', matchPatterns: ['verify'] },
  { key: 'manage', label: 'Manage', matchPatterns: ['manage'] },
];

export const RolesPermissions: React.FC = () => {
  const { user, hasPermission, refreshUser } = useAuth();
  const isAdmin = ['super_admin', 'admin'].includes(user?.role_slug || '');
  const canManageRoles = isAdmin || hasPermission('roles:manage');

  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionItem[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(() => {
    const saved = localStorage.getItem('petroflow_selected_role_id');
    return saved ? parseInt(saved, 10) : null;
  });
  const [selectedPermIds, setSelectedPermIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Custom Role Modals State
  const [showCreateRoleModal, setShowCreateRoleModal] = useState<boolean>(false);
  const [customRoleName, setCustomRoleName] = useState<string>('');
  const [customRoleDesc, setCustomRoleDesc] = useState<string>('');
  const [createRoleLoading, setCreateRoleLoading] = useState<boolean>(false);

  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [editRoleName, setEditRoleName] = useState<string>('');
  const [editRoleDesc, setEditRoleDesc] = useState<string>('');
  const [editRoleLoading, setEditRoleLoading] = useState<boolean>(false);

  const [deletingRole, setDeletingRole] = useState<RoleItem | null>(null);
  const [deleteRoleLoading, setDeleteRoleLoading] = useState<boolean>(false);

  const fetchRolesData = async (targetRoleId?: number) => {
    setLoading(true);
    setErrorToast(null);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch('/api/roles', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        const loadedRoles: RoleItem[] = json.roles || [];
        setRoles(loadedRoles);
        setAllPermissions(json.allPermissions || []);

        if (loadedRoles.length > 0) {
          const savedIdStr = localStorage.getItem('petroflow_selected_role_id');
          const savedId = savedIdStr ? parseInt(savedIdStr, 10) : null;
          const roleToSelect =
            (targetRoleId && loadedRoles.find(r => r.id === targetRoleId)) ||
            (selectedRoleId && loadedRoles.find(r => r.id === selectedRoleId)) ||
            (savedId && loadedRoles.find(r => r.id === savedId)) ||
            loadedRoles[0];

          if (roleToSelect) {
            setSelectedRoleId(roleToSelect.id);
            setSelectedPermIds((roleToSelect.permissions || []).map((p: any) => p.id));
            localStorage.setItem('petroflow_selected_role_id', String(roleToSelect.id));
          }
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        setErrorToast(errJson.error || 'Failed to load roles from database');
      }
    } catch (err: any) {
      console.error(err);
      setErrorToast(err?.message || 'Error connecting to database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRolesData();
  }, []);

  const handleRoleSelect = (r: RoleItem) => {
    setSelectedRoleId(r.id);
    setSelectedPermIds((r.permissions || []).map((p: any) => p.id));
    localStorage.setItem('petroflow_selected_role_id', String(r.id));
    setErrorToast(null);
    setSuccessToast(null);
  };

  const togglePermission = (permId: number) => {
    setSelectedPermIds(prev =>
      prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]
    );
  };

  const handleResetCurrentRole = () => {
    const current = roles.find(r => r.id === selectedRoleId);
    if (current) {
      setSelectedPermIds((current.permissions || []).map((p: any) => p.id));
      setSuccessToast(`Reset permissions for "${current.name}" to saved database state.`);
      setTimeout(() => setSuccessToast(null), 3000);
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedRoleId) return;
    setSaving(true);
    setErrorToast(null);
    setSuccessToast(null);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/roles/${selectedRoleId}/permissions`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission_ids: selectedPermIds })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setSuccessToast(`Permissions saved successfully. (${selectedRole?.name}: ${selectedPermIds.length} active)`);
        setTimeout(() => setSuccessToast(null), 5000);
        await refreshUser();
        await fetchRolesData(selectedRoleId);
      } else {
        setErrorToast(data.error || 'Failed to save permissions to database.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorToast(err?.message || 'Error updating role permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customRoleName.trim()) return;
    setCreateRoleLoading(true);
    setErrorToast(null);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customRoleName.trim(),
          description: customRoleDesc.trim() || undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.role) {
        setShowCreateRoleModal(false);
        setCustomRoleName('');
        setCustomRoleDesc('');
        setSuccessToast(`Custom role "${data.role.name}" created! Now select permissions in the matrix and click Save.`);
        setTimeout(() => setSuccessToast(null), 5000);
        await fetchRolesData(data.role.id);
      } else {
        setErrorToast(data.error || 'Failed to create custom role');
      }
    } catch (err: any) {
      setErrorToast(err?.message || 'Error creating custom role');
    } finally {
      setCreateRoleLoading(false);
    }
  };

  const handleEditCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole || !editRoleName.trim()) return;
    setEditRoleLoading(true);
    setErrorToast(null);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/roles/${editingRole.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editRoleName.trim(),
          description: editRoleDesc.trim() || undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.role) {
        setEditingRole(null);
        setSuccessToast(`Role "${data.role.name}" updated successfully.`);
        setTimeout(() => setSuccessToast(null), 4000);
        await fetchRolesData(data.role.id);
      } else {
        setErrorToast(data.error || 'Failed to update role');
      }
    } catch (err: any) {
      setErrorToast(err?.message || 'Error updating role');
    } finally {
      setEditRoleLoading(false);
    }
  };

  const handleDeleteCustomRole = async () => {
    if (!deletingRole) return;
    setDeleteRoleLoading(true);
    setErrorToast(null);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/roles/${deletingRole.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        const deletedName = deletingRole.name;
        const deletedId = deletingRole.id;
        setDeletingRole(null);
        setSuccessToast(`Custom role "${deletedName}" deleted successfully.`);
        setTimeout(() => setSuccessToast(null), 4000);
        const remaining = roles.filter(r => r.id !== deletedId);
        const nextId = remaining[0]?.id;
        await fetchRolesData(nextId);
      } else {
        setErrorToast(data.error || 'Failed to delete role');
      }
    } catch (err: any) {
      setErrorToast(err?.message || 'Error deleting role');
    } finally {
      setDeleteRoleLoading(false);
    }
  };

  const selectedRole = roles.find(r => r.id === selectedRoleId);

  // Group permissions by module
  const modulesMap: Record<string, PermissionItem[]> = {};
  for (const p of allPermissions) {
    if (!modulesMap[p.module]) modulesMap[p.module] = [];
    modulesMap[p.module].push(p);
  }

  const moduleNames = Object.keys(modulesMap).sort();

  // Helper: toggle all perms in a module
  const toggleModulePermissions = (modName: string, selectAll: boolean) => {
    const modPermIds = (modulesMap[modName] || []).map(p => p.id);
    if (selectAll) {
      setSelectedPermIds(prev => Array.from(new Set([...prev, ...modPermIds])));
    } else {
      setSelectedPermIds(prev => prev.filter(id => !modPermIds.includes(id)));
    }
  };

  // Helper: check if all perms in module are selected
  const isModuleFullySelected = (modName: string) => {
    const modPermIds = (modulesMap[modName] || []).map(p => p.id);
    return modPermIds.length > 0 && modPermIds.every(id => selectedPermIds.includes(id));
  };

  // Helper: select/deselect all for role
  const handleSelectAllForRole = () => {
    const allIds = allPermissions.map(p => p.id);
    setSelectedPermIds(allIds);
  };

  const handleClearAllForRole = () => {
    setSelectedPermIds([]);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-emerald-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
          <p className="text-xs font-semibold">{successToast}</p>
          <button onClick={() => setSuccessToast(null)} className="ml-2 text-emerald-300 hover:text-white">✕</button>
        </div>
      )}

      {/* Error Notification */}
      {errorToast && (
        <div className="fixed top-4 right-4 z-50 bg-rose-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-rose-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 text-rose-300 shrink-0" />
          <p className="text-xs font-semibold">{errorToast}</p>
          <button onClick={() => setErrorToast(null)} className="ml-2 text-rose-300 hover:text-white">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-600" />
            Roles & Permissions Matrix
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time Role-Based Access Control (RBAC). Changes immediately enforce View, Create, Edit, Delete, Approve, Verify and Manage controls throughout frontend navigation and backend API endpoints.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchRolesData(selectedRoleId || undefined)}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition"
            title="Refresh Permissions from Database"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleResetCurrentRole}
            disabled={saving || !selectedRoleId}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition disabled:opacity-50"
            title="Reset unsaved changes to database state"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <button
            onClick={handleSavePermissions}
            disabled={saving || !selectedRoleId}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Permissions'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Role Selector & Matrix Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Role Selector Sidebar */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Corporate Roles</h3>
            <span className="text-[11px] font-semibold text-slate-400 font-mono">{roles.length} Roles</span>
          </div>

          {canManageRoles && (
            <button
              type="button"
              onClick={() => {
                setCustomRoleName('');
                setCustomRoleDesc('');
                setShowCreateRoleModal(true);
              }}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create Custom Role</span>
            </button>
          )}

          <div className="space-y-2">
            {roles.map(r => {
              const isSelected = selectedRoleId === r.id;
              const count = r.permissions?.length || 0;
              const isSystem = r.is_system === 1;

              return (
                <div
                  key={r.id}
                  onClick={() => handleRoleSelect(r)}
                  className={`p-4 rounded-xl border cursor-pointer transition text-left ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                      <span>{r.name}</span>
                      {r.slug === 'super_admin' ? (
                        <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 text-[10px] font-bold rounded">
                          Full Root
                        </span>
                      ) : isSystem ? (
                        <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> System
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded">
                          Custom
                        </span>
                      )}
                    </h4>

                    <div className="flex items-center gap-1">
                      {/* Action buttons for custom roles */}
                      {!isSystem && canManageRoles && (
                        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingRole(r);
                              setEditRoleName(r.name);
                              setEditRoleDesc(r.description || '');
                            }}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition"
                            title="Edit Role Name & Description"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingRole(r);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                            title="Delete Custom Role"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {r.slug}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">{r.description}</p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
                    <span className="font-semibold text-indigo-700">
                      {isSelected ? selectedPermIds.length : count} / {allPermissions.length} permissions active
                    </span>
                    {isSelected && (
                      <span className="text-indigo-600 font-bold flex items-center gap-0.5">
                        <Check className="w-3.5 h-3.5" /> Selected
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Info Box */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
            <div className="flex items-center gap-1.5 text-indigo-900 font-bold">
              <Info className="w-4 h-4 text-indigo-600" />
              <span>Permission Enforcement</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              When permissions are saved, changes take effect immediately on all subsequent API requests. Users without permissions will see restricted items removed from the navigation bar, and backend routes will reject unauthorized queries with <code className="bg-slate-200 px-1 py-0.5 rounded text-rose-700">403 Forbidden</code>.
            </p>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          {/* Matrix Header */}
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  Configuring Role
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  {selectedRole?.name}
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Toggle module actions below. Selected capabilities will be instantly granted.
              </p>
            </div>

            {/* Quick Bulk Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllForRole}
                className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-white border border-slate-200 rounded-lg transition"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleClearAllForRole}
                className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-rose-600 hover:bg-white border border-slate-200 rounded-lg transition"
              >
                Clear All
              </button>
              <button
                type="button"
                onClick={handleResetCurrentRole}
                disabled={saving || !selectedRoleId}
                className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white border border-slate-200 rounded-lg transition flex items-center gap-1 disabled:opacity-50"
                title="Discard unsaved changes"
              >
                <RotateCcw className="w-3 h-3 text-slate-500" />
                <span>Reset</span>
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                disabled={saving || !selectedRoleId}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save Permissions'}</span>
              </button>
            </div>
          </div>

          {/* Matrix Table View */}
          <div className="overflow-x-auto flex-1 p-2 sm:p-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider bg-slate-50/50">
                  <th className="py-3 px-3 min-w-[140px]">Module</th>
                  {MATRIX_COLUMNS.map(col => (
                    <th key={col.key} className="py-3 px-2 text-center min-w-[75px]">
                      {col.label}
                    </th>
                  ))}
                  <th className="py-3 px-2 text-center min-w-[90px]">All / None</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {moduleNames.map(modName => {
                  const modPerms = modulesMap[modName] || [];
                  const isFullyActive = isModuleFullySelected(modName);

                  return (
                    <tr key={modName} className="hover:bg-slate-50/60 transition">
                      {/* Module Title */}
                      <td className="py-3 px-3 font-bold text-slate-900">
                        <div className="flex flex-col">
                          <span>{modName}</span>
                          <span className="text-[10px] text-slate-400 font-normal font-mono">
                            {modPerms.length} actions
                          </span>
                        </div>
                      </td>

                      {/* Columns: View, Create, Edit, Delete, Approve, Verify, Manage */}
                      {MATRIX_COLUMNS.map(col => {
                        // Find matching permissions for this column within this module
                        const matchingPerms = modPerms.filter(p => {
                          const actionLower = (p.code.split(':')[1] || p.code).toLowerCase();
                          return col.matchPatterns.some(pat => actionLower.includes(pat));
                        });

                        if (matchingPerms.length === 0) {
                          return (
                            <td key={col.key} className="py-3 px-2 text-center text-slate-300">
                              <span className="text-slate-200">—</span>
                            </td>
                          );
                        }

                        // If multiple perms match (e.g. view_all and view_own), render checkbox for each
                        return (
                          <td key={col.key} className="py-3 px-2 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {matchingPerms.map(p => {
                                const isChecked = selectedPermIds.includes(p.id);
                                const isSpecific = p.code.includes('view_own');
                                return (
                                  <label
                                    key={p.id}
                                    title={`${p.action} (${p.code}): ${p.description || ''}`}
                                    className={`inline-flex items-center justify-center p-1 rounded-md cursor-pointer transition ${
                                      isChecked
                                        ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                                        : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => togglePermission(p.id)}
                                      className="sr-only"
                                    />
                                    {isChecked ? (
                                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                                    ) : (
                                      <Square className="w-4 h-4 text-slate-300" />
                                    )}
                                    {isSpecific && (
                                      <span className="text-[9px] font-mono ml-1 font-bold text-amber-700">
                                        (own)
                                      </span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}

                      {/* Module Toggle All Button */}
                      <td className="py-3 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => toggleModulePermissions(modName, !isFullyActive)}
                          className={`text-[10px] font-bold px-2 py-1 rounded transition border ${
                            isFullyActive
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {isFullyActive ? 'Enabled' : 'Toggle'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Granular Individual Capability Cards Section */}
          <div className="p-5 border-t border-slate-200 bg-slate-50/40 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span>Granular Action Breakdown</span>
              <span className="text-[11px] text-slate-400 font-normal">Click any capability badge to toggle</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {allPermissions.map(p => {
                const isChecked = selectedPermIds.includes(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => togglePermission(p.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition text-left flex items-start gap-2.5 ${
                      isChecked
                        ? 'bg-white border-indigo-400 text-slate-900 shadow-2xs'
                        : 'bg-transparent border-slate-200 text-slate-500 hover:bg-white'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-slate-900 truncate">{p.action}</span>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold shrink-0">{p.module}</span>
                      </div>
                      <p className="text-[10px] font-mono text-indigo-600 truncate mt-0.5">{p.code}</p>
                      {p.description && (
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-tight">{p.description}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: CREATE CUSTOM ROLE */}
      {showCreateRoleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                Create New Custom Role
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateRoleModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Create a custom role for your operations team (e.g. <strong>Packing Manager</strong>, <strong>Senior Sales</strong>, <strong>Collection Team</strong>, <strong>Sales Manager</strong>). Once created, you can configure its permissions directly in the matrix.
            </p>

            <form onSubmit={handleCreateCustomRole} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Custom Role Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={customRoleName}
                  onChange={(e) => setCustomRoleName(e.target.value)}
                  placeholder="e.g. Packing Manager, Collection Team, Senior Sales"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Description / Responsibilities (Optional)
                </label>
                <textarea
                  rows={2}
                  value={customRoleDesc}
                  onChange={(e) => setCustomRoleDesc(e.target.value)}
                  placeholder="Describe operational responsibilities and permission scope..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateRoleModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRoleLoading || !customRoleName.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{createRoleLoading ? 'Creating...' : 'Create Role'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT CUSTOM ROLE */}
      {editingRole && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-600" />
                Edit Custom Role: {editingRole.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingRole(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditCustomRole} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Role Name *
                </label>
                <input
                  type="text"
                  required
                  value={editRoleName}
                  onChange={(e) => setEditRoleName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editRoleDesc}
                  onChange={(e) => setEditRoleDesc(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingRole(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editRoleLoading || !editRoleName.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{editRoleLoading ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CUSTOM ROLE CONFIRMATION */}
      {deletingRole && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-rose-600 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                Delete Custom Role
              </h3>
              <button
                type="button"
                onClick={() => setDeletingRole(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete the custom role <strong>"{deletingRole.name}"</strong>? All associated permission mappings will be removed.
            </p>
            <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
              Note: If any active users are currently assigned to this role, deletion will be blocked until those users are reassigned.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t">
              <button
                type="button"
                onClick={() => setDeletingRole(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCustomRole}
                disabled={deleteRoleLoading}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition text-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deleteRoleLoading ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
