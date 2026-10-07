import React, { useState, useEffect } from 'react';
import {
  TrendingUp, ShoppingCart, Clock, PackageCheck, Package, Truck, CheckCircle, XCircle,
  IndianRupee, AlertCircle, ArrowUpRight, ArrowDownRight, Eye, FileText,
  Building, User, ChevronRight, RefreshCw, BarChart2, X, Filter, Calendar,
  ShieldCheck, Layers, Award, Sparkles, Check, AlertTriangle, ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { OrderStatusBadge } from '../components/StatusBadge.js';
import { OrderSlipModal } from '../components/OrderSlipModal.js';
import { Order, OrderItem } from '../types.js';
import { DateRangeFilter } from '../components/DateRangeFilter.js';
import { DateRange, getDateRangeFromPreset, formatDisplayDate } from '../utils/dateFilters.js';

export const Dashboard: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { user, hasPermission } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(() => getDateRangeFromPreset('this_month'));
  
  // Multi-filters for Admin and Operational roles
  const [selectedSalesPerson, setSelectedSalesPerson] = useState<string>('ALL');
  const [selectedVendor, setSelectedVendor] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modals
  const [selectedOrderForSlip, setSelectedOrderForSlip] = useState<{ order: Order; items: OrderItem[] } | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [paymentActionLoading, setPaymentActionLoading] = useState<number | null>(null);

  const fetchStats = async (
    currentRange: DateRange = dateRange,
    sp: string = selectedSalesPerson,
    vnd: string = selectedVendor,
    st: string = selectedStatus
  ) => {
    try {
      const token = localStorage.getItem('petroflow_token');
      const params = new URLSearchParams();
      if (currentRange.startDate) params.append('startDate', currentRange.startDate);
      if (currentRange.endDate) params.append('endDate', currentRange.endDate);
      if (sp && sp !== 'ALL') params.append('sales_person_id', sp);
      if (vnd && vnd !== 'ALL') params.append('vendor_id', vnd);
      if (st && st !== 'ALL') params.append('order_status', st);

      const res = await fetch(`/api/dashboard/stats?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchStats(dateRange, selectedSalesPerson, selectedVendor, selectedStatus);
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats(dateRange, selectedSalesPerson, selectedVendor, selectedStatus);
  };

  const handleClearFilters = () => {
    setSelectedSalesPerson('ALL');
    setSelectedVendor('ALL');
    setSelectedStatus('ALL');
    fetchStats(dateRange, 'ALL', 'ALL', 'ALL');
  };

  const handleOpenSlip = async (orderId: number) => {
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setSelectedOrderForSlip({ order: json.order, items: json.items });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleVerifyPayment = async (paymentId: number) => {
    setPaymentActionLoading(paymentId);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/payments/${paymentId}/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notes: 'Verified via Accounts Dashboard quick action' })
      });
      if (res.ok) {
        await fetchStats(dateRange, selectedSalesPerson, selectedVendor, selectedStatus);
      } else {
        const json = await res.json();
        alert(json.error || 'Failed to verify payment');
      }
    } catch (err) {
      console.error(err);
      alert('Error verifying payment');
    } finally {
      setPaymentActionLoading(null);
    }
  };

  const handleRejectPayment = async (paymentId: number) => {
    const reason = prompt('Please enter rejection reason:');
    if (!reason) return;
    setPaymentActionLoading(paymentId);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/payments/${paymentId}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rejection_reason: reason })
      });
      if (res.ok) {
        await fetchStats(dateRange, selectedSalesPerson, selectedVendor, selectedStatus);
      } else {
        const json = await res.json();
        alert(json.error || 'Failed to reject payment');
      }
    } catch (err) {
      console.error(err);
      alert('Error rejecting payment');
    } finally {
      setPaymentActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[450px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500 font-semibold tracking-wide">Loading role-tailored dashboard...</p>
        </div>
      </div>
    );
  }

  const roleType = data?.roleType || 'master_admin';

  // =============================================================
  // RENDER 1: SALES PERSON DASHBOARD
  // =============================================================
  if (roleType === 'sales_person') {
    const cards = data.cards || {};
    const charts = data.charts || {};
    const monthly = charts.myMonthlySales || [];
    const statusBreakdown = charts.myOrdersByStatus || [];
    const topProducts = charts.myTopProducts || [];
    const topVendors = charts.myTopVendors || [];
    const paymentGauge = charts.myPaymentReceivedVsPending;
    const recentOrders = data.recentOrders || [];
    const canViewPayments = data.canViewPayments !== false;

    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-slate-900 rounded-2xl p-6 text-white border border-amber-500/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-amber-400 text-slate-950 shadow-xs">
                Sales Representative Workspace
              </span>
              <span className="text-xs text-amber-200">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight mt-1 text-white">
              Welcome, {user?.name}
            </h1>
            <p className="text-xs text-amber-100/90 mt-1 max-w-xl">
              Strictly monitoring your designated client portfolio, own orders progress, and order delivery status.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 bg-slate-900/60 hover:bg-slate-900 text-amber-200 rounded-xl text-xs font-semibold border border-amber-400/30 transition flex items-center gap-1.5"
              title="Refresh my numbers"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {(user?.role_slug === 'super_admin' || hasPermission('orders:create')) && (
              <button
                onClick={() => onNavigate('create-order')}
                className="px-4 py-2 bg-white hover:bg-amber-50 text-slate-950 rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
              >
                <span>+ Create Order</span>
              </button>
            )}
          </div>
        </div>

        {/* Date Filter */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <DateRangeFilter
            value={dateRange}
            onChange={(newRange) => {
              setDateRange(newRange);
              fetchStats(newRange, selectedSalesPerson, selectedVendor, selectedStatus);
            }}
            defaultPreset="this_month"
            allowAllTime={true}
          />
        </div>

        {/* Sales Person Cards: Section 1 - Volume & Status Pipeline */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
            <ShoppingCart className="w-3.5 h-3.5 text-amber-600" />
            My Order Pipeline & Consignments
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div
              onClick={() => onNavigate('orders?status=ALL')}
              className="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-amber-400 hover:shadow-xs transition cursor-pointer"
            >
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold">My Total Orders</span>
                <ShoppingCart className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-2xl font-black text-slate-900">{cards.myTotalOrders || 0}</p>
              <p className="text-[10px] text-slate-400 mt-1">Booked in selected period</p>
            </div>

            <div
              onClick={() => onNavigate('orders?status=NEW')}
              className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-200 hover:border-blue-400 hover:shadow-xs transition cursor-pointer"
            >
              <div className="flex items-center justify-between text-blue-700 mb-1">
                <span className="text-[11px] font-semibold">1. New</span>
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-black text-blue-900">{cards.myNewOrders || 0}</p>
              <p className="text-[10px] text-blue-600 mt-1">Awaiting review</p>
            </div>

            <div
              onClick={() => onNavigate('orders?status=APPROVED')}
              className="bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-200 hover:border-indigo-400 hover:shadow-xs transition cursor-pointer"
            >
              <div className="flex items-center justify-between text-indigo-700 mb-1">
                <span className="text-[11px] font-semibold">2. Approved</span>
                <CheckCircle className="w-4 h-4 text-indigo-600" />
              </div>
              <p className="text-2xl font-black text-indigo-900">{cards.myApprovedOrders || 0}</p>
              <p className="text-[10px] text-indigo-600 mt-1">Approved for packing</p>
            </div>

            <div
              onClick={() => onNavigate('orders?status=PACKING')}
              className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200 hover:border-amber-400 hover:shadow-xs transition cursor-pointer"
            >
              <div className="flex items-center justify-between text-amber-700 mb-1">
                <span className="text-[11px] font-semibold">3. Packing</span>
                <PackageCheck className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-black text-amber-900">{cards.myOrdersInPacking || 0}</p>
              <p className="text-[10px] text-amber-700 mt-1">Packing & formulation</p>
            </div>

            <div
              onClick={() => onNavigate('orders?status=DELIVERED')}
              className="bg-teal-50/60 p-3.5 rounded-xl border border-teal-200 hover:border-teal-400 hover:shadow-xs transition cursor-pointer"
            >
              <div className="flex items-center justify-between text-teal-700 mb-1">
                <span className="text-[11px] font-semibold">4. Delivered</span>
                <CheckCircle className="w-4 h-4 text-teal-600" />
              </div>
              <p className="text-2xl font-black text-teal-900">{cards.myDeliveredOrders || 0}</p>
              <p className="text-[10px] text-teal-600 mt-1">Customer received</p>
            </div>

            <div
              onClick={() => onNavigate('orders?status=CANCELLED')}
              className="bg-rose-50/60 p-3.5 rounded-xl border border-rose-200 hover:border-rose-400 hover:shadow-xs transition cursor-pointer"
            >
              <div className="flex items-center justify-between text-rose-700 mb-1">
                <span className="text-[11px] font-semibold">Cancelled</span>
                <XCircle className="w-4 h-4 text-rose-600" />
              </div>
              <p className="text-2xl font-black text-rose-900">{cards.myCancelledOrders || 0}</p>
              <p className="text-[10px] text-rose-600 mt-1">Voided / rejected</p>
            </div>

            <div
              onClick={() => onNavigate('vendors')}
              className="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-amber-400 hover:shadow-xs transition cursor-pointer"
            >
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold">My Assigned Vendors</span>
                <Building className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-black text-slate-900">{cards.myVendors || 0}</p>
              <p className="text-[10px] text-slate-400 mt-1">Client accounts owned</p>
            </div>
          </div>
        </div>

        {/* Sales Person Cards: Section 2 - Financial Collections (Guarded by Permission) */}
        {canViewPayments && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
              My Financial & Payment Collections
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <p className="text-xs font-semibold">My Total Sales Value</p>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Gross Billed</span>
                </div>
                <p className="text-2xl font-black text-slate-900 font-mono mt-2">
                  ₹{(cards.myTotalSalesValue || 0).toLocaleString('en-IN')}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Sum of all non-cancelled orders</p>
              </div>

              <div className="bg-emerald-50/60 p-5 rounded-2xl border border-emerald-200 shadow-xs">
                <div className="flex items-center justify-between text-emerald-800">
                  <p className="text-xs font-bold">My Verified Payment Received</p>
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-black text-emerald-700 font-mono mt-2">
                  ₹{(cards.myVerifiedPaymentReceived || 0).toLocaleString('en-IN')}
                </p>
                <p className="text-[11px] text-emerald-700 mt-1">Audited & verified payments</p>
              </div>

              <div className="bg-rose-50/60 p-5 rounded-2xl border border-rose-200 shadow-xs">
                <div className="flex items-center justify-between text-rose-800">
                  <p className="text-xs font-bold">My Pending Payment</p>
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                </div>
                <p className="text-2xl font-black text-rose-700 font-mono mt-2">
                  ₹{(cards.myPendingPayment || 0).toLocaleString('en-IN')}
                </p>
                <p className="text-[11px] text-rose-700 mt-1">Outstanding vendor balance</p>
              </div>
            </div>
          </div>
        )}

        {/* Sales Person Charts: Monthly Sales & Order Status Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* My Monthly Sales */}
          <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-amber-500" />
                  My Sales Performance Trend
                </h3>
                <p className="text-xs text-slate-500">Period revenue generated by your orders</p>
              </div>
              <span className="text-xs text-slate-400 font-mono">INR (₹)</span>
            </div>

            {monthly.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-xs text-slate-400">
                No order revenue recorded in selected date range
              </div>
            ) : (
              <div>
                <div className="h-56 flex items-end gap-5 pt-6 pb-2 px-2 border-b border-slate-100">
                  {monthly.map((m: any, idx: number) => {
                    const maxVal = Math.max(...monthly.map((x: any) => x.total_sales || 1), 10000);
                    const salesH = Math.max(10, Math.round(((m.total_sales || 0) / maxVal) * 100));
                    const recH = Math.max(6, Math.round(((m.total_received || 0) / maxVal) * 100));

                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                        <div className="w-full flex items-end justify-center gap-1 h-full">
                          <div
                            style={{ height: `${salesH}%` }}
                            className="w-1/2 max-w-[24px] bg-slate-900 rounded-t group-hover:bg-amber-500 transition duration-150 relative"
                          >
                            <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-950 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-20 font-mono shadow">
                              ₹{(m.total_sales / 1000).toFixed(0)}k
                            </div>
                          </div>
                          {canViewPayments && (
                            <div
                              style={{ height: `${recH}%` }}
                              className="w-1/2 max-w-[24px] bg-emerald-500 rounded-t group-hover:bg-emerald-600 transition duration-150 relative"
                            >
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block bg-emerald-800 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-20 font-mono shadow">
                                ₹{(m.total_received / 1000).toFixed(0)}k
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500 whitespace-nowrap">{m.month}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-center gap-6 mt-3 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-xs bg-slate-900"></span>
                    <span>My Total Billed Sales</span>
                  </div>
                  {canViewPayments && (
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-xs bg-emerald-500"></span>
                      <span>My Verified Collections</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* My Orders by Status Breakdown */}
          <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">My Orders by Status</h3>
              <p className="text-xs text-slate-500 mb-3">Live workflow distribution</p>

              <div className="space-y-2">
                {statusBreakdown.map((sb: any, idx: number) => {
                  const pct = cards.myTotalOrders > 0 ? Math.round((sb.count / cards.myTotalOrders) * 100) : 0;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">{sb.label}</span>
                        <span className="font-mono font-bold text-slate-900">{sb.count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%`, backgroundColor: sb.color }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {canViewPayments && paymentGauge && (
              <div className="mt-4 pt-3 border-t border-slate-100 bg-slate-50 p-3 rounded-xl">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-slate-800">Collection Realization</span>
                  <span className="font-bold text-emerald-700 font-mono">
                    {paymentGauge.total > 0 ? Math.round((paymentGauge.received / paymentGauge.total) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${paymentGauge.total > 0 ? Math.min(100, Math.round((paymentGauge.received / paymentGauge.total) * 100)) : 0}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top Products & Top Vendors (strictly own portfolio) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* My Top Products */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-1">My Top Lubricant Products</h3>
            <p className="text-xs text-slate-500 mb-3">Best-selling formulations in your accounts</p>

            <div className="space-y-2.5">
              {topProducts.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No product data for selected period</p>
              ) : (
                topProducts.map((p: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {p.product_image ? (
                        <img
                          src={p.product_image}
                          alt={p.product_name}
                          onClick={() => setZoomImage(p.product_image)}
                          className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0 cursor-pointer"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4 text-slate-500" />
                        </div>
                      )}
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-slate-900 truncate">{p.product_name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{p.sku} • {p.total_qty} units</p>
                      </div>
                    </div>
                    {canViewPayments && (
                      <span className="font-mono font-bold text-slate-900 shrink-0">
                        ₹{(p.total_amount || 0).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* My Top Vendors */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">My Key Vendors</h3>
                <p className="text-xs text-slate-500">Your top purchasing clients</p>
              </div>
              <button
                onClick={() => onNavigate('vendors')}
                className="text-xs font-semibold text-amber-600 hover:text-amber-700"
              >
                All My Vendors →
              </button>
            </div>

            <div className="space-y-2.5">
              {topVendors.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No vendor activity in this period</p>
              ) : (
                topVendors.map((v: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <div>
                      <p className="font-bold text-slate-900">{v.company_name}</p>
                      <p className="text-[11px] text-slate-500">{v.city} • {v.order_count} orders</p>
                    </div>
                    {canViewPayments && (
                      <div className="text-right font-mono">
                        <p className="font-bold text-slate-900">₹{(v.total_spent || 0).toLocaleString('en-IN')}</p>
                        {v.pending > 0 ? (
                          <span className="text-[10px] text-rose-600 font-semibold">₹{v.pending.toLocaleString('en-IN')} pending</span>
                        ) : (
                          <span className="text-[10px] text-emerald-600 font-semibold">Settled</span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* My Recent Orders Table (Strictly Own Orders) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">My Recent Orders</h3>
              <p className="text-xs text-slate-500">Live order intake and status updates strictly for your accounts</p>
            </div>
            <button
              onClick={() => onNavigate('orders')}
              className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1"
            >
              <span>View All My Orders</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Products</th>
                  {canViewPayments && (
                    <>
                      <th className="py-3 px-4 text-right">Order Value</th>
                      <th className="py-3 px-4 text-right">Pending</th>
                    </>
                  )}
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={canViewPayments ? 6 : 4} className="py-8 text-center text-slate-400">
                      No orders found for your sales account in this period
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((ord: any) => (
                    <tr key={ord.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {ord.order_number}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {ord.vendor_name}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {(ord.items || []).slice(0, 3).map((item: any, iIdx: number) => (
                            <div
                              key={iIdx}
                              onClick={() => item.product_image && setZoomImage(item.product_image)}
                              className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:border-amber-400 shadow-2xs"
                              title={`${item.product_name} (${item.sku})`}
                            >
                              {item.product_image ? (
                                <img
                                  src={item.product_image}
                                  alt={item.product_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                          ))}
                          {(ord.items?.length || 0) > 3 && (
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              +{(ord.items?.length || 0) - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      {canViewPayments && (
                        <>
                          <td className="py-3 px-4 font-mono font-semibold text-slate-900 text-right">
                            ₹{(ord.grand_total || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-rose-600 text-right">
                            ₹{(ord.pending_amount || 0).toLocaleString('en-IN')}
                          </td>
                        </>
                      )}
                      <td className="py-3 px-4">
                        <OrderStatusBadge status={ord.order_status} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onNavigate(`orders/${ord.id}`)}
                            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded transition"
                            title="View Full Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenSlip(ord.id)}
                            className="p-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded transition"
                            title="View Official Order Slip"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // =============================================================
  // RENDER 2: PACKING TEAM DASHBOARD
  // =============================================================
  if (roleType === 'packing_team') {
    const cards = data.cards || {};
    const queue = data.packingQueue || [];
    const filterOptions = data.filterOptions || {};

    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-purple-700 via-indigo-800 to-slate-900 rounded-2xl p-6 text-white border border-purple-500/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-purple-400 text-slate-950 shadow-xs">
                Packing Operations Workspace
              </span>
              <span className="text-xs text-purple-200">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight mt-1 text-white">
              Welcome, {user?.name}
            </h1>
            <p className="text-xs text-purple-100/90 mt-1 max-w-xl">
              Check finished lubricant stock readiness, box and pallet packaging, and mark packed orders directly as Delivered.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 bg-slate-900/60 hover:bg-slate-900 text-purple-200 rounded-xl text-xs font-semibold border border-purple-400/30 transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => onNavigate('packing')}
              className="px-4 py-2 bg-white hover:bg-purple-50 text-slate-950 rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
            >
              <PackageCheck className="w-4 h-4 text-purple-600" />
              <span>Open Packing Floor</span>
            </button>
          </div>
        </div>

        {/* Operational Filters: Date, Sales Person, Vendor */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <DateRangeFilter
            value={dateRange}
            onChange={(newRange) => {
              setDateRange(newRange);
              fetchStats(newRange, selectedSalesPerson, selectedVendor, selectedStatus);
            }}
            defaultPreset="this_month"
            allowAllTime={true}
          />

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
              <Filter className="w-3.5 h-3.5 text-amber-500" />
              <span>Queue Filters:</span>
            </div>

            {/* Sales Person Filter */}
            <select
              value={selectedSalesPerson}
              onChange={(e) => {
                setSelectedSalesPerson(e.target.value);
                fetchStats(dateRange, e.target.value, selectedVendor, selectedStatus);
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg outline-none focus:border-purple-500"
            >
              <option value="ALL">All Sales Persons</option>
              {(filterOptions.salesPersons || []).map((sp: any) => (
                <option key={sp.id} value={sp.id}>{sp.name}</option>
              ))}
            </select>

            {/* Vendor Filter */}
            <select
              value={selectedVendor}
              onChange={(e) => {
                setSelectedVendor(e.target.value);
                fetchStats(dateRange, selectedSalesPerson, e.target.value, selectedStatus);
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg outline-none focus:border-purple-500"
            >
              <option value="ALL">All Vendors</option>
              {(filterOptions.vendors || []).map((v: any) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>

            {(selectedSalesPerson !== 'ALL' || selectedVendor !== 'ALL') && (
              <button
                onClick={handleClearFilters}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold underline ml-auto"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Packing Dashboard Cards */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
            <PackageCheck className="w-3.5 h-3.5 text-purple-600" />
            Packing Floor Key Metrics
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200">
              <span className="text-[11px] font-semibold text-amber-800">Pending Packing</span>
              <p className="text-2xl font-black text-amber-900 mt-1">{cards.pendingPacking || 0}</p>
              <p className="text-[10px] text-amber-700 mt-0.5">Awaiting floor start</p>
            </div>

            <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200">
              <span className="text-[11px] font-semibold text-indigo-800">In Progress</span>
              <p className="text-2xl font-black text-indigo-900 mt-1">{cards.packingInProgress || 0}</p>
              <p className="text-[10px] text-indigo-700 mt-0.5">Currently packaging</p>
            </div>

            <div className="bg-teal-50/70 p-3.5 rounded-xl border border-teal-200">
              <span className="text-[11px] font-semibold text-teal-800">Packed Orders</span>
              <p className="text-2xl font-black text-teal-900 mt-1">{cards.packedOrders || 0}</p>
              <p className="text-[10px] text-teal-700 mt-0.5">Ready for DELIVER</p>
            </div>

            <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200">
              <span className="text-[11px] font-semibold text-emerald-800">Delivered</span>
              <p className="text-2xl font-black text-emerald-900 mt-1">{cards.deliveredOrders || 0}</p>
              <p className="text-[10px] text-emerald-700 mt-0.5">Customer received</p>
            </div>

            <div className="bg-rose-50/70 p-3.5 rounded-xl border border-rose-200">
              <span className="text-[11px] font-semibold text-rose-800">Orders on Hold</span>
              <p className="text-2xl font-black text-rose-900 mt-1">{cards.ordersOnHold || 0}</p>
              <p className="text-[10px] text-rose-700 mt-0.5">Material issue / hold</p>
            </div>

            <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-200">
              <span className="text-[11px] font-semibold text-blue-800">Today's Packing</span>
              <p className="text-2xl font-black text-blue-900 mt-1">{cards.todayPacking || 0}</p>
              <p className="text-[10px] text-blue-700 mt-0.5">Processed today</p>
            </div>

            <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-300">
              <span className="text-[11px] font-semibold text-slate-700">Total Items to Pack</span>
              <p className="text-2xl font-black text-slate-900 mt-1">{cards.totalItemsToPack || 0}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Units / drums in queue</p>
            </div>

            <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200">
              <span className="text-[11px] font-semibold text-emerald-800">Completed Packing</span>
              <p className="text-2xl font-black text-emerald-900 mt-1">{cards.completedPacking || 0}</p>
              <p className="text-[10px] text-emerald-700 mt-0.5">Fully packed & done</p>
            </div>
          </div>
        </div>

        {/* Assigned Orders Queue with Images, Product Names, Quantities, Vendor, Sales Person, Required Date */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-purple-600" />
                <span>Assigned Packaging Consignments</span>
              </h3>
              <p className="text-xs text-slate-500">Live order queue for finished lubricant packaging & bay handover</p>
            </div>
            <button
              onClick={() => onNavigate('packing')}
              className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1"
            >
              <span>Manage Packing Floor</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Sales Person</th>
                  <th className="py-3 px-4">Required Delivery</th>
                  <th className="py-3 px-4">Lubricant Items & Quantity</th>
                  <th className="py-3 px-4">Packing Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {queue.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No orders in packaging queue matching current filters
                    </td>
                  </tr>
                ) : (
                  queue.map((ord: any) => (
                    <tr key={ord.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {ord.order_number}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {ord.vendor_name}
                        <span className="block text-[10px] text-slate-400 font-normal">{ord.vendor_city}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {ord.sales_person_name}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {ord.required_delivery_date ? formatDisplayDate(ord.required_delivery_date) : 'Standard'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1.5 max-w-md">
                          {(ord.items || []).map((it: any, iIdx: number) => (
                            <div key={iIdx} className="flex items-center gap-2">
                              {it.product_image ? (
                                <img
                                  src={it.product_image}
                                  alt={it.product_name}
                                  onClick={() => setZoomImage(it.product_image)}
                                  className="w-7 h-7 rounded-md object-cover border border-slate-200 shrink-0 cursor-pointer"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                  <Package className="w-3.5 h-3.5 text-slate-400" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <span className="font-semibold text-slate-900 truncate block text-[11px]">{it.product_name}</span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  Qty: <span className="font-bold text-slate-800">{it.quantity} {it.unit}</span>
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          ord.packing_status === 'PACKED' || ord.packing_status === 'HANDED_OVER'
                            ? 'bg-teal-50 text-teal-700 border-teal-200'
                            : ord.packing_status === 'IN_PROGRESS'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : ord.packing_status === 'ON_HOLD'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {ord.packing_status || 'PENDING_PACKING'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => onNavigate('packing')}
                          className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-semibold transition"
                        >
                          Pack Order
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // =============================================================
  // RENDER 3: ACCOUNTS TEAM DASHBOARD
  // =============================================================
  if (roleType === 'accounts') {
    const cards = data.cards || {};
    const pendingList = data.pendingVerificationList || [];
    const recentPayments = data.recentPayments || [];
    const chart = data.paymentChart || [];
    const breakdown = data.paymentBreakdown || {};

    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-800 to-slate-900 rounded-2xl p-6 text-white border border-emerald-500/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-emerald-400 text-slate-950 shadow-xs">
                Accounts & Financial Ledger Workspace
              </span>
              <span className="text-xs text-emerald-200">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight mt-1 text-white">
              Welcome, {user?.name}
            </h1>
            <p className="text-xs text-emerald-100/90 mt-1 max-w-xl">
              Payment verification, clearing incoming NEFT/RTGS collections, reconciling customer ledger, and monitoring outstanding credit.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 bg-slate-900/60 hover:bg-slate-900 text-emerald-200 rounded-xl text-xs font-semibold border border-emerald-400/30 transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => onNavigate('payments')}
              className="px-4 py-2 bg-white hover:bg-emerald-50 text-slate-950 rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
            >
              <IndianRupee className="w-4 h-4 text-emerald-700" />
              <span>Full Ledger</span>
            </button>
          </div>
        </div>

        {/* Date Filter */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <DateRangeFilter
            value={dateRange}
            onChange={(newRange) => {
              setDateRange(newRange);
              fetchStats(newRange, selectedSalesPerson, selectedVendor, selectedStatus);
            }}
            defaultPreset="this_month"
            allowAllTime={true}
          />
        </div>

        {/* Accounts Cards */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
            <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
            Financial Audit & Collection KPIs
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500">Total Payments Submitted</span>
              <p className="text-2xl font-black text-slate-900 mt-1">{cards.totalPaymentsSubmitted || 0}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Entries logged</p>
            </div>

            <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-300 shadow-xs">
              <div className="flex items-center justify-between text-amber-800">
                <span className="text-[11px] font-bold">Pending Verification</span>
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-black text-amber-900 mt-1">{cards.pendingVerification || 0}</p>
              <p className="text-[10px] text-amber-700 mt-0.5">Needs accounts audit</p>
            </div>

            <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 shadow-xs">
              <div className="flex items-center justify-between text-emerald-800">
                <span className="text-[11px] font-bold">Verified Payments</span>
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-emerald-900 mt-1">{cards.verifiedPayments || 0}</p>
              <p className="text-[10px] text-emerald-700 mt-0.5">Cleared & posted</p>
            </div>

            <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-200 shadow-xs">
              <span className="text-[11px] font-bold text-rose-800">Rejected Payments</span>
              <p className="text-2xl font-black text-rose-900 mt-1">{cards.rejectedPayments || 0}</p>
              <p className="text-[10px] text-rose-700 mt-0.5">Invalid references</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500">Today's Collection</span>
              <p className="text-xl font-black text-slate-900 font-mono mt-1">₹{(cards.todayCollection || 0).toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Cleared today</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500">This Month Collection</span>
              <p className="text-xl font-black text-slate-900 font-mono mt-1">₹{(cards.thisMonthCollection || 0).toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Current month</p>
            </div>

            <div className="bg-rose-50/60 p-4 rounded-xl border border-rose-200 shadow-xs">
              <span className="text-[11px] font-bold text-rose-800">Outstanding Balance</span>
              <p className="text-xl font-black text-rose-700 font-mono mt-1">₹{(cards.outstandingAmount || 0).toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-rose-600 mt-0.5">Across active orders</p>
            </div>

            <div className="bg-teal-50/60 p-4 rounded-xl border border-teal-200 shadow-xs">
              <span className="text-[11px] font-semibold text-teal-800">Fully Paid Orders</span>
              <p className="text-2xl font-black text-teal-900 mt-1">{cards.fullyPaidOrders || 0}</p>
              <p className="text-[10px] text-teal-600 mt-0.5">Zero balance</p>
            </div>

            <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 shadow-xs">
              <span className="text-[11px] font-semibold text-amber-800">Partially Paid Orders</span>
              <p className="text-2xl font-black text-amber-900 mt-1">{cards.partiallyPaidOrders || 0}</p>
              <p className="text-[10px] text-amber-600 mt-0.5">Advance / partial</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-700">Unpaid Orders</span>
              <p className="text-2xl font-black text-slate-900 mt-1">{cards.unpaidOrders || 0}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Full payment pending</p>
            </div>
          </div>
        </div>

        {/* Pending Verification Priority Queue */}
        <div className="bg-white rounded-2xl border border-amber-200 shadow-md overflow-hidden">
          <div className="p-4 bg-amber-500/10 border-b border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Pending Verification Queue</h3>
                <p className="text-xs text-slate-500">Payments submitted by sales or vendors awaiting accounts approval</p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-amber-500 text-slate-950 rounded-full text-xs font-bold">
              {pendingList.length} Action Required
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Payment #</th>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Mode & Ref</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Receipt</th>
                  <th className="py-3 px-4 text-center">Audit Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400">
                      ✓ All submitted payments have been verified! No pending audits.
                    </td>
                  </tr>
                ) : (
                  pendingList.map((p: any) => (
                    <tr key={p.id} className="hover:bg-amber-50/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {p.payment_number}
                        <span className="block text-[10px] text-slate-400 font-normal">{p.payment_date}</span>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                        {p.order_number}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {p.vendor_name}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-800 font-semibold text-[10px] border border-slate-200">
                          {p.payment_mode}
                        </span>
                        {p.reference_number && (
                          <span className="block text-[10px] font-mono text-slate-500 mt-0.5">Ref: {p.reference_number}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-black text-emerald-700 text-right text-sm">
                        ₹{(p.amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {p.proof_url ? (
                          <button
                            onClick={() => setZoomImage(p.proof_url)}
                            className="text-amber-600 hover:text-amber-700 underline text-[11px] font-semibold"
                          >
                            View Receipt
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[10px]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleVerifyPayment(p.id)}
                            disabled={paymentActionLoading === p.id}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Verify</span>
                          </button>
                          <button
                            onClick={() => handleRejectPayment(p.id)}
                            disabled={paymentActionLoading === p.id}
                            className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-semibold transition"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Charts & Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Collection Trend</h3>
            <p className="text-xs text-slate-500 mb-4">Historical verified payment realizations</p>

            {chart.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-xs text-slate-400">
                No verified collections recorded in this period
              </div>
            ) : (
              <div className="h-56 flex items-end gap-5 pt-6 pb-2 px-2 border-b border-slate-100">
                {chart.map((c: any, idx: number) => {
                  const maxC = Math.max(...chart.map((x: any) => x.total_collected || 1), 10000);
                  const h = Math.max(10, Math.round(((c.total_collected || 0) / maxC) * 100));

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                      <div
                        style={{ height: `${h}%` }}
                        className="w-full max-w-[28px] bg-emerald-500 rounded-t group-hover:bg-emerald-600 transition duration-150 relative"
                      >
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-950 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-20 font-mono shadow">
                          ₹{(c.total_collected / 1000).toFixed(0)}k
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500 whitespace-nowrap">{c.period}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Order Payment Status</h3>
            <p className="text-xs text-slate-500 mb-4">Customer ledger settlement ratio</p>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-teal-700">Fully Paid</span>
                  <span className="font-mono font-bold text-slate-900">{breakdown.fullyPaid || 0}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full" style={{ width: `${Math.round(((breakdown.fullyPaid || 0) / (cards.totalPaymentsSubmitted || 1)) * 100)}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-amber-700">Partially Paid / Advance</span>
                  <span className="font-mono font-bold text-slate-900">{breakdown.partiallyPaid || 0}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.round(((breakdown.partiallyPaid || 0) / (cards.totalPaymentsSubmitted || 1)) * 100)}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-rose-700">Unpaid</span>
                  <span className="font-mono font-bold text-slate-900">{breakdown.unpaid || 0}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.round(((breakdown.unpaid || 0) / (cards.totalPaymentsSubmitted || 1)) * 100)}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =============================================================
  // RENDER 5: ADMIN & SUPER ADMIN – MASTER DASHBOARD
  // =============================================================
  const cat = data.categories || {};
  const ordersCat = cat.orders || {};
  const salesCat = cat.sales || {};
  const packingCat = cat.packing || {};
  const dispatchCat = cat.dispatch || {};
  const paymentsCat = cat.payments || {};
  const businessCat = cat.business || {};
  const charts = data.charts || {};
  const filterOptions = data.filterOptions || {};
  const recentOrders = data.recentOrders || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 rounded-2xl p-6 text-white border border-slate-800 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow-xs flex items-center gap-1">
              <Sparkles className="w-3 h-3 fill-slate-950" />
              Master Operations Dashboard
            </span>
            <span className="text-xs text-slate-400">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-1 text-white">
            Welcome, {user?.name}
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Enterprise-wide command center: live sales bookings, packing floor stock readiness, order delivery tracking, and payments ledger.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          {(user?.role_slug === 'super_admin' || hasPermission('orders:create')) && (
            <button
              onClick={() => onNavigate('create-order')}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-xl text-xs font-bold shadow-md transition"
            >
              + Create Order
            </button>
          )}
        </div>
      </div>

      {/* MASTER DASHBOARD MULTI-FILTERS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <DateRangeFilter
          value={dateRange}
          onChange={(newRange) => {
            setDateRange(newRange);
            fetchStats(newRange, selectedSalesPerson, selectedVendor, selectedStatus);
          }}
          defaultPreset="this_month"
          allowAllTime={true}
        />

        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
            <Filter className="w-3.5 h-3.5 text-amber-500" />
            <span>Scope Filters:</span>
          </div>

          {/* Sales Person Filter */}
          <select
            value={selectedSalesPerson}
            onChange={(e) => {
              setSelectedSalesPerson(e.target.value);
              fetchStats(dateRange, e.target.value, selectedVendor, selectedStatus);
            }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg font-medium outline-none focus:border-amber-500"
          >
            <option value="ALL">All Sales Persons</option>
            {(filterOptions.salesPersons || []).map((sp: any) => (
              <option key={sp.id} value={sp.id}>{sp.name}</option>
            ))}
          </select>

          {/* Vendor Filter */}
          <select
            value={selectedVendor}
            onChange={(e) => {
              setSelectedVendor(e.target.value);
              fetchStats(dateRange, selectedSalesPerson, e.target.value, selectedStatus);
            }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg font-medium outline-none focus:border-amber-500"
          >
            <option value="ALL">All Vendors</option>
            {(filterOptions.vendors || []).map((v: any) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>

          {/* Order Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              fetchStats(dateRange, selectedSalesPerson, selectedVendor, e.target.value);
            }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg font-medium outline-none focus:border-amber-500"
          >
            <option value="ALL">All Order Statuses</option>
            {(filterOptions.statuses || []).filter((s: string) => s !== 'ALL').map((st: string) => (
              <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>
            ))}
          </select>

          {(selectedSalesPerson !== 'ALL' || selectedVendor !== 'ALL' || selectedStatus !== 'ALL') && (
            <button
              onClick={handleClearFilters}
              className="text-xs text-rose-600 hover:text-rose-700 font-bold underline ml-auto flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Scope Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* CATEGORY 1: ORDERS PIPELINE (New -> Approved -> Packing -> Delivered) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <ShoppingCart className="w-3.5 h-3.5 text-blue-600" />
            Orders Pipeline (New → Approved → Packing → Delivered)
          </h2>
          <span className="text-[11px] font-semibold text-slate-400">Strict Single-Stage Delivery</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div onClick={() => onNavigate('orders?status=ALL')} className="bg-white p-3 rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs cursor-pointer">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Total Orders</span>
            <p className="text-xl font-black text-slate-900 mt-0.5">{ordersCat.totalOrders || 0}</p>
          </div>
          <div onClick={() => onNavigate('orders?status=NEW')} className="bg-blue-50/60 p-3 rounded-xl border border-blue-200 hover:border-blue-300 shadow-2xs cursor-pointer">
            <span className="text-[10px] font-bold text-blue-700 uppercase">1. New</span>
            <p className="text-xl font-black text-blue-900 mt-0.5">{ordersCat.newOrders || 0}</p>
          </div>
          <div onClick={() => onNavigate('orders?status=APPROVED')} className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-200 hover:border-indigo-300 shadow-2xs cursor-pointer">
            <span className="text-[10px] font-bold text-indigo-700 uppercase">2. Approved</span>
            <p className="text-xl font-black text-indigo-900 mt-0.5">{ordersCat.approvedOrders || 0}</p>
          </div>
          <div onClick={() => onNavigate('orders?status=PACKING')} className="bg-amber-50/60 p-3 rounded-xl border border-amber-200 hover:border-amber-300 shadow-2xs cursor-pointer">
            <span className="text-[10px] font-bold text-amber-700 uppercase">3. Packing</span>
            <p className="text-xl font-black text-amber-900 mt-0.5">{ordersCat.packingOrders || 0}</p>
          </div>
          <div onClick={() => onNavigate('delivered-orders')} className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-300 hover:border-emerald-400 shadow-2xs cursor-pointer">
            <span className="text-[10px] font-bold text-emerald-700 uppercase">4. Delivered</span>
            <p className="text-xl font-black text-emerald-900 mt-0.5">{ordersCat.deliveredOrders || 0}</p>
          </div>
          <div onClick={() => onNavigate('orders?status=CANCELLED')} className="bg-rose-50/60 p-3 rounded-xl border border-rose-200 hover:border-rose-300 shadow-2xs cursor-pointer">
            <span className="text-[10px] font-bold text-rose-700 uppercase">Cancelled</span>
            <p className="text-xl font-black text-rose-900 mt-0.5">{ordersCat.cancelledOrders || 0}</p>
          </div>
        </div>
      </div>

      {/* CATEGORY 2 & 5: SALES & PAYMENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sales Overview */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
              Sales Performance
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">Billed Volume</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] font-semibold text-slate-500">Total Sales Value</span>
              <p className="text-lg font-black text-slate-900 font-mono mt-0.5">₹{(salesCat.totalSalesValue || 0).toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] font-semibold text-slate-500">Today's Sales</span>
              <p className="text-lg font-black text-slate-900 font-mono mt-0.5">₹{(salesCat.todaySales || 0).toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] font-semibold text-slate-500">This Month Sales</span>
              <p className="text-lg font-black text-slate-900 font-mono mt-0.5">₹{(salesCat.thisMonthSales || 0).toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>

        {/* Payments Overview */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
              Payments & Collections
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">Ledger Balances</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200">
              <span className="text-[10px] font-bold text-emerald-800">Verified Received</span>
              <p className="text-lg font-black text-emerald-700 font-mono mt-0.5">₹{(paymentsCat.verifiedReceived || 0).toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-200">
              <span className="text-[10px] font-bold text-rose-800">Pending Amount</span>
              <p className="text-lg font-black text-rose-700 font-mono mt-0.5">₹{(paymentsCat.pendingAmount || 0).toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200">
              <span className="text-[10px] font-bold text-amber-800">Pending Audit</span>
              <p className="text-lg font-black text-amber-900 font-mono mt-0.5">{paymentsCat.pendingVerification || 0} bills</p>
            </div>
          </div>
        </div>
      </div>

      {/* CATEGORY 3: PACKING READINESS & DELIVERY STATUS */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <PackageCheck className="w-4 h-4 text-purple-600" />
            Packing Readiness & Order Delivery Flow
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={() => onNavigate('packing')} className="text-xs font-semibold text-purple-600 hover:underline">
              Packing Floor View →
            </button>
            <span className="text-slate-300">•</span>
            <button onClick={() => onNavigate('delivered-orders')} className="text-xs font-semibold text-emerald-600 hover:underline">
              Delivered Orders List →
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div onClick={() => onNavigate('packing')} className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 cursor-pointer hover:border-amber-300 transition">
            <span className="text-[10px] font-bold text-amber-800 uppercase block">Pending Packing</span>
            <span className="text-2xl font-black text-amber-900 mt-1 block">{packingCat.pendingPacking || 0}</span>
            <span className="text-[10px] text-amber-700 mt-0.5 block">Waiting for picking</span>
          </div>
          <div onClick={() => onNavigate('packing')} className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 cursor-pointer hover:border-blue-300 transition">
            <span className="text-[10px] font-bold text-blue-800 uppercase block">In Packing</span>
            <span className="text-2xl font-black text-blue-900 mt-1 block">{packingCat.packingInProgress || 0}</span>
            <span className="text-[10px] text-blue-700 mt-0.5 block">Being packed now</span>
          </div>
          <div onClick={() => onNavigate('packing')} className="p-3 bg-indigo-50/80 rounded-xl border border-indigo-200 cursor-pointer hover:border-indigo-300 transition">
            <span className="text-[10px] font-bold text-indigo-800 uppercase block">Packed</span>
            <span className="text-2xl font-black text-indigo-900 mt-1 block">{packingCat.packed || 0}</span>
            <span className="text-[10px] text-indigo-700 mt-0.5 block">Ready for DELIVER</span>
          </div>
          <div onClick={() => onNavigate('delivered-orders')} className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-300 cursor-pointer hover:border-emerald-400 transition">
            <span className="text-[10px] font-bold text-emerald-800 uppercase block">Delivered</span>
            <span className="text-2xl font-black text-emerald-900 mt-1 block">{ordersCat.deliveredOrders || 0}</span>
            <span className="text-[10px] text-emerald-700 mt-0.5 block">Complete deliveries</span>
          </div>
        </div>
      </div>

      {/* CATEGORY 6: BUSINESS DATA */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div onClick={() => onNavigate('vendors')} className="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs cursor-pointer flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500">Total Vendors</span>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{businessCat.totalVendors || 0}</p>
          </div>
          <Building className="w-5 h-5 text-amber-500" />
        </div>

        <div onClick={() => onNavigate('products')} className="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs cursor-pointer flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500">Total Products</span>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{businessCat.totalProducts || 0}</p>
          </div>
          <Package className="w-5 h-5 text-indigo-500" />
        </div>

        <div onClick={() => onNavigate('sales-persons')} className="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs cursor-pointer flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500">Active Sales Persons</span>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{businessCat.activeSalesPersons || 0}</p>
          </div>
          <User className="w-5 h-5 text-teal-500" />
        </div>

        <div onClick={() => onNavigate('users')} className="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs cursor-pointer flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500">Active Users</span>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{businessCat.activeUsers || 0}</p>
          </div>
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
        </div>
      </div>

      {/* MASTER DASHBOARD CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sales Trend Chart */}
        <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-amber-500" />
                Company Sales & Collections Trend
              </h3>
              <p className="text-xs text-slate-500">Periodic revenue and verified receipts</p>
            </div>
            <span className="text-xs text-slate-400 font-mono">INR (₹)</span>
          </div>

          <div className="h-60 flex items-end gap-5 pt-6 pb-2 px-2 border-b border-slate-100">
            {(charts.salesTrend || []).map((m: any, idx: number) => {
              const maxS = Math.max(...(charts.salesTrend || []).map((x: any) => x.total_sales || 1), 100000);
              const hSales = Math.max(10, Math.round(((m.total_sales || 0) / maxS) * 100));
              const hRec = Math.max(6, Math.round(((m.total_received || 0) / maxS) * 100));

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  <div className="w-full flex items-end justify-center gap-1 h-full">
                    <div
                      style={{ height: `${hSales}%` }}
                      className="w-1/2 max-w-[26px] bg-slate-900 rounded-t group-hover:bg-amber-500 transition duration-150 relative"
                    >
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-950 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-20 font-mono shadow">
                        ₹{(m.total_sales / 1000).toFixed(0)}k
                      </div>
                    </div>
                    <div
                      style={{ height: `${hRec}%` }}
                      className="w-1/2 max-w-[26px] bg-emerald-500 rounded-t group-hover:bg-emerald-600 transition duration-150 relative"
                    >
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block bg-emerald-800 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-20 font-mono shadow">
                        ₹{(m.total_received / 1000).toFixed(0)}k
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 whitespace-nowrap">{m.period}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-6 mt-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-xs bg-slate-900"></span>
              <span>Total Billed Sales</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-xs bg-emerald-500"></span>
              <span>Verified Collections</span>
            </div>
          </div>
        </div>

        {/* Orders by Status */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Orders by Status</h3>
            <p className="text-xs text-slate-500 mb-3">Enterprise order distribution</p>

            <div className="space-y-2">
              {(charts.ordersByStatus || []).map((sb: any, idx: number) => {
                const total = ordersCat.totalOrders || 1;
                const pct = Math.round((sb.count / total) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">{sb.label}</span>
                      <span className="font-mono font-bold text-slate-900">{sb.count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: sb.color }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {charts.receivedVsPending && (
            <div className="mt-4 pt-3 border-t border-slate-100 bg-slate-50 p-3 rounded-xl">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-slate-800">Received vs Pending Balance</span>
                <span className="font-bold text-emerald-700 font-mono">
                  {charts.receivedVsPending.total > 0 ? Math.round((charts.receivedVsPending.received / charts.receivedVsPending.total) * 100) : 0}% Realized
                </span>
              </div>
              <div className="w-full bg-rose-200 rounded-full h-2.5 overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${charts.receivedVsPending.total > 0 ? Math.min(100, Math.round((charts.receivedVsPending.received / charts.receivedVsPending.total) * 100)) : 0}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SALES REPRESENTATIVES & TERRITORY PERFORMANCE RANKING */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              Sales Representatives & Territory Performance
            </h3>
            <p className="text-xs text-slate-500">Live booking value and collections by team member • Click any representative to View Performance Drilldown</p>
          </div>
          <button onClick={() => onNavigate('sales-persons')} className="text-xs font-semibold text-amber-600 hover:text-amber-700">
            Team Directory →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(charts.salesPersonPerformance || []).map((sp: any, idx: number) => (
            <div
              key={idx}
              onClick={() => onNavigate(`sales-persons/${sp.id}`)}
              className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-amber-400 hover:shadow-xs flex items-center justify-between cursor-pointer transition group"
              title="Click to View Performance Drilldown"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-900 group-hover:bg-amber-500 group-hover:text-slate-950 text-amber-400 font-bold flex items-center justify-center text-xs transition">
                  {sp.name[0]}
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-xs group-hover:text-amber-700 transition">{sp.name}</p>
                  <p className="text-[11px] text-slate-500">{sp.employee_id || 'SALES'} • {sp.total_orders} orders</p>
                </div>
              </div>
              <div className="text-right font-mono">
                <p className="font-black text-slate-900 text-xs">₹{(sp.total_sales || 0).toLocaleString('en-IN')}</p>
                <p className="text-[10px] text-emerald-600">₹{(sp.total_received || 0).toLocaleString('en-IN')} rec</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* TOP PRODUCTS & TOP VENDORS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Top Lubricant Products</h3>
          <p className="text-xs text-slate-500 mb-3">Enterprise highest revenue generating SKUs</p>
          <div className="space-y-2">
            {(charts.topProducts || []).map((p: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  {p.product_image ? (
                    <img
                      src={p.product_image}
                      alt={p.product_name}
                      onClick={() => setZoomImage(p.product_image)}
                      className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0 cursor-pointer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-slate-500" />
                    </div>
                  )}
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-slate-900 truncate">{p.product_name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{p.sku} • {p.total_qty} units</p>
                  </div>
                </div>
                <span className="font-mono font-bold text-slate-900 shrink-0">
                  ₹{(p.total_amount || 0).toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Key Client Accounts</h3>
              <p className="text-xs text-slate-500">Top commercial buyers</p>
            </div>
            <button onClick={() => onNavigate('vendors')} className="text-xs font-semibold text-amber-600 hover:text-amber-700">
              All Vendors →
            </button>
          </div>
          <div className="space-y-2">
            {(charts.topVendors || []).map((v: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div>
                  <p className="font-bold text-slate-900">{v.company_name}</p>
                  <p className="text-[11px] text-slate-500">{v.city} • {v.order_count} orders</p>
                </div>
                <div className="text-right font-mono">
                  <p className="font-bold text-slate-900">₹{(v.total_spent || 0).toLocaleString('en-IN')}</p>
                  {v.pending > 0 ? (
                    <span className="text-[10px] text-rose-600 font-semibold">₹{v.pending.toLocaleString('en-IN')} pending</span>
                  ) : (
                    <span className="text-[10px] text-emerald-600 font-semibold">Settled</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RECENT ORDERS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recent Customer Orders</h3>
            <p className="text-xs text-slate-500">Live order intake and status updates</p>
          </div>
          <button
            onClick={() => onNavigate('orders')}
            className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1"
          >
            <span>View All Orders</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Vendor</th>
                <th className="py-3 px-4">Products</th>
                <th className="py-3 px-4">Sales Person</th>
                <th className="py-3 px-4">Billing Company</th>
                <th className="py-3 px-4 text-right">Order Value</th>
                <th className="py-3 px-4 text-right">Pending</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentOrders.map((ord: any) => (
                <tr key={ord.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">
                    {ord.order_number}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900">
                    {ord.vendor_name}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      {(ord.items || []).slice(0, 3).map((item: any, iIdx: number) => (
                        <div
                          key={iIdx}
                          onClick={() => item.product_image && setZoomImage(item.product_image)}
                          className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:border-amber-400 shadow-2xs"
                          title={`${item.product_name} (${item.sku})`}
                        >
                          {item.product_image ? (
                            <img src={item.product_image} alt={item.product_name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      ))}
                      {(ord.items?.length || 0) > 3 && (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          +{(ord.items?.length || 0) - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {ord.sales_person_name}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {ord.company_name}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900 text-right">
                    ₹{(ord.grand_total || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-rose-600 text-right">
                    ₹{(ord.pending_amount || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-4">
                    <OrderStatusBadge status={ord.order_status} size="sm" />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onNavigate(`orders/${ord.id}`)}
                        className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded transition"
                        title="View Full Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenSlip(ord.id)}
                        className="p-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded transition"
                        title="View Official Order Slip"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slip Modal */}
      {selectedOrderForSlip && (
        <OrderSlipModal
          order={selectedOrderForSlip.order}
          items={selectedOrderForSlip.items}
          isOpen={true}
          onClose={() => setSelectedOrderForSlip(null)}
        />
      )}

      {/* Image Zoom Modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setZoomImage(null)}
        >
          <div
            className="relative max-w-lg max-h-[85vh] bg-slate-950 p-2 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setZoomImage(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-900/80 hover:bg-rose-500 text-slate-300 hover:text-white transition z-10"
              title="Close Preview"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={zoomImage}
              alt="Enlarged Product Preview"
              className="w-full h-auto max-h-[75vh] object-contain rounded-xl"
            />
            <p className="text-center text-xs text-slate-400 mt-2 font-medium">Lubricant Product Preview</p>
          </div>
        </div>
      )}
    </div>
  );
};
