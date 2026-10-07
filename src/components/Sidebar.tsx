import React from 'react';
import {
  LayoutDashboard, ShoppingCart, Package, Tags, Store, Users, PackageCheck,
  CheckCircle2, CreditCard, BarChart3, Building, ShieldCheck, FileText, Settings,
  LogOut, Droplets, ChevronRight, X, ReceiptText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, isOpen = true, onClose }) => {
  const { user, logout, hasPermission } = useAuth();

  const isSuperAdmin = user?.role_slug === 'super_admin';
  const isAdmin = user?.role_slug === 'admin' || isSuperAdmin;
  const isSalesPerson = user?.role_slug === 'sales_person';
  const isPacking = user?.role_slug === 'packing_team' || user?.role_slug === 'production_team';
  const isDispatch = user?.role_slug === 'dispatch_team';
  const isAccounts = user?.role_slug === 'accounts';

  const menuSections = [
    {
      title: 'Main Operations',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, visible: isSuperAdmin || hasPermission('dashboard:view') || true },
        { id: 'orders', label: 'Orders Management', icon: ShoppingCart, visible: isSuperAdmin || hasPermission('orders:view_all') || hasPermission('orders:view_own') },
        { id: 'packing', label: 'Packing Management', icon: PackageCheck, visible: isSuperAdmin || hasPermission('packing:view') || hasPermission('production:view') },
        { id: 'delivered-orders', label: 'Delivered Orders', icon: CheckCircle2, visible: isSuperAdmin || hasPermission('orders:view_all') || hasPermission('orders:view_own') || true },
        { id: 'bills', label: 'Bills', icon: ReceiptText, visible: isSuperAdmin || hasPermission('bills:view_all') || hasPermission('bills:view_own') || isAccounts || isAdmin },
        { id: 'payments', label: 'Payments & Ledger', icon: CreditCard, visible: isSuperAdmin || hasPermission('payments:view') || hasPermission('payments:add') || hasPermission('payments:verify') },
      ]
    },
    {
      title: 'Relationship & Catalogs',
      items: [
        { id: 'vendors', label: 'Parties', icon: Store, visible: isSuperAdmin || hasPermission('vendors:view_all') || hasPermission('vendors:view_own') },
        { id: 'sales-persons', label: 'Sales Team', icon: Users, visible: isSuperAdmin || hasPermission('sales_persons:view') || (isAdmin && hasPermission('users:manage')) },
        { id: 'products', label: 'Lubricant Catalog', icon: Package, visible: isSuperAdmin || hasPermission('products:view') || hasPermission('products:manage') || isPacking || isSalesPerson },
        { id: 'brands-categories', label: 'Brands & Categories', icon: Tags, visible: isSuperAdmin || hasPermission('products:manage') },
      ]
    },
    {
      title: 'Analytics & Governance',
      items: [
        { id: 'reports', label: 'Business Reports', icon: BarChart3, visible: isSuperAdmin || hasPermission('reports:view') },
        { id: 'companies', label: 'Billing Companies', icon: Building, visible: isSuperAdmin || hasPermission('companies:manage') },
        { id: 'users', label: 'User Management', icon: Users, visible: isSuperAdmin || hasPermission('users:manage') },
        { id: 'roles', label: 'Roles & Permissions', icon: ShieldCheck, visible: isSuperAdmin || hasPermission('roles:manage') },
        { id: 'activity-logs', label: 'Audit Trail / Logs', icon: FileText, visible: isSuperAdmin || hasPermission('activity:view') },
      ]
    },
    {
      title: 'Configuration',
      items: [
        { id: 'settings', label: 'System & Demo Reset', icon: Settings, visible: isSuperAdmin || isAdmin },
      ]
    }
  ];

  return (
    <aside className={`
      fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-slate-950 text-slate-300 flex flex-col border-r border-slate-800 shadow-2xl transition-transform duration-200 ease-in-out
      lg:static lg:w-64 lg:max-w-none lg:shadow-none lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    `}>
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800 bg-slate-950 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md">
            <Droplets className="w-5 h-5 fill-slate-950" />
          </div>
          <div>
            <span className="font-bold text-white text-base tracking-wide flex items-center gap-1">
              Petro<span className="text-amber-400">Flow</span>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 bg-amber-400/20 text-amber-300 rounded ml-1 border border-amber-400/30">ERP</span>
            </span>
            <p className="text-[10px] text-slate-400 font-medium">Lubricant Ops & Logistics</p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden transition"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {menuSections.map((section, sIdx) => {
          const visibleItems = section.items.filter(it => it.visible);
          if (visibleItems.length === 0) return null;

          return (
            <div key={sIdx}>
              <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                {section.title}
              </p>
              <div className="space-y-1">
                {visibleItems.map(item => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id || currentPage.startsWith(`${item.id}/`);
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onNavigate(item.id);
                        if (onClose) onClose();
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition group ${
                        isActive
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                        <span>{item.label}</span>
                      </div>
                      {isActive && <ChevronRight className="w-3.5 h-3.5 text-amber-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* User Footer & Logout */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-[11px] shrink-0">
              {user?.name ? user.name[0] : 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-amber-400 truncate">{user?.role_slug === 'production_team' ? 'Packing Team' : user?.role_name}</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-md hover:bg-slate-800 transition"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
