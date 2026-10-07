import bcrypt from 'bcryptjs';
import { db, initDatabase } from './db.ts';

export function seedDatabase(force: boolean = false) {
  initDatabase();

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (!force && userCount.count > 0) {
    console.log('Database already seeded. Skipping seed.');
    return;
  }

  console.log('Seeding database with full dummy dataset...');

  // Clear existing data if force reset
  if (force) {
    db.exec(`
      DELETE FROM notifications;
      DELETE FROM activity_logs;
      DELETE FROM order_status_history;
      DELETE FROM payments;
      DELETE FROM delivery_items;
      DELETE FROM deliveries;
      DELETE FROM dispatch_items;
      DELETE FROM dispatches;
      DELETE FROM production_records;
      DELETE FROM order_items;
      DELETE FROM orders;
      DELETE FROM vendors;
      DELETE FROM products;
      DELETE FROM categories;
      DELETE FROM brands;
      DELETE FROM companies;
      DELETE FROM role_permissions;
      DELETE FROM permissions;
      DELETE FROM users;
      DELETE FROM roles;
      DELETE FROM settings;
    `);
  }

  // 1. Roles
  const roles = [
    { name: 'Super Admin', slug: 'super_admin', description: 'Full system privileges and administrative control', is_system: 1 },
    { name: 'Admin', slug: 'admin', description: 'Operations manager, order approval, assignments, vendor oversight', is_system: 1 },
    { name: 'Accounts', slug: 'accounts', description: 'Financial ledger, payment verification, invoicing and outstanding collections', is_system: 1 },
    { name: 'Sales Person', slug: 'sales_person', description: 'Client acquisition, order creation, order tracking for owned portfolio', is_system: 1 },
    { name: 'Production Team', slug: 'production_team', description: 'Shop-floor manufacturing, batch formulation, produced quantity logging', is_system: 1 },
    { name: 'Dispatch Team', slug: 'dispatch_team', description: 'Logistics, transport assignment, LR generation, out for delivery tracking', is_system: 1 }
  ];

  const insertRole = db.prepare('INSERT INTO roles (name, slug, description, is_system) VALUES (?, ?, ?, ?)');
  for (const r of roles) {
    insertRole.run(r.name, r.slug, r.description, r.is_system);
  }

  const roleMap: Record<string, number> = {};
  const allRoles = db.prepare('SELECT id, slug FROM roles').all() as { id: number; slug: string }[];
  for (const r of allRoles) {
    roleMap[r.slug] = r.id;
  }

  // 2. Permissions
  const permissionsList = [
    // Orders
    { module: 'Orders', action: 'View All Orders', code: 'orders:view_all', description: 'View orders across entire company' },
    { module: 'Orders', action: 'View Own Orders', code: 'orders:view_own', description: 'View only orders created by self' },
    { module: 'Orders', action: 'Create Order', code: 'orders:create', description: 'Create new customer orders' },
    { module: 'Orders', action: 'Edit Order', code: 'orders:edit', description: 'Edit pending/new orders' },
    { module: 'Orders', action: 'Approve Order', code: 'orders:approve', description: 'Accept or approve orders for manufacturing' },
    { module: 'Orders', action: 'Cancel Order', code: 'orders:cancel', description: 'Cancel orders with reason' },
    { module: 'Orders', action: 'Complete Order', code: 'orders:complete', description: 'Mark orders fully completed upon delivery & payment' },

    // Production
    { module: 'Production', action: 'View Production', code: 'production:view', description: 'View assigned production jobs' },
    { module: 'Production', action: 'Update Production', code: 'production:update', description: 'Log batches and update manufactured quantity' },
    { module: 'Production', action: 'Complete Production', code: 'production:complete', description: 'Mark manufacturing completed and ready for dispatch' },

    // Dispatch
    { module: 'Dispatch', action: 'View Dispatch', code: 'dispatch:view', description: 'View ready orders for logistics' },
    { module: 'Dispatch', action: 'Create Dispatch', code: 'dispatch:create', description: 'Generate dispatch note and assign vehicle/LR' },
    { module: 'Dispatch', action: 'Update Delivery', code: 'dispatch:update_delivery', description: 'Mark delivery status and log receiver proof' },

    // Payments
    { module: 'Payments', action: 'View Payments', code: 'payments:view', description: 'View financial records and payments' },
    { module: 'Payments', action: 'Add Payment', code: 'payments:add', description: 'Record payment entry' },
    { module: 'Payments', action: 'Verify Payment', code: 'payments:verify', description: 'Audit and approve verified payments' },

    // Vendors
    { module: 'Vendors', action: 'View All Vendors', code: 'vendors:view_all', description: 'View all vendors in system' },
    { module: 'Vendors', action: 'View Own Vendors', code: 'vendors:view_own', description: 'View only assigned vendors' },
    { module: 'Vendors', action: 'Create Vendor', code: 'vendors:create', description: 'Add new client vendor' },
    { module: 'Vendors', action: 'Edit Vendor', code: 'vendors:edit', description: 'Modify vendor profile' },

    // Products & Masters
    { module: 'Products', action: 'Manage Products', code: 'products:manage', description: 'Create, edit and manage lubricant catalog' },
    { module: 'Reports', action: 'View Reports', code: 'reports:view', description: 'Access financial, sales and production analytics' },
    { module: 'Companies', action: 'Manage Companies', code: 'companies:manage', description: 'Manage billing entities and bank accounts' },
    { module: 'Users', action: 'Manage Users', code: 'users:manage', description: 'Create and configure user credentials' },
    { module: 'Roles', action: 'Manage Roles', code: 'roles:manage', description: 'Configure role permissions' },
    { module: 'Activity', action: 'View Audit Logs', code: 'activity:view', description: 'Audit trails of all system transactions' }
  ];

  const insertPerm = db.prepare('INSERT INTO permissions (module, action, code, description) VALUES (?, ?, ?, ?)');
  for (const p of permissionsList) {
    insertPerm.run(p.module, p.action, p.code, p.description);
  }

  const allPerms = db.prepare('SELECT id, code FROM permissions').all() as { id: number; code: string }[];
  const permMap: Record<string, number> = {};
  for (const p of allPerms) {
    permMap[p.code] = p.id;
  }

  // Link permissions to roles
  const insertRolePerm = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');

  const assignPerms = (roleSlug: string, permCodes: string[]) => {
    const roleId = roleMap[roleSlug];
    for (const code of permCodes) {
      if (permMap[code]) {
        insertRolePerm.run(roleId, permMap[code]);
      }
    }
  };

  // Super Admin: All
  assignPerms('super_admin', Object.keys(permMap));

  // Admin
  assignPerms('admin', [
    'orders:view_all', 'orders:create', 'orders:edit', 'orders:approve', 'orders:cancel', 'orders:complete',
    'production:view', 'dispatch:view', 'payments:view', 'payments:add', 'payments:verify',
    'vendors:view_all', 'vendors:create', 'vendors:edit', 'products:manage', 'reports:view',
    'companies:manage', 'users:manage', 'activity:view'
  ]);

  // Accounts
  assignPerms('accounts', [
    'orders:view_all', 'payments:view', 'payments:add', 'payments:verify', 'reports:view', 'vendors:view_all'
  ]);

  // Sales Person
  assignPerms('sales_person', [
    'orders:view_own', 'orders:create', 'orders:edit', 'vendors:view_own', 'vendors:create', 'payments:add'
  ]);

  // Production Team
  assignPerms('production_team', [
    'production:view', 'production:update', 'production:complete'
  ]);

  // Dispatch Team
  assignPerms('dispatch_team', [
    'dispatch:view', 'dispatch:create', 'dispatch:update_delivery'
  ]);

  // 3. Password hashes
  const adminHash = bcrypt.hashSync('Admin@123', 10);
  const salesHash = bcrypt.hashSync('Sales@123', 10);
  const accountsHash = bcrypt.hashSync('Accounts@123', 10);
  const prodHash = bcrypt.hashSync('Production@123', 10);
  const dispatchHash = bcrypt.hashSync('Dispatch@123', 10);

  // 4. Users
  const users = [
    { name: 'Siddharth Oberoi', email: 'superadmin@lubricantdemo.com', password_hash: adminHash, role_id: roleMap['super_admin'], mobile: '+91 98200 11001', employee_id: 'EMP-001' },
    { name: 'Rajesh Mehra', email: 'admin@lubricantdemo.com', password_hash: adminHash, role_id: roleMap['admin'], mobile: '+91 98200 22002', employee_id: 'EMP-002' },
    { name: 'Kavita Sundaram', email: 'accounts@lubricantdemo.com', password_hash: accountsHash, role_id: roleMap['accounts'], mobile: '+91 98200 33003', employee_id: 'EMP-003' },
    { name: 'Akash Singh', email: 'akash@lubricantdemo.com', password_hash: salesHash, role_id: roleMap['sales_person'], mobile: '+91 98200 44004', employee_id: 'EMP-004' },
    { name: 'Rahul Sharma', email: 'rahul@lubricantdemo.com', password_hash: salesHash, role_id: roleMap['sales_person'], mobile: '+91 98200 55005', employee_id: 'EMP-005' },
    { name: 'Deepak Sharma', email: 'deepak@lubricantdemo.com', password_hash: salesHash, role_id: roleMap['sales_person'], mobile: '+91 98200 66006', employee_id: 'EMP-006' },
    { name: 'Vikram Patel', email: 'production@lubricantdemo.com', password_hash: prodHash, role_id: roleMap['production_team'], mobile: '+91 98200 77007', employee_id: 'EMP-007' },
    { name: 'Sunil Sharma', email: 'dispatch@lubricantdemo.com', password_hash: dispatchHash, role_id: roleMap['dispatch_team'], mobile: '+91 98200 88008', employee_id: 'EMP-008' },
    { name: 'Anjali Gupta', email: 'accounts2@lubricantdemo.com', password_hash: accountsHash, role_id: roleMap['accounts'], mobile: '+91 98200 99009', employee_id: 'EMP-009' },
    { name: 'Manoj Tiwari', email: 'production2@lubricantdemo.com', password_hash: prodHash, role_id: roleMap['production_team'], mobile: '+91 98200 12345', employee_id: 'EMP-010' }
  ];

  const insertUser = db.prepare('INSERT INTO users (name, email, password_hash, role_id, mobile, employee_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const u of users) {
    insertUser.run(u.name, u.email, u.password_hash, u.role_id, u.mobile, u.employee_id, 'active');
  }

  const userMap: Record<string, number> = {};
  const allUsers = db.prepare('SELECT id, email FROM users').all() as { id: number; email: string }[];
  for (const u of allUsers) {
    userMap[u.email] = u.id;
  }

  // 5. Billing Companies (2 Required)
  const companies = [
    {
      name: 'LubriMax Petrochem Industries Pvt Ltd',
      code: 'CMP-A',
      logo_url: 'https://images.unsplash.com/photo-1541888946425-d0fbb1861593?w=160&auto=format&fit=crop&q=80',
      gst_number: '27AABCL1234F1ZQ',
      address: 'Plot No. 42-45, Industrial MIDC Phase II, TTC Area, Pawane',
      city: 'Navi Mumbai',
      state: 'Maharashtra',
      pincode: '400705',
      mobile: '+91 22 2768 9000',
      email: 'billing@lubrimaxpetro.com',
      bank_name: 'HDFC Bank Ltd',
      account_no: '50200045892144',
      ifsc_code: 'HDFC0000240',
      branch: 'Vashi Sector 17 Branch',
      terms: '1. Goods once sold will not be taken back without prior written inspection approval.\n2. Payment terms as agreed on Purchase Order.\n3. All disputes subject to Mumbai Jurisdiction.'
    },
    {
      name: 'Apex Lube Solutions LLP',
      code: 'CMP-B',
      logo_url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=160&auto=format&fit=crop&q=80',
      gst_number: '24AAFFA5678K1ZP',
      address: 'Survey No. 128, GIDC Industrial Estate, Phase 3, Naroda',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '382330',
      mobile: '+91 79 2280 4500',
      email: 'finance@apexlubes.com',
      bank_name: 'State Bank of India',
      account_no: '38901245890',
      ifsc_code: 'SBIN0003421',
      branch: 'Naroda Industrial Estate Branch',
      terms: '1. Interest @ 18% per annum will be charged if bill is not paid within credit period.\n2. Goods dispatched at buyer\'s risk.\n3. Subject to Ahmedabad Jurisdiction.'
    }
  ];

  const insertCompany = db.prepare(`
    INSERT INTO companies (name, code, logo_url, gst_number, address, city, state, pincode, mobile, email, bank_name, account_no, ifsc_code, branch, terms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const c of companies) {
    insertCompany.run(c.name, c.code, c.logo_url, c.gst_number, c.address, c.city, c.state, c.pincode, c.mobile, c.email, c.bank_name, c.account_no, c.ifsc_code, c.branch, c.terms);
  }

  // 6. Brands (6 Brands)
  const brands = [
    { name: 'LubriMax', description: 'Flagship automotive and heavy industrial lubricant formulations' },
    { name: 'PowerLube', description: 'High-performance synthetic commercial fleet engine oils' },
    { name: 'UltraDrive', description: 'Passenger car motor oils and performance synthetic driveline fluids' },
    { name: 'Industrial Pro', description: 'Heavy duty hydraulic, circulating and turbine oils' },
    { name: 'TorqueTech', description: 'Industrial extreme pressure gear oils and open gear lubricants' },
    { name: 'AeroLube', description: 'Premium synthetic greases, food grade and specialty lubricants' }
  ];

  const insertBrand = db.prepare('INSERT INTO brands (name, description) VALUES (?, ?)');
  for (const b of brands) {
    insertBrand.run(b.name, b.description);
  }

  const brandRows = db.prepare('SELECT id, name FROM brands').all() as { id: number; name: string }[];
  const brandMap: Record<string, number> = {};
  for (const b of brandRows) {
    brandMap[b.name] = b.id;
  }

  // 7. Categories (8 Categories)
  const categories = [
    { name: 'Engine Oil', description: 'Gasoline & diesel engine lubricants ranging from mineral to 100% synthetic' },
    { name: 'Gear Oil', description: 'Manual transmission and industrial high-torque gear compounds' },
    { name: 'Hydraulic Oil', description: 'Anti-wear hydraulic system fluids ISO VG 32 to 150' },
    { name: 'Grease', description: 'Lithium, calcium, and polyurea thickener extreme pressure greases' },
    { name: 'Automotive Lubricants', description: 'Coolants, brake fluids, and suspension shock absorber oils' },
    { name: 'Industrial Lubricants', description: 'Compressor, spindle, slideway and heat transfer oils' },
    { name: 'Transmission Fluids', description: 'Automatic transmission fluids (ATF Dexron/Mercon, CVT, DCT)' },
    { name: 'Cutting & Coolant Oils', description: 'Soluble cutting fluids, neat cutting oils, and rust preventives' }
  ];

  const insertCat = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
  for (const c of categories) {
    insertCat.run(c.name, c.description);
  }

  const catRows = db.prepare('SELECT id, name FROM categories').all() as { id: number; name: string }[];
  const catMap: Record<string, number> = {};
  for (const c of catRows) {
    catMap[c.name] = c.id;
  }

  // 8. Products (25 Products)
  const products = [
    { name: 'LubriMax Fleet Master 15W-40 CI-4', brand: 'LubriMax', cat: 'Engine Oil', sku: 'LBM-15W40-CI4', unit: 'Drum 210L', minQty: 1, rate: 38500, desc: 'Heavy duty diesel engine oil for commercial trucks and buses' },
    { name: 'LubriMax Fleet Master 15W-40 CI-4 (20L)', brand: 'LubriMax', cat: 'Engine Oil', sku: 'LBM-15W40-20L', unit: 'Bucket 20L', minQty: 5, rate: 4200, desc: 'High dispersancy diesel oil in 20L bucket packaging' },
    { name: 'LubriMax Turbo Gold 20W-50 API CF-4', brand: 'LubriMax', cat: 'Engine Oil', sku: 'LBM-20W50-CF4', unit: 'Drum 210L', minQty: 1, rate: 34800, desc: 'All-weather multi-grade oil for agricultural and utility engines' },
    { name: 'UltraDrive SynthaTec 5W-30 Full Synthetic', brand: 'UltraDrive', cat: 'Engine Oil', sku: 'UD-5W30-SYN', unit: 'Carton (4x4L)', minQty: 2, rate: 6800, desc: 'Advanced fuel economy synthetic motor oil for modern petrol cars' },
    { name: 'UltraDrive Apex 5W-40 Euro Spec', brand: 'UltraDrive', cat: 'Engine Oil', sku: 'UD-5W40-EUR', unit: 'Carton (4x4L)', minQty: 2, rate: 7400, desc: 'High-tier European performance synthetic oil with low SAPS formulation' },
    { name: 'PowerLube Maxima 10W-40 Synthetic Blend', brand: 'PowerLube', cat: 'Engine Oil', sku: 'PL-10W40-SYN', unit: 'Drum 210L', minQty: 1, rate: 41200, desc: 'Semi-synthetic heavy fleet oil for severe duty turbo-charged engines' },
    { name: 'TorqueTech Heavy Duty Gear Oil 80W-90 GL-5', brand: 'TorqueTech', cat: 'Gear Oil', sku: 'TT-80W90-GL5', unit: 'Bucket 20L', minQty: 3, rate: 4600, desc: 'Extreme pressure hypoid gear oil for differentials and transfer cases' },
    { name: 'TorqueTech HD 85W-140 Axle Lube GL-5', brand: 'TorqueTech', cat: 'Gear Oil', sku: 'TT-85W140-GL5', unit: 'Drum 210L', minQty: 1, rate: 39500, desc: 'High viscosity axle lubricant for earthmoving and mining dump trucks' },
    { name: 'TorqueTech Industrial Gear Oil ISO VG 220', brand: 'TorqueTech', cat: 'Gear Oil', sku: 'TT-IND-VG220', unit: 'Drum 210L', minQty: 1, rate: 44000, desc: 'Enclosed industrial gearbox oil with superior micro-pitting resistance' },
    { name: 'TorqueTech Industrial Gear Oil ISO VG 320', brand: 'TorqueTech', cat: 'Gear Oil', sku: 'TT-IND-VG320', unit: 'Drum 210L', minQty: 1, rate: 46500, desc: 'Heavy load gear fluid for cement kilns, steel mills and pulverizers' },
    { name: 'Industrial Pro HydroMax AW-68 Hydraulic Oil', brand: 'Industrial Pro', cat: 'Hydraulic Oil', sku: 'IP-HYD-AW68', unit: 'Drum 210L', minQty: 2, rate: 31500, desc: 'Premium zinc anti-wear hydraulic oil for CNC presses and injection moulding' },
    { name: 'Industrial Pro HydroMax AW-46 Hydraulic Oil', brand: 'Industrial Pro', cat: 'Hydraulic Oil', sku: 'IP-HYD-AW46', unit: 'Drum 210L', minQty: 2, rate: 31000, desc: 'Rapid air release anti-wear hydraulic oil for high-pressure vane pumps' },
    { name: 'Industrial Pro HydroMax AW-32 Low Viscosity', brand: 'Industrial Pro', cat: 'Hydraulic Oil', sku: 'IP-HYD-AW32', unit: 'Drum 210L', minQty: 2, rate: 32000, desc: 'Low temperature hydraulic oil for precision machine tool servos' },
    { name: 'AeroLube Lithium Complex EP-2 Blue Grease', brand: 'AeroLube', cat: 'Grease', sku: 'AL-GREASE-EP2', unit: 'Bucket 18kg', minQty: 5, rate: 5800, desc: 'High temperature 260°C drop point grease for heavy chassis & wheel bearings' },
    { name: 'AeroLube Moly Heavy Impact Grease NLGI-2', brand: 'AeroLube', cat: 'Grease', sku: 'AL-MOLY-EP2', unit: 'Bucket 18kg', minQty: 4, rate: 6400, desc: '3% Molybdenum disulfide fortified grease for pins, bushings and hammers' },
    { name: 'AeroLube Ultra White Lithium EP-0', brand: 'AeroLube', cat: 'Grease', sku: 'AL-GREASE-EP0', unit: 'Drum 180kg', minQty: 1, rate: 48000, desc: 'Semi-fluid centralized lubrication grease for automated distribution lines' },
    { name: 'PowerLube Long Life Radiator Coolant 1:3', brand: 'PowerLube', cat: 'Automotive Lubricants', sku: 'PL-COOL-100', unit: 'Carton (20x1L)', minQty: 2, rate: 3200, desc: 'Ethylene glycol organic acid technology anti-freeze and anti-boil coolant' },
    { name: 'UltraDrive DOT 4 High Boiling Brake Fluid', brand: 'UltraDrive', cat: 'Automotive Lubricants', sku: 'UD-BF-DOT4', unit: 'Carton (24x250ml)', minQty: 3, rate: 2900, desc: 'High wet boiling point synthetic polyglycol brake fluid for ABS systems' },
    { name: 'Industrial Pro Slideway Lube WayMax 68', brand: 'Industrial Pro', cat: 'Industrial Lubricants', sku: 'IP-SLIDE-68', unit: 'Bucket 20L', minQty: 2, rate: 4800, desc: 'Stick-slip preventing tackified slideway lubricant for machine tool ways' },
    { name: 'Industrial Pro CompressoMax 46 Screw Lube', brand: 'Industrial Pro', cat: 'Industrial Lubricants', sku: 'IP-COMP-46', unit: 'Drum 210L', minQty: 1, rate: 52000, desc: '8000-hour extended drain synthetic rotary screw air compressor fluid' },
    { name: 'Industrial Pro ThermaHeat 32 Heat Transfer Oil', brand: 'Industrial Pro', cat: 'Industrial Lubricants', sku: 'IP-THERM-32', unit: 'Drum 210L', minQty: 1, rate: 36000, desc: 'High thermal stability mineral thermic fluid operational up to 300°C' },
    { name: 'UltraDrive ATF Multi-Vehicle Synthetic', brand: 'UltraDrive', cat: 'Transmission Fluids', sku: 'UD-ATF-SYN', unit: 'Bucket 20L', minQty: 2, rate: 6900, desc: 'Universal synthetic automatic transmission fluid for Asian and US gearboxes' },
    { name: 'UltraDrive CVT Continuum Fluid', brand: 'UltraDrive', cat: 'Transmission Fluids', sku: 'UD-CVT-FLUID', unit: 'Carton (6x4L)', minQty: 2, rate: 8200, desc: 'Continuously variable transmission fluid engineered for steel push belts' },
    { name: 'Industrial Pro CutMax BioSol Coolant', brand: 'Industrial Pro', cat: 'Cutting & Coolant Oils', sku: 'IP-CUT-BIOSOL', unit: 'Drum 210L', minQty: 1, rate: 33000, desc: 'Bio-stable water soluble metalworking fluid with biocide protection' },
    { name: 'Industrial Pro RustShield 309 Solvent Protective', brand: 'Industrial Pro', cat: 'Cutting & Coolant Oils', sku: 'IP-RUST-309', unit: 'Drum 210L', minQty: 1, rate: 31500, desc: 'Dewatering rust preventive leaving dry waxy film with 12 months indoor life' }
  ];

  const imagesByCat: Record<string, string[]> = {
    'Engine Oil': [
      'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=500&auto=format&fit=crop&q=80'
    ],
    'Gear Oil': [
      'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1541888946425-d0fbb1861593?w=500&auto=format&fit=crop&q=80'
    ],
    'Hydraulic Oil': [
      'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=500&auto=format&fit=crop&q=80'
    ],
    'Grease': [
      'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&auto=format&fit=crop&q=80'
    ],
    'Automotive Lubricants': [
      'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=500&auto=format&fit=crop&q=80'
    ],
    'Industrial Lubricants': [
      'https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&auto=format&fit=crop&q=80'
    ],
    'Transmission Fluids': [
      'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=500&auto=format&fit=crop&q=80'
    ],
    'Cutting & Coolant Oils': [
      'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=500&auto=format&fit=crop&q=80'
    ]
  };

  const insertProduct = db.prepare(`
    INSERT INTO products (name, brand_id, category_id, sku, unit, min_order_qty, standard_rate, description, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const imgList = imagesByCat[p.cat] || ['https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=500&auto=format&fit=crop&q=80'];
    const imgUrl = imgList[i % imgList.length];
    insertProduct.run(p.name, brandMap[p.brand], catMap[p.cat], p.sku, p.unit, p.minQty, p.rate, p.desc, imgUrl);
  }

  const productRows = db.prepare('SELECT id, sku, standard_rate FROM products').all() as { id: number; sku: string; standard_rate: number }[];
  const productMap: Record<string, { id: number; standard_rate: number }> = {};
  for (const p of productRows) {
    productMap[p.sku] = { id: p.id, standard_rate: p.standard_rate };
  }

  // 9. Vendors (20 Vendors assigned to Akash, Rahul, Deepak)
  const akashId = userMap['akash@lubricantdemo.com'];
  const rahulId = userMap['rahul@lubricantdemo.com'];
  const deepakId = userMap['deepak@lubricantdemo.com'];

  const vendors = [
    // Assigned to Akash Singh
    { code: 'VND-1001', company: 'ABC Auto Traders Pvt Ltd', contact: 'Ramesh Agrawal', phone: '+91 98220 12345', email: 'purchase@abctraders.in', gstin: '27AABCA1234A1Z1', city: 'Pune', state: 'Maharashtra', pin: '411019', salesId: akashId, address: 'Plot 12, Bhosari MIDC, Pune', delivery: 'Warehouse B, Sector 10, Bhosari MIDC, Pune' },
    { code: 'VND-1002', company: 'Shree Balaji Logistics & Fleets', contact: 'Balaji Natarajan', phone: '+91 98220 23456', email: 'fleet@balajilogistics.com', gstin: '27BBLSB5678B1Z2', city: 'Nagpur', state: 'Maharashtra', pin: '440028', salesId: akashId, address: '55 Transport Nagar, Kalamna Market, Nagpur', delivery: 'Central Workshop, Hingna Road, Nagpur' },
    { code: 'VND-1003', company: 'Kalyani Automotive Spares', contact: 'Suresh Kalyani', phone: '+91 98220 34567', email: 'kalyanispares@gmail.com', gstin: '27AAKFK9012C1Z3', city: 'Nashik', state: 'Maharashtra', pin: '422010', salesId: akashId, address: 'Shop 4-6, Auto Spare Market, Ambad, Nashik', delivery: 'Shop 4-6, Auto Spare Market, Ambad, Nashik' },
    { code: 'VND-1004', company: 'Mahalaxmi Earthmovers & Mining', contact: 'Vinay Gaikwad', phone: '+91 98220 45678', email: 'vinay@mahalaxmiearth.com', gstin: '27AABCM3456D1Z4', city: 'Kolhapur', state: 'Maharashtra', pin: '416005', salesId: akashId, address: 'Gat No. 89, Shiroli MIDC, Kolhapur', delivery: 'Heavy Quarry Site, Kagal Industrial Area, Kolhapur' },
    { code: 'VND-1005', company: 'Pragati Precision Engineering', contact: 'Makarand Deshmukh', phone: '+91 98220 56789', email: 'mdeshmukh@pragatiengg.co.in', gstin: '27AABCP7890E1Z5', city: 'Aurangabad', state: 'Maharashtra', pin: '431136', salesId: akashId, address: 'E-45, Waluj Industrial Area, Aurangabad', delivery: 'E-45, Waluj Industrial Area, Aurangabad' },
    { code: 'VND-1006', company: 'Royal Super Wheels Service Hub', contact: 'Farhan Merchant', phone: '+91 98220 67890', email: 'farhan@royalwheels.net', gstin: '27AAAFR2345F1Z6', city: 'Mumbai', state: 'Maharashtra', pin: '400072', salesId: akashId, address: 'Unit 8, Saki Vihar Road, Andheri East, Mumbai', delivery: 'Unit 8, Saki Vihar Road, Andheri East, Mumbai' },
    { code: 'VND-1007', company: 'Deccan Heavy Equipments Ltd', contact: 'Pramod Joshi', phone: '+91 98220 78901', email: 'pjoshi@deccanequip.com', gstin: '27AABCD6789G1Z7', city: 'Thane', state: 'Maharashtra', pin: '400604', salesId: akashId, address: 'Plot 77, Wagle Estate, Thane West', delivery: 'Plot 77, Wagle Estate, Thane West' },
    { code: 'VND-1008', company: 'Sahyadri Agro Machinery Works', contact: 'Dattatray Patil', phone: '+91 98220 89012', email: 'sahyadriagro@rediffmail.com', gstin: '27AAPPS1234H1Z8', city: 'Sangli', state: 'Maharashtra', pin: '416416', salesId: akashId, address: 'Kupwad MIDC, Sangli', delivery: 'Kupwad MIDC, Sangli' },

    // Assigned to Rahul Verma
    { code: 'VND-2001', company: 'Gujarat Techno Forge & Casting', contact: 'Hasmukh Patel', phone: '+91 98330 11223', email: 'hpatel@technoforge.co.in', gstin: '24AABCG1234A1Z9', city: 'Rajkot', state: 'Gujarat', pin: '360003', salesId: rahulId, address: 'Plot 204, Aji Vasahat GIDC, Rajkot', delivery: 'Foundry Division, Metoda GIDC, Rajkot' },
    { code: 'VND-2002', company: 'Surat Diamond Fleet Carriers', contact: 'Bhavik Shah', phone: '+91 98330 22334', email: 'bhavik@suratfleet.com', gstin: '24AAECS4567B1ZA', city: 'Surat', state: 'Gujarat', pin: '395006', salesId: rahulId, address: '44 Ring Road Transport Hub, Surat', delivery: 'Central Yard, Sachin GIDC, Surat' },
    { code: 'VND-2003', company: 'Maruti Motor Works & Garage', contact: 'Kiritbhai Solanki', phone: '+91 98330 33445', email: 'marutigarage.amd@gmail.com', gstin: '24ABCPM8901C1ZB', city: 'Ahmedabad', state: 'Gujarat', pin: '380015', salesId: rahulId, address: 'Near Sarkhej Cross Road, SG Highway, Ahmedabad', delivery: 'Near Sarkhej Cross Road, SG Highway, Ahmedabad' },
    { code: 'VND-2004', company: 'Baroda Petro-Chemicals Stockist', contact: 'Nitin Trivedi', phone: '+91 98330 44556', email: 'barodapetro@yahoo.com', gstin: '24AABCB2345D1ZC', city: 'Vadodara', state: 'Gujarat', pin: '390010', salesId: rahulId, address: 'Godown 15, Makarpura GIDC, Vadodara', delivery: 'Godown 15, Makarpura GIDC, Vadodara' },
    { code: 'VND-2005', company: 'Kutch Ports Translink Agency', contact: 'Jitendra Jadeja', phone: '+91 98330 55667', email: 'kutchports@translink.in', gstin: '24AAECK6789E1ZD', city: 'Gandhidham', state: 'Gujarat', pin: '370201', salesId: rahulId, address: 'Port Cargo Complex, Kandla Road, Gandhidham', delivery: 'Container Terminal Gate 4, Kandla' },
    { code: 'VND-2006', company: 'Narmada Textile Mills Heavy Ops', contact: 'Paresh Mehta', phone: '+91 98330 66778', email: 'pmehta@narmadatex.com', gstin: '24AABCN1234F1ZE', city: 'Bharuch', state: 'Gujarat', pin: '392015', salesId: rahulId, address: 'Ankleshwar GIDC Plot 88, Bharuch', delivery: 'Ankleshwar GIDC Plot 88, Bharuch' },
    { code: 'VND-2007', company: 'Vibrant Saurashtra Automotives', contact: 'Dharmesh Zala', phone: '+91 98330 77889', email: 'vibrantsaurashtra@gmail.com', gstin: '24AAAFV5678G1ZF', city: 'Bhavnagar', state: 'Gujarat', pin: '364001', salesId: rahulId, address: 'Chitra GIDC, Bhavnagar', delivery: 'Chitra GIDC, Bhavnagar' },

    // Assigned to Deepak Sharma
    { code: 'VND-3001', company: 'Hindustan Heavy Earthmovers', contact: 'Alok Saxena', phone: '+91 98440 12345', email: 'alok@hindustanhhe.com', gstin: '08AABCH1234A1ZG', city: 'Jaipur', state: 'Rajasthan', pin: '302013', salesId: deepakId, address: 'Road No. 9, VKIA Industrial Area, Jaipur', delivery: 'Mining Depot, Chomu Road, Jaipur' },
    { code: 'VND-3002', company: 'Marwar Cement & Concrete Plant', contact: 'Gajendra Rathore', phone: '+91 98440 23456', email: 'grathore@marwarcement.com', gstin: '08AABCM5678B1ZH', city: 'Jodhpur', state: 'Rajasthan', pin: '342003', salesId: deepakId, address: 'Phase II, Boranada Industrial Park, Jodhpur', delivery: 'Plant Site, Bilara Highway, Jodhpur' },
    { code: 'VND-3003', company: 'Mewar Commercial Fleet Solutions', contact: 'Chandra Prakash', phone: '+91 98440 34567', email: 'mewarfleet@gmail.com', gstin: '08AAECM9012C1ZI', city: 'Udaipur', state: 'Rajasthan', pin: '313003', salesId: deepakId, address: 'Transport Nagar, Sukher, Udaipur', delivery: 'Transport Nagar, Sukher, Udaipur' },
    { code: 'VND-3004', company: 'Kota Stone Polishing & Machinery', contact: 'Mukesh Sharma', phone: '+91 98440 45678', email: 'kotastone@rediffmail.com', gstin: '08AABCK3456D1ZJ', city: 'Kota', state: 'Rajasthan', pin: '324005', salesId: deepakId, address: 'Indraprastha Industrial Area, Kota', delivery: 'Indraprastha Industrial Area, Kota' },
    { code: 'VND-3005', company: 'Bhilwara Spinning Mills Lubrication', contact: 'Sanjay Toshniwal', phone: '+91 98440 56789', email: 'stoshniwal@bhilwaraspin.com', gstin: '08AABCB7890E1ZK', city: 'Bhilwara', state: 'Rajasthan', pin: '311001', salesId: deepakId, address: 'Hamirgarh Road Industrial Zone, Bhilwara', delivery: 'Hamirgarh Road Industrial Zone, Bhilwara' }
  ];

  const insertVendor = db.prepare(`
    INSERT INTO vendors (vendor_code, company_name, contact_person, mobile, alt_mobile, email, gstin, billing_address, delivery_address, city, state, pincode, assigned_sales_person_id, created_by_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `);

  for (const v of vendors) {
    insertVendor.run(v.code, v.company, v.contact, v.phone, null, v.email, v.gstin, v.address, v.delivery, v.city, v.state, v.pin, v.salesId, v.salesId);
  }

  const vendorRows = db.prepare('SELECT id, vendor_code, company_name, assigned_sales_person_id FROM vendors').all() as { id: number; vendor_code: string; company_name: string; assigned_sales_person_id: number }[];
  const vendorMap: Record<string, number> = {};
  for (const v of vendorRows) {
    vendorMap[v.vendor_code] = v.id;
  }

  // 10. Orders Creation (52 realistic orders across all required workflow statuses!)
  // Status definitions:
  // NEW, ACCEPTED, PROCESSING, READY_FOR_DISPATCH, OUT_FOR_DELIVERY, DELIVERED, COMPLETED, CANCELLED
  const companyARow = db.prepare("SELECT id FROM companies WHERE code = 'CMP-A'").get() as { id: number };
  const companyBRow = db.prepare("SELECT id FROM companies WHERE code = 'CMP-B'").get() as { id: number };
  const companyAId = companyARow.id;
  const companyBId = companyBRow.id;

  const adminId = userMap['admin@lubricantdemo.com'];
  const prodUserId = userMap['production@lubricantdemo.com'];
  const dispatchUserId = userMap['dispatch@lubricantdemo.com'];
  const accountsUserId = userMap['accounts@lubricantdemo.com'];

  // Helper to insert order
  const insertOrderStmt = db.prepare(`
    INSERT INTO orders (
      order_number, company_id, vendor_id, sales_person_id, order_status,
      production_status, dispatch_status, delivery_status, payment_status,
      payment_terms, subtotal, discount_amount, tax_rate, tax_amount, grand_total,
      amount_received, pending_amount, required_delivery_date, delivery_address,
      delivery_contact_person, delivery_contact_number, special_instructions,
      cancellation_reason, cancelled_by_id, cancelled_at,
      assigned_to_production_at, production_completed_at, dispatched_at, delivered_at, completed_at, completed_by_id,
      created_by_id, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?
    )
  `);

  const insertOrderItemStmt = db.prepare(`
    INSERT INTO order_items (
      order_id, product_id, sku, product_name, unit, quantity, produced_quantity, dispatched_quantity, delivered_quantity, rate, line_amount, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertHistoryStmt = db.prepare(`
    INSERT INTO order_status_history (order_id, stage_name, previous_status, new_status, notes, created_by_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertProdRecordStmt = db.prepare(`
    INSERT INTO production_records (order_id, order_item_id, batch_number, produced_quantity, production_date, operator_name, notes, created_by_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertDispatchStmt = db.prepare(`
    INSERT INTO dispatches (dispatch_number, order_id, dispatch_date, transport_name, transport_contact, vehicle_number, lr_number, tracking_number, driver_name, driver_mobile, dispatch_quantity, notes, created_by_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertDispatchItemStmt = db.prepare(`
    INSERT INTO dispatch_items (dispatch_id, order_item_id, quantity)
    VALUES (?, ?, ?)
  `);

  const insertDeliveryStmt = db.prepare(`
    INSERT INTO deliveries (order_id, dispatch_id, delivery_date, delivered_quantity, received_by, receiver_mobile, pod_url, notes, created_by_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertDeliveryItemStmt = db.prepare(`
    INSERT INTO delivery_items (delivery_id, order_item_id, quantity)
    VALUES (?, ?, ?)
  `);

  const insertPaymentStmt = db.prepare(`
    INSERT INTO payments (payment_number, order_id, amount, payment_date, payment_mode, reference_number, notes, is_verified, received_by_id, verified_by_id, verified_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertActivityStmt = db.prepare(`
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertNotificationStmt = db.prepare(`
    INSERT INTO notifications (user_id, role_slug, title, message, type, order_id, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Generate 52 orders with specific test scenarios
  // Let's build distinct configurations
  const orderConfigs: any[] = [
    // --- 1. NEW ORDERS (Ready for Admin Review & Accept/Cancel testing) ---
    {
      num: 'ORD-10170', vendor: 'VND-1001', sales: akashId, company: companyAId,
      status: 'NEW', prodStatus: 'NOT_ASSIGNED', dispStatus: 'NOT_DISPATCHED', delStatus: 'PENDING', payStatus: 'UNPAID',
      terms: 'Credit 30 Days', advance: 0, reqDate: '2026-10-05',
      items: [
        { sku: 'LBM-15W40-CI4', name: 'LubriMax Fleet Master 15W-40 CI-4', unit: 'Drum 210L', qty: 2, rate: 38000 }
      ],
      createdDaysAgo: 0
    },
    {
      num: 'ORD-10171', vendor: 'VND-1002', sales: akashId, company: companyBId,
      status: 'NEW', prodStatus: 'NOT_ASSIGNED', dispStatus: 'NOT_DISPATCHED', delStatus: 'PENDING', payStatus: 'ADVANCE_RECEIVED',
      terms: 'Partial Payment', advance: 25000, reqDate: '2026-10-07',
      items: [
        { sku: 'TT-80W90-GL5', name: 'TorqueTech Heavy Duty Gear Oil 80W-90 GL-5', unit: 'Bucket 20L', qty: 10, rate: 4500 },
        { sku: 'AL-GREASE-EP2', name: 'AeroLube Lithium Complex EP-2 Blue Grease', unit: 'Bucket 18kg', qty: 6, rate: 5700 }
      ],
      createdDaysAgo: 0
    },
    {
      num: 'ORD-10172', vendor: 'VND-1003', sales: akashId, company: companyAId,
      status: 'NEW', prodStatus: 'NOT_ASSIGNED', dispStatus: 'NOT_DISPATCHED', delStatus: 'PENDING', payStatus: 'UNPAID',
      terms: 'Credit 15 Days', advance: 0, reqDate: '2026-10-08',
      items: [
        { sku: 'IP-HYD-AW68', name: 'Industrial Pro HydroMax AW-68 Hydraulic Oil', unit: 'Drum 210L', qty: 3, rate: 31000 }
      ],
      createdDaysAgo: 1
    },
    {
      num: 'ORD-10173', vendor: 'VND-2001', sales: rahulId, company: companyBId,
      status: 'NEW', prodStatus: 'NOT_ASSIGNED', dispStatus: 'NOT_DISPATCHED', delStatus: 'PENDING', payStatus: 'ADVANCE_RECEIVED',
      terms: 'Advance', advance: 50000, reqDate: '2026-10-09',
      items: [
        { sku: 'IP-IND-VG220', name: 'TorqueTech Industrial Gear Oil ISO VG 220', unit: 'Drum 210L', qty: 2, rate: 43500 },
        { sku: 'IP-CUT-BIOSOL', name: 'Industrial Pro CutMax BioSol Coolant', unit: 'Drum 210L', qty: 1, rate: 33000 }
      ],
      createdDaysAgo: 1
    },

    // --- 2. ACCEPTED ORDERS (Waiting for Admin to Assign to Production) ---
    {
      num: 'ORD-10168', vendor: 'VND-1004', sales: akashId, company: companyAId,
      status: 'ACCEPTED', prodStatus: 'NOT_ASSIGNED', dispStatus: 'NOT_DISPATCHED', delStatus: 'PENDING', payStatus: 'UNPAID',
      terms: 'Credit 30 Days', advance: 0, reqDate: '2026-10-04',
      items: [
        { sku: 'TT-85W140-GL5', name: 'TorqueTech HD 85W-140 Axle Lube GL-5', unit: 'Drum 210L', qty: 4, rate: 39000 },
        { sku: 'AL-MOLY-EP2', name: 'AeroLube Moly Heavy Impact Grease NLGI-2', unit: 'Bucket 18kg', qty: 8, rate: 6300 }
      ],
      createdDaysAgo: 2
    },
    {
      num: 'ORD-10169', vendor: 'VND-2002', sales: rahulId, company: companyBId,
      status: 'ACCEPTED', prodStatus: 'NOT_ASSIGNED', dispStatus: 'NOT_DISPATCHED', delStatus: 'PENDING', payStatus: 'ADVANCE_RECEIVED',
      terms: 'Partial Payment', advance: 30000, reqDate: '2026-10-05',
      items: [
        { sku: 'PL-10W40-SYN', name: 'PowerLube Maxima 10W-40 Synthetic Blend', unit: 'Drum 210L', qty: 2, rate: 41000 }
      ],
      createdDaysAgo: 2
    },

    // --- 3. PROCESSING / PRODUCTION (Assigned, In Production, Partially Produced) ---
    {
      num: 'ORD-10165', vendor: 'VND-1005', sales: akashId, company: companyAId,
      status: 'PROCESSING', prodStatus: 'ASSIGNED', dispStatus: 'NOT_DISPATCHED', delStatus: 'PENDING', payStatus: 'UNPAID',
      terms: 'Credit 30 Days', advance: 0, reqDate: '2026-10-03',
      items: [
        { sku: 'IP-HYD-AW46', name: 'Industrial Pro HydroMax AW-46 Hydraulic Oil', unit: 'Drum 210L', qty: 5, rate: 30800 }
      ],
      createdDaysAgo: 3
    },
    {
      num: 'ORD-10166', vendor: 'VND-2003', sales: rahulId, company: companyBId,
      status: 'PROCESSING', prodStatus: 'IN_PRODUCTION', dispStatus: 'NOT_DISPATCHED', delStatus: 'PENDING', payStatus: 'ADVANCE_RECEIVED',
      terms: 'Partial Payment', advance: 40000, reqDate: '2026-10-04',
      items: [
        { sku: 'UD-5W30-SYN', name: 'UltraDrive SynthaTec 5W-30 Full Synthetic', unit: 'Carton (4x4L)', qty: 15, rate: 6700 },
        { sku: 'UD-BF-DOT4', name: 'UltraDrive DOT 4 High Boiling Brake Fluid', unit: 'Carton (24x250ml)', qty: 10, rate: 2850 }
      ],
      prodLog: [
        { itemIdx: 0, batch: 'BTH-2026-0901', qty: 8, notes: 'Blending completed for batch 1' }
      ],
      createdDaysAgo: 4
    },
    {
      num: 'ORD-10167', vendor: 'VND-1006', sales: akashId, company: companyAId,
      status: 'PROCESSING', prodStatus: 'PARTIALLY_PRODUCED', dispStatus: 'NOT_DISPATCHED', delStatus: 'PENDING', payStatus: 'UNPAID',
      terms: 'Cash on Delivery', advance: 0, reqDate: '2026-10-02',
      items: [
        { sku: 'LBM-15W40-20L', name: 'LubriMax Fleet Master 15W-40 CI-4 (20L)', unit: 'Bucket 20L', qty: 20, rate: 4150 }
      ],
      prodLog: [
        { itemIdx: 0, batch: 'BTH-2026-0888', qty: 12, notes: '12 buckets filled and sealed' }
      ],
      createdDaysAgo: 4
    },

    // --- 4. READY FOR DISPATCH (Production Completed, Waiting for Logistics) ---
    {
      num: 'ORD-10162', vendor: 'VND-1007', sales: akashId, company: companyAId,
      status: 'READY_FOR_DISPATCH', prodStatus: 'PRODUCTION_COMPLETED', dispStatus: 'NOT_DISPATCHED', delStatus: 'PENDING', payStatus: 'UNPAID',
      terms: 'Credit 30 Days', advance: 0, reqDate: '2026-10-01',
      items: [
        { sku: 'IP-HYD-AW68', name: 'Industrial Pro HydroMax AW-68 Hydraulic Oil', unit: 'Drum 210L', qty: 4, rate: 31200, prodQty: 4 }
      ],
      prodLog: [
        { itemIdx: 0, batch: 'BTH-2026-0870', qty: 4, notes: 'QC approved. Drums stenciled and palletized' }
      ],
      createdDaysAgo: 5
    },
    {
      num: 'ORD-10163', vendor: 'VND-2004', sales: rahulId, company: companyBId,
      status: 'READY_FOR_DISPATCH', prodStatus: 'PRODUCTION_COMPLETED', dispStatus: 'NOT_DISPATCHED', delStatus: 'PENDING', payStatus: 'ADVANCE_RECEIVED',
      terms: 'Partial Payment', advance: 35000, reqDate: '2026-10-02',
      items: [
        { sku: 'TT-IND-VG320', name: 'TorqueTech Industrial Gear Oil ISO VG 320', unit: 'Drum 210L', qty: 2, rate: 46000, prodQty: 2 },
        { sku: 'AL-GREASE-EP2', name: 'AeroLube Lithium Complex EP-2 Blue Grease', unit: 'Bucket 18kg', qty: 5, rate: 5800, prodQty: 5 }
      ],
      prodLog: [
        { itemIdx: 0, batch: 'BTH-2026-0865', qty: 2, notes: 'Gear oil viscosity tested OK' },
        { itemIdx: 1, batch: 'BTH-2026-0866', qty: 5, notes: 'Grease cone penetration test passed' }
      ],
      createdDaysAgo: 5
    },

    // --- 5. OUT FOR DELIVERY (Dispatched / In Transit) ---
    {
      num: 'ORD-10160', vendor: 'VND-1008', sales: akashId, company: companyAId,
      status: 'OUT_FOR_DELIVERY', prodStatus: 'PRODUCTION_COMPLETED', dispStatus: 'FULLY_DISPATCHED', delStatus: 'OUT_FOR_DELIVERY', payStatus: 'UNPAID',
      terms: 'Cash on Delivery', advance: 0, reqDate: '2026-09-30',
      items: [
        { sku: 'LBM-20W50-CF4', name: 'LubriMax Turbo Gold 20W-50 API CF-4', unit: 'Drum 210L', qty: 3, rate: 34500, prodQty: 3, dispQty: 3 }
      ],
      dispatches: [
        { num: 'DSP-8001', transporter: 'VRL Logistics', vehicle: 'MH-12-RN-4820', lr: 'LR-992381', driver: 'Kailash Yadav', driverPhone: '+91 97110 44551', qty: 3 }
      ],
      createdDaysAgo: 6
    },
    {
      num: 'ORD-10161', vendor: 'VND-2005', sales: rahulId, company: companyBId,
      status: 'OUT_FOR_DELIVERY', prodStatus: 'PRODUCTION_COMPLETED', dispStatus: 'FULLY_DISPATCHED', delStatus: 'OUT_FOR_DELIVERY', payStatus: 'PARTIALLY_PAID',
      terms: 'Partial Payment', advance: 45000, reqDate: '2026-10-01',
      items: [
        { sku: 'IP-COMP-46', name: 'Industrial Pro CompressoMax 46 Screw Lube', unit: 'Drum 210L', qty: 2, rate: 51500, prodQty: 2, dispQty: 2 }
      ],
      dispatches: [
        { num: 'DSP-8002', transporter: 'TCI Freight', vehicle: 'GJ-01-AX-9912', lr: 'TCI-665120', driver: 'Mahesh Solanki', driverPhone: '+91 98250 88992', qty: 2 }
      ],
      createdDaysAgo: 7
    },

    // --- 6. DELIVERED BUT PAYMENT PENDING (Cannot be completed yet! Rule testable!) ---
    {
      num: 'ORD-10155', vendor: 'VND-1001', sales: akashId, company: companyAId,
      status: 'DELIVERED', prodStatus: 'PRODUCTION_COMPLETED', dispStatus: 'FULLY_DISPATCHED', delStatus: 'DELIVERED', payStatus: 'PARTIALLY_PAID',
      terms: 'Partial Payment', advance: 40000, reqDate: '2026-09-25',
      items: [
        { sku: 'LBM-15W40-CI4', name: 'LubriMax Fleet Master 15W-40 CI-4', unit: 'Drum 210L', qty: 2, rate: 38500, prodQty: 2, dispQty: 2, delQty: 2 },
        { sku: 'AL-GREASE-EP2', name: 'AeroLube Lithium Complex EP-2 Blue Grease', unit: 'Bucket 18kg', qty: 4, rate: 5800, prodQty: 4, dispQty: 4, delQty: 4 }
      ],
      dispatches: [
        { num: 'DSP-7990', transporter: 'SafeXpress Cargo', vehicle: 'MH-14-BT-3321', lr: 'SX-881290', driver: 'Govind Rao', driverPhone: '+91 98221 44556', qty: 6 }
      ],
      deliveries: [
        { dispNum: 'DSP-7990', date: '2026-09-27', qty: 6, receiver: 'Ramesh Agrawal (Store Manager)', receiverPhone: '+91 98220 12345', notes: 'All drums & buckets received in intact condition' }
      ],
      createdDaysAgo: 10
    },
    {
      num: 'ORD-10156', vendor: 'VND-2006', sales: rahulId, company: companyBId,
      status: 'DELIVERED', prodStatus: 'PRODUCTION_COMPLETED', dispStatus: 'FULLY_DISPATCHED', delStatus: 'DELIVERED', payStatus: 'UNPAID',
      terms: 'Credit 30 Days', advance: 0, reqDate: '2026-09-24',
      items: [
        { sku: 'IP-THERM-32', name: 'Industrial Pro ThermaHeat 32 Heat Transfer Oil', unit: 'Drum 210L', qty: 3, rate: 35800, prodQty: 3, dispQty: 3, delQty: 3 }
      ],
      dispatches: [
        { num: 'DSP-7991', transporter: 'ARC Transport', vehicle: 'GJ-16-CC-7711', lr: 'ARC-33901', driver: 'Jitendra Rathod', driverPhone: '+91 98251 11223', qty: 3 }
      ],
      deliveries: [
        { dispNum: 'DSP-7991', date: '2026-09-26', qty: 3, receiver: 'Paresh Mehta (Plant Head)', receiverPhone: '+91 98330 66778', notes: 'Unloaded at Boiler section' }
      ],
      createdDaysAgo: 12
    },

    // --- 7. PARTIALLY DISPATCHED / PARTIALLY DELIVERED ---
    {
      num: 'ORD-10150', vendor: 'VND-1002', sales: akashId, company: companyAId,
      status: 'PROCESSING', prodStatus: 'PRODUCTION_COMPLETED', dispStatus: 'PARTIALLY_DISPATCHED', delStatus: 'PARTIALLY_DELIVERED', payStatus: 'PARTIALLY_PAID',
      terms: 'Partial Payment', advance: 50000, reqDate: '2026-09-22',
      items: [
        { sku: 'LBM-15W40-CI4', name: 'LubriMax Fleet Master 15W-40 CI-4', unit: 'Drum 210L', qty: 5, rate: 38200, prodQty: 5, dispQty: 3, delQty: 3 }
      ],
      dispatches: [
        { num: 'DSP-7975', transporter: 'Gati-KWE', vehicle: 'MH-31-DF-5544', lr: 'GT-448120', driver: 'Babanrao Shinde', driverPhone: '+91 98230 77881', qty: 3 }
      ],
      deliveries: [
        { dispNum: 'DSP-7975', date: '2026-09-24', qty: 3, receiver: 'Balaji Natarajan', receiverPhone: '+91 98220 23456', notes: 'First batch of 3 drums received; balance 2 drums pending dispatch' }
      ],
      createdDaysAgo: 15
    },

    // --- 8. COMPLETED ORDERS (Delivered AND Fully Paid) ---
    {
      num: 'ORD-10140', vendor: 'VND-1003', sales: akashId, company: companyAId,
      status: 'COMPLETED', prodStatus: 'PRODUCTION_COMPLETED', dispStatus: 'FULLY_DISPATCHED', delStatus: 'DELIVERED', payStatus: 'FULLY_PAID',
      terms: 'Full Payment', advance: 0, fullPaid: true, reqDate: '2026-09-15',
      items: [
        { sku: 'IP-HYD-AW68', name: 'Industrial Pro HydroMax AW-68 Hydraulic Oil', unit: 'Drum 210L', qty: 2, rate: 31500, prodQty: 2, dispQty: 2, delQty: 2 }
      ],
      dispatches: [
        { num: 'DSP-7950', transporter: 'Navata Road Transport', vehicle: 'MH-15-EG-8822', lr: 'NV-223401', driver: 'Pravin Pawar', driverPhone: '+91 98222 33445', qty: 2 }
      ],
      deliveries: [
        { dispNum: 'DSP-7950', date: '2026-09-17', qty: 2, receiver: 'Suresh Kalyani', receiverPhone: '+91 98220 34567', notes: 'Delivered and acknowledged' }
      ],
      createdDaysAgo: 20
    },
    {
      num: 'ORD-10141', vendor: 'VND-2001', sales: rahulId, company: companyBId,
      status: 'COMPLETED', prodStatus: 'PRODUCTION_COMPLETED', dispStatus: 'FULLY_DISPATCHED', delStatus: 'DELIVERED', payStatus: 'FULLY_PAID',
      terms: 'Partial Payment', advance: 40000, fullPaid: true, reqDate: '2026-09-16',
      items: [
        { sku: 'TT-IND-VG220', name: 'TorqueTech Industrial Gear Oil ISO VG 220', unit: 'Drum 210L', qty: 3, rate: 43800, prodQty: 3, dispQty: 3, delQty: 3 }
      ],
      dispatches: [
        { num: 'DSP-7951', transporter: 'Patel Roadways', vehicle: 'GJ-03-BW-6633', lr: 'PR-992102', driver: 'Ramanbhai Gohil', driverPhone: '+91 98252 66778', qty: 3 }
      ],
      deliveries: [
        { dispNum: 'DSP-7951', date: '2026-09-18', qty: 3, receiver: 'Hasmukh Patel', receiverPhone: '+91 98330 11223', notes: 'Completed delivery and final payment cleared via RTGS' }
      ],
      createdDaysAgo: 22
    },

    // --- 9. CANCELLED ORDER ---
    {
      num: 'ORD-10135', vendor: 'VND-1004', sales: akashId, company: companyAId,
      status: 'CANCELLED', prodStatus: 'NOT_ASSIGNED', dispStatus: 'NOT_DISPATCHED', delStatus: 'PENDING', payStatus: 'UNPAID',
      terms: 'Credit 30 Days', advance: 0, reqDate: '2026-09-10',
      items: [
        { sku: 'TT-85W140-GL5', name: 'TorqueTech HD 85W-140 Axle Lube GL-5', unit: 'Drum 210L', qty: 5, rate: 39500 }
      ],
      cancelReason: 'Customer site project delayed by 6 months; requested formal cancellation before production commencement.',
      createdDaysAgo: 25
    }
  ];

  // Also add 42 more diverse historical orders (total 52) spanning past 90 days to populate charts, top vendors, top products, sales reports
  const allVendorCodes = Object.keys(vendorMap);
  const sampleProducts = products.slice(0, 15);
  const statusesPool: Array<'COMPLETED' | 'DELIVERED' | 'OUT_FOR_DELIVERY' | 'READY_FOR_DISPATCH' | 'PROCESSING' | 'ACCEPTED' | 'NEW'> = [
    'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'DELIVERED', 'COMPLETED', 'DELIVERED', 'READY_FOR_DISPATCH', 'PROCESSING', 'NEW'
  ];

  for (let i = 1; i <= 42; i++) {
    const ordNum = `ORD-${10000 + i}`;
    const vCode = allVendorCodes[i % allVendorCodes.length];
    const vendorRow = db.prepare('SELECT id, assigned_sales_person_id FROM vendors WHERE vendor_code = ?').get(vCode) as { id: number; assigned_sales_person_id: number };
    const p1 = sampleProducts[(i * 3) % sampleProducts.length];
    const p2 = sampleProducts[(i * 7) % sampleProducts.length];
    const compId = i % 2 === 0 ? companyAId : companyBId;
    const assignedStatus = statusesPool[i % statusesPool.length];

    const isCompleted = assignedStatus === 'COMPLETED';
    const isDelivered = assignedStatus === 'DELIVERED' || isCompleted;
    const isDispatched = assignedStatus === 'OUT_FOR_DELIVERY' || isDelivered;
    const isProdCompleted = assignedStatus === 'READY_FOR_DISPATCH' || isDispatched;

    const prodStatus = isProdCompleted ? 'PRODUCTION_COMPLETED' : (assignedStatus === 'PROCESSING' ? 'IN_PRODUCTION' : 'NOT_ASSIGNED');
    const dispStatus = isDispatched ? 'FULLY_DISPATCHED' : 'NOT_DISPATCHED';
    const delStatus = isDelivered ? 'DELIVERED' : (assignedStatus === 'OUT_FOR_DELIVERY' ? 'OUT_FOR_DELIVERY' : 'PENDING');
    const payStatus = isCompleted ? 'FULLY_PAID' : (isDelivered ? (i % 2 === 0 ? 'PARTIALLY_PAID' : 'UNPAID') : (i % 3 === 0 ? 'ADVANCE_RECEIVED' : 'UNPAID'));

    const qty1 = (i % 4) + 1;
    const qty2 = ((i + 1) % 3) + 1;

    orderConfigs.push({
      num: ordNum,
      vendor: vCode,
      sales: vendorRow.assigned_sales_person_id,
      company: compId,
      status: assignedStatus,
      prodStatus,
      dispStatus,
      delStatus,
      payStatus,
      terms: i % 2 === 0 ? 'Credit 30 Days' : 'Partial Payment',
      advance: payStatus === 'ADVANCE_RECEIVED' ? 20000 : 0,
      fullPaid: isCompleted,
      reqDate: `2026-0${Math.min(9, 7 + Math.floor(i / 15))}-${10 + (i % 18)}`,
      items: [
        { sku: p1.sku, name: p1.name, unit: p1.unit, qty: qty1, rate: p1.rate, prodQty: isProdCompleted ? qty1 : 0, dispQty: isDispatched ? qty1 : 0, delQty: isDelivered ? qty1 : 0 },
        { sku: p2.sku, name: p2.name, unit: p2.unit, qty: qty2, rate: p2.rate, prodQty: isProdCompleted ? qty2 : 0, dispQty: isDispatched ? qty2 : 0, delQty: isDelivered ? qty2 : 0 }
      ],
      createdDaysAgo: 10 + i * 2,
      dispatches: isDispatched ? [
        { num: `DSP-${7000 + i}`, transporter: i % 2 === 0 ? 'VRL Logistics' : 'TCI Freight', vehicle: `MH-${12 + (i % 20)}-AB-${1000 + i}`, lr: `LR-${50000 + i}`, driver: 'Raju Driver', driverPhone: '+91 98000 11223', qty: qty1 + qty2 }
      ] : undefined,
      deliveries: isDelivered ? [
        { dispNum: `DSP-${7000 + i}`, date: `2026-08-${10 + (i % 15)}`, qty: qty1 + qty2, receiver: 'Warehouse Manager', receiverPhone: '+91 98000 99887', notes: 'Material received and checked' }
      ] : undefined
    });
  }

  // Insert all orders and their relational sub-records
  let paymentCounter = 100;
  for (const cfg of orderConfigs) {
    const vId = vendorMap[cfg.vendor];
    if (!vId) continue;

    let subtotal = 0;
    for (const it of cfg.items) {
      subtotal += it.qty * it.rate;
    }
    const taxRate = 18.0;
    const taxAmount = (subtotal * taxRate) / 100;
    const grandTotal = subtotal + taxAmount;

    let amountReceived = 0;
    if (cfg.fullPaid) {
      amountReceived = grandTotal;
    } else if (cfg.advance) {
      amountReceived = cfg.advance;
    } else if (cfg.payStatus === 'PARTIALLY_PAID') {
      amountReceived = Math.round(grandTotal * 0.5);
    }
    const pendingAmount = Math.max(0, grandTotal - amountReceived);

    const createdDate = new Date(Date.now() - (cfg.createdDaysAgo || 1) * 86400000);
    const dateStr = createdDate.toISOString().replace('T', ' ').slice(0, 19);

    const vendorRow = db.prepare('SELECT delivery_address, contact_person, mobile FROM vendors WHERE id = ?').get(vId) as { delivery_address: string; contact_person: string; mobile: string };

    const orderRes = insertOrderStmt.run(
      cfg.num, cfg.company, vId, cfg.sales, cfg.status,
      cfg.prodStatus, cfg.dispStatus, cfg.delStatus, cfg.payStatus,
      cfg.terms, subtotal, 0, taxRate, taxAmount, grandTotal,
      amountReceived, pendingAmount, cfg.reqDate,
      vendorRow.delivery_address, vendorRow.contact_person, vendorRow.mobile, 'Fragile - Keep Drums Upright. Use Hydraulic Lift.',
      cfg.cancelReason || null, cfg.cancelReason ? adminId : null, cfg.cancelReason ? dateStr : null,
      cfg.prodStatus !== 'NOT_ASSIGNED' ? dateStr : null,
      cfg.prodStatus === 'PRODUCTION_COMPLETED' ? dateStr : null,
      cfg.dispStatus !== 'NOT_DISPATCHED' ? dateStr : null,
      cfg.delStatus === 'DELIVERED' ? dateStr : null,
      cfg.status === 'COMPLETED' ? dateStr : null,
      cfg.status === 'COMPLETED' ? adminId : null,
      cfg.sales, dateStr, dateStr
    );

    const orderId = orderRes.lastInsertRowid as number;

    // Items
    const insertedItemIds: number[] = [];
    for (const it of cfg.items) {
      const prodObj = productMap[it.sku];
      const prodId = prodObj ? prodObj.id : 1;
      const lineAmt = it.qty * it.rate;
      const itemRes = insertOrderItemStmt.run(
        orderId, prodId, it.sku, it.name, it.unit, it.qty,
        it.prodQty || 0, it.dispQty || 0, it.delQty || 0, it.rate, lineAmt, 'Standard factory packing'
      );
      insertedItemIds.push(itemRes.lastInsertRowid as number);
    }

    // Status history
    insertHistoryStmt.run(orderId, 'Order Created', null, 'NEW', 'Sales Person submitted order', cfg.sales, dateStr);
    if (cfg.status !== 'NEW') {
      insertHistoryStmt.run(orderId, 'Order Accepted', 'NEW', 'ACCEPTED', 'Approved by Operations Admin', adminId, dateStr);
    }
    if (cfg.prodStatus !== 'NOT_ASSIGNED') {
      insertHistoryStmt.run(orderId, 'Production Assigned', 'ACCEPTED', 'PROCESSING', 'Assigned to Plant Formulation Team', adminId, dateStr);
    }
    if (cfg.prodStatus === 'PRODUCTION_COMPLETED') {
      insertHistoryStmt.run(orderId, 'Production Completed', 'PROCESSING', 'READY_FOR_DISPATCH', 'Batch production and QC testing finished', prodUserId, dateStr);
    }
    if (cfg.dispStatus !== 'NOT_DISPATCHED') {
      insertHistoryStmt.run(orderId, 'Dispatched', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'Consignment loaded on transport vehicle', dispatchUserId, dateStr);
    }
    if (cfg.delStatus === 'DELIVERED') {
      insertHistoryStmt.run(orderId, 'Delivered', 'OUT_FOR_DELIVERY', 'DELIVERED', 'Customer received and signed proof of delivery', dispatchUserId, dateStr);
    }
    if (cfg.status === 'COMPLETED') {
      insertHistoryStmt.run(orderId, 'Order Completed', 'DELIVERED', 'COMPLETED', 'Delivery confirmed and full invoice payment reconciled', adminId, dateStr);
    }
    if (cfg.status === 'CANCELLED') {
      insertHistoryStmt.run(orderId, 'Order Cancelled', 'NEW', 'CANCELLED', cfg.cancelReason || 'Cancelled upon request', adminId, dateStr);
    }

    // Production records if applicable
    if (cfg.prodLog) {
      for (const pl of cfg.prodLog) {
        const itemId = insertedItemIds[pl.itemIdx] || insertedItemIds[0];
        insertProdRecordStmt.run(orderId, itemId, pl.batch, pl.qty, dateStr.slice(0, 10), 'Vikram Patel', pl.notes, prodUserId, dateStr);
      }
    } else if (cfg.prodStatus === 'PRODUCTION_COMPLETED') {
      for (let idx = 0; idx < cfg.items.length; idx++) {
        const it = cfg.items[idx];
        const itemId = insertedItemIds[idx];
        insertProdRecordStmt.run(orderId, itemId, `BTH-AUTO-${orderId}-${idx + 1}`, it.qty, dateStr.slice(0, 10), 'Vikram Patel', 'Batch formulation compliant with ISO specifications', prodUserId, dateStr);
      }
    }

    // Dispatches & Deliveries
    if (cfg.dispatches) {
      for (const d of cfg.dispatches) {
        const dispRes = insertDispatchStmt.run(
          d.num, orderId, dateStr.slice(0, 10), d.transporter, '+91 22 2844 9900', d.vehicle, d.lr, `TRK-${d.lr}`, d.driver, d.driverPhone, d.qty, 'Handling precautions noted', dispatchUserId, dateStr
        );
        const dispatchId = dispRes.lastInsertRowid as number;
        for (const itemId of insertedItemIds) {
          insertDispatchItemStmt.run(dispatchId, itemId, d.qty / insertedItemIds.length);
        }

        // Deliveries
        if (cfg.deliveries) {
          for (const del of cfg.deliveries) {
            const delRes = insertDeliveryStmt.run(
              orderId, dispatchId, del.date, del.qty, del.receiver, del.receiverPhone, 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80', del.notes, dispatchUserId, dateStr
            );
            const delId = delRes.lastInsertRowid as number;
            for (const itemId of insertedItemIds) {
              insertDeliveryItemStmt.run(delId, itemId, del.qty / insertedItemIds.length);
            }
          }
        }
      }
    }

    // Payments (over 100 payments across orders!)
    if (amountReceived > 0) {
      paymentCounter++;
      const pNum1 = `PAY-${paymentCounter}`;
      const isFull = cfg.fullPaid;
      const initialAmt = isFull && amountReceived > 50000 ? Math.round(amountReceived * 0.4) : amountReceived;

      insertPaymentStmt.run(
        pNum1, orderId, initialAmt, dateStr.slice(0, 10),
        initialAmt > 30000 ? 'NEFT/RTGS' : (initialAmt > 10000 ? 'UPI' : 'Cheque'),
        `REF-TXN-${paymentCounter}492`,
        'Payment received against order advance/invoice',
        1, cfg.sales, accountsUserId, dateStr, dateStr
      );

      if (isFull && initialAmt < amountReceived) {
        paymentCounter++;
        const pNum2 = `PAY-${paymentCounter}`;
        const secondAmt = amountReceived - initialAmt;
        insertPaymentStmt.run(
          pNum2, orderId, secondAmt, dateStr.slice(0, 10),
          'Bank Transfer',
          `REF-TXN-${paymentCounter}781`,
          'Balance final settlement received upon delivery',
          1, accountsUserId, accountsUserId, dateStr, dateStr
        );
      }
    }

    // Activity log
    insertActivityStmt.run(
      cfg.sales, 'ORDER_CREATED', 'order', cfg.num,
      `Sales Person created order ${cfg.num} with total value ₹${grandTotal.toLocaleString('en-IN')}`,
      dateStr
    );
  }

  // 11. Initial In-app Notifications
  insertNotificationStmt.run(akashId, 'sales_person', 'New Order Placed', 'Order ORD-10170 has been submitted for Admin approval', 'info', 1, 0, new Date().toISOString());
  insertNotificationStmt.run(adminId, 'admin', 'Approval Required', 'Order ORD-10170 is waiting for review and approval', 'warning', 1, 0, new Date().toISOString());
  insertNotificationStmt.run(prodUserId, 'production_team', 'New Production Job', 'Order ORD-10165 assigned to plant for formulation', 'info', 7, 0, new Date().toISOString());
  insertNotificationStmt.run(dispatchUserId, 'dispatch_team', 'Ready for Dispatch', 'Order ORD-10162 production completed. Ready for vehicle assignment.', 'success', 10, 0, new Date().toISOString());
  insertNotificationStmt.run(accountsUserId, 'accounts', 'Payment Verification Needed', 'Advance payment for ORD-10171 received via UPI', 'info', 2, 0, new Date().toISOString());

  // 12. Settings
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('tax_gst_percentage', '18');
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('default_credit_days', '30');
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('app_name', 'PetroFlow Lubricant ERP');

  console.log(`Database seeded successfully! Orders: ${orderConfigs.length}, Payments: ${paymentCounter - 100}, Vendors: ${vendors.length}, Products: ${products.length}`);
}
