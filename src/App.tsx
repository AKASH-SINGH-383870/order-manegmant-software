import React, { useState } from 'react';
import { useAuth } from './context/AuthContext.js';
import { Login } from './pages/Login.js';
import { Header } from './components/Header.js';
import { Sidebar } from './components/Sidebar.js';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

// Pages
import { Dashboard } from './pages/Dashboard.js';
import { Orders } from './pages/Orders.js';
import { OrderDetail } from './pages/OrderDetail.js';
import { CreateOrder } from './pages/CreateOrder.js';
import { PackingManagement } from './pages/PackingManagement.js';
import { Production } from './pages/Production.js';
import { DeliveredOrders } from './pages/DeliveredOrders.js';
import { Bills } from './pages/Bills.js';
import { Payments } from './pages/Payments.js';
import { Vendors } from './pages/Vendors.js';
import { SalesPersons } from './pages/SalesPersons.js';
import { Products } from './pages/Products.js';
import { BrandsCategories } from './pages/BrandsCategories.js';
import { Reports } from './pages/Reports.js';
import { Companies } from './pages/Companies.js';
import { Users } from './pages/Users.js';
import { RolesPermissions } from './pages/RolesPermissions.js';
import { ActivityLogs } from './pages/ActivityLogs.js';
import { Settings } from './pages/Settings.js';

export function App() {
  const { user, isLoading, hasPermission } = useAuth();
  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-slate-300">Initializing PetroFlow Lubricant ERP...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const navigate = (page: string) => {
    setCurrentPage(page);
    setMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isSuperAdmin = user.role_slug === 'super_admin';

  const renderAccessRestricted = (moduleName: string) => (
    <div className="p-6 sm:p-12 max-w-lg mx-auto my-12 bg-white rounded-2xl border border-rose-200 shadow-md p-8 text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200 shadow-xs">
        <ShieldAlert className="w-7 h-7" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Access Restricted</h2>
        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
          Your current account role <span className="font-semibold text-slate-900">({user.role_name})</span> does not have granted authorization to access the <span className="font-semibold text-slate-900 capitalize">{moduleName}</span> module.
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          Contact your Super Administrator to adjust your capabilities in the Dynamic Roles & Permissions Matrix.
        </p>
      </div>
      <div className="pt-2">
        <button
          onClick={() => navigate('dashboard')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </button>
      </div>
    </div>
  );

  // Render current view
  const renderView = () => {
    if (currentPage.startsWith('orders/')) {
      const orderId = currentPage.split('/')[1];
      return <OrderDetail orderId={orderId} onNavigate={navigate} />;
    }

    if (currentPage.startsWith('orders?')) {
      const params = new URLSearchParams(currentPage.split('?')[1]);
      const initialSearch = params.get('search') || '';
      const initialStatus = params.get('status') || 'ALL';
      return <Orders onNavigate={navigate} initialSearch={initialSearch} initialStatus={initialStatus} />;
    }

    if (currentPage.startsWith('vendors/')) {
      const vendorId = currentPage.split('/')[1];
      return <Vendors onNavigate={navigate} initialVendorId={vendorId} />;
    }

    if (currentPage.startsWith('sales-persons/')) {
      const spId = currentPage.split('/')[1];
      if (!isSuperAdmin && !hasPermission('sales_persons:view') && user.role_slug !== 'admin') {
        return renderAccessRestricted('Sales Team');
      }
      return <SalesPersons onNavigate={navigate} initialPersonId={spId} />;
    }

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={navigate} />;
      case 'orders':
        if (!isSuperAdmin && !hasPermission('orders:view_all') && !hasPermission('orders:view_own')) {
          return renderAccessRestricted('Orders Management');
        }
        return <Orders onNavigate={navigate} />;
      case 'create-order':
        if (!isSuperAdmin && !hasPermission('orders:create')) {
          return renderAccessRestricted('Create Order');
        }
        return <CreateOrder onNavigate={navigate} />;
      case 'packing':
      case 'production':
        if (!isSuperAdmin && !hasPermission('packing:view') && !hasPermission('production:view')) {
          return renderAccessRestricted('Packing Management');
        }
        return <PackingManagement onNavigate={navigate} />;
      case 'delivered-orders':
        return <DeliveredOrders onNavigate={navigate} />;
      case 'bills':
        if (!isSuperAdmin && !hasPermission('bills:view_all') && !hasPermission('bills:view_own') && user.role_slug !== 'admin' && user.role_slug !== 'accounts') {
          return renderAccessRestricted('Bills & Invoices');
        }
        return <Bills onNavigate={navigate} />;
      case 'payments':
        if (!isSuperAdmin && !hasPermission('payments:view') && !hasPermission('payments:add') && !hasPermission('payments:verify')) {
          return renderAccessRestricted('Payments & Ledger');
        }
        return <Payments onNavigate={navigate} />;
      case 'vendors':
        if (!isSuperAdmin && !hasPermission('vendors:view_all') && !hasPermission('vendors:view_own')) {
          return renderAccessRestricted('Vendors');
        }
        return <Vendors onNavigate={navigate} />;
      case 'sales-persons':
        if (!isSuperAdmin && !hasPermission('sales_persons:view') && user.role_slug !== 'admin') {
          return renderAccessRestricted('Sales Team');
        }
        return <SalesPersons onNavigate={navigate} />;
      case 'products':
        return <Products />;
      case 'brands-categories':
        if (!isSuperAdmin && !hasPermission('products:manage')) {
          return renderAccessRestricted('Brands & Categories');
        }
        return <BrandsCategories />;
      case 'reports':
        if (!isSuperAdmin && !hasPermission('reports:view')) {
          return renderAccessRestricted('Reports');
        }
        return <Reports />;
      case 'companies':
        if (!isSuperAdmin && !hasPermission('companies:manage')) {
          return renderAccessRestricted('Billing Companies');
        }
        return <Companies />;
      case 'users':
        if (!isSuperAdmin && !hasPermission('users:manage')) {
          return renderAccessRestricted('User Management');
        }
        return <Users />;
      case 'roles':
        if (!isSuperAdmin && !hasPermission('roles:manage')) {
          return renderAccessRestricted('Roles & Permissions Matrix');
        }
        return <RolesPermissions />;
      case 'activity-logs':
        if (!isSuperAdmin && !hasPermission('activity:view')) {
          return renderAccessRestricted('Audit Logs');
        }
        return <ActivityLogs />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard onNavigate={navigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex text-slate-900 font-sans antialiased">
      {/* Sidebar for Desktop & Mobile Overlay */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={navigate}
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      {/* Mobile backdrop */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity"
        ></div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          onNavigate={navigate}
          onOpenNewOrder={() => navigate('create-order')}
          onToggleMobileSidebar={() => setMobileSidebarOpen(prev => !prev)}
        />

        <main className="flex-1 overflow-y-auto bg-slate-100">
          {renderView()}
        </main>
      </div>
    </div>
  );
}

export default App;
