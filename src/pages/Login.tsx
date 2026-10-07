import React, { useState } from 'react';
import {
  Droplets, Lock, Mail, Eye, EyeOff, ShieldCheck, ArrowRight,
  Sparkles, CheckCircle2, PackageCheck, Truck, CreditCard, Building2, UserCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    {
      role: 'Super Admin',
      name: 'Siddharth Oberoi',
      email: 'superadmin@lubricantdemo.com',
      pass: 'Admin@123',
      badge: 'Full Access (All Modules, Products, Orders & Roles)',
      color: 'bg-indigo-600',
      icon: ShieldCheck
    },
    {
      role: 'Operations Admin',
      name: 'Rajesh Mehra',
      email: 'admin@lubricantdemo.com',
      pass: 'Admin@123',
      badge: 'Approve Orders, Assign Packing, Dispatch Oversight',
      color: 'bg-blue-600',
      icon: Building2
    },
    {
      role: 'Accounts & Finance',
      name: 'Kavita Sundaram',
      email: 'accounts@lubricantdemo.com',
      pass: 'Accounts@123',
      badge: 'Verify Payments, Ledger, Approve/Reject Collections',
      color: 'bg-emerald-600',
      icon: CreditCard
    },
    {
      role: 'Sales: Akash Singh',
      name: 'Akash Singh (West)',
      email: 'akash@lubricantdemo.com',
      pass: 'Sales@123',
      badge: 'Create Orders with Images & Custom Rates, Add Payments',
      color: 'bg-amber-600',
      icon: UserCheck
    },
    {
      role: 'Sales: Rahul Sharma',
      name: 'Rahul Sharma (Gujarat)',
      email: 'rahul@lubricantdemo.com',
      pass: 'Sales@123',
      badge: 'Gujarat Vendors Portfolio, Custom Pricing Orders',
      color: 'bg-amber-600',
      icon: UserCheck
    },
    {
      role: 'Packing Team',
      name: 'Vikram Patel',
      email: 'production@lubricantdemo.com',
      pass: 'Production@123',
      badge: 'Check Availability, Prepare, Pack & Handover to Dispatch',
      color: 'bg-purple-600',
      icon: PackageCheck
    },
    {
      role: 'Dispatch & Logistics',
      name: 'Sunil Sharma',
      email: 'dispatch@lubricantdemo.com',
      pass: 'Dispatch@123',
      badge: 'Vehicle & LR Assignment, Delivery Log with Thumbnails',
      color: 'bg-cyan-600',
      icon: Truck
    }
  ];

  const handleQuickLogin = async (accEmail: string, accPass: string) => {
    setEmail(accEmail);
    setPassword(accPass);
    setError(null);
    setLoading(true);
    try {
      await login(accEmail, accPass);
    } catch (err: any) {
      setError(err.message || 'Login error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 mb-3">
          <Droplets className="w-8 h-8 fill-slate-950" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Petro<span className="text-amber-400">Flow</span> ERP
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Finished Lubricant Order, Packing, Dispatch & Verified Payment Tracking System
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-4xl z-10 px-4">
        {/* Instant Access Banner */}
        <div className="mb-4 bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/40 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-white">Direct Demo Access</p>
              <p className="text-[11px] text-slate-300">Click below to enter immediately as Super Admin with all features unlocked</p>
            </div>
          </div>
          <button
            onClick={() => handleQuickLogin('superadmin@lubricantdemo.com', 'Admin@123')}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg shadow-md transition shrink-0 ml-3"
          >
            Enter Dashboard →
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8">
          {/* Left Column: Login Form */}
          <div className="lg:col-span-6 flex flex-col justify-between pr-0 lg:pr-4 border-b lg:border-b-0 lg:border-r border-slate-800 pb-6 lg:pb-0">
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-bold text-white">Sign In to Workspace</h3>
                <p className="text-xs text-slate-400 mt-0.5">Enter your corporate credentials to access the ERP</p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email / Username
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. akash@lubricantdemo.com"
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-9 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-300">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-700 text-amber-500 focus:ring-0 bg-slate-950"
                    />
                    <span>Remember me</span>
                  </label>
                  <span className="text-[11px] text-amber-400 font-medium">Session persists in secure cookie</span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs rounded-lg shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Sign In to Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800">
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>End-to-End Workflow testing enabled with 60+ pre-seeded orders.</span>
              </div>
            </div>
          </div>

          {/* Right Column: Demo Accounts Quick Login */}
          <div className="lg:col-span-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h4 className="text-sm font-bold text-white">1-Click Demo Accounts</h4>
                </div>
                <span className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full font-medium">
                  Instant Test Login
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Click any role card below to log in directly and test role-specific screens & permissions:
              </p>

              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {demoAccounts.map((acc, idx) => {
                  const Icon = acc.icon;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleQuickLogin(acc.email, acc.pass)}
                      className="group p-2.5 bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/50 rounded-xl cursor-pointer transition flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg ${acc.color} text-white flex items-center justify-center shrink-0 shadow-sm`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{acc.role}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({acc.pass})</span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">{acc.badge}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="px-2.5 py-1 text-[11px] font-semibold bg-slate-800 group-hover:bg-amber-500 group-hover:text-slate-950 text-slate-200 rounded-md transition shrink-0 ml-2"
                      >
                        Login →
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Test walkthrough scenario guide */}
            <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wide">Test Scenario Walkthrough</p>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                <strong>Akash (Sales)</strong> creates order with custom rates & images (₹0 advance) → <strong>Admin</strong> accepts order → <strong>Packing Team</strong> checks items & packs → <strong>Dispatch</strong> loads vehicle & records delivery → <strong>Sales/Accounts</strong> logs payment → <strong>Accounts</strong> verifies in Ledger!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
