import React, { useState, useEffect } from 'react';
import {
  X, Save, Plus, Trash2, Building2, Store, Package, AlertCircle,
  CheckCircle2, Clock, ShieldAlert, Search, RefreshCw, Calculator,
  Calendar, MapPin, Phone, User, FileText, ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { Company, Vendor, Product, Order, OrderItem } from '../types.js';

interface EditOrderModalProps {
  orderId: number | string;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated?: (updatedOrder: Order) => void;
}

export interface EditProductRow {
  product_id: number;
  product_name: string;
  sku: string;
  unit: string;
  item_colour?: string;
  quantity: number;
  rate: number;
  line_amount: number;
  notes?: string;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  orderId,
  isOpen,
  onClose,
  onOrderUpdated
}) => {
  const { user, hasPermission } = useAuth();
  const isAdmin = ['super_admin', 'admin'].includes(user?.role_slug || '');

  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Master Data
  const [companies, setCompanies] = useState<Company[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  // Original Order Data
  const [originalOrder, setOriginalOrder] = useState<Order | null>(null);

  // Form State
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  const [taxType, setTaxType] = useState<'GST_18' | 'NON_GST'>('GST_18');
  const [productRows, setProductRows] = useState<EditProductRow[]>([]);
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [contactPerson, setContactPerson] = useState<string>('');
  const [contactNumber, setContactNumber] = useState<string>('');
  const [requiredDeliveryDate, setRequiredDeliveryDate] = useState<string>('');
  const [specialInstructions, setSpecialInstructions] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [paymentTerms, setPaymentTerms] = useState<string>('Credit 30 Days');

  // Product Selection Modal
  const [showProductPicker, setShowProductPicker] = useState<boolean>(false);
  const [productSearch, setProductSearch] = useState<string>('');

  // Fetch Master Data & Order Data
  useEffect(() => {
    if (!isOpen || !orderId) return;

    let isMounted = true;
    const loadOrderAndPrerequisites = async () => {
      setLoading(true);
      setError(null);
      setSuccess(null);
      try {
        const token = localStorage.getItem('petroflow_token');
        const [orderRes, compRes, vendRes, prodRes] = await Promise.all([
          fetch(`/api/orders/${orderId}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/companies', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/vendors', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/products', { headers: { Authorization: `Bearer ${token}` } })
        ]);

        if (!orderRes.ok) {
          throw new Error('Failed to load order details');
        }

        const orderJson = await orderRes.json();
        const ord: Order = orderJson.order;
        const items: OrderItem[] = orderJson.items || [];

        if (compRes.ok) {
          const compJson = await compRes.json();
          if (isMounted) setCompanies(compJson.companies || []);
        }
        if (vendRes.ok) {
          const vendJson = await vendRes.json();
          if (isMounted) setVendors(vendJson.vendors || []);
        }
        if (prodRes.ok) {
          const prodJson = await prodRes.json();
          if (isMounted) setAllProducts(prodJson.products || []);
        }

        if (isMounted) {
          setOriginalOrder(ord);
          setSelectedCompanyId(ord.company_id);
          setSelectedVendorId(ord.vendor_id);
          setTaxType((ord.tax_type as 'GST_18' | 'NON_GST') || 'GST_18');
          setDeliveryAddress(ord.delivery_address || '');
          setContactPerson(ord.delivery_contact_person || ord.vendor_contact || '');
          setContactNumber(ord.delivery_contact_number || ord.vendor_mobile || '');
          setRequiredDeliveryDate(ord.required_delivery_date || '');
          setSpecialInstructions(ord.special_instructions || '');
          setOrderNotes(ord.notes || '');
          setPaymentTerms(ord.payment_terms || 'Credit 30 Days');

          // Map items to product rows
          const rows: EditProductRow[] = items.map(it => ({
            product_id: it.product_id,
            product_name: it.product_name,
            sku: it.sku,
            unit: it.unit,
            item_colour: it.item_colour || 'Golden Yellow',
            quantity: it.quantity,
            rate: it.rate,
            line_amount: Math.round(it.quantity * it.rate * 100) / 100,
            notes: it.notes || ''
          }));
          setProductRows(rows);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Error loading order');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadOrderAndPrerequisites();
    return () => { isMounted = false; };
  }, [isOpen, orderId]);

  if (!isOpen) return null;

  // Delivered check rule
  const isDelivered = originalOrder?.order_status === 'DELIVERED';
  const canEditDelivered = isAdmin || hasPermission('orders:edit_delivered');
  const isDeliveredBlocked = isDelivered && !canEditDelivered;

  // Live calculations
  const grandTotal = Math.round(productRows.reduce((acc, r) => acc + (r.line_amount || 0), 0) * 100) / 100;
  const isNonGst = taxType === 'NON_GST';
  const subtotal = isNonGst ? grandTotal : Math.round((grandTotal / 1.18) * 100) / 100;
  const taxAmount = isNonGst ? 0 : Math.round((grandTotal - subtotal) * 100) / 100;
  const previouslyReceived = Number(originalOrder?.amount_received || 0);
  const newPendingAmount = Math.max(0, Math.round((grandTotal - previouslyReceived) * 100) / 100);

  // Row handlers
  const handleUpdateRowQty = (index: number, newQty: number) => {
    const val = Math.max(0, isNaN(newQty) ? 0 : newQty);
    setProductRows(prev => {
      const next = [...prev];
      next[index].quantity = val;
      next[index].line_amount = Math.round(val * next[index].rate * 100) / 100;
      return next;
    });
  };

  const handleUpdateRowRate = (index: number, newRate: number) => {
    const val = Math.max(0, isNaN(newRate) ? 0 : newRate);
    setProductRows(prev => {
      const next = [...prev];
      next[index].rate = val;
      next[index].line_amount = Math.round(next[index].quantity * val * 100) / 100;
      return next;
    });
  };

  const handleUpdateRowNotes = (index: number, notes: string) => {
    setProductRows(prev => {
      const next = [...prev];
      next[index].notes = notes;
      return next;
    });
  };

  const handleUpdateRowColour = (index: number, colour: string) => {
    setProductRows(prev => {
      const next = [...prev];
      next[index].item_colour = colour;
      return next;
    });
  };

  const handleRemoveRow = (index: number) => {
    setProductRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddProductFromCatalog = (prod: Product) => {
    const existingIndex = productRows.findIndex(r => r.product_id === prod.id);
    if (existingIndex >= 0) {
      // Increment quantity
      handleUpdateRowQty(existingIndex, productRows[existingIndex].quantity + 1);
    } else {
      const defaultRate = Number(prod.standard_rate) > 0 ? Number(prod.standard_rate) : 150;
      setProductRows(prev => [
        ...prev,
        {
          product_id: prod.id,
          product_name: prod.name,
          sku: prod.sku,
          unit: prod.unit,
          item_colour: prod.item_colour || 'Golden Yellow',
          quantity: 1,
          rate: defaultRate,
          line_amount: defaultRate,
          notes: ''
        }
      ]);
    }
    setShowProductPicker(false);
  };

  // Vendor change updates delivery defaults
  const handleVendorSelect = (vId: number) => {
    setSelectedVendorId(vId);
    const v = vendors.find(x => x.id === vId);
    if (v) {
      if (!deliveryAddress || deliveryAddress === originalOrder?.delivery_address) {
        setDeliveryAddress(v.delivery_address || v.billing_address || '');
      }
      if (!contactPerson || contactPerson === originalOrder?.delivery_contact_person) {
        setContactPerson(v.contact_person || '');
      }
      if (!contactNumber || contactNumber === originalOrder?.delivery_contact_number) {
        setContactNumber(v.mobile || '');
      }
    }
  };

  // Save Order Edits
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originalOrder) return;

    if (isDeliveredBlocked) {
      setError('Delivered orders can only be edited by an Administrator or Super Admin.');
      return;
    }

    if (!selectedCompanyId) {
      setError('Please select a Billing Company.');
      return;
    }

    if (!selectedVendorId) {
      setError('Please select a Party / Vendor.');
      return;
    }

    if (productRows.length === 0) {
      setError('At least one product item is required in the order.');
      return;
    }

    for (const r of productRows) {
      if (!r.product_id || r.quantity <= 0 || r.rate <= 0) {
        setError(`Please ensure valid quantity (> 0) and selling rate (> 0) for "${r.product_name}".`);
        return;
      }
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('petroflow_token');
      const payload = {
        company_id: selectedCompanyId,
        vendor_id: selectedVendorId,
        tax_type: taxType,
        delivery_address: deliveryAddress,
        delivery_contact_person: contactPerson,
        delivery_contact_number: contactNumber,
        required_delivery_date: requiredDeliveryDate || null,
        special_instructions: specialInstructions,
        notes: orderNotes,
        payment_terms: paymentTerms,
        items: productRows.map(r => ({
          product_id: r.product_id,
          sku: r.sku,
          product_name: r.product_name,
          unit: r.unit,
          quantity: r.quantity,
          rate: r.rate,
          item_colour: r.item_colour,
          notes: r.notes
        }))
      };

      const res = await fetch(`/api/orders/${originalOrder.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update order');
      }

      setSuccess('Order updated successfully! Recalculated totals, ledger balance, and audit trail saved.');
      if (onOrderUpdated && data.order) {
        onOrderUpdated(data.order);
      }

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Error updating order');
    } finally {
      setSaving(false);
    }
  };

  const filteredCatalog = allProducts.filter(p => {
    if (!productSearch) return true;
    const term = productSearch.toLowerCase();
    return (
      p.name?.toLowerCase().includes(term) ||
      p.sku?.toLowerCase().includes(term) ||
      p.brand_name?.toLowerCase().includes(term) ||
      p.category_name?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto border border-slate-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black">
              #
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">
                  Edit Order: <span className="font-mono text-amber-400">{originalOrder?.order_number || `ID ${orderId}`}</span>
                </h2>
                {originalOrder?.order_status && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                    {originalOrder.order_status}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Modifies existing order ID & recalculates total, taxes, and balance with audit history.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
              <p className="font-semibold text-xs text-slate-600">Loading order configuration...</p>
            </div>
          ) : (
            <form id="edit-order-form" onSubmit={handleSave} className="space-y-6">
              {/* Alert Banners */}
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              {/* Delivered Order Notice */}
              {isDelivered && (
                <div className={`p-3 rounded-xl border flex items-start gap-3 ${
                  isDeliveredBlocked
                    ? 'bg-rose-50 border-rose-300 text-rose-900'
                    : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}>
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Order Delivered Status Notice</p>
                    <p className="text-[11px] mt-0.5">
                      {isDeliveredBlocked
                        ? 'This order has already been marked DELIVERED. Editing is restricted to Administrators only.'
                        : 'This order is DELIVERED. As an Administrator, any modifications will update the order slip, ledger, and record an audit entry.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Section 1: Commercial Parties (Billing Entity & Party) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {/* Billing Company */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-amber-600" />
                    Billing Company *
                  </label>
                  <select
                    value={selectedCompanyId || ''}
                    onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
                    disabled={isDeliveredBlocked}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    required
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code}) - GSTIN: {c.gst_number}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">Changes billing entity printed on invoices & slips.</p>
                </div>

                {/* Party (Vendor) */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-amber-600" />
                    Party (Customer / Vendor) *
                  </label>
                  <select
                    value={selectedVendorId || ''}
                    onChange={(e) => handleVendorSelect(Number(e.target.value))}
                    disabled={isDeliveredBlocked}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    required
                  >
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.company_name} ({v.vendor_code}) - {v.city}, {v.state}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">Select party to bill. Delivery address auto-suggests.</p>
                </div>
              </div>

              {/* Section 2: Products & Selling Rate */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Package className="w-4 h-4 text-amber-600" />
                      Order Items & Selling Rates
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Total is calculated strictly from: Quantity × Selling Rate. Add/remove lubricants or adjust pricing.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Tax Type Selector */}
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setTaxType('GST_18')}
                        className={`px-3 py-1.5 rounded-md font-bold text-xs transition ${
                          taxType === 'GST_18'
                            ? 'bg-amber-500 text-slate-950 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        GST 18%
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaxType('NON_GST')}
                        className={`px-3 py-1.5 rounded-md font-bold text-xs transition ${
                          taxType === 'NON_GST'
                            ? 'bg-slate-800 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Non-GST
                      </button>
                    </div>

                    {/* Add Product Button */}
                    <button
                      type="button"
                      onClick={() => setShowProductPicker(true)}
                      disabled={isDeliveredBlocked}
                      className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold rounded-lg flex items-center gap-1.5 transition shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Product</span>
                    </button>
                  </div>
                </div>

                {/* Products Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Product Name & SKU</th>
                          <th className="py-2.5 px-3">Colour</th>
                          <th className="py-2.5 px-3 w-28 text-right">Qty</th>
                          <th className="py-2.5 px-3 w-32 text-right">Selling Rate (₹)</th>
                          <th className="py-2.5 px-3 w-32 text-right">Amount (₹)</th>
                          <th className="py-2.5 px-3">Item Notes</th>
                          <th className="py-2.5 px-3 text-center w-12">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {productRows.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-slate-400">
                              No products in order. Click <strong>+ Add Product</strong> to add items.
                            </td>
                          </tr>
                        ) : (
                          productRows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/70">
                              <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                              <td className="py-2.5 px-3">
                                <p className="font-bold text-slate-900">{row.product_name}</p>
                                <span className="font-mono text-[10px] text-slate-500">
                                  {row.sku} • {row.unit}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <input
                                  type="text"
                                  value={row.item_colour || ''}
                                  onChange={(e) => handleUpdateRowColour(idx, e.target.value)}
                                  disabled={isDeliveredBlocked}
                                  placeholder="Colour"
                                  className="w-24 p-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
                                />
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={row.quantity}
                                  onChange={(e) => handleUpdateRowQty(idx, parseFloat(e.target.value) || 0)}
                                  disabled={isDeliveredBlocked}
                                  className="w-20 p-1.5 bg-slate-50 border border-slate-200 rounded text-right font-mono font-bold text-slate-900 text-xs focus:ring-1 focus:ring-amber-500"
                                />
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={row.rate}
                                  onChange={(e) => handleUpdateRowRate(idx, parseFloat(e.target.value) || 0)}
                                  disabled={isDeliveredBlocked}
                                  className="w-24 p-1.5 bg-slate-50 border border-slate-200 rounded text-right font-mono font-bold text-slate-900 text-xs focus:ring-1 focus:ring-amber-500"
                                />
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                ₹{row.line_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-3">
                                <input
                                  type="text"
                                  value={row.notes || ''}
                                  onChange={(e) => handleUpdateRowNotes(idx, e.target.value)}
                                  disabled={isDeliveredBlocked}
                                  placeholder="Specs / Packing notes"
                                  className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
                                />
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRow(idx)}
                                  disabled={isDeliveredBlocked || productRows.length <= 1}
                                  className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition disabled:opacity-30"
                                  title="Remove item"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Real-time Order Total & Tax Summary */}
                <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Calculator className="w-6 h-6 text-amber-400" />
                    <div>
                      <p className="font-bold text-sm">Recalculated Commercials</p>
                      <p className="text-[11px] text-slate-400">
                        {taxType === 'GST_18'
                          ? 'GST 18% Inclusive (Subtotal ₹' + subtotal.toLocaleString('en-IN') + ' + Tax ₹' + taxAmount.toLocaleString('en-IN') + ')'
                          : 'Non-GST Commercial Order (Tax Rate 0%)'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 text-right">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Order Grand Total</span>
                      <span className="font-mono text-lg font-black text-amber-400">
                        ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="border-l border-slate-700 pl-6">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Verified Received</span>
                      <span className="font-mono text-sm font-bold text-emerald-400">
                        ₹{previouslyReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="border-l border-slate-700 pl-6">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Recalculated Balance</span>
                      <span className={`font-mono text-base font-black ${
                        newPendingAmount > 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}>
                        ₹{newPendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Delivery Details & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="space-y-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-600" />
                      Delivery Destination Address *
                    </label>
                    <textarea
                      rows={2}
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      disabled={isDeliveredBlocked}
                      placeholder="Warehouse / Consignee Delivery Address"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-amber-600" />
                        Receiver Contact
                      </label>
                      <input
                        type="text"
                        value={contactPerson}
                        onChange={(e) => setContactPerson(e.target.value)}
                        disabled={isDeliveredBlocked}
                        placeholder="Person Name"
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-amber-600" />
                        Receiver Mobile
                      </label>
                      <input
                        type="text"
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        disabled={isDeliveredBlocked}
                        placeholder="10-digit mobile"
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-600" />
                      Required Delivery Date
                    </label>
                    <input
                      type="date"
                      value={requiredDeliveryDate}
                      onChange={(e) => setRequiredDeliveryDate(e.target.value)}
                      disabled={isDeliveredBlocked}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-600" />
                      Payment Terms
                    </label>
                    <select
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      disabled={isDeliveredBlocked}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    >
                      <option value="100% Advance">100% Advance</option>
                      <option value="50% Advance, Balance on Delivery">50% Advance, Balance on Delivery</option>
                      <option value="Credit 15 Days">Credit 15 Days</option>
                      <option value="Credit 30 Days">Credit 30 Days</option>
                      <option value="Credit 45 Days">Credit 45 Days</option>
                      <option value="Credit 60 Days">Credit 60 Days</option>
                      <option value="Against LR Copy">Against LR Copy</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Special Dispatch / Production Instructions</label>
                    <textarea
                      rows={2}
                      value={specialInstructions}
                      onChange={(e) => setSpecialInstructions(e.target.value)}
                      disabled={isDeliveredBlocked}
                      placeholder="e.g. 210L Barrel palletized packaging, fragile cap seals"
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Commercial / Internal Notes</label>
                    <textarea
                      rows={2}
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      disabled={isDeliveredBlocked}
                      placeholder="General order remarks, purchase order references"
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            {originalOrder?.updated_at && (
              <span>
                Last updated: <strong>{new Date(originalOrder.updated_at).toLocaleString('en-IN')}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-xl font-bold text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-order-form"
              disabled={saving || loading || isDeliveredBlocked}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Changes...' : 'Save Order Changes'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Product Selector Sub-Modal */}
      {showProductPicker && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-5 space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-600" />
                Select Product to Add
              </h3>
              <button onClick={() => setShowProductPicker(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products by SKU, name, brand, category..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 divide-y divide-slate-100">
              {filteredCatalog.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No lubricant products found matching search.
                </div>
              ) : (
                filteredCatalog.map(p => (
                  <div
                    key={p.id}
                    onClick={() => handleAddProductFromCatalog(p)}
                    className="pt-2 flex items-center justify-between p-2 hover:bg-amber-50 rounded-lg cursor-pointer transition"
                  >
                    <div>
                      <p className="font-bold text-slate-900 text-xs">{p.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {p.sku} • {p.unit} • Std Rate: ₹{p.standard_rate}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="px-2.5 py-1 bg-amber-500 text-slate-950 font-bold text-[11px] rounded-lg shadow-2xs hover:bg-amber-600"
                    >
                      + Add
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
