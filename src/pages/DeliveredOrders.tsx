import React, { useState, useEffect } from 'react';
import {
  CheckCircle2, Search, Filter, RefreshCw, Eye, Calendar,
  Building2, User, Package, IndianRupee, FileText, ArrowRight, X, Clock, Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { DateRangeFilter } from '../components/DateRangeFilter.js';
import { DateRange, getDateRangeFromPreset } from '../utils/dateFilters.js';

interface DeliveredOrdersProps {
  onNavigate: (page: string) => void;
}

export const DeliveredOrders: React.FC<DeliveredOrdersProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>(() => getDateRangeFromPreset('this_month'));
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSalesPerson, setSelectedSalesPerson] = useState('ALL');
  const [selectedVendor, setSelectedVendor] = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const fetchDeliveredOrders = async (range: DateRange = dateRange) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const params = new URLSearchParams();
      if (range.startDate) params.append('startDate', range.startDate);
      if (range.endDate) params.append('endDate', range.endDate);
      if (searchTerm) params.append('search', searchTerm);
      if (selectedSalesPerson !== 'ALL') params.append('sales_person_id', selectedSalesPerson);
      if (selectedVendor !== 'ALL') params.append('vendor_id', selectedVendor);

      const res = await fetch(`/api/orders/delivered?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setOrders(json.orders || []);
      }
    } catch (err) {
      console.error('Error fetching delivered orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveredOrders(dateRange);
  }, [dateRange, selectedSalesPerson, selectedVendor]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDeliveredOrders(dateRange);
  };

  // Dynamic filter lists
  const salesPersonsList = React.useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach(o => {
      if (o.sales_person_name) map.set(o.sales_person_name.trim(), o.sales_person_name.trim());
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [orders]);

  const vendorsList = React.useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach(o => {
      if (o.vendor_name) map.set(o.vendor_name.trim(), o.vendor_name.trim());
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [orders]);

  // Client filtered orders
  const filteredOrders = orders.filter(o => {
    if (selectedSalesPerson !== 'ALL' && (o.sales_person_name || '').trim() !== selectedSalesPerson.trim()) {
      return false;
    }
    if (selectedVendor !== 'ALL' && (o.vendor_name || '').trim() !== selectedVendor.trim()) {
      return false;
    }
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const matchNum = o.order_number?.toLowerCase().includes(s);
      const matchVendor = o.vendor_name?.toLowerCase().includes(s);
      const matchSales = o.sales_person_name?.toLowerCase().includes(s);
      const matchItems = o.items?.some((it: any) =>
        it.product_name?.toLowerCase().includes(s) || it.sku?.toLowerCase().includes(s)
      );
      if (!matchNum && !matchVendor && !matchSales && !matchItems) return false;
    }
    return true;
  });

  const totalDeliveredCount = filteredOrders.length;
  const totalDeliveredAmount = filteredOrders.reduce((acc, o) => acc + (o.grand_total || 0), 0);
  const totalItemsCount = filteredOrders.reduce((acc, o) => acc + (o.total_quantity || 0), 0);

  const formatDeliveredDate = (dateStr: string | null) => {
    if (!dateStr) return 'Delivered';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              Delivered Orders
            </h1>
            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-300">
              Completed Delivery
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Complete historical registry of all successfully delivered client consignments, recipient parties, and delivery timestamps.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchDeliveredOrders(dateRange)}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition"
            title="Refresh List"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/40">
          <div className="flex items-center justify-between text-emerald-800 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Total Delivered Orders</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-3xl font-black font-mono text-emerald-950 mt-1">{totalDeliveredCount}</p>
          <p className="text-[11px] text-emerald-700 mt-0.5">Successfully handed over to parties</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Delivered Sales Value</span>
            <IndianRupee className="w-5 h-5 text-slate-600" />
          </div>
          <p className="text-2xl font-black font-mono text-slate-900 mt-1">₹{totalDeliveredAmount.toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Total billed goods fulfilled</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Total Volume Delivered</span>
            <Package className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-2xl font-black font-mono text-indigo-950 mt-1">{totalItemsCount} <span className="text-sm font-semibold text-slate-500">units</span></p>
          <p className="text-[11px] text-slate-500 mt-0.5">Verified lubricant items delivered</p>
        </div>
      </div>

      {/* Unified Date Range Filter */}
      <DateRangeFilter
        value={dateRange}
        onChange={(newRange) => {
          setDateRange(newRange);
        }}
        defaultPreset="this_month"
        allowAllTime={true}
      />

      {/* Filter Bar: Search, Sales Person, Vendor */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          {/* Search */}
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Search Consignments</span>
            </label>
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                type="text"
                placeholder="Order #, Party, Sales Person, SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-500 outline-none transition"
              />
            </form>
          </div>

          {/* Sales Person */}
          <div className="sm:col-span-1 lg:col-span-4">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              <span>Sales Person</span>
            </label>
            <select
              value={selectedSalesPerson}
              onChange={(e) => setSelectedSalesPerson(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:border-emerald-500 outline-none transition"
            >
              <option value="ALL">All Sales Persons</option>
              {salesPersonsList.map(sp => (
                <option key={sp} value={sp}>{sp}</option>
              ))}
            </select>
          </div>

          {/* Vendor */}
          <div className="sm:col-span-1 lg:col-span-4">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Party / Client</span>
            </label>
            <select
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:border-emerald-500 outline-none transition"
            >
              <option value="ALL">All Parties</option>
              {vendorsList.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table & Mobile Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500">
            <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs font-semibold">Loading delivered orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No delivered orders found</p>
            <p className="text-xs text-slate-400">There are no orders matching your current date or filter selection.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Party</th>
                    <th className="py-3 px-4">Sales Person</th>
                    <th className="py-3 px-4">Products</th>
                    <th className="py-3 px-4 text-right">Order Amount</th>
                    <th className="py-3 px-4">Delivered By</th>
                    <th className="py-3 px-4">Delivered Date / Time</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map(ord => (
                    <tr key={ord.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          #{ord.order_number}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900">{ord.vendor_name}</p>
                        {ord.vendor_city && <p className="text-[11px] text-slate-400">{ord.vendor_city}</p>}
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 font-medium whitespace-nowrap">
                        {ord.sales_person_name}
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="space-y-1">
                          {(ord.items || []).slice(0, 2).map((it: any, idx: number) => (
                            <div key={idx} className="text-[11px] text-slate-700 truncate">
                              <span className="font-semibold text-slate-900">{it.product_name}</span>{' '}
                              <span className="text-slate-500 font-mono">({it.quantity} {it.unit || 'units'})</span>
                            </div>
                          ))}
                          {(ord.items?.length || 0) > 2 && (
                            <span className="text-[10px] text-emerald-700 font-semibold">
                              +{(ord.items?.length || 0) - 2} more items
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-right whitespace-nowrap">
                        ₹{(ord.grand_total || 0).toLocaleString('en-IN')}
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-semibold">
                          <User className="w-3 h-3 text-slate-500" />
                          {ord.delivered_by_name || 'Operations Team'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap font-mono text-[11px]">
                        {formatDeliveredDate(ord.delivered_at || ord.created_at)}
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => onNavigate(`orders/${ord.id}`)}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition flex items-center gap-1 mx-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Details</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (< lg) */}
            <div className="block lg:hidden divide-y divide-slate-100">
              {filteredOrders.map(ord => (
                <div key={ord.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      #{ord.order_number}
                    </span>
                    <span className="font-mono font-black text-emerald-700 text-sm">
                      ₹{(ord.grand_total || 0).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Party</span>
                      <span className="font-bold text-slate-900 block truncate">{ord.vendor_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Sales Person</span>
                      <span className="font-semibold text-slate-800 block truncate">{ord.sales_person_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Delivered By</span>
                      <span className="font-semibold text-slate-700 block truncate">{ord.delivered_by_name || 'Operations Team'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Delivered Date</span>
                      <span className="font-mono text-slate-700 block text-[11px] truncate">
                        {formatDeliveredDate(ord.delivered_at || ord.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Products snippet */}
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Products Delivered</span>
                    <div className="space-y-0.5">
                      {(ord.items || []).map((it: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-[11px]">
                          <span className="text-slate-800 font-medium truncate pr-2">{it.product_name}</span>
                          <span className="text-slate-600 font-mono shrink-0">{it.quantity} {it.unit || 'units'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => onNavigate(`orders/${ord.id}`)}
                    className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Full Details</span>
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
