import React, { useState, useEffect } from 'react';
import {
  Search, Filter, Plus, Eye, FileText, ChevronLeft, ChevronRight,
  Download, Printer, RefreshCw, X, Check, CheckCircle2, AlertCircle, Building2,
  RotateCcw, Store, UserCheck, Edit2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { OrderStatusBadge } from '../components/StatusBadge.js';
import { OrderSlipModal } from '../components/OrderSlipModal.js';
import { EditOrderModal } from '../components/EditOrderModal.js';
import { Order, OrderItem } from '../types.js';
import { DateRangeFilter } from '../components/DateRangeFilter.js';
import { DateRange, getDateRangeFromPreset } from '../utils/dateFilters.js';

interface OrdersProps {
  onNavigate: (page: string) => void;
  initialSearch?: string;
  initialStatus?: string;
}

export const Orders: React.FC<OrdersProps> = ({ onNavigate, initialSearch = '', initialStatus = 'ALL' }) => {
  const { user, hasPermission } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);
  const normalizedInitialStatus = initialStatus === 'ACCEPTED' ? 'APPROVED' : initialStatus === 'PROCESSING' ? 'PACKING' : initialStatus;
  const [status, setStatus] = useState<string>(normalizedInitialStatus);
  const [companyId, setCompanyId] = useState<string>('');
  const [salesPersonId, setSalesPersonId] = useState<string>('');
  const [vendorId, setVendorId] = useState<string>('');
  const [taxType, setTaxType] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange>(() => getDateRangeFromPreset('this_month'));
  const [page, setPage] = useState<number>(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 15 });

  // Companies, Sales Persons & Vendors for filters
  const [companies, setCompanies] = useState<any[]>([]);
  const [salesPersons, setSalesPersons] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);

  // Slip Modal state
  const [slipData, setSlipData] = useState<{ order: Order; items: OrderItem[] } | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<number | string | null>(null);

  // Accept/Cancel quick modals
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const fetchFilters = async () => {
    try {
      const token = localStorage.getItem('petroflow_token');
      const [compRes, salesRes, vendRes] = await Promise.all([
        fetch('/api/companies', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/sales-persons', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/vendors', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (compRes.ok) {
        const cJson = await compRes.json();
        setCompanies(cJson.companies || []);
      }
      if (salesRes.ok) {
        const sJson = await salesRes.json();
        setSalesPersons(sJson.salesPersons || []);
      }
      if (vendRes.ok) {
        const vJson = await vendRes.json();
        setVendors(vJson.vendors || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOrders = async (currentRange: DateRange = dateRange) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15'
      });
      if (search) params.append('search', search);
      if (status && status !== 'ALL') params.append('status', status);
      if (companyId) params.append('company_id', companyId);
      if (salesPersonId) params.append('sales_person_id', salesPersonId);
      if (vendorId) params.append('vendor_id', vendorId);
      if (taxType) params.append('tax_type', taxType);
      if (currentRange.startDate) params.append('startDate', currentRange.startDate);
      if (currentRange.endDate) params.append('endDate', currentRange.endDate);

      const res = await fetch(`/api/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setOrders(json.orders || []);
        if (json.pagination) {
          setPagination(json.pagination);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchOrders(dateRange);
  }, [page, status, companyId, salesPersonId, vendorId, taxType, dateRange]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders(dateRange);
  };

  const handleResetAllFilters = () => {
    setSearch('');
    setStatus('ALL');
    setCompanyId('');
    setSalesPersonId('');
    setVendorId('');
    setTaxType('');
    const resetRange = getDateRangeFromPreset('this_month');
    setDateRange(resetRange);
    setPage(1);
    fetchOrders(resetRange);
  };

  const handleOpenSlip = async (orderId: number) => {
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setSlipData({ order: json.order, items: json.items });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAcceptOrder = async (orderId: number) => {
    if (!window.confirm('Accept and approve this order for operations?')) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/orders/${orderId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        fetchOrders();
      } else {
        const errJson = await res.json();
        alert(errJson.error || 'Failed to accept order');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalOrder || !cancelReason.trim()) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/orders/${cancelModalOrder.id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason })
      });
      if (res.ok) {
        setCancelModalOrder(null);
        setCancelReason('');
        fetchOrders();
      } else {
        const errJson = await res.json();
        alert(errJson.error || 'Failed to cancel order');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const statusTabs = [
    { id: 'ALL', label: 'All Orders' },
    { id: 'NEW', label: 'New' },
    { id: 'APPROVED', label: 'Approved' },
    { id: 'PACKING', label: 'Packing' },
    { id: 'DELIVERED', label: 'Delivered' },
    { id: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Order Management</h1>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full animate-pulse">
              Live
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            View, filter, track and manage customer lubricant orders across packing, dispatch, delivery and verified collections.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchOrders(dateRange)}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium transition"
            title="Refresh Orders"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {(user?.role_slug === 'super_admin' || hasPermission('orders:create')) && (
            <button
              onClick={() => onNavigate('create-order')}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create Order</span>
            </button>
          )}
        </div>
      </div>

      {/* Unified Orders Date Filter */}
      <DateRangeFilter
        value={dateRange}
        onChange={(newRange) => {
          setDateRange(newRange);
          setPage(1);
          fetchOrders(newRange);
        }}
        defaultPreset="this_month"
        allowAllTime={true}
      />

      {/* Status Tabs Filter */}
      <div className="border-b border-slate-200 overflow-x-auto">
        <div className="flex space-x-1 pb-1 min-w-max">
          {statusTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setStatus(tab.id);
                setPage(1);
              }}
              className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 ${
                status === tab.id
                  ? 'border-amber-500 text-amber-600 bg-amber-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Multi-Dimensional Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          {/* Search box */}
          <div className="sm:col-span-2">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Order ID, Vendor, SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 transition"
              />
            </form>
          </div>

          {/* Vendor Filter */}
          <div>
            <select
              value={vendorId}
              onChange={(e) => {
                setVendorId(e.target.value);
                setPage(1);
              }}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="">All Parties</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.company_name}</option>
              ))}
            </select>
          </div>

          {/* Sales Person Filter */}
          {user?.role_slug !== 'sales_person' ? (
            <div>
              <select
                value={salesPersonId}
                onChange={(e) => {
                  setSalesPersonId(e.target.value);
                  setPage(1);
                }}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="">All Sales Team</option>
                {salesPersons.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <div className="w-full py-2 px-3 bg-amber-50/50 border border-amber-200 text-amber-900 rounded-lg text-xs font-semibold truncate">
                Sales: {user.name}
              </div>
            </div>
          )}

          {/* Billing Company Filter */}
          <div>
            <select
              value={companyId}
              onChange={(e) => {
                setCompanyId(e.target.value);
                setPage(1);
              }}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="">All Billing Companies</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Tax Type / Reset */}
          <div className="flex items-center gap-2">
            <select
              value={taxType}
              onChange={(e) => {
                setTaxType(e.target.value);
                setPage(1);
              }}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="">All Invoicing</option>
              <option value="GST_18">GST (18%)</option>
              <option value="NON_GST">Non-GST</option>
            </select>

            {(search || companyId || salesPersonId || vendorId || taxType || status !== 'ALL' || dateRange.preset !== 'this_month') && (
              <button
                onClick={handleResetAllFilters}
                className="p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg shrink-0 transition"
                title="Reset all filters"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Orders Table & Mobile Cards */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Mobile Cards View (< md) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="py-12 text-center text-slate-500">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <span className="text-xs">Loading orders...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No orders match your filter criteria.
            </div>
          ) : (
            orders.map((ord) => {
              const isAdmin = ['super_admin', 'admin'].includes(user?.role_slug || '');
              return (
                <div key={ord.id} className="p-4 space-y-3 hover:bg-slate-50/70 transition">
                  {/* Top: Order #, Date, Status */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span
                        onClick={() => onNavigate(`orders/${ord.id}`)}
                        className="font-mono font-bold text-amber-600 hover:text-amber-700 cursor-pointer text-sm"
                      >
                        {ord.order_number}
                      </span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">
                        {new Date(ord.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <OrderStatusBadge status={ord.order_status} size="sm" />
                  </div>

                  {/* Client & Sales Info */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">Party</p>
                      <p className="font-semibold text-slate-900 truncate" title={ord.vendor_name}>{ord.vendor_name}</p>
                      <p className="text-[10px] text-slate-500">{ord.vendor_city}, {ord.vendor_state}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">Sales Officer</p>
                      <p className="font-medium text-slate-800 truncate">{ord.sales_person_name}</p>
                      <p className="text-[10px] text-slate-500">{ord.billing_company_code}</p>
                    </div>
                  </div>

                  {/* Products row with thumbnails */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      {ord.items && ord.items.length > 0 ? (
                        <div className="flex items-center -space-x-1.5 shrink-0">
                          {ord.items.slice(0, 3).map((item: any, iIdx: number) => (
                            <div
                              key={item.id || iIdx}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (item.product_image) setZoomImage(item.product_image);
                              }}
                              className="w-9 h-9 rounded-lg bg-white border border-slate-200 overflow-hidden shadow-2xs cursor-pointer hover:scale-110 transition shrink-0"
                              title={`${item.product_name} (${item.sku})`}
                            >
                              <img
                                src={item.product_image || 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=80&auto=format&fit=crop&q=80'}
                                alt={item.product_name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                          {ord.items.length > 3 && (
                            <span
                              onClick={() => onNavigate(`orders/${ord.id}`)}
                              className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold flex items-center justify-center cursor-pointer"
                            >
                              +{ord.items.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 font-bold text-[9px]">
                          LUBE
                        </div>
                      )}
                      <div className="min-w-0 flex-1 text-xs">
                        <p className="font-medium text-slate-800 truncate">{ord.products_summary || 'Multiple Lubricants'}</p>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {ord.total_delivered || 0} / {ord.total_quantity || 0} delivered
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Financial Metrics Strip */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-center">
                    <div>
                      <span className="block text-[10px] text-slate-400 font-semibold uppercase">Total Value</span>
                      <span className="font-mono font-bold text-xs text-slate-900">₹{ord.grand_total.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-semibold uppercase">Received</span>
                      <span className="font-mono font-semibold text-xs text-emerald-600">₹{ord.amount_received.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-semibold uppercase">Balance Payment</span>
                      <span className={`font-mono font-bold text-xs ${ord.pending_amount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        ₹{ord.pending_amount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons for Mobile */}
                  <div className="flex items-center justify-between pt-1 gap-2">
                    <button
                      onClick={() => onNavigate(`orders/${ord.id}`)}
                      className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition text-center shadow-xs"
                    >
                      View Order
                    </button>
                    <button
                      onClick={() => handleOpenSlip(ord.id)}
                      className="py-2 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg transition flex items-center justify-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-600" />
                      <span>Slip</span>
                    </button>
                    {isAdmin && ord.order_status === 'NEW' && (
                      <>
                        <button
                          onClick={() => handleAcceptOrder(ord.id)}
                          disabled={actionLoading}
                          className="p-2 bg-emerald-600 text-white rounded-lg text-xs font-bold transition hover:bg-emerald-700"
                          title="Approve Order"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setCancelModalOrder(ord);
                            setCancelReason('');
                          }}
                          disabled={actionLoading}
                          className="p-2 bg-rose-600 text-white rounded-lg text-xs font-bold transition hover:bg-rose-700"
                          title="Cancel Order"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Sales Person</th>
                <th className="py-3 px-4">Party</th>
                <th className="py-3 px-4">Products / Brand</th>
                <th className="py-3 px-4 text-center">Progress</th>
                <th className="py-3 px-4 text-right">Order Value</th>
                <th className="py-3 px-4 text-right">Received</th>
                <th className="py-3 px-4 text-right">Balance Payment</th>
                <th className="py-3 px-4">Delivery Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading orders...</span>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    No orders match your filter criteria.
                  </td>
                </tr>
              ) : (
                orders.map((ord) => {
                  const isAdmin = ['super_admin', 'admin'].includes(user?.role_slug || '');
                  return (
                    <tr key={ord.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <span
                          onClick={() => onNavigate(`orders/${ord.id}`)}
                          className="font-mono font-bold text-amber-600 hover:text-amber-700 cursor-pointer"
                        >
                          {ord.order_number}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          {new Date(ord.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-900">{ord.sales_person_name}</span>
                        <span className="block text-[10px] text-slate-400">{ord.billing_company_code}</span>
                      </td>

                      <td className="py-3 px-4 max-w-[180px]">
                        <p className="font-semibold text-slate-900 truncate" title={ord.vendor_name}>
                          {ord.vendor_name}
                        </p>
                        <p className="text-[10px] text-slate-500">{ord.vendor_city}, {ord.vendor_state}</p>
                      </td>

                      <td className="py-3 px-4 max-w-[240px]">
                        <div className="flex items-center gap-2">
                          {/* Product Thumbnails with +N */}
                          {ord.items && ord.items.length > 0 ? (
                            <div className="flex items-center -space-x-2 shrink-0">
                              {ord.items.slice(0, 2).map((item: any, iIdx: number) => (
                                <div
                                  key={item.id || iIdx}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (item.product_image) setZoomImage(item.product_image);
                                  }}
                                  className="w-8 h-8 rounded-md bg-white border border-slate-200 overflow-hidden shadow-xs cursor-pointer hover:scale-110 hover:z-10 transition shrink-0"
                                  title={`${item.product_name} (${item.sku})`}
                                >
                                  <img
                                    src={item.product_image || 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=80&auto=format&fit=crop&q=80'}
                                    alt={item.product_name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ))}
                              {ord.items.length > 2 && (
                                <span
                                  onClick={() => onNavigate(`orders/${ord.id}`)}
                                  className="w-6 h-6 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold flex items-center justify-center cursor-pointer hover:bg-amber-200 transition"
                                  title={`${ord.items.length - 2} more lubricant products`}
                                >
                                  +{ord.items.length - 2}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                              <span className="text-[10px] font-bold">LUBE</span>
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-slate-800 truncate" title={ord.products_summary || ''}>
                              {ord.products_summary || 'Multiple Lubricants'}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              {ord.item_count || (ord.items?.length || 1)} products • {ord.total_quantity || 0} units
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="inline-block text-[11px] font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {ord.total_delivered || 0} / {ord.total_quantity || 0} delivered
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-slate-900 text-right">
                        ₹{ord.grand_total.toLocaleString('en-IN')}
                      </td>

                      <td className="py-3 px-4 font-mono font-semibold text-emerald-600 text-right">
                        ₹{ord.amount_received.toLocaleString('en-IN')}
                      </td>

                      <td className="py-3 px-4 font-mono font-semibold text-right">
                        {ord.pending_amount > 0 ? (
                          <span className="text-rose-600 font-bold">₹{ord.pending_amount.toLocaleString('en-IN')}</span>
                        ) : (
                          <span className="text-slate-400">₹0</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {ord.required_delivery_date
                          ? new Date(ord.required_delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : 'Immediate'}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <OrderStatusBadge status={ord.order_status} size="sm" />
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onNavigate(`orders/${ord.id}`)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-md transition"
                            title="View Full Order Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Order Option with View */}
                          {(() => {
                            const isCancelled = ord.order_status === 'CANCELLED';
                            const isDelivered = ord.order_status === 'DELIVERED';
                            const canEdit = !isCancelled && (
                              isDelivered
                                ? (isAdmin || hasPermission('orders:edit_delivered'))
                                : (isAdmin || hasPermission('orders:edit') || ord.sales_person_id === user?.id)
                            );
                            if (!canEdit) return null;
                            return (
                              <button
                                onClick={() => setEditingOrderId(ord.id)}
                                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition"
                                title="Edit Order Details"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            );
                          })()}

                          <button
                            onClick={() => handleOpenSlip(ord.id)}
                            className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-md transition"
                            title="Generate Official Order Slip"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Admin Actions if NEW */}
                          {isAdmin && ord.order_status === 'NEW' && (
                            <>
                              <button
                                onClick={() => handleAcceptOrder(ord.id)}
                                disabled={actionLoading}
                                className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition"
                                title="Approve / Accept Order"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setCancelModalOrder(ord);
                                  setCancelReason('');
                                }}
                                disabled={actionLoading}
                                className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition"
                                title="Cancel Order"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-600">
          <div>
            Showing <span className="font-semibold text-slate-900">{orders.length}</span> of{' '}
            <span className="font-semibold text-slate-900">{pagination.total}</span> total orders
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 bg-white border border-slate-200 rounded-md hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Page {page} of {pagination.totalPages || 1}</span>
            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="p-1.5 bg-white border border-slate-200 rounded-md hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Slip Modal */}
      {slipData && (
        <OrderSlipModal
          order={slipData.order}
          items={slipData.items}
          isOpen={true}
          onClose={() => setSlipData(null)}
        />
      )}

      {/* Cancellation Reason Modal */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
              <AlertCircle className="w-5 h-5" />
              <span>Cancel Order #{cancelModalOrder.order_number}</span>
            </div>
            <p className="text-xs text-slate-600">
              Please enter an official cancellation reason. This will be stored permanently in the audit trail and notified to the Sales Person.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Cancellation *
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Client requested postponement of quarterly turnaround; credit term non-compliance..."
                rows={3}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-rose-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCancelModalOrder(null)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={actionLoading || cancelReason.trim().length < 5}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
              >
                {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-2xl w-full bg-slate-900 rounded-2xl overflow-hidden p-2 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-3 text-white border-b border-slate-800">
              <span className="text-xs font-bold tracking-wide">Lubricant Product Image</span>
              <button onClick={() => setZoomImage(null)} className="p-1 hover:bg-slate-800 rounded">
                <X className="w-5 h-5 text-slate-300" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-slate-950">
              <img src={zoomImage} alt="Product Preview" className="max-h-[70vh] object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {editingOrderId && (
        <EditOrderModal
          orderId={editingOrderId}
          isOpen={!!editingOrderId}
          onClose={() => setEditingOrderId(null)}
          onOrderUpdated={() => fetchOrders(dateRange)}
        />
      )}
    </div>
  );
};
