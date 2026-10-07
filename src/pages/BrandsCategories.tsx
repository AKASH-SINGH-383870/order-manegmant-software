import React, { useState, useEffect } from 'react';
import { Tags, Plus, X, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { Brand, Category } from '../types.js';

export const BrandsCategories: React.FC = () => {
  const { user } = useAuth();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [brandName, setBrandName] = useState('');
  const [brandDesc, setBrandDesc] = useState('');

  const [showCatModal, setShowCatModal] = useState(false);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  const fetchMasters = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const [bRes, cRes] = await Promise.all([
        fetch('/api/brands', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/categories', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (bRes.ok) {
        const j = await bRes.json();
        setBrands(j.brands || []);
      }
      if (cRes.ok) {
        const j = await cRes.json();
        setCategories(j.categories || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasters();
  }, []);

  const handleAddBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim()) return;
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: brandName, description: brandDesc })
      });
      if (res.ok) {
        setShowBrandModal(false);
        setBrandName('');
        setBrandDesc('');
        fetchMasters();
      } else {
        const j = await res.json();
        alert(j.error || 'Failed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: catName, description: catDesc })
      });
      if (res.ok) {
        setShowCatModal(false);
        setCatName('');
        setCatDesc('');
        fetchMasters();
      } else {
        const j = await res.json();
        alert(j.error || 'Failed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const canManage = ['super_admin', 'admin'].includes(user?.role_slug || '');

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Tags className="w-6 h-6 text-amber-500" />
            Brands & Product Categories
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Organize lubricant formulations under commercial trade brands and functional viscosity categories.
          </p>
        </div>

        <button
          onClick={fetchMasters}
          className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 self-start"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* BRANDS SECTION */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Commercial Brands ({brands.length})</h2>
              <p className="text-xs text-slate-500">Trading labels and packaging product lines</p>
            </div>
            {canManage && (
              <button
                onClick={() => setShowBrandModal(true)}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Brand</span>
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {brands.map(b => (
              <div key={b.id} className="py-3 flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-slate-900">{b.name}</h4>
                  <p className="text-slate-500 text-[11px] mt-0.5">{b.description || 'Lubricant Brand'}</p>
                </div>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-semibold rounded text-[10px]">
                  Active
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CATEGORIES SECTION */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Viscosity Categories ({categories.length})</h2>
              <p className="text-xs text-slate-500">Functional fluid types (Engine, Gear, Hydraulic, Grease)</p>
            </div>
            {canManage && (
              <button
                onClick={() => setShowCatModal(true)}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Category</span>
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {categories.map(c => (
              <div key={c.id} className="py-3 flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-slate-900">{c.name}</h4>
                  <p className="text-slate-500 text-[11px] mt-0.5">{c.description || 'Functional Fluid Category'}</p>
                </div>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-semibold rounded text-[10px]">
                  Active
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Brand Modal */}
      {showBrandModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-slate-900">Add Brand</h3>
              <button onClick={() => setShowBrandModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleAddBrand} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Brand Name *</label>
                <input
                  type="text"
                  required
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. UltraDrive"
                  className="w-full p-2 bg-slate-50 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={brandDesc}
                  onChange={(e) => setBrandDesc(e.target.value)}
                  className="w-full p-2 bg-slate-50 border rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowBrandModal(false)} className="px-4 py-2">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-amber-500 text-slate-950 font-bold rounded-lg">Save Brand</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-slate-900">Add Viscosity Category</h3>
              <button onClick={() => setShowCatModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleAddCategory} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="e.g. Transmission Fluids"
                  className="w-full p-2 bg-slate-50 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  className="w-full p-2 bg-slate-50 border rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowCatModal(false)} className="px-4 py-2">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-amber-500 text-slate-950 font-bold rounded-lg">Save Category</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
