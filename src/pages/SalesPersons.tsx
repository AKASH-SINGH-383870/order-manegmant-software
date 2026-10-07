import React, { useState, useEffect } from 'react';
import {
  Users,
  Phone,
  Mail,
  Award,
  TrendingUp,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  X,
  Calendar,
  Filter,
  RotateCcw,
  Package,
  Building2,
  CheckCircle,
  XCircle,
  CreditCard,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import {
  DatePreset,
  DateRange,
  getDateRangeFromPreset,
  formatDisplayDate,
  formatDateToISO
} from '../utils/dateFilters.js';

interface SalesPersonsProps {
  onNavigate: (page: string) => void;
  initialPersonId?: string | number | null;
}

const PRESET_OPTIONS: { key: DatePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' },
  { key: 'last_week', label: 'Last Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'this_year', label: 'This Year' },
  { key: 'custom', label: 'Custom Date Range' },
];

export const SalesPersons: React.FC<SalesPersonsProps> = ({ onNavigate, initialPersonId }) => {
  const [salesTeam, setSalesTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Profile modal state
  const [selectedPerson, setSelectedPerson] = useState<any | null>(null);
  const [profileData, setProfileData] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  // Date filter state inside drilldown
  const [drilldownDateRange, setDrilldownDateRange] = useState<DateRange>(() =>
    getDateRangeFromPreset('this_month')
  );
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [showCustomPicker, setShowCustomPicker] = useState<boolean>(false);

  const fetchSalesPersons = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch('/api/sales-persons', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        const team = json.salesPersons || [];
        setSalesTeam(team);

        // If navigated with initialPersonId, auto open their drilldown
        if (initialPersonId) {
          const match = team.find((p: any) => String(p.id) === String(initialPersonId));
          if (match) {
            handleOpenDetail(match);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = async (personId: number, range: DateRange) => {
    setProfileLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      let url = `/api/sales-persons/${personId}?`;
      if (range.preset === 'custom' || (range.startDate && range.endDate)) {
        url += `startDate=${encodeURIComponent(range.startDate)}&endDate=${encodeURIComponent(range.endDate)}`;
      } else {
        url += `period=${encodeURIComponent(range.preset)}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setProfileData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesPersons();
  }, []);

  const handleOpenDetail = (person: any) => {
    setSelectedPerson(person);
    const initialRange = getDateRangeFromPreset('this_month');
    setDrilldownDateRange(initialRange);
    setCustomFrom(initialRange.startDate || '');
    setCustomTo(initialRange.endDate || '');
    setShowCustomPicker(false);
    loadProfile(person.id, initialRange);
  };

  const handleSelectPreset = (preset: DatePreset) => {
    if (preset === 'custom') {
      setShowCustomPicker(true);
      return;
    }
    setShowCustomPicker(false);
    const newRange = getDateRangeFromPreset(preset);
    setDrilldownDateRange(newRange);
    setCustomFrom(newRange.startDate || '');
    setCustomTo(newRange.endDate || '');
    if (selectedPerson) {
      loadProfile(selectedPerson.id, newRange);
    }
  };

  const handleApplyCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customFrom || !customTo) return;
    const newRange = getDateRangeFromPreset('custom', customFrom, customTo);
    setDrilldownDateRange(newRange);
    if (selectedPerson) {
      loadProfile(selectedPerson.id, newRange);
    }
  };

  const handleClearCustom = () => {
    const defaultRange = getDateRangeFromPreset('this_month');
    setDrilldownDateRange(defaultRange);
    setCustomFrom(defaultRange.startDate || '');
    setCustomTo(defaultRange.endDate || '');
    setShowCustomPicker(false);
    if (selectedPerson) {
      loadProfile(selectedPerson.id, defaultRange);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Users className="w-6 h-6 text-amber-500" />
          Sales Representatives & Territory Performance
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Measure monthly territory sales targets, booking volume, collection clearance, and client portfolio sizes.
        </p>
      </div>

      {/* Sales Team Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400">Loading sales representatives...</div>
        ) : (
          salesTeam.map((person) => (
            <div
              key={person.id}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4 hover:border-amber-400 transition group"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 font-bold text-base flex items-center justify-center shadow-md">
                      {person.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{person.name}</h3>
                      <span className="font-mono text-[11px] text-slate-400 font-semibold">{person.employee_id}</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200">
                    Active
                  </span>
                </div>

                <div className="mt-4 space-y-1 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{person.mobile}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{person.email}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 p-2 rounded-lg">
                    <p className="text-[10px] text-slate-400">Total Billed Sales</p>
                    <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                      ₹{(person.total_sales || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg">
                    <p className="text-[10px] text-slate-400">Total Received</p>
                    <p className="font-mono font-bold text-emerald-600 text-sm mt-0.5">
                      ₹{(person.total_received || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex justify-between text-xs text-slate-500">
                  <span>
                    Assigned Parties: <strong>{person.vendor_count || 0}</strong>
                  </span>
                  <span>
                    Orders Booked: <strong>{person.total_orders || 0}</strong>
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleOpenDetail(person)}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs"
              >
                <span>View Performance Drilldown</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* PERFORMANCE DETAIL MODAL */}
      {selectedPerson && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full p-4 sm:p-6 space-y-5 max-h-[94vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-slate-900">{selectedPerson.name}</h2>
                  <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {selectedPerson.employee_id}
                  </span>
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-800 text-[11px] font-bold rounded-full border border-amber-200">
                    Performance Drilldown
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                  <span>Territory Sales Lead</span>
                  <span>•</span>
                  <span>{selectedPerson.mobile}</span>
                  <span>•</span>
                  <span>{selectedPerson.email}</span>
                </p>
              </div>

              <button
                onClick={() => setSelectedPerson(null)}
                className="self-end sm:self-center p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* DATE FILTER BAR */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-slate-800">Filter Performance Period:</span>
                  <span className="text-xs font-mono font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded border border-amber-200">
                    {drilldownDateRange.label}
                  </span>
                </div>

                {drilldownDateRange.preset !== 'this_month' && (
                  <button
                    onClick={handleClearCustom}
                    className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Filter</span>
                  </button>
                )}
              </div>

              {/* Preset Buttons Grid */}
              <div className="flex flex-wrap gap-1.5">
                {PRESET_OPTIONS.map((opt) => {
                  const isActive = drilldownDateRange.preset === opt.key;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => handleSelectPreset(opt.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 shadow-xs ring-1 ring-amber-600'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Custom Date Range Inputs */}
              {(showCustomPicker || drilldownDateRange.preset === 'custom') && (
                <form
                  onSubmit={handleApplyCustom}
                  className="pt-2 border-t border-slate-200/80 flex flex-wrap items-end gap-3 bg-white p-3 rounded-lg border border-slate-200"
                >
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      From Date *
                    </label>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      required
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-900 focus:outline-amber-500"
                    />
                  </div>

                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      To Date *
                    </label>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      required
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-900 focus:outline-amber-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition shadow-xs"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={handleClearCustom}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition"
                    >
                      Clear
                    </button>
                  </div>
                </form>
              )}
            </div>

            {profileLoading ? (
              <div className="py-16 text-center text-slate-400">
                <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-xs font-semibold">Recalculating territory performance for selected period...</p>
              </div>
            ) : profileData ? (
              <>
                {/* Performance KPI Cards (recalculated for active range) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-slate-500 text-[11px] font-semibold">Total Orders</p>
                    <p className="text-xl font-black text-slate-900 mt-0.5">
                      {profileData.metrics.total_orders || 0}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Booked in range</p>
                  </div>

                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200">
                    <p className="text-amber-800 text-[11px] font-semibold">Total Sales</p>
                    <p className="text-xl font-black text-amber-950 font-mono mt-0.5">
                      ₹{(profileData.metrics.total_order_value || 0).toLocaleString('en-IN')}
                    </p>
                    <p className="text-[10px] text-amber-700 mt-0.5">Grand total value</p>
                  </div>

                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                    <p className="text-emerald-800 text-[11px] font-semibold">Delivered Orders</p>
                    <p className="text-xl font-black text-emerald-900 mt-0.5">
                      {profileData.metrics.delivered_orders || 0}
                    </p>
                    <p className="text-[10px] text-emerald-600 mt-0.5">Completed orders</p>
                  </div>

                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                    <p className="text-rose-800 text-[11px] font-semibold">Cancelled Orders</p>
                    <p className="text-xl font-black text-rose-900 mt-0.5">
                      {profileData.metrics.cancelled_orders || 0}
                    </p>
                    <p className="text-[10px] text-rose-600 mt-0.5">Rejected / Voided</p>
                  </div>

                  <div className="p-3 bg-teal-50 rounded-xl border border-teal-200">
                    <p className="text-teal-800 text-[11px] font-semibold">Verified Payments</p>
                    <p className="text-xl font-black text-teal-900 font-mono mt-0.5">
                      ₹{(profileData.metrics.amount_received || 0).toLocaleString('en-IN')}
                    </p>
                    <p className="text-[10px] text-teal-600 mt-0.5">Realized funds</p>
                  </div>

                  <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                    <p className="text-indigo-800 text-[11px] font-semibold">Balance Payment</p>
                    <p className="text-xl font-black text-indigo-900 font-mono mt-0.5">
                      ₹{(profileData.metrics.pending_amount || 0).toLocaleString('en-IN')}
                    </p>
                    <p className="text-[10px] text-indigo-600 mt-0.5">Outstanding balance</p>
                  </div>
                </div>

                {/* Additional Summary Pill */}
                <div className="p-3 bg-slate-900 text-white rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-amber-400" />
                    <span>
                      Active Parties with Bookings: <strong>{profileData.metrics.party_count || 0}</strong>
                    </span>
                    <span className="text-slate-500">•</span>
                    <span>
                      Total Assigned Parties: <strong>{profileData.metrics.total_assigned_parties || 0}</strong>
                    </span>
                  </div>
                  <div className="text-slate-300 font-mono text-[11px]">
                    Realization Rate:{' '}
                    <strong className="text-emerald-400">
                      {profileData.metrics.total_order_value > 0
                        ? Math.round(
                            (profileData.metrics.amount_received / profileData.metrics.total_order_value) * 100
                          )
                        : 0}
                      %
                    </strong>
                  </div>
                </div>

                {/* Top Products & Top Parties Grid (for active range) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Product Performance */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-amber-600" />
                      Product Performance ({profileData.topProducts?.length || 0})
                    </h3>
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {(profileData.topProducts || []).length === 0 ? (
                        <p className="text-xs text-slate-400 py-3 text-center">No products sold in this period</p>
                      ) : (
                        profileData.topProducts.map((p: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={
                                  p.product_image ||
                                  'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=80&auto=format&fit=crop&q=80'
                                }
                                alt={p.product_name}
                                onClick={() => setZoomImage(p.product_image)}
                                className="w-7 h-7 rounded object-cover border border-slate-200 shrink-0 cursor-pointer"
                              />
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 truncate text-[11px]">{p.product_name}</p>
                                <p className="text-[10px] text-slate-500 font-mono">
                                  {p.sku} • {p.total_qty} {p.unit}
                                </p>
                              </div>
                            </div>
                            <span className="font-mono font-bold text-slate-900 shrink-0 text-xs">
                              ₹{(p.total_amount || 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Party Performance */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-amber-600" />
                      Party Performance ({profileData.topParties?.length || 0})
                    </h3>
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {(profileData.topParties || []).length === 0 ? (
                        <p className="text-xs text-slate-400 py-3 text-center">No party activity in this period</p>
                      ) : (
                        profileData.topParties.map((pty: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate text-[11px]">
                                {pty.party_name || pty.company_name}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {pty.city} • {pty.order_count} orders
                              </p>
                            </div>
                            <div className="text-right font-mono text-xs shrink-0">
                              <p className="font-bold text-slate-900">
                                ₹{(pty.total_spent || 0).toLocaleString('en-IN')}
                              </p>
                              {pty.balance_payment > 0 ? (
                                <p className="text-[10px] text-rose-600 font-semibold">
                                  ₹{pty.balance_payment.toLocaleString('en-IN')} bal
                                </p>
                              ) : (
                                <p className="text-[10px] text-emerald-600 font-semibold">Cleared</p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Sales Performance Trend */}
                {profileData.salesTrend && profileData.salesTrend.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                      Sales Performance Trend Breakdown
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                            <th className="py-2 px-3">Timeline Interval</th>
                            <th className="py-2 px-3 text-center">Orders</th>
                            <th className="py-2 px-3 text-right">Total Sales (₹)</th>
                            <th className="py-2 px-3 text-right">Verified Payments (₹)</th>
                            <th className="py-2 px-3 text-right">Balance Payment (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {profileData.salesTrend.map((tr: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono font-semibold text-slate-800">{tr.period}</td>
                              <td className="py-2 px-3 text-center font-bold">{tr.orders_count}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">
                                ₹{(tr.total_sales || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-emerald-600 font-semibold">
                                ₹{(tr.total_received || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-rose-600 font-semibold">
                                ₹{(tr.balance_payment || 0).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Complete Order List for this Period */}
                <div>
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ShoppingCart className="w-3.5 h-3.5 text-amber-600" />
                      Booked Orders in Range ({profileData.orders.length})
                    </span>
                    <span className="text-slate-400 font-mono text-[10px] lowercase">
                      showing all records from {drilldownDateRange.label}
                    </span>
                  </h3>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                          <th className="py-2.5 px-3">Order ID</th>
                          <th className="py-2.5 px-3">Products</th>
                          <th className="py-2.5 px-3">Party Name</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3 text-right">Value (₹)</th>
                          <th className="py-2.5 px-3 text-right">Received (₹)</th>
                          <th className="py-2.5 px-3 text-right">Balance (₹)</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {profileData.orders.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-slate-400">
                              No orders found in this date range.
                            </td>
                          </tr>
                        ) : (
                          profileData.orders.map((ord: any) => (
                            <tr key={ord.id} className="hover:bg-slate-50">
                              <td
                                className="py-2.5 px-3 font-mono font-bold text-amber-600 cursor-pointer hover:underline"
                                onClick={() => {
                                  setSelectedPerson(null);
                                  onNavigate(`orders/${ord.id}`);
                                }}
                              >
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
                                        src={
                                          item.product_image ||
                                          'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=80&auto=format&fit=crop&q=80'
                                        }
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
                              <td className="py-2.5 px-3 font-medium text-slate-900">
                                {ord.party_name || ord.vendor_name}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 font-mono">
                                {new Date(ord.created_at).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold">
                                ₹{ord.grand_total.toLocaleString('en-IN')}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-emerald-600">
                                ₹{ord.amount_received.toLocaleString('en-IN')}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-rose-600">
                                ₹{ord.pending_amount.toLocaleString('en-IN')}
                              </td>
                              <td className="py-2.5 px-3 font-semibold">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    ord.order_status === 'DELIVERED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : ord.order_status === 'CANCELLED'
                                      ? 'bg-rose-100 text-rose-800'
                                      : ord.order_status === 'ACCEPTED'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {ord.order_status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : null}

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                onClick={() => setSelectedPerson(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition"
              >
                Close Drilldown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs cursor-pointer"
        >
          <div
            className="relative max-w-lg max-h-[85vh] bg-white rounded-2xl overflow-hidden p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={zoomImage}
              alt="Lubricant Product Full Preview"
              className="w-full h-auto object-contain max-h-[75vh] rounded-xl"
            />
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
