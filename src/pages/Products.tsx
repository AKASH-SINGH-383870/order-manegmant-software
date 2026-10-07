import React, { useState, useEffect } from 'react';
import { Package, Search, Plus, Filter, RefreshCw, X, Tag, Upload, Link as LinkIcon, Edit, Eye, Trash2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { Product } from '../types.js';

export const Products: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Add / Edit Modal state
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Image mode: 'upload' | 'url'
  const [imageOption, setImageOption] = useState<'upload' | 'url'>('upload');
  const [imagePreview, setImagePreview] = useState<string>('');

  const [form, setForm] = useState({
    name: '',
    brand_id: '',
    category_id: '',
    sku: '',
    unit: '',
    min_order_qty: '1',
    standard_rate: '',
    description: '',
    image_url: '',
    item_colour: 'Golden Yellow',
    status: 'active'
  });

  const [actionLoading, setActionLoading] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const fetchMasters = async () => {
    try {
      const token = localStorage.getItem('petroflow_token');
      const [bRes, cRes] = await Promise.all([
        fetch('/api/brands', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/categories', { headers: { Authorization: `Bearer ${token}` } }),
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
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (brandFilter) params.append('brand_id', brandFilter);
      if (categoryFilter) params.append('category_id', categoryFilter);

      const res = await fetch(`/api/products?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const j = await res.json();
        setProducts(j.products || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasters();
    fetchProducts();
  }, [brandFilter, categoryFilter]);

  // Handle local image upload (Option 1)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Only JPG, JPEG, PNG, and WebP images are supported.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image file size must be under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setForm(prev => ({ ...prev, image_url: result }));
    };
    reader.readAsDataURL(file);
  };

  // Open Add Modal
  const openAddModal = () => {
    setModalMode('add');
    setEditingId(null);
    setImageOption('upload');
    setImagePreview('');
    setForm({
      name: '',
      brand_id: brands[0]?.id ? brands[0].id.toString() : '',
      category_id: categories[0]?.id ? categories[0].id.toString() : '',
      sku: '',
      unit: '',
      min_order_qty: '1',
      standard_rate: '',
      description: '',
      image_url: '',
      item_colour: 'Golden Yellow',
      status: 'active'
    });
    setShowModal(true);
  };

  // Open Edit Modal
  const openEditModal = (p: Product) => {
    setModalMode('edit');
    setEditingId(p.id);
    setImagePreview(p.image_url || '');
    // Determine whether URL or base64
    if (p.image_url && p.image_url.startsWith('http')) {
      setImageOption('url');
    } else {
      setImageOption('upload');
    }
    setForm({
      name: p.name,
      brand_id: p.brand_id.toString(),
      category_id: p.category_id.toString(),
      sku: p.sku,
      unit: p.unit,
      min_order_qty: p.min_order_qty.toString(),
      standard_rate: p.standard_rate.toString(),
      description: p.description || '',
      image_url: p.image_url || '',
      item_colour: p.item_colour || 'Golden Yellow',
      status: p.status || 'active'
    });
    setShowModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const url = modalMode === 'add' ? '/api/products' : `/api/products/${editingId}`;
      const method = modalMode === 'add' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        setShowModal(false);
        fetchProducts();
      } else {
        alert(data.error || 'Failed to save product');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const canManage = ['super_admin', 'admin'].includes(user?.role_slug || '');

  // Filter products client-side for dynamic responsive feedback
  const filteredProducts = products.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      p.name?.toLowerCase().includes(s) ||
      p.sku?.toLowerCase().includes(s) ||
      p.brand_name?.toLowerCase().includes(s) ||
      p.category_name?.toLowerCase().includes(s) ||
      p.item_colour?.toLowerCase().includes(s) ||
      p.unit?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-amber-500" />
            Product Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete finished lubricant catalog with high-resolution images, brand categories, SKU specifications and item colors.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchProducts}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5"
            title="Refresh Catalog"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {canManage && (
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs rounded-lg shadow-xs transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add New Product</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Product Name, SKU, Brand, Category or Item Colour..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            >
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            >
              <option value="">All Brands</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Products Table & Mobile Cards */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Mobile Product Cards (< md) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">Loading lubricant catalog...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">No products matching criteria.</div>
          ) : (
            filteredProducts.map(p => (
              <div key={p.id} className="p-4 space-y-3 hover:bg-slate-50/70 transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform"
                          onClick={() => setZoomImage(p.image_url!)}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=100&auto=format&fit=crop&q=60';
                          }}
                        />
                      ) : (
                        <Package className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">
                        {p.name} {p.unit ? `– ${p.unit}` : ''}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">{p.sku} • {p.brand_name}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                          {p.item_colour || 'Golden Yellow'}
                        </span>
                        <span className="px-1.5 py-0.2 bg-slate-100 rounded text-slate-700 font-semibold text-[9px]">{p.unit}</span>
                      </div>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full shrink-0 ${
                    p.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {p.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="text-slate-500 text-[11px]">Min Order: <strong>{p.min_order_qty} {p.unit}</strong></span>
                  {canManage && (
                    <button
                      onClick={() => openEditModal(p)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-amber-50 hover:text-amber-800 text-slate-700 font-semibold rounded-lg text-xs transition flex items-center gap-1"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Image</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">SKU Code</th>
                <th className="py-3 px-4">Brand</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Item Colour</th>
                <th className="py-3 px-4">Packing Unit</th>
                <th className="py-3 px-4">Min Qty</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">Loading lubricant catalog...</td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">No products matching criteria.</td>
                </tr>
              ) : (
                filteredProducts.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    {/* Thumbnail */}
                    <td className="py-3 px-4">
                      <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform"
                            onClick={() => setZoomImage(p.image_url!)}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=100&auto=format&fit=crop&q=60';
                            }}
                          />
                        ) : (
                          <Package className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{p.name} {p.unit ? `– ${p.unit}` : ''}</p>
                      <p className="text-[11px] text-slate-400 truncate max-w-xs">{p.description || 'Standard formulation'}</p>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.sku}</td>
                    <td className="py-3 px-4 text-slate-700 font-medium">{p.brand_name}</td>
                    <td className="py-3 px-4 text-slate-600">{p.category_name}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                        {p.item_colour || 'Golden Yellow'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800 font-semibold">{p.unit}</span>
                    </td>
                    <td className="py-3 px-4 font-mono">{p.min_order_qty}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        p.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {p.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {canManage && (
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                          title="Edit Product"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-500" />
                {modalMode === 'add' ? 'Add New Product Formulation' : 'Edit Product Formulation'}
              </h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              {/* Product Image Section (Upload & URL) */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">Product Image *</label>
                  <div className="flex items-center bg-white rounded-lg border border-slate-200 p-0.5">
                    <button
                      type="button"
                      onClick={() => setImageOption('upload')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 ${
                        imageOption === 'upload' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Image</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageOption('url')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 ${
                        imageOption === 'url' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      <span>Image URL</span>
                    </button>
                  </div>
                </div>

                {imageOption === 'upload' ? (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={handleFileUpload}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-900 hover:file:bg-amber-200 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-500">Supports JPG, JPEG, PNG, and WebP (Max 5MB).</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="url"
                      placeholder="https://example.com/product-image.jpg"
                      value={form.image_url}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm(f => ({ ...f, image_url: val }));
                        setImagePreview(val);
                      }}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                    <p className="text-[10px] text-slate-500">Paste direct public image URL from CDN or cloud storage.</p>
                  </div>
                )}

                {/* Live Preview & Remove/Replace Button */}
                {imagePreview && (
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
                    <div className="w-16 h-16 rounded-lg bg-white border border-slate-300 overflow-hidden relative group shrink-0">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=100&auto=format&fit=crop&q=60';
                        }}
                      />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Live Image Preview Ready
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setImagePreview('');
                          setForm(f => ({ ...f, image_url: '' }));
                        }}
                        className="mt-1 text-[11px] text-rose-600 hover:underline flex items-center gap-1 font-semibold"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove image
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Product Basic Fields */}
              <div>
                <label className="block font-semibold mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. UltraDrive Synthetic 5W-30 SN/CF"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Brand *</label>
                  <select
                    value={form.brand_id}
                    required
                    onChange={(e) => setForm({ ...form, brand_id: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="">Select Brand</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Category *</label>
                  <select
                    value={form.category_id}
                    required
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })}
                    placeholder="e.g. UD-5W30-SYN"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono uppercase"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-xs text-slate-700">Packing Unit *</label>
                    <span className="text-[10px] text-slate-400">Type any unit or pick below</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="e.g. 900 ML, 5 Litre, 20 Litre, 180 KG, 1 Box"
                    list="packing-unit-list"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <datalist id="packing-unit-list">
                    <option value="900 ML" />
                    <option value="1 Litre" />
                    <option value="1.5 Litre" />
                    <option value="3 Litre" />
                    <option value="3.5 Litre" />
                    <option value="5 Litre" />
                    <option value="7.5 Litre" />
                    <option value="10 Litre" />
                    <option value="20 Litre" />
                    <option value="26 Litre" />
                    <option value="50 KG" />
                    <option value="180 KG" />
                    <option value="210 Litre" />
                    <option value="1 Piece" />
                    <option value="12 Pieces" />
                    <option value="1 Box" />
                    <option value="1 Carton" />
                    <option value="24 Bottles" />
                    <option value="Drum" />
                    <option value="Bucket" />
                    <option value="Pouch" />
                    <option value="Custom Pack" />
                  </datalist>

                  {/* Quick-Select Suggestions */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {['900 ML', '1 Litre', '5 Litre', '20 Litre', '180 KG', '210 Litre', '1 Box'].map(u => (
                      <button
                        type="button"
                        key={u}
                        onClick={() => setForm({ ...form, unit: u })}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition ${
                          form.unit === u
                            ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Item Colour *</label>
                  <input
                    type="text"
                    required
                    value={form.item_colour}
                    onChange={(e) => setForm({ ...form, item_colour: e.target.value })}
                    placeholder="e.g. Golden Yellow, Red, Amber"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Min Order Qty *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.min_order_qty}
                    onChange={(e) => setForm({ ...form, min_order_qty: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Status *</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Formulation Description & Performance Specifications</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. API SN Plus, ACEA A3/B4, Meets MB 229.5 & VW 502 00 specifications"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 font-bold rounded-lg shadow-xs"
                >
                  {modalMode === 'add' ? 'Save New Product' : 'Update Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-xl max-h-[80vh] bg-white rounded-2xl overflow-hidden p-2 shadow-2xl" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setZoomImage(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={zoomImage}
              alt="Product High Resolution"
              className="w-full h-auto max-h-[75vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
