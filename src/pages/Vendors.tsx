import React, { useState, useEffect } from 'react';
import {
  Store, Search, Plus, Filter, MapPin, Phone, Mail, Building, Eye,
  CheckCircle2, AlertCircle, X, ChevronRight, RefreshCw, User, Edit2,
  Clock, ShieldCheck, FileText, Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { Vendor } from '../types.js';

export const Vendors: React.FC<{
  onNavigate: (page: string) => void;
  initialVendorId?: string | number;
}> = ({ onNavigate, initialVendorId }) => {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [cityFilter, setCityFilter] = useState<string>('');
  const [salesFilter, setSalesFilter] = useState<string>('');
  const [salesPersons, setSalesPersons] = useState<any[]>([]);

  // Notifications
  const [successNotification, setSuccessNotification] = useState<string | null>(null);

  // Vendor Profile Drawer
  const [selectedVendorProfile, setSelectedVendorProfile] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  // Edit Party State
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [editForm, setEditForm] = useState({
    company_name: '',
    mobile: '',
    email: '',
    gstin: '',
    aadhaar_no: '',
    billing_address: '',
    delivery_address: '',
    city: '',
    state: 'Maharashtra',
    pincode: '',
    assigned_sales_person_id: '',
    notes: '',
    status: 'active' as 'active' | 'inactive'
  });
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // New Party Modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newVendorForm, setNewVendorForm] = useState({
    company_name: '',
    mobile: '',
    email: '',
    gstin: '',
    aadhaar_no: '',
    billing_address: '',
    delivery_address: '',
    city: '',
    state: 'Maharashtra',
    pincode: '',
    assigned_sales_person_id: '',
    notes: ''
  });
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);

  // Permission Check: Super Admin & Admin can edit all, Sales Person can edit only assigned vendors
  const canEditVendor = (v?: any): boolean => {
    if (!user || !v) return false;
    if (user.role_slug === 'super_admin') return true;
    const hasEditPerm = user.permissions?.includes('vendors:edit');
    if (!hasEditPerm) return false;
    if (user.role_slug === 'sales_person') {
      return Number(v.assigned_sales_person_id) === Number(user.id);
    }
    return true;
  };

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (cityFilter) params.append('city', cityFilter);
      if (salesFilter) params.append('sales_person_id', salesFilter);

      const res = await fetch(`/api/vendors?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setVendors(json.vendors || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesPersons = async () => {
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch('/api/sales-persons', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setSalesPersons(json.salesPersons || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchVendors();
    fetchSalesPersons();
  }, [cityFilter, salesFilter]);

  // Deep-link initial vendor ID support
  useEffect(() => {
    if (initialVendorId) {
      handleOpenProfile(Number(initialVendorId));
    }
  }, [initialVendorId]);

  const handleOpenProfile = async (vendorId: number) => {
    setProfileLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/vendors/${vendorId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setSelectedVendorProfile(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProfileLoading(false);
    }
  };

  // Open Edit Vendor Modal with CURRENT saved information
  const handleOpenEdit = (v: any) => {
    if (!canEditVendor(v)) {
      alert('Access denied: You do not have permission to edit this party profile.');
      return;
    }
    setEditingVendor(v);
    setEditError(null);
    setEditForm({
      company_name: v.company_name || '',
      mobile: v.mobile || '',
      email: v.email || '',
      gstin: v.gstin || '',
      aadhaar_no: v.aadhaar_no || '',
      billing_address: v.billing_address || '',
      delivery_address: v.delivery_address || v.billing_address || '',
      city: v.city || '',
      state: v.state || 'Maharashtra',
      pincode: v.pincode || '',
      assigned_sales_person_id: String(v.assigned_sales_person_id || ''),
      notes: v.notes || '',
      status: (v.status as 'active' | 'inactive') || 'active'
    });
  };

  // Handle Save Changes for Edit Party
  const handleUpdateVendorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVendor) return;

    if (!editForm.company_name.trim() || !editForm.mobile.trim() || !editForm.billing_address.trim() || !editForm.city.trim() || !editForm.state.trim()) {
      setEditError('Please fill in all required fields (Party Name, Mobile, Billing Address, City and State).');
      return;
    }

    setEditSubmitting(true);
    setEditError(null);

    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/vendors/${editingVendor.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editForm)
      });

      const data = await res.json();
      if (res.ok) {
        // 1. Success Message
        setSuccessNotification('Party profile updated successfully.');
        setTimeout(() => {
          setSuccessNotification(null);
        }, 5000);

        // 2. Immediately update party profile view if open
        if (selectedVendorProfile && selectedVendorProfile.vendor.id === editingVendor.id) {
          setSelectedVendorProfile((prev: any) => prev ? {
            ...prev,
            vendor: data.vendor || { ...prev.vendor, ...editForm }
          } : null);
          handleOpenProfile(editingVendor.id);
        }

        // 3. Refresh list
        await fetchVendors();

        // 4. Close Edit Modal
        setEditingVendor(null);
      } else {
        setEditError(data.error || 'Failed to update party profile');
      }
    } catch (err: any) {
      setEditError(err.message || 'Network error updating party profile');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleCreateVendorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendorForm.company_name.trim() || !newVendorForm.mobile.trim() || !newVendorForm.billing_address.trim() || !newVendorForm.city.trim() || !newVendorForm.state.trim()) {
      alert('Please fill in required fields: Party Name, Mobile, Address, City and State.');
      return;
    }
    setFormSubmitting(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(newVendorForm)
      });
      const data = await res.json();
      if (res.ok) {
        setShowAddModal(false);
        setNewVendorForm({
          company_name: '', mobile: '', email: '', gstin: '', aadhaar_no: '',
          billing_address: '', delivery_address: '', city: '', state: 'Maharashtra',
          pincode: '', assigned_sales_person_id: '', notes: ''
        });
        setSuccessNotification('Party profile created successfully.');
        setTimeout(() => setSuccessNotification(null), 4000);
        fetchVendors();
      } else {
        alert(data.error || 'Failed to create party profile');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const isSalesPerson = user?.role_slug === 'sales_person';

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {successNotification && (
        <div className="fixed top-5 right-5 z-[100] max-w-md bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-fade-in border border-emerald-500">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-100" />
          <span className="text-xs font-bold tracking-wide">{successNotification}</span>
          <button
            onClick={() => setSuccessNotification(null)}
            className="ml-auto text-emerald-200 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Store className="w-6 h-6 text-amber-500" />
            Parties & Customer Portfolio
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isSalesPerson
              ? `Strict Privacy: Displaying only party accounts assigned to ${user?.name}.`
              : 'Enterprise party master: view purchase history, contact information, profile edits, and balance payments.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchVendors}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition"
            title="Refresh Parties"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs rounded-lg shadow-xs transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add New Party</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by party name, mobile, code, city..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') fetchVendors(); }}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <input
              type="text"
              placeholder="Filter by city (e.g. Pune, Rajkot)..."
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
            />
          </div>

          {!isSalesPerson && (
            <div>
              <select
                value={salesFilter}
                onChange={(e) => setSalesFilter(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
              >
                <option value="">All Sales Representatives</option>
                {salesPersons.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.employee_id})</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Parties Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400">Loading party records...</div>
        ) : vendors.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 text-xs">
            No parties match the specified criteria.
          </div>
        ) : (
          vendors.map(v => (
            <div
              key={v.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-300 shadow-xs flex flex-col justify-between space-y-4 transition"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    {v.vendor_code}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {v.status === 'inactive' ? (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded uppercase">
                        Inactive
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded uppercase">
                        Active
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400 font-medium">{v.city}, {v.state}</span>
                  </div>
                </div>

                <h3 className="font-bold text-slate-900 text-base mt-2 truncate" title={v.company_name}>
                  {v.company_name}
                </h3>
                <p className="text-xs text-slate-600 mt-1">Attn: <strong>{v.contact_person}</strong></p>

                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{v.mobile}</span>
                    {v.alt_mobile && <span className="text-slate-400 font-mono text-[11px]">/ {v.alt_mobile}</span>}
                  </div>
                  {v.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{v.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
                    <span>GSTIN:</span>
                    <span>{v.gstin || 'Unregistered'}</span>
                  </div>
                </div>

                {/* Financial overview */}
                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-50 p-1.5 rounded">
                    <p className="text-[10px] text-slate-400">Orders</p>
                    <p className="font-bold text-slate-900">{v.total_orders || 0}</p>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded">
                    <p className="text-[10px] text-slate-400">Total Spent</p>
                    <p className="font-bold text-slate-900 font-mono">₹{((v.total_order_value || 0) / 1000).toFixed(0)}k</p>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded">
                    <p className="text-[10px] text-slate-400">Balance</p>
                    <p className="font-bold text-rose-600 font-mono">₹{((v.pending_amount || 0) / 1000).toFixed(0)}k</p>
                  </div>
                </div>
              </div>

              {/* Vendor Actions: View | Edit */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-[11px] text-slate-500 truncate mr-2">Sales: <strong>{v.sales_person_name}</strong></span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleOpenProfile(v.id)}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-lg transition flex items-center gap-1"
                    title="View Vendor Profile & History"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-600" />
                    <span>View</span>
                  </button>

                  <span className="text-slate-300 font-light">|</span>

                  {canEditVendor(v) ? (
                    <button
                      onClick={() => handleOpenEdit(v)}
                      className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1 shadow-2xs"
                      title="Edit Vendor Profile"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic px-1" title="Restricted to assigned sales representative or admin">
                      Locked
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* VENDOR PROFILE DRAWER / MODAL */}
      {selectedVendorProfile && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-5 sm:p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b pb-4 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    {selectedVendorProfile.vendor.vendor_code}
                  </span>
                  {selectedVendorProfile.vendor.status === 'inactive' ? (
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded uppercase">
                      Inactive
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded uppercase">
                      Active
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-1">{selectedVendorProfile.vendor.company_name}</h2>
                <p className="text-xs text-slate-500">
                  Contact: {selectedVendorProfile.vendor.contact_person} ({selectedVendorProfile.vendor.mobile}) • Sales Rep: {selectedVendorProfile.vendor.sales_person_name}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Prominent Edit Party Button */}
                {canEditVendor(selectedVendorProfile.vendor) && (
                  <button
                    onClick={() => handleOpenEdit(selectedVendorProfile.vendor)}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow-xs"
                    title="Edit Party Profile"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Party</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedVendorProfile(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Audit Information Section */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-600">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Created Information</span>
                  <span className="font-medium text-slate-800">
                    {selectedVendorProfile.vendor.created_by_name || 'System Administrator'}
                  </span>
                  <span className="text-slate-400 mx-1.5">•</span>
                  <span className="text-slate-600">
                    {selectedVendorProfile.vendor.created_at
                      ? new Date(selectedVendorProfile.vendor.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                      : 'Initial Setup'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-l sm:pl-4 border-slate-200 pt-2 sm:pt-0">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Last Updated Record</span>
                  {selectedVendorProfile.vendor.updated_at ? (
                    <span className="font-medium text-slate-800">
                      {selectedVendorProfile.vendor.updated_by_name || 'Authorized Staff'}
                      <span className="text-slate-400 mx-1.5">•</span>
                      <span className="text-slate-600">
                        {new Date(selectedVendorProfile.vendor.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}{' '}
                        at{' '}
                        {new Date(selectedVendorProfile.vendor.updated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">No modifications recorded yet</span>
                  )}
                </div>
              </div>
            </div>

            {/* Financial Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-slate-400">Total Orders Placed</p>
                <p className="text-lg font-bold text-slate-900 mt-0.5">{selectedVendorProfile.summary.total_orders || 0}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-slate-400">Gross Billed Value</p>
                <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">₹{(selectedVendorProfile.summary.total_value || 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <p className="text-emerald-700">Collected</p>
                <p className="text-lg font-bold text-emerald-800 font-mono mt-0.5">₹{(selectedVendorProfile.summary.total_received || 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                <p className="text-rose-700">Outstanding Balance</p>
                <p className="text-lg font-bold text-rose-800 font-mono mt-0.5">₹{(selectedVendorProfile.summary.total_pending || 0).toLocaleString('en-IN')}</p>
              </div>
            </div>

            {/* Address & Tax info */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Billing Address</span>
                  <p className="text-slate-800 font-medium">
                    {selectedVendorProfile.vendor.billing_address}, {selectedVendorProfile.vendor.city}, {selectedVendorProfile.vendor.state}
                    {selectedVendorProfile.vendor.pincode ? ` - ${selectedVendorProfile.vendor.pincode}` : ''}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Delivery Destination</span>
                  <p className="text-slate-800 font-medium">
                    {selectedVendorProfile.vendor.delivery_address || selectedVendorProfile.vendor.billing_address}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">GSTIN</span>
                  <p className="font-mono font-semibold text-slate-800">{selectedVendorProfile.vendor.gstin || 'Unregistered'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Contact Number</span>
                  <p className="text-slate-800 font-medium">{selectedVendorProfile.vendor.mobile} {selectedVendorProfile.vendor.alt_mobile ? `(Alt: ${selectedVendorProfile.vendor.alt_mobile})` : ''}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Email</span>
                  <p className="text-slate-800 font-medium">{selectedVendorProfile.vendor.email || 'N/A'}</p>
                </div>
              </div>

              {selectedVendorProfile.vendor.notes && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Special Notes / Terms</span>
                  <p className="text-slate-700 italic">{selectedVendorProfile.vendor.notes}</p>
                </div>
              )}
            </div>

            {/* Complete Order History */}
            <div>
              <h3 className="font-bold text-slate-900 text-sm mb-2">Order History</h3>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                      <th className="py-2.5 px-3">Order ID</th>
                      <th className="py-2.5 px-3">Products</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Billing Entity</th>
                      <th className="py-2.5 px-3 text-right">Order Value</th>
                      <th className="py-2.5 px-3 text-right">Received</th>
                      <th className="py-2.5 px-3 text-right">Pending</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedVendorProfile.orders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-slate-400">No orders recorded for this vendor yet.</td>
                      </tr>
                    ) : (
                      selectedVendorProfile.orders.map((ord: any) => (
                        <tr key={ord.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-600 cursor-pointer" onClick={() => {
                            setSelectedVendorProfile(null);
                            onNavigate(`orders/${ord.id}`);
                          }}>
                            {ord.order_number}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              {(ord.items || []).slice(0, 2).map((item: any, iIdx: number) => (
                                <div
                                  key={iIdx}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (item.product_image) setZoomImage(item.product_image);
                                  }}
                                  className="w-7 h-7 rounded bg-white border border-slate-200 overflow-hidden cursor-pointer hover:border-amber-400 shadow-2xs shrink-0"
                                  title={`${item.product_name} (${item.sku})`}
                                >
                                  <img
                                    src={item.product_image || 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=80&auto=format&fit=crop&q=80'}
                                    alt={item.product_name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ))}
                              {(ord.items?.length || 0) > 2 && (
                                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                                  +{(ord.items?.length || 0) - 2}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {new Date(ord.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{ord.company_name}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">₹{ord.grand_total.toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-600">₹{ord.amount_received.toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-rose-600">₹{ord.pending_amount.toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-3 font-semibold">{ord.order_status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              {canEditVendor(selectedVendorProfile.vendor) ? (
                <button
                  onClick={() => handleOpenEdit(selectedVendorProfile.vendor)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow-xs"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Party Profile</span>
                </button>
              ) : <div />}
              <button
                onClick={() => setSelectedVendorProfile(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT VENDOR MODAL */}
      {editingVendor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    {editingVendor.vendor_code}
                  </span>
                  <h3 className="font-bold text-base sm:text-lg text-slate-900">Edit Party Profile</h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update party master specifications, contact numbers, tax identifiers, and delivery address.
                </p>
              </div>
              <button
                onClick={() => setEditingVendor(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message if any */}
            {editError && (
              <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            {/* Form Body */}
            <form id="edit-vendor-form" onSubmit={handleUpdateVendorSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Party Name */}
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Party Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.company_name}
                    onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                    placeholder="e.g. Mahavir Mining Equipments"
                  />
                </div>

                {/* Mobile Number */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mobile Number *</label>
                  <input
                    type="text"
                    required
                    value={editForm.mobile}
                    onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                    placeholder="10-digit primary mobile number"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                    placeholder="official@company.com"
                  />
                </div>

                {/* GST No. */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">GST No.</label>
                  <input
                    type="text"
                    value={editForm.gstin}
                    onChange={(e) => setEditForm({ ...editForm, gstin: e.target.value.toUpperCase() })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono uppercase focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                    placeholder="e.g. 27AAAAA0000A1Z5"
                  />
                </div>

                {/* Aadhaar No. */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Aadhaar No.</label>
                  <input
                    type="text"
                    value={editForm.aadhaar_no}
                    onChange={(e) => setEditForm({ ...editForm, aadhaar_no: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                    placeholder="12-digit Aadhaar number"
                  />
                </div>

                {/* Active / Inactive Status */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Party Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                  >
                    <option value="active">Active (Available for Orders)</option>
                    <option value="inactive">Inactive (Suspended)</option>
                  </select>
                </div>

                {/* Billing Address */}
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Billing Address *</label>
                  <textarea
                    rows={2}
                    required
                    value={editForm.billing_address}
                    onChange={(e) => setEditForm({ ...editForm, billing_address: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                    placeholder="Plot / Unit No, Road, Industrial Area"
                  />
                </div>

                {/* Delivery Address */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700">Delivery Address</label>
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, delivery_address: editForm.billing_address })}
                      className="text-[11px] text-amber-600 hover:text-amber-700 font-semibold underline"
                    >
                      Copy from Billing Address
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={editForm.delivery_address}
                    onChange={(e) => setEditForm({ ...editForm, delivery_address: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                    placeholder="Warehouse / Site address for dispatch destination"
                  />
                </div>

                {/* City */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                    placeholder="e.g. Pune"
                  />
                </div>

                {/* State */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">State *</label>
                  <input
                    type="text"
                    required
                    value={editForm.state}
                    onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                    placeholder="e.g. Maharashtra"
                  />
                </div>

                {/* PIN Code */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">PIN Code</label>
                  <input
                    type="text"
                    value={editForm.pincode}
                    onChange={(e) => setEditForm({ ...editForm, pincode: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                    placeholder="6-digit postal code"
                  />
                </div>

                {/* Assigned Sales Person */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Sales Person</label>
                  {isSalesPerson ? (
                    <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-medium">
                      {editingVendor.sales_person_name || user?.name}
                      <span className="block text-[10px] text-slate-400 mt-0.5">
                        (Sales Person re-assignment is reserved for Super Admin / Admin)
                      </span>
                    </div>
                  ) : (
                    <select
                      value={editForm.assigned_sales_person_id}
                      onChange={(e) => setEditForm({ ...editForm, assigned_sales_person_id: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                    >
                      <option value="">Select Sales Representative</option>
                      {salesPersons.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.employee_id})</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Commercial Notes / Terms</label>
                  <textarea
                    rows={2}
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                    placeholder="Credit limits, preferred delivery window, freight terms, etc."
                  />
                </div>
              </div>
            </form>

            {/* Modal Footer with Save Changes and Cancel buttons */}
            <div className="px-5 py-4 sm:px-6 sm:py-4 border-t border-slate-100 bg-slate-50 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setEditingVendor(null)}
                className="w-full sm:w-auto px-4 py-2.5 text-slate-700 hover:bg-slate-200/70 border border-slate-200 rounded-lg font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-vendor-form"
                disabled={editSubmitting}
                className="w-full sm:w-auto px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold rounded-lg shadow-xs transition flex items-center justify-center gap-1.5"
              >
                {editSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD PARTY MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-slate-900">Add New Commercial Party</h3>
              <button onClick={() => setShowAddModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <form onSubmit={handleCreateVendorSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold mb-1">Party Name *</label>
                  <input
                    type="text"
                    required
                    value={newVendorForm.company_name}
                    onChange={(e) => setNewVendorForm({ ...newVendorForm, company_name: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    placeholder="e.g. Mahavir Mining Equipments"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Mobile Number *</label>
                  <input
                    type="text"
                    required
                    value={newVendorForm.mobile}
                    onChange={(e) => setNewVendorForm({ ...newVendorForm, mobile: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    placeholder="10-digit mobile number"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    value={newVendorForm.email}
                    onChange={(e) => setNewVendorForm({ ...newVendorForm, email: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    placeholder="official@company.com"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">GST No.</label>
                  <input
                    type="text"
                    value={newVendorForm.gstin}
                    onChange={(e) => setNewVendorForm({ ...newVendorForm, gstin: e.target.value.toUpperCase() })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono uppercase"
                    placeholder="e.g. 27AAAAA0000A1Z5"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Aadhaar No.</label>
                  <input
                    type="text"
                    value={newVendorForm.aadhaar_no}
                    onChange={(e) => setNewVendorForm({ ...newVendorForm, aadhaar_no: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                    placeholder="12-digit Aadhaar number"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold mb-1">Billing Address *</label>
                  <textarea
                    rows={2}
                    required
                    value={newVendorForm.billing_address}
                    onChange={(e) => setNewVendorForm({ ...newVendorForm, billing_address: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    placeholder="Plot / Unit No, Road, Industrial Area"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={newVendorForm.city}
                    onChange={(e) => setNewVendorForm({ ...newVendorForm, city: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">State *</label>
                  <input
                    type="text"
                    required
                    value={newVendorForm.state}
                    onChange={(e) => setNewVendorForm({ ...newVendorForm, state: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-slate-600">Cancel</button>
                <button type="submit" disabled={formSubmitting} className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg">
                  Save Vendor
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
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs cursor-pointer"
        >
          <div className="relative max-w-lg max-h-[85vh] bg-white rounded-2xl overflow-hidden p-2 shadow-2xl" onClick={e => e.stopPropagation()}>
            <img src={zoomImage} alt="Lubricant Product Full Preview" className="w-full h-auto object-contain max-h-[75vh] rounded-xl" />
            <div className="p-3 text-center">
              <button
                onClick={() => setZoomImage(null)}
                className="px-4 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
