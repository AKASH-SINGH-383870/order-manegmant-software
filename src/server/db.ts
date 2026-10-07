import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbDirectory = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dbDirectory)) {
  fs.mkdirSync(dbDirectory, { recursive: true });
}

const dbPath = path.resolve(dbDirectory, 'lubricant_erp.db');
export const db = new Database(dbPath);

// Enable foreign keys and WAL mode for reliability and performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      is_system INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL,
      permission_id INTEGER NOT NULL,
      PRIMARY KEY (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role_id INTEGER NOT NULL,
      mobile TEXT,
      employee_id TEXT UNIQUE,
      avatar_url TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id)
    );

    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      logo_url TEXT,
      gst_number TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      pincode TEXT NOT NULL,
      mobile TEXT NOT NULL,
      email TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      account_no TEXT NOT NULL,
      ifsc_code TEXT NOT NULL,
      branch TEXT NOT NULL,
      terms TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      brand_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      unit TEXT NOT NULL,
      min_order_qty INTEGER DEFAULT 1,
      standard_rate REAL DEFAULT 0,
      description TEXT,
      image_url TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (brand_id) REFERENCES brands(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_code TEXT NOT NULL UNIQUE,
      company_name TEXT NOT NULL,
      contact_person TEXT NOT NULL,
      mobile TEXT NOT NULL,
      alt_mobile TEXT,
      email TEXT,
      gstin TEXT,
      billing_address TEXT NOT NULL,
      delivery_address TEXT,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      pincode TEXT,
      assigned_sales_person_id INTEGER NOT NULL,
      created_by_id INTEGER NOT NULL,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_sales_person_id) REFERENCES users(id),
      FOREIGN KEY (created_by_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      company_id INTEGER NOT NULL,
      vendor_id INTEGER NOT NULL,
      sales_person_id INTEGER NOT NULL,
      order_status TEXT NOT NULL DEFAULT 'NEW',
      production_status TEXT NOT NULL DEFAULT 'NOT_ASSIGNED',
      dispatch_status TEXT NOT NULL DEFAULT 'NOT_DISPATCHED',
      delivery_status TEXT NOT NULL DEFAULT 'PENDING',
      payment_status TEXT NOT NULL DEFAULT 'UNPAID',
      payment_terms TEXT NOT NULL DEFAULT 'Credit 30 Days',
      subtotal REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      tax_rate REAL NOT NULL DEFAULT 18.0,
      tax_amount REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,
      amount_received REAL NOT NULL DEFAULT 0,
      pending_amount REAL NOT NULL DEFAULT 0,
      required_delivery_date TEXT,
      delivery_address TEXT,
      delivery_contact_person TEXT,
      delivery_contact_number TEXT,
      special_instructions TEXT,
      notes TEXT,
      cancellation_reason TEXT,
      cancelled_by_id INTEGER,
      cancelled_at DATETIME,
      assigned_to_production_at DATETIME,
      production_completed_at DATETIME,
      dispatched_at DATETIME,
      delivered_at DATETIME,
      completed_at DATETIME,
      completed_by_id INTEGER,
      created_by_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (vendor_id) REFERENCES vendors(id),
      FOREIGN KEY (sales_person_id) REFERENCES users(id),
      FOREIGN KEY (created_by_id) REFERENCES users(id),
      FOREIGN KEY (cancelled_by_id) REFERENCES users(id),
      FOREIGN KEY (completed_by_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      sku TEXT NOT NULL,
      product_name TEXT NOT NULL,
      unit TEXT NOT NULL,
      quantity REAL NOT NULL,
      produced_quantity REAL NOT NULL DEFAULT 0,
      dispatched_quantity REAL NOT NULL DEFAULT 0,
      delivered_quantity REAL NOT NULL DEFAULT 0,
      rate REAL NOT NULL,
      line_amount REAL NOT NULL,
      notes TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS production_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      order_item_id INTEGER NOT NULL,
      batch_number TEXT NOT NULL,
      produced_quantity REAL NOT NULL,
      production_date TEXT NOT NULL,
      operator_name TEXT,
      notes TEXT,
      created_by_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS dispatches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dispatch_number TEXT NOT NULL UNIQUE,
      order_id INTEGER NOT NULL,
      dispatch_date TEXT NOT NULL,
      transport_name TEXT NOT NULL,
      transport_contact TEXT,
      vehicle_number TEXT NOT NULL,
      lr_number TEXT,
      tracking_number TEXT,
      driver_name TEXT,
      driver_mobile TEXT,
      dispatch_quantity REAL NOT NULL,
      notes TEXT,
      created_by_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS dispatch_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dispatch_id INTEGER NOT NULL,
      order_item_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      FOREIGN KEY (dispatch_id) REFERENCES dispatches(id) ON DELETE CASCADE,
      FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      dispatch_id INTEGER,
      delivery_date TEXT NOT NULL,
      delivered_quantity REAL NOT NULL,
      received_by TEXT NOT NULL,
      receiver_mobile TEXT,
      pod_url TEXT,
      notes TEXT,
      created_by_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (dispatch_id) REFERENCES dispatches(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS delivery_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery_id INTEGER NOT NULL,
      order_item_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE,
      FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_number TEXT NOT NULL UNIQUE,
      order_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      payment_mode TEXT NOT NULL,
      reference_number TEXT,
      notes TEXT,
      is_verified INTEGER DEFAULT 0,
      received_by_id INTEGER NOT NULL,
      verified_by_id INTEGER,
      verified_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (received_by_id) REFERENCES users(id),
      FOREIGN KEY (verified_by_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS order_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      stage_name TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT NOT NULL,
      notes TEXT,
      created_by_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      description TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      role_slug TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      order_id INTEGER,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Indices for quick query performance
    CREATE INDEX IF NOT EXISTS idx_orders_sales_person ON orders(sales_person_id);
    CREATE INDEX IF NOT EXISTS idx_orders_vendor ON orders(vendor_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
    CREATE INDEX IF NOT EXISTS idx_vendors_sales_person ON vendors(assigned_sales_person_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
    CREATE INDEX IF NOT EXISTS idx_history_order ON order_status_history(order_id);
  `);

  // Safe migration helper for existing databases
  const safeAddColumn = (table: string, column: string, colDef: string) => {
    try {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${colDef}`).run();
    } catch {
      // Column exists
    }
  };

  safeAddColumn('products', 'item_colour', "TEXT DEFAULT 'Golden Yellow'");
  safeAddColumn('order_items', 'item_colour', "TEXT DEFAULT 'Golden Yellow'");
  safeAddColumn('payments', 'proof_url', 'TEXT');
  safeAddColumn('payments', 'status', "TEXT DEFAULT 'PENDING_VERIFICATION'");
  safeAddColumn('payments', 'rejection_reason', 'TEXT');
  safeAddColumn('payments', 'updated_by_id', 'INTEGER');
  safeAddColumn('payments', 'updated_at', 'DATETIME');
  safeAddColumn('orders', 'packing_status', "TEXT DEFAULT 'PENDING_PACKING'");
  safeAddColumn('orders', 'packing_notes', 'TEXT');
  safeAddColumn('orders', 'tax_type', "TEXT DEFAULT 'GST_18'");
  safeAddColumn('orders', 'delivered_by_id', 'INTEGER');
  safeAddColumn('orders', 'delivered_by_name', 'TEXT');
  safeAddColumn('orders', 'updated_by_id', 'INTEGER');
  safeAddColumn('order_items', 'item_availability', "TEXT DEFAULT 'AVAILABLE'");
  safeAddColumn('vendors', 'updated_by_id', 'INTEGER');
  safeAddColumn('vendors', 'updated_at', 'DATETIME');
  safeAddColumn('vendors', 'aadhaar_no', 'TEXT');

  // Ensure comprehensive permissions matrix exists and is linked
  try {
    const fullPermissions = [
      { module: 'Dashboard', action: 'View Dashboard', code: 'dashboard:view', description: 'Access operational dashboard and metrics' },
      { module: 'Orders', action: 'View All Orders', code: 'orders:view_all', description: 'View orders across entire enterprise' },
      { module: 'Orders', action: 'View Own Orders', code: 'orders:view_own', description: 'View only orders assigned to self' },
      { module: 'Orders', action: 'Create Order', code: 'orders:create', description: 'Create and submit new customer orders' },
      { module: 'Orders', action: 'Edit Order', code: 'orders:edit', description: 'Edit pending/draft commercial orders' },
      { module: 'Orders', action: 'Approve Order', code: 'orders:approve', description: 'Approve orders for packing and fulfillment' },
      { module: 'Orders', action: 'Cancel Order', code: 'orders:cancel', description: 'Cancel orders with reason' },
      { module: 'Orders', action: 'Complete Order', code: 'orders:complete', description: 'Final order closure upon full delivery and payment' },
      { module: 'Orders', action: 'Delete Order', code: 'orders:delete', description: 'Remove / archive cancelled orders' },
      { module: 'Vendors', action: 'View All Vendors', code: 'vendors:view_all', description: 'Access master vendor portfolio' },
      { module: 'Vendors', action: 'View Own Vendors', code: 'vendors:view_own', description: 'Access only assigned vendor accounts' },
      { module: 'Vendors', action: 'Create Vendor', code: 'vendors:create', description: 'Register new client accounts' },
      { module: 'Vendors', action: 'Edit Vendor', code: 'vendors:edit', description: 'Modify vendor profile details' },
      { module: 'Vendors', action: 'Delete Vendor', code: 'vendors:delete', description: 'Deactivate / remove vendor record' },
      { module: 'Products', action: 'View Products', code: 'products:view', description: 'Browse lubricant product catalog' },
      { module: 'Products', action: 'Manage Products', code: 'products:manage', description: 'Create, update, and manage lubricant SKUs' },
      { module: 'Packing', action: 'View Packing', code: 'packing:view', description: 'View orders queued for packing' },
      { module: 'Packing', action: 'Manage Packing', code: 'packing:manage', description: 'Check stock availability and pack items' },
      { module: 'Packing', action: 'Deliver Order', code: 'packing:deliver', description: 'Mark packed orders directly as Delivered' },
      { module: 'Orders', action: 'Deliver Order', code: 'orders:deliver', description: 'Mark packed order as Delivered directly' },
      { module: 'Dispatch', action: 'View Dispatch', code: 'dispatch:view', description: 'View ready consignments and fleet schedules' },
      { module: 'Dispatch', action: 'Create Dispatch', code: 'dispatch:create', description: 'Generate dispatch note and assign vehicle / LR' },
      { module: 'Dispatch', action: 'Update Dispatch', code: 'dispatch:update', description: 'Update LR, tracking numbers and fleet information' },
      { module: 'Delivery', action: 'View Delivery', code: 'delivery:view', description: 'View proof of delivery records' },
      { module: 'Delivery', action: 'Update Delivery', code: 'delivery:update', description: 'Record receiver acknowledgement and closure' },
      { module: 'Bills', action: 'View All Bills', code: 'bills:view_all', description: 'Access enterprise-wide customer bills and invoice records' },
      { module: 'Bills', action: 'View Own Bills', code: 'bills:view_own', description: 'Access only own customer bills and invoices' },
      { module: 'Payments', action: 'View All Payments', code: 'payments:view_all', description: 'Access enterprise-wide customer payment ledger' },
      { module: 'Payments', action: 'View Own Payments', code: 'payments:view_own', description: 'Access only own customer payment records' },
      { module: 'Payments', action: 'View Payments', code: 'payments:view', description: 'Access customer payment ledger' },
      { module: 'Payments', action: 'Add Payment', code: 'payments:add', description: 'Submit / record new payment transaction' },
      { module: 'Payments', action: 'Submit Payment', code: 'payments:submit', description: 'Submit customer payment entry for accounts verification' },
      { module: 'Payments', action: 'Edit Payment', code: 'payments:edit', description: 'Edit existing payment details or audit corrections' },
      { module: 'Payments', action: 'Verify Payment', code: 'payments:verify', description: 'Approve or reject customer payment entries' },
      { module: 'Reports', action: 'View Reports', code: 'reports:view', description: 'Access business, sales, and financial reports' },
      { module: 'Companies', action: 'Manage Companies', code: 'companies:manage', description: 'Manage billing entities and bank accounts' },
      { module: 'Users', action: 'View Users', code: 'users:view', description: 'View user directory' },
      { module: 'Users', action: 'Manage Users', code: 'users:manage', description: 'Create, edit and manage user credentials & roles' },
      { module: 'Roles', action: 'View Roles', code: 'roles:view', description: 'View corporate roles and permission configurations' },
      { module: 'Roles', action: 'Manage Roles', code: 'roles:manage', description: 'Create and edit roles, configure dynamic permissions matrix' },
      { module: 'Activity', action: 'View Audit Logs', code: 'activity:view', description: 'Audit trail of system transactions' }
    ];

    const insertPermStmt = db.prepare('INSERT OR IGNORE INTO permissions (module, action, code, description) VALUES (?, ?, ?, ?)');
    for (const p of fullPermissions) {
      insertPermStmt.run(p.module, p.action, p.code, p.description);
    }

    // Update role names if needed (e.g. Production Team -> Packing Team)
    db.prepare("UPDATE roles SET name = 'Packing Team', slug = 'packing_team', description = 'Packing floor, stock readiness, box packaging and dispatch bay handover' WHERE slug = 'production_team'").run();

    // Map permissions by code
    const allPermRows = db.prepare('SELECT id, code FROM permissions').all() as { id: number; code: string }[];
    const permMap: Record<string, number> = {};
    for (const row of allPermRows) {
      permMap[row.code] = row.id;
    }

    const roles = db.prepare('SELECT id, slug FROM roles').all() as { id: number; slug: string }[];
    const insertRolePerm = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');

    // Ensure Super Admin has all permissions always
    const superAdmin = roles.find(r => r.slug === 'super_admin');
    if (superAdmin) {
      for (const pId of Object.values(permMap)) {
        insertRolePerm.run(superAdmin.id, pId);
      }
    }

    // Always ensure payment role permissions are assigned
    const assignRoleCodes = (slug: string, codes: string[]) => {
      const r = roles.find(x => x.slug === slug);
      if (r) {
        for (const c of codes) {
          if (permMap[c]) insertRolePerm.run(r.id, permMap[c]);
        }
      }
    };

    assignRoleCodes('sales_person', ['bills:view_own', 'payments:view_own', 'payments:submit', 'payments:add', 'payments:edit', 'payments:view']);
    assignRoleCodes('accounts', ['bills:view_all', 'bills:view_own', 'payments:view_all', 'payments:verify', 'payments:edit', 'payments:add', 'payments:view']);
    assignRoleCodes('admin', ['bills:view_all', 'bills:view_own', 'payments:view_all', 'payments:verify', 'payments:edit', 'payments:add', 'payments:view', 'packing:deliver', 'orders:deliver']);
    assignRoleCodes('packing_team', ['packing:view', 'packing:manage', 'packing:deliver', 'orders:deliver', 'orders:view_all', 'products:view']);

    // Only assign initial baseline permissions if not already initialized
    const baselineDone = db.prepare("SELECT value FROM settings WHERE key = 'rbac_baseline_initialized'").get() as any;
    if (!baselineDone) {

      // Helper to assign baseline perms if role exists
      const assignBaseline = (slug: string, codes: string[]) => {
        const r = roles.find(x => x.slug === slug);
        if (r) {
          for (const c of codes) {
            if (permMap[c]) insertRolePerm.run(r.id, permMap[c]);
          }
        }
      };

      // Baseline permissions for default roles if not already set
      assignBaseline('admin', [
        'dashboard:view', 'orders:view_all', 'orders:create', 'orders:edit', 'orders:approve', 'orders:cancel', 'orders:complete', 'orders:delete',
        'vendors:view_all', 'vendors:create', 'vendors:edit', 'vendors:delete',
        'products:view', 'products:manage', 'packing:view', 'packing:manage',
        'dispatch:view', 'dispatch:create', 'dispatch:update', 'delivery:view', 'delivery:update',
        'payments:view', 'payments:add', 'reports:view', 'companies:manage',
        'users:view', 'users:manage', 'roles:view', 'roles:manage', 'activity:view'
      ]);

      assignBaseline('accounts', [
        'dashboard:view', 'orders:view_all', 'payments:view', 'payments:add', 'payments:verify', 'reports:view', 'vendors:view_all'
      ]);

      assignBaseline('sales_person', [
        'dashboard:view', 'orders:view_own', 'orders:create', 'orders:edit', 'vendors:view_own', 'vendors:create', 'vendors:edit',
        'products:view', 'packing:view', 'dispatch:view', 'payments:view', 'payments:add'
      ]);

      assignBaseline('packing_team', [
        'dashboard:view', 'packing:view', 'packing:manage', 'orders:view_all', 'products:view'
      ]);

      assignBaseline('dispatch_team', [
        'dashboard:view', 'dispatch:view', 'dispatch:create', 'dispatch:update', 'delivery:view', 'delivery:update', 'orders:view_all', 'products:view'
      ]);

      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('rbac_baseline_initialized', '1')").run();
    }

  } catch (e) {
    console.error('Migration error updating permissions matrix:', e);
  }
}
