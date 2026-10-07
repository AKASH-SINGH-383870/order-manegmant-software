import React, { useState, useEffect } from 'react';
import { Building, Edit2, Plus, RefreshCw, X, CheckCircle2 } from 'lucide-react';
import { Company } from '../types.js';

export const Companies: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch('/api/companies', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const j = await res.json();
        setCompanies(j.companies || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/companies/${editingCompany.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCompany)
      });
      if (res.ok) {
        setEditingCompany(null);
        fetchCompanies();
      } else {
        const j = await res.json();
        alert(j.error || 'Update failed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building className="w-6 h-6 text-amber-500" />
            Billing Entities & Invoicing Companies
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure the two billing companies used for generating GST invoices, order slips, and bank account remittance details.
          </p>
        </div>

        <button
          onClick={fetchCompanies}
          className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 self-start"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Companies Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {companies.map(c => (
          <div key={c.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-5">
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {c.logo_url ? (
                    <img src={c.logo_url} alt={c.name} className="w-14 h-14 rounded-xl object-cover border border-slate-200 shadow-xs" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-slate-900 text-amber-400 font-bold flex items-center justify-center text-lg shadow-xs">
                      {c.code}
                    </div>
                  )}
                  <div>
                    <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      {c.code}
                    </span>
                    <h3 className="font-bold text-slate-900 text-base mt-1">{c.name}</h3>
                  </div>
                </div>

                <button
                  onClick={() => setEditingCompany(c)}
                  className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                  title="Edit Company Details"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <p><strong>GSTIN:</strong> <span className="font-mono font-bold text-slate-900">{c.gst_number}</span></p>
                <p><strong>Registered Address:</strong> {c.address}, {c.city}, {c.state} - {c.pincode}</p>
                <p><strong>Official Contact:</strong> {c.mobile} | {c.email}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-xs space-y-1">
                <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wide">Bank Account Remittance Details</p>
                <div className="grid grid-cols-2 gap-2 text-slate-600 mt-1">
                  <div>Bank: <strong className="text-slate-800">{c.bank_name}</strong></div>
                  <div>Account: <strong className="font-mono text-slate-800">{c.account_no}</strong></div>
                  <div>IFSC: <strong className="font-mono text-slate-800">{c.ifsc_code}</strong></div>
                  <div>Branch: <strong className="text-slate-800">{c.branch}</strong></div>
                </div>
              </div>

              {c.terms && (
                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                  <p className="font-semibold text-slate-700 mb-0.5">Default Invoicing Terms:</p>
                  <p className="line-clamp-2">{c.terms}</p>
                </div>
              )}
            </div>

            <div className="pt-2 border-t flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Active Billing Entity
              </span>
              <button
                onClick={() => setEditingCompany(c)}
                className="text-amber-600 hover:text-amber-700 font-semibold"
              >
                Modify Bank & Terms →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* EDIT COMPANY MODAL */}
      {editingCompany && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-slate-900">Edit Company Information</h3>
              <button onClick={() => setEditingCompany(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <form onSubmit={handleSaveCompany} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Company Trade Name *</label>
                <input
                  type="text"
                  required
                  value={editingCompany.name}
                  onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })}
                  className="w-full p-2 bg-slate-50 border rounded-lg font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">GSTIN *</label>
                  <input
                    type="text"
                    required
                    value={editingCompany.gst_number}
                    onChange={(e) => setEditingCompany({ ...editingCompany, gst_number: e.target.value })}
                    className="w-full p-2 bg-slate-50 border rounded-lg font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Mobile Contact</label>
                  <input
                    type="text"
                    value={editingCompany.mobile}
                    onChange={(e) => setEditingCompany({ ...editingCompany, mobile: e.target.value })}
                    className="w-full p-2 bg-slate-50 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    value={editingCompany.email}
                    onChange={(e) => setEditingCompany({ ...editingCompany, email: e.target.value })}
                    className="w-full p-2 bg-slate-50 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">City & State</label>
                  <input
                    type="text"
                    value={`${editingCompany.city}, ${editingCompany.state}`}
                    onChange={(e) => setEditingCompany({ ...editingCompany, city: e.target.value })}
                    className="w-full p-2 bg-slate-50 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Full Address</label>
                <textarea
                  rows={2}
                  value={editingCompany.address}
                  onChange={(e) => setEditingCompany({ ...editingCompany, address: e.target.value })}
                  className="w-full p-2 bg-slate-50 border rounded-lg"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border space-y-2">
                <p className="font-bold text-slate-800">Bank Remittance Information</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-slate-500 mb-0.5">Bank Name</label>
                    <input
                      type="text"
                      value={editingCompany.bank_name}
                      onChange={(e) => setEditingCompany({ ...editingCompany, bank_name: e.target.value })}
                      className="w-full p-1.5 bg-white border rounded"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-500 mb-0.5">Account Number</label>
                    <input
                      type="text"
                      value={editingCompany.account_no}
                      onChange={(e) => setEditingCompany({ ...editingCompany, account_no: e.target.value })}
                      className="w-full p-1.5 bg-white border rounded font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-500 mb-0.5">IFSC Code</label>
                    <input
                      type="text"
                      value={editingCompany.ifsc_code}
                      onChange={(e) => setEditingCompany({ ...editingCompany, ifsc_code: e.target.value })}
                      className="w-full p-1.5 bg-white border rounded font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-500 mb-0.5">Branch</label>
                    <input
                      type="text"
                      value={editingCompany.branch}
                      onChange={(e) => setEditingCompany({ ...editingCompany, branch: e.target.value })}
                      className="w-full p-1.5 bg-white border rounded"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Terms & Conditions</label>
                <textarea
                  rows={3}
                  value={editingCompany.terms || ''}
                  onChange={(e) => setEditingCompany({ ...editingCompany, terms: e.target.value })}
                  className="w-full p-2 bg-slate-50 border rounded-lg font-sans"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setEditingCompany(null)} className="px-4 py-2">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-amber-500 text-slate-950 font-bold rounded-lg">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
