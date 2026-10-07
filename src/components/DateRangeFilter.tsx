import React, { useState, useEffect } from 'react';
import { Calendar, Filter, X, Check, ChevronDown, Clock, RotateCcw } from 'lucide-react';
import { DatePreset, DateRange, getDateRangeFromPreset, formatDisplayDate } from '../utils/dateFilters.js';

export interface DateTypeOption {
  value: string;
  label: string;
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange, dateType?: string) => void;
  dateTypes?: DateTypeOption[];
  currentDateType?: string;
  onDateTypeChange?: (dateType: string) => void;
  defaultPreset?: DatePreset;
  allowAllTime?: boolean;
  className?: string;
}

const PRESET_BUTTONS: { key: DatePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' },
  { key: 'last_week', label: 'Last Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'this_year', label: 'This Year' },
  { key: 'custom', label: 'Custom Range' },
];

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  value,
  onChange,
  dateTypes,
  currentDateType,
  onDateTypeChange,
  defaultPreset = 'this_month',
  allowAllTime = true,
  className = '',
}) => {
  const [customStart, setCustomStart] = useState<string>(value.startDate || '');
  const [customEnd, setCustomEnd] = useState<string>(value.endDate || '');
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);
  const [mobileExpanded, setMobileExpanded] = useState<boolean>(false);

  useEffect(() => {
    if (value.preset === 'custom') {
      setCustomStart(value.startDate);
      setCustomEnd(value.endDate);
    }
  }, [value]);

  const handleSelectPreset = (preset: DatePreset) => {
    if (preset === 'custom') {
      setShowCustomModal(true);
      return;
    }
    const newRange = getDateRangeFromPreset(preset);
    onChange(newRange, currentDateType);
    setMobileExpanded(false);
  };

  const handleApplyCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customStart || !customEnd) return;
    const newRange = getDateRangeFromPreset('custom', customStart, customEnd);
    onChange(newRange, currentDateType);
    setShowCustomModal(false);
    setMobileExpanded(false);
  };

  const handleReset = () => {
    const newRange = allowAllTime ? getDateRangeFromPreset('all') : getDateRangeFromPreset(defaultPreset);
    onChange(newRange, currentDateType);
    setCustomStart('');
    setCustomEnd('');
    setShowCustomModal(false);
    setMobileExpanded(false);
  };

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-xs p-3 space-y-3 ${className}`}>
      {/* Top Bar: Current Selection Badge, Date Type (if any), Mobile Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-semibold">
            <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Selected Period:</span>
            <span className="font-bold font-mono text-amber-700">
              {value.startDate && value.endDate ? (
                `${formatDisplayDate(value.startDate)} – ${formatDisplayDate(value.endDate)}`
              ) : value.label}
            </span>
          </div>

          {/* Date Type Selector if provided (e.g. for Dispatch / Payments) */}
          {dateTypes && dateTypes.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Date Type:</span>
              <select
                value={currentDateType || dateTypes[0].value}
                onChange={(e) => {
                  if (onDateTypeChange) onDateTypeChange(e.target.value);
                  onChange(value, e.target.value);
                }}
                className="bg-transparent font-bold text-slate-900 focus:outline-hidden text-xs cursor-pointer"
              >
                {dateTypes.map(dt => (
                  <option key={dt.value} value={dt.value}>{dt.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {value.preset !== 'all' && (
            <button
              onClick={handleReset}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
              title="Reset date filter"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear Filter</span>
            </button>
          )}

          <button
            onClick={() => setMobileExpanded(!mobileExpanded)}
            className="sm:hidden flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Options</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${mobileExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Preset Buttons Toolbar - Visible on Desktop, Expandable on Mobile */}
      <div className={`sm:flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 ${mobileExpanded ? 'flex' : 'hidden sm:flex'}`}>
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
          Filter By:
        </span>

        {PRESET_BUTTONS.map(btn => {
          const isActive = value.preset === btn.key;
          return (
            <button
              key={btn.key}
              onClick={() => handleSelectPreset(btn.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80'
              }`}
            >
              {btn.label}
            </button>
          );
        })}

        {allowAllTime && (
          <button
            onClick={() => handleSelectPreset('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
              value.preset === 'all'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200/80'
            }`}
          >
            All Time
          </button>
        )}
      </div>

      {/* Custom Date Range Modal / Drawer */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-base text-slate-900">Custom Date Range</h3>
              </div>
              <button
                onClick={() => setShowCustomModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyCustom} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">From Date *</label>
                  <input
                    type="date"
                    required
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">To Date *</label>
                  <input
                    type="date"
                    required
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {customStart && customEnd && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900">
                  Range: <strong>{formatDisplayDate(customStart)}</strong> to <strong>{formatDisplayDate(customEnd)}</strong>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!customStart || !customEnd}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold rounded-lg shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Apply Filter</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
