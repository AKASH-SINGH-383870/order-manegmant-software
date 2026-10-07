import React, { useState, useEffect } from 'react';
import {
  FileText, Search, Filter, Printer, Download, Eye, RefreshCw,
  Building2, User, Store, CreditCard, ChevronRight, CheckCircle2,
  AlertCircle, ArrowUpRight, Check, X, ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { Bill } from '../types.js';
import { BillModal } from '../components/BillModal.js';
import { DateRangeFilter } from '../components/DateRangeFilter.js';
import { DateRange, getDateRangeFromPreset } from '../utils/dateFilters.js';

interface BillsProps {
  onNavigate: (page: string) => void;
}

export const Bills: React.FC<BillsProps> = ({ onNavigate }) => {
  const { user, hasPermission } = useAuth();
  const isSuperAdmin = user?.role_slug === 'super_admin';
  const isAdmin = user?.role_slug === 'admin' || isSuperAdmin;
  const isAccounts = user?.role_slug === 'accounts';
  const isSalesPerson = user?.role_slug === 'sales_person';
  const canViewAll = isSuperAdmin || isAdmin || isAccounts || hasPermission('bills:view_all');
  const canViewOwn = user?.permissions.includes('bills:view_own') || isSalesPerson;

  // State
  const [bills, setBills] = useState<Bill[]>([]);
  const [summary, setSummary] = useState({
    total_bills: 0,
    gst_bills: 0,
    non_gst_bills: 0,
    total_billing_amount: 0,
    total_received: 0,
    balance_payment: 0
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  // Filters
  const [taxFilter, setTaxFilter] = useState<'ALL' | 'GST' | 'NON_GST'>('ALL');
  const [partyFilter, setPartyFilter] = useState<string>('ALL');
  const [salesPersonFilter, setSalesPersonFilter] = useState<string>('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<DateRange>(getDateRangeFromPreset('this_month'));

  // Lists for filter dropdowns
  const [parties, setParties] = useState<any[]>([]);
  const [salesPersons, setSalesPersons] = useState<any[]>([]);

  // Modal State
  const [activeBillId, setActiveBillId] = useState<number | string | null>(null);
  const [autoPrintModal, setAutoPrintModal] = useState<boolean>(false);

  // Load Parties and Sales Persons for dropdown filters
  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const token = localStorage.getItem('petroflow_token');
        const [vRes, spRes] = await Promise.all([
          fetch('/api/vendors', { headers: { Authorization: `Bearer ${token}` } }),
          canViewAll ? fetch('/api/sales-persons', { headers: { Authorization: `Bearer ${token}` } }) : Promise.resolve(null)
        ]);
        if (vRes.ok) {
          const vData = await vRes.json();
          setParties(vData.vendors || []);
        }
        if (spRes && spRes.ok) {
          const spData = await spRes.json();
          setSalesPersons(spData.salesPersons || []);
        }
      } catch (err) {
        console.error('Error fetching filter dropdowns:', err);
      }
    };
    fetchDropdowns();
  }, [canViewAll]);

  // Fetch Bills
  const fetchBills = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const params = new URLSearchParams();

      if (taxFilter !== 'ALL') {
        params.append('tax_type', taxFilter === 'GST' ? 'GST_18' : 'NON_GST');
      }
      if (partyFilter && partyFilter !== 'ALL') {
        params.append('party_id', partyFilter);
      }
      if (canViewAll && salesPersonFilter && salesPersonFilter !== 'ALL') {
        params.append('sales_person_id', salesPersonFilter);
      }
      if (paymentStatusFilter && paymentStatusFilter !== 'ALL') {
        params.append('payment_status', paymentStatusFilter);
      }
      if (dateRange.startDate) {
        params.append('startDate', dateRange.startDate);
      }
      if (dateRange.endDate) {
        params.append('endDate', dateRange.endDate);
      }
      if (search.trim()) {
        params.append('search', search.trim());
      }

      const res = await fetch(`/api/bills?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setBills(data.bills || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      }
    } catch (err) {
      console.error('Error loading bills:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, [taxFilter, partyFilter, salesPersonFilter, paymentStatusFilter, dateRange]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBills();
  };

  const handleResetFilters = () => {
    setTaxFilter('ALL');
    setPartyFilter('ALL');
    setSalesPersonFilter('ALL');
    setPaymentStatusFilter('ALL');
    setSearch('');
    setDateRange(getDateRangeFromPreset('this_month'));
  };

  // Open modal for view
  const handleViewBill = (billId: number | string) => {
    setActiveBillId(billId);
    setAutoPrintModal(false);
  };

  // Open modal and trigger print
  const handlePrintBill = (billId: number | string) => {
    setActiveBillId(billId);
    setAutoPrintModal(true);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Page Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center border border-amber-500/30">
              <FileText className="w-5 h-5 text-amber-600" />
            </div>
            <span>Bills & Invoices</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Automated commercial bills and tax invoices generated from orders & reconciled with Payments & Ledger
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchBills}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg border border-slate-200 shadow-2xs transition"
            title="Refresh bills"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-600' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('orders')}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            View Orders
          </button>
        </div>
      </div>

      {/* TOP SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Bills */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Total Bills</p>
          <p className="text-xl sm:text-2xl font-black text-slate-900">{summary.total_bills}</p>
          <p className="text-[10px] text-slate-400">Total Commercial Invoices</p>
        </div>

        {/* GST Bills */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wide">GST Bills</p>
          <p className="text-xl sm:text-2xl font-black text-emerald-700">{summary.gst_bills}</p>
          <p className="text-[10px] text-emerald-600">18% GST Applicable</p>
        </div>

        {/* Non-GST Bills */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wide">Non-GST Bills</p>
          <p className="text-xl sm:text-2xl font-black text-amber-700">{summary.non_gst_bills}</p>
          <p className="text-[10px] text-amber-600">Standard Commercial</p>
        </div>

        {/* Total Billing Amount */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Billing Amount</p>
          <p className="text-lg sm:text-xl font-black text-slate-900 truncate" title={`₹${summary.total_billing_amount.toLocaleString('en-IN')}`}>
            ₹{summary.total_billing_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-slate-400">Total Invoice Value</p>
        </div>

        {/* Total Received */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wide">Total Received</p>
          <p className="text-lg sm:text-xl font-black text-emerald-700 truncate" title={`₹${summary.total_received.toLocaleString('en-IN')}`}>
            ₹{summary.total_received.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-emerald-600">Verified Ledger Payments</p>
        </div>

        {/* Balance Payment */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wide">Balance Payment</p>
          <p className="text-lg sm:text-xl font-black text-rose-700 truncate" title={`₹${summary.balance_payment.toLocaleString('en-IN')}`}>
            ₹{summary.balance_payment.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-rose-600">Outstanding Receivable</p>
        </div>
      </div>

      {/* FILTERS & SEARCH BAR */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        
        {/* Row 1: Tax Type Tabs + Search */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Tax Filter Tabs: All / GST / Non-GST */}
          <div className="flex items-center p-1 bg-slate-100 rounded-lg text-xs font-semibold self-start">
            <button
              type="button"
              onClick={() => setTaxFilter('ALL')}
              className={`px-3 py-1.5 rounded-md transition ${
                taxFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Bills
            </button>
            <button
              type="button"
              onClick={() => setTaxFilter('GST')}
              className={`px-3 py-1.5 rounded-md transition ${
                taxFilter === 'GST'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              GST Bills (18%)
            </button>
            <button
              type="button"
              onClick={() => setTaxFilter('NON_GST')}
              className={`px-3 py-1.5 rounded-md transition ${
                taxFilter === 'NON_GST'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Non-GST Bills
            </button>
          </div>

          {/* Quick Search */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Invoice No, Order ID, Party Name..."
              className="w-full pl-9 pr-16 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-amber-500 focus:bg-white transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  fetchBills();
                }}
                className="absolute right-12 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold rounded"
            >
              Search
            </button>
          </form>

        </div>

        {/* Row 2: Secondary Dropdown Filters + Date Range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          
          {/* Party Dropdown */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
              Party / Client
            </label>
            <select
              value={partyFilter}
              onChange={(e) => setPartyFilter(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-hidden focus:border-amber-500"
            >
              <option value="ALL">All Parties ({parties.length})</option>
              {parties.map(p => (
                <option key={p.id} value={p.id}>
                  {p.company_name} ({p.city || 'Vendor'})
                </option>
              ))}
            </select>
          </div>

          {/* Sales Person Dropdown (Only for users who can view all bills) */}
          {canViewAll ? (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                Sales Person
              </label>
              <select
                value={salesPersonFilter}
                onChange={(e) => setSalesPersonFilter(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-hidden focus:border-amber-500"
              >
                <option value="ALL">All Sales Persons</option>
                {salesPersons.map(sp => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                Assigned Sales Rep
              </label>
              <div className="p-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">
                {user?.name} (Own Bills)
              </div>
            </div>
          )}

          {/* Payment Status Dropdown */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
              Payment Status
            </label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-hidden focus:border-amber-500"
            >
              <option value="ALL">All Payment Statuses</option>
              <option value="PAID">Fully Paid</option>
              <option value="PARTIAL">Partially Paid</option>
              <option value="UNPAID">Unpaid (Full Balance Due)</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleResetFilters}
              className="w-full p-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Reset All Filters
            </button>
          </div>

        </div>

        {/* Row 3: Date Range Filter Bar */}
        <div className="pt-2 border-t border-slate-100">
          <DateRangeFilter
            value={dateRange}
            onChange={(newRange) => setDateRange(newRange)}
            defaultPreset="this_month"
            allowAllTime={true}
          />
        </div>

      </div>

      {/* BILL LIST TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-sm text-slate-900">
              Generated Invoices & Bills
            </h2>
            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-semibold">
              {bills.length} Records
            </span>
          </div>

          {isSalesPerson && (
            <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 font-medium">
              Filtered to your assigned accounts only
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-semibold text-slate-500">Loading bills ledger...</p>
          </div>
        ) : bills.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <FileText className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
            <p className="text-sm font-semibold text-slate-600">No bills found matching your criteria</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Try adjusting the date range, tax type filter, or search keywords.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice No.</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Order ID</th>
                  <th className="py-3 px-4">Party</th>
                  <th className="py-3 px-3 text-center">Tax Type</th>
                  <th className="py-3 px-3 text-right">Bill Amount</th>
                  <th className="py-3 px-3 text-right">Received</th>
                  <th className="py-3 px-3 text-right">Balance Payment</th>
                  <th className="py-3 px-3 text-center">Payment Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {bills.map((b) => {
                  const isNonGst = b.tax_type === 'NON_GST';
                  const billAmt = Number(b.bill_amount) || 0;
                  const recAmt = Number(b.received_amount) || 0;
                  const balAmt = Math.max(0, Number(b.balance_payment) || (billAmt - recAmt));

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Invoice No. */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        <button
                          type="button"
                          onClick={() => handleViewBill(b.id)}
                          className="hover:text-amber-600 hover:underline text-left cursor-pointer"
                          title="Click to view full bill"
                        >
                          {b.invoice_number}
                        </button>
                        <div className="text-[10px] text-slate-400 font-sans font-normal truncate max-w-[120px]">
                          {b.company_name}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {new Date(b.invoice_date || b.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>

                      {/* Order ID */}
                      <td className="py-3 px-3 font-medium">
                        <button
                          type="button"
                          onClick={() => onNavigate(`orders/${b.order_id}`)}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline font-mono"
                          title="View order tracking"
                        >
                          #{b.order_number}
                        </button>
                        <div className="text-[10px] text-slate-400 font-sans">
                          {b.order_status}
                        </div>
                      </td>

                      {/* Party */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 max-w-[180px] truncate" title={b.party_name}>
                          {b.party_name}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                          <span>{b.party_city || 'Client'}</span>
                          {b.sales_person_name && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[90px]">{b.sales_person_name}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Tax Type */}
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          isNonGst
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {isNonGst ? 'Non-GST' : 'GST 18%'}
                        </span>
                      </td>

                      {/* Bill Amount */}
                      <td className="py-3 px-3 text-right font-black text-slate-900">
                        ₹{billAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {!isNonGst && (
                          <div className="text-[9px] text-slate-400 font-normal">
                            Taxable: ₹{Number(b.taxable_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </div>
                        )}
                      </td>

                      {/* Received */}
                      <td className="py-3 px-3 text-right font-bold text-emerald-700">
                        ₹{recAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Balance Payment */}
                      <td className="py-3 px-3 text-right font-black text-rose-700">
                        ₹{balAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Payment Status */}
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          b.payment_status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.payment_status === 'PARTIAL'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {b.payment_status}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View Bill */}
                          <button
                            type="button"
                            onClick={() => handleViewBill(b.id)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition cursor-pointer"
                            title="View Bill Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Print Bill */}
                          <button
                            type="button"
                            onClick={() => handlePrintBill(b.id)}
                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition cursor-pointer"
                            title="Print Bill"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Download PDF */}
                          <button
                            type="button"
                            onClick={() => handlePrintBill(b.id)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition cursor-pointer"
                            title="Download PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bill View/Print Modal */}
      {activeBillId && (
        <BillModal
          billId={activeBillId}
          isOpen={!!activeBillId}
          onClose={() => {
            setActiveBillId(null);
            setAutoPrintModal(false);
          }}
          autoPrint={autoPrintModal}
        />
      )}

    </div>
  );
};
