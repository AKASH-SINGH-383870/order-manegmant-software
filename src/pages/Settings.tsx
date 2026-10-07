import React, { useState } from 'react';
import { Settings as SettingsIcon, RefreshCw, AlertTriangle, CheckCircle2, Shield, Info, DollarSign } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleResetDemoData = async () => {
    if (!window.confirm('Are you sure you want to restore the demonstration database? This will reload all default test orders, dummy payments, and users.')) {
      return;
    }
    setResetting(true);
    setResetMessage(null);
    try {
      const token = localStorage.getItem('petroflow_token');
      const res = await fetch('/api/settings/reset-demo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setResetMessage(data.message || 'Demo data restored successfully.');
      } else {
        alert(data.error || 'Failed to reset demo data');
      }
    } catch (err) {
      console.error(err);
      alert('Network error');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-slate-700" />
          System Settings & Demonstration Controls
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Operational defaults, project commercial reference documentation, and factory database reset.
        </p>
      </div>

      {resetMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{resetMessage}</span>
        </div>
      )}

      {/* Operational Defaults */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900">Enterprise Operational Defaults</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-400 font-medium">Standard GST Tax Rate</span>
            <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">18.0%</p>
            <p className="text-[11px] text-slate-500 mt-0.5">CGST 9.0% + SGST 9.0%</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-400 font-medium">Standard Commercial Credit</span>
            <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">30 Calendar Days</p>
            <p className="text-[11px] text-slate-500 mt-0.5">From date of delivery receipt</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-400 font-medium">Multi-Entity Billing</span>
            <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">2 Companies</p>
            <p className="text-[11px] text-slate-500 mt-0.5">LubriMax Petrochem & Apex Lube</p>
          </div>
        </div>
      </div>

      {/* Commercial Project Documentation Reference Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
          <DollarSign className="w-5 h-5 text-amber-500" />
          <span>Commercial Project Specifications (Documentation)</span>
        </div>
        <p className="text-xs text-slate-500">
          As specified in project documentation requirements:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <p className="font-bold text-slate-800">Software Implementation Cost</p>
            <p className="text-base font-bold text-slate-900 font-mono">₹40,000 (One-time)</p>
            <p className="text-slate-600 text-[11px] mt-1">• Includes 1 Year Maintenance & Support</p>
            <p className="text-slate-600 text-[11px]">• Includes Sales Person & User Training</p>
            <p className="text-slate-600 text-[11px]">• Next Year Renewal: ₹40,000 / year (includes maintenance & support)</p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <p className="font-bold text-slate-800">Commercial Payment Terms</p>
            <div className="space-y-1 mt-2">
              <div className="flex justify-between">
                <span>25% Advance:</span>
                <span className="font-mono font-bold">₹10,000</span>
              </div>
              <div className="flex justify-between">
                <span>75% On Software Completion:</span>
                <span className="font-mono font-bold">₹30,000</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900">
                <span>Total Project Contract:</span>
                <span className="font-mono text-sm">₹40,000</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Demonstration Database Reset Box */}
      <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-xs space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Demonstration Database Reset</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Reset all tables back to the pristine factory test state. Restores 2 Billing Companies, 6 Brands, 8 Categories, 25 Products, 20 Vendors, 52 Orders covering all workflow stages (New, Accepted, In Production, Ready for Dispatch, Out for Delivery, Delivered with pending payment, Completed, Cancelled), and 65+ Payments.
            </p>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={handleResetDemoData}
            disabled={resetting}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${resetting ? 'animate-spin' : ''}`} />
            <span>{resetting ? 'Re-seeding Database...' : 'Restore Factory Test Database'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
