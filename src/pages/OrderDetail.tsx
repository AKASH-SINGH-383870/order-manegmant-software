import React, { useState, useEffect } from 'react';
import {
  FileText, Printer, Check, X, PackageCheck, Truck, CreditCard, ChevronRight,
  AlertCircle, CheckCircle2, Clock, MapPin, User, Calendar, RefreshCw, Plus, ShieldCheck, Edit2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { Order, OrderItem, ProductionRecord, Dispatch, Delivery, Payment, OrderStatusHistoryItem, ActivityLog } from '../types.js';
import { OrderStatusBadge, ProductionStatusBadge, DispatchStatusBadge, DeliveryStatusBadge, PaymentStatusBadge } from '../components/StatusBadge.js';
import { OrderSlipModal } from '../components/OrderSlipModal.js';
import { EditOrderModal } from '../components/EditOrderModal.js';
import { EditPaymentModal } from '../components/EditPaymentModal.js';

interface OrderDetailProps {
  orderId: string | number;
  onNavigate: (page: string) => void;
}

export const OrderDetail: React.FC<OrderDetailProps> = ({ orderId, onNavigate }) => {
  const { user, hasPermission } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [productionRecords, setProductionRecords] = useState<ProductionRecord[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [history, setHistory] = useState<OrderStatusHistoryItem[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'dispatch' | 'payments' | 'timeline' | 'logs'>('overview');
  const [slipModalOpen, setSlipModalOpen] = useState<boolean>(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  // Modals for actions
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [showDeliverConfirm, setShowDeliverConfirm] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [showAddPaymentModal, setShowAddPaymentModal] = useState<boolean>(false);
  const [editOrderModalOpen, setEditOrderModalOpen] = useState<boolean>(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_mode: 'Bank Transfer',
    reference_number: '',
    notes: ''
  });

  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const handleDeliverOrder = async () => {
    if (!order) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/orders/${order.id}/deliver`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok) {
        setShowDeliverConfirm(false);
        await fetchOrderDetail();
      } else {
        alert(data.error || 'Failed to deliver order');
      }
    } catch (err) {
      console.error(err);
      alert('Error marking order as delivered');
    } finally {
      setActionLoading(false);
    }
  };

  const fetchOrderDetail = async () => {
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setOrder(json.order);
        setItems(json.items || []);
        setProductionRecords(json.productionRecords || []);
        setDispatches(json.dispatches || []);
        setDeliveries(json.deliveries || []);
        setPayments(json.payments || []);
        setHistory(json.history || []);
        setLogs(json.logs || []);
      } else {
        alert('Order not found or permission denied');
        onNavigate('orders');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetail();
  }, [orderId]);

  if (loading || !order) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <span>Loading order details...</span>
      </div>
    );
  }

  const isAdmin = ['super_admin', 'admin'].includes(user?.role_slug || '');
  const isProduction = ['super_admin', 'admin', 'production_team'].includes(user?.role_slug || '');
  const isDispatch = ['super_admin', 'admin', 'dispatch_team'].includes(user?.role_slug || '');
  const isAccounts = ['super_admin', 'admin', 'accounts'].includes(user?.role_slug || '');

  // Calculate totals
  const totalQty = items.reduce((acc, it) => acc + it.quantity, 0);
  const totalProduced = items.reduce((acc, it) => acc + (it.produced_quantity || 0), 0);
  const totalDispatched = items.reduce((acc, it) => acc + (it.dispatched_quantity || 0), 0);
  const totalDelivered = items.reduce((acc, it) => acc + (it.delivered_quantity || 0), 0);

  // Business Rule check for Mark Order Completed:
  // Must be DELIVERED AND FULLY PAID (pending_amount === 0)
  const canComplete = order.delivery_status === 'DELIVERED' && order.pending_amount <= 0 && order.order_status !== 'COMPLETED';

  // API Call Handlers
  const handleAccept = async () => {
    if (!window.confirm('Accept and approve order for operations?')) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/orders/${order.id}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchOrderDetail();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignProduction = async () => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/orders/${order.id}/assign-production`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Assigned to blending plant' })
      });
      if (res.ok) {
        fetchOrderDetail();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubmit = async () => {
    if (!cancelReason.trim()) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/orders/${order.id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason })
      });
      if (res.ok) {
        setShowCancelModal(false);
        fetchOrderDetail();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(paymentForm.amount);
    if (isNaN(amt) || amt <= 0) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/orders/${order.id}/add-payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentForm)
      });
      if (res.ok) {
        setShowAddPaymentModal(false);
        setPaymentForm({ amount: '', payment_mode: 'Bank Transfer', reference_number: '', notes: '' });
        fetchOrderDetail();
      } else {
        const err = await res.json();
        alert(err.error || 'Payment failed');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyPayment = async (paymentId: number) => {
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/payments/${paymentId}/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchOrderDetail();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteOrder = async () => {
    if (!canComplete) {
      alert('Order cannot be marked completed until delivery is finished AND payment is fully cleared.');
      return;
    }
    if (!window.confirm('Mark this order 100% completed? This closes the order permanently.')) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/orders/${order.id}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchOrderDetail();
      } else {
        const err = await res.json();
        alert(err.error || 'Could not complete order');
      }
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xl font-bold text-slate-900">{order.order_number}</span>
            <OrderStatusBadge status={order.order_status} />
            {order.cancellation_reason && (
              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-xs font-semibold rounded-md">
                Cancelled
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
            <span>Created: <strong>{new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong></span>
            <span>Billing Entity: <strong>{order.billing_company_name}</strong></span>
            <span>Sales Officer: <strong>{order.sales_person_name}</strong></span>
            <span>Vendor: <strong>{order.vendor_name}</strong></span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSlipModalOpen(true)}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow-xs"
          >
            <FileText className="w-4 h-4" />
            <span>View / Print Slip</span>
          </button>

          {/* Edit Order Option with View */}
          {(() => {
            const isCancelled = order.order_status === 'CANCELLED';
            const isDelivered = order.order_status === 'DELIVERED';
            const canEdit = !isCancelled && (
              isDelivered
                ? (isAdmin || hasPermission('orders:edit_delivered'))
                : (isAdmin || hasPermission('orders:edit') || order.sales_person_id === user?.id)
            );
            if (!canEdit) return null;
            return (
              <button
                onClick={() => setEditOrderModalOpen(true)}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow-xs"
                title="Edit Order Details"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit Order</span>
              </button>
            );
          })()}

          {/* Approval & Cancel Actions */}
          {(user?.role_slug === 'super_admin' || hasPermission('orders:approve')) && order.order_status === 'NEW' && (
            <button
              onClick={handleAccept}
              disabled={actionLoading}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Accept Order</span>
            </button>
          )}

          {(user?.role_slug === 'super_admin' || hasPermission('orders:cancel')) && ['NEW', 'ACCEPTED', 'PROCESSING', 'READY_FOR_DISPATCH'].includes(order.order_status) && (
            <button
              onClick={() => setShowCancelModal(true)}
              disabled={actionLoading}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          )}

          {/* Packing Navigation Shortcut */}
          {(user?.role_slug === 'super_admin' || hasPermission('packing:view') || hasPermission('production:view')) && ['ACCEPTED', 'PROCESSING'].includes(order.order_status) && (
            <button
              onClick={() => onNavigate('packing')}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1.5"
            >
              <PackageCheck className="w-4 h-4" />
              <span>Go to Packing Workspace</span>
            </button>
          )}

          {/* Direct DELIVER Button when Packed and not Delivered */}
          {order.packing_status === 'PACKED' && order.order_status !== 'DELIVERED' && (
            <button
              onClick={() => setShowDeliverConfirm(true)}
              disabled={actionLoading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wide rounded-lg shadow-md transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>DELIVER ORDER</span>
            </button>
          )}

          {order.order_status === 'DELIVERED' && (
            <div className="px-3.5 py-2 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-lg border border-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Delivered</span>
            </div>
          )}

          {/* Accounts / Permitted Add Payment */}
          {(user?.role_slug === 'super_admin' || hasPermission('payments:add')) && order.pending_amount > 0 && order.order_status !== 'CANCELLED' && (
            <button
              onClick={() => setShowAddPaymentModal(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5"
            >
              <CreditCard className="w-4 h-4" />
              <span>+ Record Payment</span>
            </button>
          )}

          {/* Complete Order Strict Rule */}
          {(user?.role_slug === 'super_admin' || hasPermission('orders:complete')) && order.order_status !== 'COMPLETED' && order.order_status !== 'CANCELLED' && (
            <div className="relative group">
              <button
                onClick={handleCompleteOrder}
                disabled={!canComplete || actionLoading}
                className={`px-4 py-2 font-bold text-xs rounded-lg transition flex items-center gap-1.5 ${
                  canComplete
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark Order Completed</span>
              </button>

              {!canComplete && (
                <div className="absolute right-0 top-full mt-1 w-64 p-2 bg-slate-900 text-white text-[11px] rounded-lg shadow-xl hidden group-hover:block z-20">
                  Strict Rule: Can only be completed when goods are 100% delivered AND payment is fully settled.
                  <div className="mt-1 text-amber-300 font-semibold">
                    Delivery: {order.delivery_status} | Pending: ₹{order.pending_amount.toLocaleString('en-IN')}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Visual Status Progress Flow: New -> Approved -> Packing -> Delivered */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs overflow-x-auto">
        <div className="flex items-center justify-between min-w-[540px] text-xs">
          {[
            { label: '1. New Order', active: ['NEW', 'ACCEPTED', 'PROCESSING', 'READY_FOR_DISPATCH', 'DELIVERED', 'COMPLETED'].includes(order.order_status) },
            { label: '2. Approved', active: ['ACCEPTED', 'PROCESSING', 'READY_FOR_DISPATCH', 'DELIVERED', 'COMPLETED'].includes(order.order_status) },
            { label: '3. Packing', active: ['PROCESSING', 'READY_FOR_DISPATCH', 'DELIVERED', 'COMPLETED'].includes(order.order_status) || order.packing_status === 'PACKED' },
            { label: '4. Delivered', active: ['DELIVERED', 'COMPLETED'].includes(order.order_status) || order.delivery_status === 'DELIVERED' },
          ].map((st, i, arr) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center text-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                  st.active ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}>
                  {st.active ? '✓' : i + 1}
                </div>
                <span className={`text-xs mt-1.5 font-bold ${st.active ? 'text-slate-900' : 'text-slate-400'}`}>
                  {st.label}
                </span>
              </div>
              {i < arr.length - 1 && (
                <div className={`flex-1 h-1 mx-3 rounded-full ${st.active && arr[i + 1].active ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs text-center">
          <p className="text-[11px] text-slate-500 font-medium">Ordered Qty</p>
          <p className="text-lg font-bold text-slate-900 mt-0.5">{totalQty}</p>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs text-center">
          <p className="text-[11px] text-slate-500 font-medium">Packed Qty</p>
          <p className="text-lg font-bold text-purple-700 mt-0.5">{['NEW', 'ACCEPTED'].includes(order.order_status) ? 0 : totalQty} / {totalQty}</p>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs text-center">
          <p className="text-[11px] text-slate-500 font-medium">Delivered Qty</p>
          <p className="text-lg font-bold text-emerald-700 mt-0.5">{order.order_status === 'DELIVERED' || order.order_status === 'COMPLETED' ? totalQty : totalDelivered} / {totalQty}</p>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs text-center">
          <p className="text-[11px] text-slate-500 font-medium">Total Amount</p>
          <p className="text-sm font-bold text-slate-900 font-mono mt-1">₹{order.grand_total.toLocaleString('en-IN')}</p>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs text-center">
          <p className="text-[11px] text-slate-500 font-medium">Received</p>
          <p className="text-sm font-bold text-emerald-600 font-mono mt-1">₹{order.amount_received.toLocaleString('en-IN')}</p>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs text-center">
          <p className="text-[11px] text-slate-500 font-medium">Pending Balance</p>
          <p className={`text-sm font-bold font-mono mt-1 ${order.pending_amount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
            ₹{order.pending_amount.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* Order Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="border-b border-slate-200 px-4 bg-slate-50 flex space-x-2 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'overview', label: `Products & Overview (${items.length})` },
            { id: 'dispatch', label: `Fulfillment & Delivery` },
            { id: 'payments', label: `Payments & Ledger (${payments.length})` },
            { id: 'timeline', label: `Status Timeline (${history.length})` },
            { id: 'logs', label: `Audit Trail (${logs.length})` }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`py-3 px-3.5 border-b-2 transition ${
                activeTab === t.id
                  ? 'border-amber-500 text-amber-600 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* TAB 1: OVERVIEW & PRODUCTS */}
          {activeTab === 'overview' && (() => {
            const isNonGst = order.tax_type === 'NON_GST' || (order.tax_rate === 0 && order.tax_amount === 0 && order.subtotal === order.grand_total);
            return (
            <div className="space-y-6">
              {/* Mobile Product Cards (< md) */}
              <div className="block md:hidden space-y-3">
                {items.map((it, idx) => (
                  <div key={it.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex items-start gap-3">
                      <div
                        onClick={() => { if (it.product_image) setZoomImage(it.product_image); }}
                        className="w-14 h-14 rounded-lg bg-white border border-slate-200 overflow-hidden cursor-pointer shrink-0 shadow-2xs"
                        title="Click to preview full image"
                      >
                        <img
                          src={it.product_image || 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=120&auto=format&fit=crop&q=80'}
                          alt={it.product_name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=120&auto=format&fit=crop&q=80';
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 text-xs">{it.product_name} {it.unit ? `– ${it.unit}` : ''}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] text-slate-500 font-mono">
                          <span>{it.sku}</span>
                          <span>•</span>
                          <span>{it.brand_name}</span>
                        </div>
                        {it.item_colour && (
                          <span className="inline-block mt-1 px-1.5 py-0.2 bg-amber-50 text-amber-900 text-[10px] rounded font-medium border border-amber-200">
                            Colour: {it.item_colour}
                          </span>
                        )}
                        {it.notes && <p className="text-[10px] text-slate-400 italic mt-0.5">{it.notes}</p>}
                      </div>
                    </div>

                    {/* Progress & Financials */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block">Ordered Qty</span>
                        <span className="font-bold text-slate-800">{it.quantity} {it.unit}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                          {isNonGst ? 'Line Total' : 'Line Total (Incl. GST)'}
                        </span>
                        <span className="font-mono font-bold text-slate-900">₹{it.line_amount.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block">Dispatched / Delivered</span>
                        <span className="font-mono text-[11px] text-cyan-700 font-semibold">{it.dispatched_quantity || 0} disp</span>
                        <span className="text-slate-400 mx-1">•</span>
                        <span className="font-mono text-[11px] text-teal-700 font-semibold">{it.delivered_quantity || 0} deliv</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                          {isNonGst ? 'Selling Rate' : 'Selling Rate (Incl. GST)'}
                        </span>
                        <span className="font-mono text-xs text-slate-700">₹{it.rate.toLocaleString('en-IN')} / {it.unit}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Product Image</th>
                      <th className="py-2.5 px-3">Product Description</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3 text-right">Ordered Qty</th>
                      <th className="py-2.5 px-3 text-right">Dispatched</th>
                      <th className="py-2.5 px-3 text-right">Delivered</th>
                      <th className="py-2.5 px-3 text-right">
                        {isNonGst ? 'Selling Rate' : 'Selling Rate (Incl. GST)'}
                      </th>
                      <th className="py-2.5 px-3 text-right">
                        {isNonGst ? 'Amount' : 'Amount (Incl. GST)'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((it, idx) => (
                      <tr key={it.id} className="hover:bg-slate-50">
                        <td className="py-3 px-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-3 px-3">
                          <div
                            onClick={() => {
                              if (it.product_image) setZoomImage(it.product_image);
                            }}
                            className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden cursor-pointer hover:opacity-90 shadow-2xs"
                            title="Click to preview full image"
                          >
                            <img
                              src={it.product_image || 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=120&auto=format&fit=crop&q=80'}
                              alt={it.product_name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=120&auto=format&fit=crop&q=80';
                              }}
                            />
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900">{it.product_name} {it.unit ? `– ${it.unit}` : ''}</p>
                          <span className="text-[11px] text-slate-500">{it.brand_name} • {it.category_name}</span>
                          {it.item_colour && (
                            <span className="inline-block ml-2 px-1.5 py-0.2 bg-slate-100 text-slate-700 text-[10px] rounded font-medium border border-slate-200">
                              Colour: {it.item_colour}
                            </span>
                          )}
                          {it.notes && <p className="text-[10px] text-slate-400 italic">{it.notes}</p>}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600">{it.sku}</td>
                        <td className="py-3 px-3 text-right font-bold text-slate-800">
                          {it.quantity} {it.unit}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-cyan-700">
                          {it.dispatched_quantity || 0}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-teal-700">
                          {it.delivered_quantity || 0}
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          ₹{it.rate.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          ₹{it.line_amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Destination & Logistics Box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200 text-xs">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                  <p className="font-bold uppercase text-[11px] tracking-wide text-slate-500 mb-2">Delivery Destination</p>
                  <p className="text-slate-800"><strong>Address:</strong> {order.delivery_address || order.vendor_delivery_address}</p>
                  <p className="text-slate-700"><strong>Site Contact:</strong> {order.delivery_contact_person} ({order.delivery_contact_number})</p>
                  <p className="text-slate-700"><strong>Target Date:</strong> {order.required_delivery_date || 'Standard'}</p>
                  {order.special_instructions && (
                    <p className="text-amber-800 bg-amber-50 p-2 rounded border border-amber-200 mt-2">
                      <strong>Special Note:</strong> {order.special_instructions}
                    </p>
                  )}
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 font-sans">
                  <p className="font-bold uppercase text-[11px] tracking-wide text-slate-500 mb-2">Commercial & Tax Breakdown</p>
                  <div className="flex justify-between text-slate-600">
                    <span>{isNonGst ? 'Subtotal:' : 'Subtotal (Excl. GST):'}</span>
                    <span className="font-mono font-semibold text-slate-800">₹{order.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>{isNonGst ? 'GST:' : 'GST @18%:'}</span>
                    <span className="font-mono text-slate-800">₹{order.tax_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-sm text-slate-900">
                    <span>{isNonGst ? 'Grand Total:' : 'Grand Total (Incl. GST):'}</span>
                    <span className="font-mono">₹{order.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-semibold pt-1 border-t border-slate-200">
                    <span>Amount Received:</span>
                    <span className="font-mono">₹{order.amount_received.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>Pending Balance:</span>
                    <span className="font-mono">₹{order.pending_amount.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>
            );
          })()}

          {/* TAB 2: FULFILLMENT & DELIVERY */}
          {activeTab === 'dispatch' && (
            <div className="space-y-6">
              {/* Delivery Banner */}
              {order.order_status === 'DELIVERED' && (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">Order Successfully Delivered</p>
                      <p className="text-xs text-emerald-800">
                        Delivered on: {order.delivered_at ? new Date(order.delivered_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'Completed'}
                        {order.delivered_by_name ? ` • Verified by: ${order.delivered_by_name}` : ''}
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-emerald-600 text-white font-bold text-xs rounded-lg uppercase self-start sm:self-center">
                    Delivered
                  </span>
                </div>
              )}

              {order.packing_status === 'PACKED' && order.order_status !== 'DELIVERED' && (
                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <PackageCheck className="w-6 h-6 text-indigo-600 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-900 text-sm">Packed & Ready for Delivery</p>
                      <p className="text-xs text-indigo-700">All consignment items are packed. Click DELIVER to directly complete delivery.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDeliverConfirm(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase rounded-lg shadow-sm flex items-center gap-1.5 self-start sm:self-center"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>DELIVER NOW</span>
                  </button>
                </div>
              )}

              {/* Delivery Destination & Contact Details */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block">Customer / Party</span>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">{order.vendor_name}</p>
                  <p className="text-slate-600 mt-1"><strong>Delivery Address:</strong> {order.delivery_address || order.vendor_delivery_address || 'Same as Billing Address'}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block">Receiving Site Contact</span>
                  <p className="font-bold text-slate-800 mt-0.5">{order.delivery_contact_person || order.vendor_contact || 'Site Supervisor'}</p>
                  <p className="text-slate-600">Mobile: {order.delivery_contact_number || order.vendor_mobile || '—'}</p>
                  <p className="text-slate-600">Target Delivery Date: <strong className="text-slate-800">{order.required_delivery_date || 'Standard'}</strong></p>
                </div>
              </div>

              {/* Deliveries */}
              <div className="pt-4 border-t border-slate-200">
                <h3 className="font-bold text-slate-900 text-sm mb-2">Delivery Confirmations & POD</h3>
                {deliveries.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs">
                    No delivery records logged yet. Current delivery state: <DeliveryStatusBadge status={order.delivery_status} />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <th className="py-2.5 px-3">Delivery Date</th>
                          <th className="py-2.5 px-3">Received By</th>
                          <th className="py-2.5 px-3">Receiver Mobile</th>
                          <th className="py-2.5 px-3 text-right">Quantity Received</th>
                          <th className="py-2.5 px-3">Acknowledged Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {deliveries.map(del => (
                          <tr key={del.id} className="hover:bg-slate-50">
                            <td className="py-3 px-3 font-semibold text-slate-900">{del.delivery_date}</td>
                            <td className="py-3 px-3 font-bold text-slate-900">{del.received_by}</td>
                            <td className="py-3 px-3 text-slate-600">{del.receiver_mobile || '—'}</td>
                            <td className="py-3 px-3 text-right font-bold text-emerald-700">{del.delivered_quantity}</td>
                            <td className="py-3 px-3 text-slate-600">{del.notes || 'Received in intact condition'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: PAYMENTS & LEDGER */}
          {activeTab === 'payments' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Payment Receipts & Reconciliation</h3>
                  <p className="text-xs text-slate-500">Every advance, installment, and settlement received against this order.</p>
                </div>
                {order.pending_amount > 0 && (
                  <button
                    onClick={() => setShowAddPaymentModal(true)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Payment Entry</span>
                  </button>
                )}
              </div>

              {payments.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs">
                  No payments recorded yet for this order. Status: <PaymentStatusBadge status={order.payment_status} />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="py-2.5 px-3">Receipt #</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                        <th className="py-2.5 px-3">Mode</th>
                        <th className="py-2.5 px-3">Reference / UTR</th>
                        <th className="py-2.5 px-3">Logged By</th>
                        <th className="py-2.5 px-3">Verification</th>
                        <th className="py-2.5 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">{p.payment_number}</td>
                          <td className="py-3 px-3 text-slate-600">{p.payment_date}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                            ₹{p.amount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-800">{p.payment_mode}</td>
                          <td className="py-3 px-3 font-mono text-slate-500">{p.reference_number || '—'}</td>
                          <td className="py-3 px-3 text-slate-600">{p.received_by_name}</td>
                          <td className="py-3 px-3">
                            {p.is_verified ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Verified by {p.verified_by_name || 'Accounts'}
                              </span>
                            ) : (
                              <span className="text-[11px] text-amber-700 font-semibold">Pending Audit</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Edit Payment Button */}
                              {(() => {
                                const isVer = p.is_verified === 1;
                                const canEditPay = isVer
                                  ? (isAdmin || isAccounts || hasPermission('payments:verify'))
                                  : (isAdmin || isAccounts || p.received_by_id === user?.id || order.sales_person_id === user?.id || hasPermission('payments:add'));
                                if (!canEditPay) return null;
                                return (
                                  <button
                                    onClick={() => setEditingPayment(p)}
                                    className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition"
                                    title="Edit Payment Receipt"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                );
                              })()}

                              {!p.is_verified && isAccounts && (
                                <button
                                  onClick={() => handleVerifyPayment(p.id)}
                                  className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold rounded text-[10px] transition"
                                >
                                  Verify ✓
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 text-sm">Visual Order Lifecycle History</h3>
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {history.map((h) => (
                  <div key={h.id} className="relative group">
                    <div className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 ring-4 ring-white"></div>
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-sm">{h.stage_name}</span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {new Date(h.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-1">{h.notes}</p>
                      <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-2">
                        <span>Actor: <strong className="text-slate-700">{h.actor_name}</strong></span>
                        <span>•</span>
                        <span>Role: <strong className="text-slate-700">{h.actor_role}</strong></span>
                        {h.previous_status && (
                          <>
                            <span>•</span>
                            <span>Transition: {h.previous_status} → <strong>{h.new_status}</strong></span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: AUDIT TRAIL LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-3">
              <h3 className="font-bold text-slate-900 text-sm">System Audit Records</h3>
              <div className="divide-y divide-slate-100 text-xs">
                {logs.map(log => (
                  <div key={log.id} className="py-2.5 flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">{log.action}</p>
                      <p className="text-slate-600 mt-0.5">{log.description}</p>
                      <span className="text-[10px] text-slate-400">Initiated by {log.user_name || 'System'}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.created_at).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Order Slip Modal */}
      {slipModalOpen && (
        <OrderSlipModal
          order={order}
          items={items}
          isOpen={true}
          onClose={() => setSlipModalOpen(false)}
        />
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-base text-rose-600">Cancel Order #{order.order_number}</h3>
            <p className="text-xs text-slate-600">Please record the official cancellation justification:</p>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Turnaround delayed; customer requested cancellation..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCancelModal(false)} className="px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
                Close
              </button>
              <button
                onClick={handleCancelSubmit}
                disabled={actionLoading || cancelReason.trim().length < 5}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg disabled:opacity-50"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showAddPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-slate-900">Add Payment Receipt</h3>
              <button onClick={() => setShowAddPaymentModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleAddPaymentSubmit} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg text-slate-600">
                <span>Outstanding Balance:</span>
                <span className="font-mono font-bold text-rose-600 text-sm ml-2">₹{order.pending_amount.toLocaleString('en-IN')}</span>
              </div>
              <div>
                <label className="block font-semibold mb-1">Payment Amount (₹) *</label>
                <input
                  type="number"
                  min="1"
                  max={order.pending_amount}
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                  placeholder="e.g. 25000"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Payment Mode</label>
                <select
                  value={paymentForm.payment_mode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <option value="Bank Transfer">Bank Transfer / NEFT</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Reference / Cheque / UTR #</label>
                <input
                  type="text"
                  value={paymentForm.reference_number}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                  placeholder="e.g. UTR-8812903"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  placeholder="e.g. Second installment against invoice"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowAddPaymentModal(false)} className="px-4 py-2 text-slate-600">Cancel</button>
                <button type="submit" disabled={actionLoading} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg">
                  Submit Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Simple Confirmation Modal Before Delivery */}
      {showDeliverConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Confirm Order Delivery
              </h3>
              <button onClick={() => setShowDeliverConfirm(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
              <p className="text-slate-600">
                Order: <strong className="text-slate-900 font-mono">#{order.order_number}</strong>
              </p>
              <p className="text-slate-600">
                Customer: <strong className="text-slate-900">{order.vendor_name}</strong>
              </p>
              <p className="text-slate-600">
                Quantity: <strong className="text-slate-900">{totalQty} units</strong>
              </p>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              Are you sure you want to mark Order <strong className="text-slate-900">#{order.order_number}</strong> as <span className="text-emerald-700 font-bold uppercase">Delivered</span>?
            </p>
            <p className="text-[11px] text-slate-400">
              This will directly update the order status to Delivered. Packing count will decrease and Delivered count will increase.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeliverConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeliverOrder}
                disabled={actionLoading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                {actionLoading ? 'Processing...' : 'Confirm Delivery'}
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
      {editOrderModalOpen && (
        <EditOrderModal
          orderId={order.id}
          isOpen={editOrderModalOpen}
          onClose={() => setEditOrderModalOpen(false)}
          onOrderUpdated={() => fetchOrderDetail()}
        />
      )}

      {/* Edit Payment Modal */}
      {editingPayment && (
        <EditPaymentModal
          payment={editingPayment}
          isOpen={!!editingPayment}
          onClose={() => setEditingPayment(null)}
          onPaymentUpdated={() => fetchOrderDetail()}
        />
      )}
    </div>
  );
};
