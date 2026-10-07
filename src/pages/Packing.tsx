import React, { useState, useEffect } from 'react';
import {
  Boxes, CheckCircle2, Play, AlertCircle, Eye, RefreshCw, X,
  PackageCheck, Truck, ShieldAlert, ArrowRight, User, Clock, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const Packing: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'IN_PROGRESS' | 'PACKED' | 'ON_HOLD' | 'READY_DISPATCH'>('ALL');

  // Selected Order for detail & packing actions
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [activeOrderItems, setActiveOrderItems] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Hold reason modal
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdReason, setHoldReason] = useState('Stock shortage discovered during packing');
  const [selectedMissingItemId, setSelectedMissingItemId] = useState<number | null>(null);

  // Zoom Image modal
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const fetchPackingOrders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch('/api/packing/orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setOrders(json.orders || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackingOrders();
  }, []);

  // Open order detail modal
  const handleOpenOrderDetail = async (order: any) => {
    setActiveOrder(order);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/orders/${order.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const json = await res.json();
        setActiveOrderItems(json.items || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Action: Start Packing
  const handleStartPacking = async (orderId: number) => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/orders/${orderId}/start-packing`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchPackingOrders();
        if (activeOrder && activeOrder.id === orderId) {
          setActiveOrder((prev: any) => ({ ...prev, packing_status: 'PACKING_IN_PROGRESS' }));
        }
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Toggle Item Availability (Item Ready vs Not Available)
  const handleToggleItemAvailability = async (orderId: number, itemId: number, currentAvailability: string) => {
    if (currentAvailability === 'AVAILABLE') {
      // Prompt for hold reason
      setSelectedMissingItemId(itemId);
      setShowHoldModal(true);
    } else {
      // Mark available
      setActionLoading(true);
      try {
        const token = localStorage.getItem('petroflow_token');
        const res = await fetch(`/api/orders/${orderId}/toggle-item-availability`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: itemId, availability: 'AVAILABLE' })
        });
        if (res.ok) {
          fetchPackingOrders();
          setActiveOrderItems(prev => prev.map(it => it.id === itemId ? { ...it, item_availability: 'AVAILABLE' } : it));
        }
      } finally {
        setActionLoading(false);
      }
    }
  };

  // Confirm Item Not Available -> Puts Order On Hold
  const handleConfirmHold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder || !selectedMissingItemId) return;

    setActionLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/orders/${activeOrder.id}/toggle-item-availability`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: selectedMissingItemId,
          availability: 'NOT_AVAILABLE',
          hold_reason: holdReason
        })
      });
      if (res.ok) {
        setShowHoldModal(false);
        fetchPackingOrders();
        setActiveOrder((prev: any) => ({ ...prev, packing_status: 'ON_HOLD', packing_notes: holdReason }));
        setActiveOrderItems(prev => prev.map(it => it.id === selectedMissingItemId ? { ...it, item_availability: 'NOT_AVAILABLE' } : it));
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Complete Packing
  const handleCompletePacking = async (orderId: number) => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/orders/${orderId}/complete-packing`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        fetchPackingOrders();
        if (activeOrder && activeOrder.id === orderId) {
          setActiveOrder((prev: any) => ({ ...prev, packing_status: 'PACKED' }));
        }
      } else {
        alert(data.error || 'Cannot complete packing');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Handover to Dispatch
  const handleHandoverDispatch = async (orderId: number) => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch(`/api/orders/${orderId}/handover-dispatch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchPackingOrders();
        setActiveOrder(null);
        alert('Order successfully handed over to Dispatch Team! Marked Ready for Dispatch.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Categorize queues
  const pendingPacking = orders.filter(o => o.packing_status === 'PENDING_PACKING' || o.packing_status === 'ASSIGNED');
  const packingInProgress = orders.filter(o => o.packing_status === 'PACKING_IN_PROGRESS');
  const packedOrders = orders.filter(o => o.packing_status === 'PACKED');
  const readyDispatch = orders.filter(o => o.packing_status === 'HANDED_OVER_TO_DISPATCH' || o.order_status === 'READY_FOR_DISPATCH');
  const ordersOnHold = orders.filter(o => o.packing_status === 'ON_HOLD');

  const displayedOrders = orders.filter(o => {
    if (filter === 'PENDING') return o.packing_status === 'PENDING_PACKING' || o.packing_status === 'ASSIGNED';
    if (filter === 'IN_PROGRESS') return o.packing_status === 'PACKING_IN_PROGRESS';
    if (filter === 'PACKED') return o.packing_status === 'PACKED';
    if (filter === 'ON_HOLD') return o.packing_status === 'ON_HOLD';
    if (filter === 'READY_DISPATCH') return o.packing_status === 'HANDED_OVER_TO_DISPATCH' || o.order_status === 'READY_FOR_DISPATCH';
    return true;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="w-6 h-6 text-amber-500" />
            Packing Management & Warehouse Staging
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Check finished lubricant stock availability, pack drums and cartons, mark missing items On Hold, and handover packed orders to Dispatch.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchPackingOrders}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5"
            title="Refresh Packing Queue"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 5 Packing Dashboard Status Cards (Requirement 6) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setFilter('PENDING')}
          className={`p-4 rounded-xl border text-left transition-all ${
            filter === 'PENDING' ? 'border-amber-500 bg-amber-50/50 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase">Pending Packing</span>
          <p className="text-xl font-bold text-amber-600 mt-1">{pendingPacking.length}</p>
          <span className="text-[10px] text-slate-500">Awaiting pick list</span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('IN_PROGRESS')}
          className={`p-4 rounded-xl border text-left transition-all ${
            filter === 'IN_PROGRESS' ? 'border-blue-500 bg-blue-50/50 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase">Packing in Progress</span>
          <p className="text-xl font-bold text-blue-600 mt-1">{packingInProgress.length}</p>
          <span className="text-[10px] text-slate-500">Being boxed & sealed</span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('PACKED')}
          className={`p-4 rounded-xl border text-left transition-all ${
            filter === 'PACKED' ? 'border-emerald-500 bg-emerald-50/50 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase">Packed Orders</span>
          <p className="text-xl font-bold text-emerald-600 mt-1">{packedOrders.length}</p>
          <span className="text-[10px] text-slate-500">Ready for handover</span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('READY_DISPATCH')}
          className={`p-4 rounded-xl border text-left transition-all ${
            filter === 'READY_DISPATCH' ? 'border-cyan-500 bg-cyan-50/50 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase">Ready for Dispatch</span>
          <p className="text-xl font-bold text-cyan-600 mt-1">{readyDispatch.length}</p>
          <span className="text-[10px] text-slate-500">Handed to logistics</span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('ON_HOLD')}
          className={`p-4 rounded-xl border text-left transition-all ${
            filter === 'ON_HOLD' ? 'border-rose-500 bg-rose-50/50 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-bold text-rose-500 uppercase flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Orders on Hold
          </span>
          <p className="text-xl font-bold text-rose-600 mt-1">{ordersOnHold.length}</p>
          <span className="text-[10px] text-rose-500">Missing item shortage</span>
        </button>
      </div>

      {/* Filter Tabs Filter Pill */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { key: 'ALL', label: `All Orders (${orders.length})` },
            { key: 'PENDING', label: `Pending Packing (${pendingPacking.length})` },
            { key: 'IN_PROGRESS', label: `In Progress (${packingInProgress.length})` },
            { key: 'PACKED', label: `Packed (${packedOrders.length})` },
            { key: 'ON_HOLD', label: `On Hold (${ordersOnHold.length})` },
            { key: 'READY_DISPATCH', label: `Handed to Dispatch (${readyDispatch.length})` }
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                filter === t.key
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Grid / Cards with Visible Thumbnails */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading packing queue...</div>
        ) : displayedOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs">
            No orders in this packing queue view.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedOrders.map(ord => {
              const statusBadge = (() => {
                switch (ord.packing_status) {
                  case 'ON_HOLD':
                    return <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full">On Hold (Shortage)</span>;
                  case 'PACKING_IN_PROGRESS':
                    return <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full">Packing in Progress</span>;
                  case 'PACKED':
                    return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">Packed</span>;
                  case 'HANDED_OVER_TO_DISPATCH':
                    return <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 text-[10px] font-bold rounded-full">Ready for Dispatch</span>;
                  default:
                    return <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">Pending Packing</span>;
                }
              })();

              return (
                <div
                  key={ord.id}
                  className={`p-4 rounded-xl border-2 flex flex-col justify-between space-y-3 transition-all ${
                    ord.packing_status === 'ON_HOLD'
                      ? 'border-rose-300 bg-rose-50/20'
                      : ord.packing_status === 'PACKED'
                      ? 'border-emerald-300 bg-emerald-50/10'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">{ord.order_number}</span>
                      {statusBadge}
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm mt-1">{ord.vendor_name}</h4>
                    <p className="text-xs text-slate-500">
                      Sales Rep: {ord.sales_person_name} • Req: {ord.required_delivery_date || 'Standard'}
                    </p>

                    {ord.packing_notes && (
                      <div className="mt-2 p-1.5 bg-rose-100 text-rose-800 rounded text-[11px] font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{ord.packing_notes}</span>
                      </div>
                    )}

                    {/* Ordered Products Visible Thumbnails (Requirement 7) */}
                    {ord.items && ord.items.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto py-1">
                        {ord.items.slice(0, 3).map((it: any) => (
                          <div key={it.id} className="flex items-center gap-1 bg-slate-50 p-1 rounded border border-slate-200 shrink-0 max-w-[150px]">
                            <img
                              src={it.product_image || 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=80&auto=format&fit=crop&q=60'}
                              alt={it.product_name}
                              className="w-7 h-7 object-cover rounded bg-white shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=80&auto=format&fit=crop&q=60';
                              }}
                            />
                            <div className="overflow-hidden">
                              <p className="text-[10px] font-semibold text-slate-800 truncate" title={it.product_name}>
                                {it.product_name} {it.unit ? `– ${it.unit}` : ''}
                              </p>
                              <p className="text-[9px] text-slate-500">{it.quantity} {it.unit}</p>
                            </div>
                          </div>
                        ))}
                        {ord.items.length > 3 && (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                            +{ord.items.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenOrderDetail(ord)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Check & Pack</span>
                    </button>

                    {ord.packing_status === 'PENDING_PACKING' && (
                      <button
                        onClick={() => handleStartPacking(ord.id)}
                        disabled={actionLoading}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Start Packing</span>
                      </button>
                    )}

                    {ord.packing_status === 'PACKING_IN_PROGRESS' && (
                      <button
                        onClick={() => handleCompletePacking(ord.id)}
                        disabled={actionLoading}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1"
                      >
                        <PackageCheck className="w-3.5 h-3.5" />
                        <span>Packing Completed</span>
                      </button>
                    )}

                    {ord.packing_status === 'PACKED' && (
                      <button
                        onClick={() => handleHandoverDispatch(ord.id)}
                        disabled={actionLoading}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Handover to Dispatch</span>
                      </button>
                    )}

                    {ord.packing_status === 'HANDED_OVER_TO_DISPATCH' && (
                      <span className="text-[11px] font-bold text-cyan-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>At Dispatch Bay</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PACKING ORDER DETAIL MODAL (Requirement 6) */}
      {activeOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 space-y-4 my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-amber-500" />
                  Packing Order Details: #{activeOrder.order_number}
                </h3>
                <p className="text-xs text-slate-500">
                  Vendor: <strong>{activeOrder.vendor_name}</strong> • Sales Officer: {activeOrder.sales_person_name} • Target Date: {activeOrder.required_delivery_date || 'Standard'}
                </p>
              </div>
              <button onClick={() => setActiveOrder(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            {/* Hold Banner if on hold */}
            {activeOrder.packing_status === 'ON_HOLD' && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Order On Hold Due to Stock Unavailability</p>
                  <p className="text-[11px] mt-0.5">{activeOrder.packing_notes || 'Item shortage reported during packing check. Admin has been alerted.'}</p>
                </div>
              </div>
            )}

            {/* Items Checklist with Visible Product Thumbnails (Requirement 6 & 7) */}
            <div className="overflow-y-auto flex-1 border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Product Image</th>
                    <th className="py-2.5 px-3">Product Name & SKU</th>
                    <th className="py-2.5 px-3">Ordered Qty</th>
                    <th className="py-2.5 px-3">Packing Unit</th>
                    <th className="py-2.5 px-3">Item Availability</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeOrderItems.map(item => {
                    const isAvailable = (item.item_availability || 'AVAILABLE') === 'AVAILABLE';
                    return (
                      <tr key={item.id} className={isAvailable ? 'hover:bg-slate-50' : 'bg-rose-50/50'}>
                        {/* Thumbnail with Click to Zoom */}
                        <td className="py-2.5 px-3">
                          <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                            <img
                              src={item.product_image || 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=100&auto=format&fit=crop&q=60'}
                              alt={item.product_name}
                              className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform"
                              onClick={() => setZoomImage(item.product_image || 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=800&auto=format&fit=crop&q=80')}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=100&auto=format&fit=crop&q=60';
                              }}
                            />
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          <p className="font-bold text-slate-900">{item.product_name} {item.unit ? `– ${item.unit}` : ''}</p>
                          <p className="font-mono text-[10px] text-slate-500 font-semibold">{item.sku} • {item.brand_name || 'Lubricant'}</p>
                        </td>

                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 text-sm">
                          {item.quantity}
                        </td>

                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold text-[10px]">
                            {item.unit}
                          </span>
                        </td>

                        <td className="py-2.5 px-3">
                          {isAvailable ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Item Ready in Stock</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Item Not Available</span>
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          {isAvailable ? (
                            <button
                              type="button"
                              onClick={() => handleToggleItemAvailability(activeOrder.id, item.id, 'AVAILABLE')}
                              className="px-2.5 py-1 text-rose-700 hover:bg-rose-50 border border-rose-300 rounded text-[11px] font-semibold transition"
                            >
                              Mark Not Available
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleItemAvailability(activeOrder.id, item.id, 'NOT_AVAILABLE')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition"
                            >
                              Mark Ready
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions based on packing state */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setActiveOrder(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {activeOrder.packing_status === 'PENDING_PACKING' && (
                  <button
                    type="button"
                    onClick={() => handleStartPacking(activeOrder.id)}
                    disabled={actionLoading}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
                  >
                    <Play className="w-4 h-4" />
                    <span>Start Packing</span>
                  </button>
                )}

                {activeOrder.packing_status === 'PACKING_IN_PROGRESS' && (
                  <button
                    type="button"
                    onClick={() => handleCompletePacking(activeOrder.id)}
                    disabled={actionLoading}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
                  >
                    <PackageCheck className="w-4 h-4" />
                    <span>Packing Completed</span>
                  </button>
                )}

                {activeOrder.packing_status === 'PACKED' && (
                  <button
                    type="button"
                    onClick={() => handleHandoverDispatch(activeOrder.id)}
                    disabled={actionLoading}
                    className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
                  >
                    <Truck className="w-4 h-4" />
                    <span>Handover to Dispatch Team</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HOLD REASON MODAL (When marking item not available) */}
      {showHoldModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-rose-600 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Mark Item Not Available & Hold Order
              </h3>
              <button onClick={() => setShowHoldModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <form onSubmit={handleConfirmHold} className="space-y-4 text-xs">
              <p className="text-slate-600">
                Marking this item as <strong>Not Available</strong> will place the order <strong>On Hold</strong> and immediately alert the Administrator. Incomplete orders cannot be sent to Dispatch.
              </p>

              <div>
                <label className="block font-semibold mb-1 text-slate-800">Reason / Shortage Details *</label>
                <textarea
                  rows={3}
                  required
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  placeholder="e.g. Drums out of stock in warehouse bay 3. Awaiting batch release."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowHoldModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-xs"
                >
                  Put Order On Hold
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ZOOM IMAGE MODAL */}
      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-xl max-h-[85vh] bg-white rounded-2xl overflow-hidden p-2 shadow-2xl" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setZoomImage(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={zoomImage}
              alt="Product High Resolution"
              className="w-full h-auto max-h-[80vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
