import express from 'express';
import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from './db.ts';
import { authMiddleware, generateToken, requirePermission, type AuthRequest } from './auth.ts';
import { seedDatabase } from './seed.ts';

export const apiRouter = express.Router();

// Helper to log activities
function logActivity(userId: number | null, action: string, entityType: string, entityId: string, description: string) {
  try {
    db.prepare(`
      INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, action, entityType, entityId, description);
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}

// Helper to notify
function sendNotification(userId: number | null, roleSlug: string | null, title: string, message: string, type: string = 'info', orderId: number | null = null) {
  try {
    db.prepare(`
      INSERT INTO notifications (user_id, role_slug, title, message, type, order_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, roleSlug, title, message, type, orderId);
  } catch (err) {
    console.error('Failed to send notification:', err);
  }
}

// -------------------------------------------------------------
// AUTH ROUTES
// -------------------------------------------------------------

apiRouter.get('/auth/demo-users', (_req, res) => {
  const users = [
    { role: 'Super Admin', email: 'superadmin@lubricantdemo.com', name: 'Siddharth Oberoi', badge: 'Full Access', color: 'indigo' },
    { role: 'Admin', email: 'admin@lubricantdemo.com', name: 'Rajesh Mehra', badge: 'Operations Manager', color: 'blue' },
    { role: 'Accounts', email: 'accounts@lubricantdemo.com', name: 'Kavita Sundaram', badge: 'Finance & Payments', color: 'emerald' },
    { role: 'Sales Person', email: 'akash@lubricantdemo.com', name: 'Akash Singh (Sales)', badge: 'West Region Lead', color: 'amber' },
    { role: 'Sales Person', email: 'rahul@lubricantdemo.com', name: 'Rahul Sharma (Sales)', badge: 'Gujarat Region Lead', color: 'amber' },
    { role: 'Production Team', email: 'production@lubricantdemo.com', name: 'Vikram Patel', badge: 'Plant Formulation Lead', color: 'purple' },
    { role: 'Dispatch Team', email: 'dispatch@lubricantdemo.com', name: 'Sunil Sharma', badge: 'Logistics & Fleet Coord.', color: 'cyan' },
  ];
  res.json({ users, defaultPassword: 'See card hint' });
});

apiRouter.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare(`
    SELECT u.*, r.name as role_name, r.slug as role_slug
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE LOWER(u.email) = LOWER(?) AND u.status = 'active'
  `).get(email.trim()) as any;

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or inactive user account' });
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  const token = generateToken(user.id);
  res.cookie('token', token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  });

  const perms = db.prepare(`
    SELECT p.code FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = ?
  `).all(user.role_id) as { code: string }[];

  logActivity(user.id, 'LOGIN', 'auth', user.id.toString(), `${user.name} logged into the system`);

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role_id: user.role_id,
      role_name: user.role_name,
      role_slug: user.role_slug,
      mobile: user.mobile,
      employee_id: user.employee_id,
      avatar_url: user.avatar_url,
      permissions: perms.map(p => p.code)
    }
  });
});

apiRouter.get('/auth/me', authMiddleware, (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

apiRouter.post('/auth/logout', (req: AuthRequest, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// -------------------------------------------------------------
// DASHBOARD STATS (Role-based metrics)
// -------------------------------------------------------------

apiRouter.get('/dashboard/stats', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const roleSlug = user.role_slug || '';
  const isSuperAdmin = roleSlug === 'super_admin';
  const isAdmin = roleSlug === 'admin' || isSuperAdmin;
  const isSalesPerson = roleSlug === 'sales_person';
  const isPacking = roleSlug === 'packing_team' || roleSlug === 'production_team' || roleSlug === 'dispatch_team';
  const isAccounts = roleSlug === 'accounts';

  // Common filters from query
  const { startDate, endDate, date_from, date_to, sales_person_id, vendor_id, order_status } = req.query;
  const sDate = (startDate || date_from) as string | undefined;
  const eDate = (endDate || date_to) as string | undefined;

  const todayStr = new Date().toISOString().slice(0, 10);
  const thisMonthStr = todayStr.slice(0, 7);

  // -------------------------------------------------------------
  // 1. SALES PERSON DASHBOARD (STRICT DATA ISOLATION)
  // -------------------------------------------------------------
  if (isSalesPerson || (!isAdmin && !isPacking && !isAccounts && user.permissions.includes('orders:view_own'))) {
    // STRICT DATA ISOLATION: force sales_person_id to the logged-in user ID
    // Even if an attacker or user modifies the URL / query parameter, it is completely ignored!
    const mySalesPersonId = user.id;
    const canViewPayments = isSuperAdmin || user.permissions.includes('payments:view');

    let orderWhere = 'WHERE o.sales_person_id = ?';
    const orderParams: any[] = [mySalesPersonId];
    if (sDate) { orderWhere += ' AND DATE(o.created_at) >= ?'; orderParams.push(sDate); }
    if (eDate) { orderWhere += ' AND DATE(o.created_at) <= ?'; orderParams.push(eDate); }

    // Status counts for own orders
    const statusCounts = db.prepare(`
      SELECT o.order_status, COUNT(*) as count, SUM(o.grand_total) as total_val,
             SUM(o.amount_received) as received_val, SUM(o.pending_amount) as pending_val
      FROM orders o
      ${orderWhere}
      GROUP BY o.order_status
    `).all(...orderParams) as any[];

    const countsMap: Record<string, number> = {};
    let myTotalOrders = 0;
    let myTotalSalesValue = 0;
    let myVerifiedReceived = 0;
    let myPendingPayment = 0;

    for (const row of statusCounts) {
      countsMap[row.order_status] = row.count;
      myTotalOrders += row.count;
      if (row.order_status !== 'CANCELLED') {
        myTotalSalesValue += row.total_val || 0;
        myVerifiedReceived += row.received_val || 0;
        myPendingPayment += row.pending_val || 0;
      }
    }

    // Orders in Packing (PROCESSING, packed but not delivered, or in packing)
    const myNewOrders = countsMap['NEW'] || 0;
    const myApprovedOrders = countsMap['ACCEPTED'] || 0;
    const myDeliveredOrders = (countsMap['DELIVERED'] || 0) + (countsMap['COMPLETED'] || 0);
    const myCancelledOrders = countsMap['CANCELLED'] || 0;
    // Packed but not delivered orders count under Packing
    const myOrdersInPacking = Math.max(0, myTotalOrders - myNewOrders - myApprovedOrders - myDeliveredOrders - myCancelledOrders);

    // My Assigned Vendors count
    const vendorCount = db.prepare(`
      SELECT COUNT(*) as count FROM vendors WHERE assigned_sales_person_id = ?
    `).get(mySalesPersonId) as { count: number };

    // Chart: My Monthly / Daily Sales
    const isShort = sDate && eDate && (new Date(eDate).getTime() - new Date(sDate).getTime() <= 31 * 86400000);
    const dateGroup = isShort ? "DATE(o.created_at)" : "strftime('%Y-%m', o.created_at)";
    const monthlyData = db.prepare(`
      SELECT ${dateGroup} as month,
             COUNT(*) as orders_count,
             SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.grand_total ELSE 0 END) as total_sales,
             SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.amount_received ELSE 0 END) as total_received
      FROM orders o
      ${orderWhere}
      GROUP BY ${dateGroup}
      ORDER BY month ASC
    `).all(...orderParams);

    // Chart: My Top Products
    const topProducts = db.prepare(`
      SELECT oi.product_name, oi.sku, p.image_url as product_image,
             SUM(oi.quantity) as total_qty, SUM(oi.line_amount) as total_amount
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      ${orderWhere} AND o.order_status != 'CANCELLED'
      GROUP BY oi.product_id, oi.sku
      ORDER BY total_amount DESC
      LIMIT 5
    `).all(...orderParams);

    // Chart: My Top Vendors
    const topVendors = db.prepare(`
      SELECT v.id, v.company_name, v.city, COUNT(o.id) as order_count,
             SUM(o.grand_total) as total_spent, SUM(o.pending_amount) as pending
      FROM vendors v
      JOIN orders o ON v.id = o.vendor_id
      ${orderWhere} AND o.order_status != 'CANCELLED'
      GROUP BY v.id
      ORDER BY total_spent DESC
      LIMIT 5
    `).all(...orderParams);

    // Recent orders owned by this Sales Person
    const recentOrdersRaw = db.prepare(`
      SELECT o.id, o.order_number, o.order_status, o.grand_total, o.amount_received, o.pending_amount,
             o.created_at, o.required_delivery_date, o.packing_status, o.dispatch_status, o.delivery_status,
             v.company_name as vendor_name, u.name as sales_person_name, c.name as company_name
      FROM orders o
      JOIN vendors v ON o.vendor_id = v.id
      JOIN users u ON o.sales_person_id = u.id
      JOIN companies c ON o.company_id = c.id
      ${orderWhere}
      ORDER BY o.id DESC
      LIMIT 10
    `).all(...orderParams);

    const recentOrders = recentOrdersRaw.map((o: any) => {
      const items = db.prepare(`
        SELECT oi.*, p.name as product_name, p.sku, p.image_url as product_image, p.unit
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `).all(o.id);
      return { ...o, items };
    });

    return res.json({
      roleType: 'sales_person',
      canViewPayments,
      cards: {
        myTotalOrders,
        myNewOrders,
        myApprovedOrders,
        myOrdersInPacking,
        myDeliveredOrders,
        myCancelledOrders,
        myTotalSalesValue: canViewPayments ? myTotalSalesValue : null,
        myVerifiedPaymentReceived: canViewPayments ? myVerifiedReceived : null,
        myBalancePayment: canViewPayments ? myPendingPayment : null,
        myPendingPayment: canViewPayments ? myPendingPayment : null,
        myParties: vendorCount.count || 0,
        myVendors: vendorCount.count || 0
      },
      charts: {
        myMonthlySales: canViewPayments ? monthlyData : monthlyData.map((m: any) => ({ ...m, total_sales: 0, total_received: 0 })),
        myOrdersByStatus: [
          { status: 'NEW', label: 'New', count: myNewOrders, color: '#3b82f6' },
          { status: 'ACCEPTED', label: 'Approved', count: myApprovedOrders, color: '#6366f1' },
          { status: 'PROCESSING', label: 'Packing', count: myOrdersInPacking, color: '#f59e0b' },
          { status: 'DELIVERED', label: 'Delivered', count: myDeliveredOrders, color: '#10b981' },
          { status: 'CANCELLED', label: 'Cancelled', count: myCancelledOrders, color: '#ef4444' },
        ],
        myPaymentReceivedVsPending: canViewPayments ? {
          received: myVerifiedReceived,
          pending: myPendingPayment,
          total: myTotalSalesValue
        } : null,
        myTopProducts: topProducts,
        myTopVendors: topVendors
      },
      recentOrders
    });
  }

  // -------------------------------------------------------------
  // 2. PACKING TEAM DASHBOARD
  // -------------------------------------------------------------
  if (isPacking || (!isAdmin && !isAccounts && user.permissions.includes('packing:view'))) {
    // STRICT DATA ISOLATION: Absolutely NO company total sales, sales person revenue, company financial data, or payment collections
    let where = "WHERE o.order_status != 'CANCELLED'";
    const params: any[] = [];
    if (sDate) { where += ' AND DATE(o.created_at) >= ?'; params.push(sDate); }
    if (eDate) { where += ' AND DATE(o.created_at) <= ?'; params.push(eDate); }
    if (sales_person_id && sales_person_id !== 'ALL') {
      where += ' AND o.sales_person_id = ?';
      params.push(Number(sales_person_id));
    }
    if (vendor_id && vendor_id !== 'ALL') {
      where += ' AND o.vendor_id = ?';
      params.push(Number(vendor_id));
    }

    const pendingPacking = db.prepare(`
      SELECT COUNT(*) as count FROM orders o
      ${where} AND (o.packing_status = 'PENDING_PACKING' OR (o.packing_status IS NULL AND o.order_status IN ('ACCEPTED', 'PROCESSING')))
        AND o.order_status NOT IN ('READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED')
    `).get(...params) as { count: number };

    const packingInProgress = db.prepare(`
      SELECT COUNT(*) as count FROM orders o
      ${where} AND (o.packing_status = 'IN_PROGRESS' OR o.production_status = 'IN_PRODUCTION')
        AND o.order_status NOT IN ('READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED')
    `).get(...params) as { count: number };

    const packedOrders = db.prepare(`
      SELECT COUNT(*) as count FROM orders o
      ${where} AND (o.packing_status = 'PACKED' OR o.production_status = 'PRODUCTION_COMPLETED')
    `).get(...params) as { count: number };

    const deliveredOrders = db.prepare(`
      SELECT COUNT(*) as count FROM orders o
      ${where} AND (o.order_status = 'DELIVERED' OR o.delivery_status = 'DELIVERED')
    `).get(...params) as { count: number };

    const todayDeliveredOrders = db.prepare(`
      SELECT COUNT(*) as count FROM orders o
      WHERE DATE(o.delivered_at) = ? AND (o.order_status = 'DELIVERED' OR o.delivery_status = 'DELIVERED')
    `).get(todayStr) as { count: number };

    const ordersOnHold = db.prepare(`
      SELECT COUNT(*) as count FROM orders o
      ${where} AND (o.packing_status = 'ON_HOLD' OR o.packing_notes LIKE '%HOLD%')
    `).get(...params) as { count: number };

    const todayPacking = db.prepare(`
      SELECT COUNT(*) as count FROM orders o
      WHERE DATE(o.updated_at) = ? AND o.packing_status IN ('PACKED', 'IN_PROGRESS', 'HANDED_OVER')
    `).get(todayStr) as { count: number };

    const totalItemsToPack = db.prepare(`
      SELECT COALESCE(SUM(oi.quantity), 0) as totalQty
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      ${where} AND o.packing_status IN ('PENDING_PACKING', 'IN_PROGRESS')
        AND o.order_status NOT IN ('READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED')
    `).get(...params) as { totalQty: number };

    // Packing assigned queue with items, images, quantities, vendor, sales person, required date
    const packingQueueRaw = db.prepare(`
      SELECT o.id, o.order_number, o.order_status, o.packing_status, o.packing_notes,
             o.required_delivery_date, o.created_at, o.updated_at,
             v.company_name as vendor_name, v.city as vendor_city,
             u.name as sales_person_name
      FROM orders o
      JOIN vendors v ON o.vendor_id = v.id
      JOIN users u ON o.sales_person_id = u.id
      ${where} AND o.order_status NOT IN ('CANCELLED')
      ORDER BY
        CASE
          WHEN o.packing_status = 'IN_PROGRESS' THEN 1
          WHEN o.packing_status = 'PENDING_PACKING' THEN 2
          WHEN o.packing_status = 'ON_HOLD' THEN 3
          WHEN o.packing_status = 'PACKED' THEN 4
          ELSE 5
        END ASC,
        o.required_delivery_date ASC,
        o.id DESC
      LIMIT 25
    `).all(...params);

    const packingQueue = packingQueueRaw.map((o: any) => {
      const items = db.prepare(`
        SELECT oi.id, oi.sku, oi.product_name, oi.unit, oi.quantity, oi.produced_quantity, oi.item_availability,
               p.image_url as product_image
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `).all(o.id);
      return { ...o, items };
    });

    const salesPersons = db.prepare("SELECT id, name FROM users WHERE role_id IN (SELECT id FROM roles WHERE slug = 'sales_person') ORDER BY name ASC").all();
    const vendors = db.prepare("SELECT id, company_name as name FROM vendors ORDER BY company_name ASC").all();

    return res.json({
      roleType: 'packing_team',
      cards: {
        pendingPacking: pendingPacking.count || 0,
        packingInProgress: packingInProgress.count || 0,
        packedOrders: packedOrders.count || 0,
        deliveredOrders: deliveredOrders.count || 0,
        todayPacking: todayPacking.count || 0,
        todayDeliveredOrders: todayDeliveredOrders.count || 0,
        totalItemsToPack: totalItemsToPack.totalQty || 0,
        ordersOnHold: ordersOnHold.count || 0,
        completedPacking: packedOrders.count || 0
      },
      packingQueue,
      filterOptions: {
        salesPersons,
        vendors,
        parties: vendors
      }
    });
  }

  // -------------------------------------------------------------
  // 3. ACCOUNTS TEAM DASHBOARD
  // -------------------------------------------------------------
  if (isAccounts || (!isAdmin && (user.permissions.includes('payments:verify') || user.permissions.includes('payments:view')))) {
    // Focus strictly on Payments, Verification, Collections, Outstanding balances
    let pWhere = "WHERE 1=1";
    const pParams: any[] = [];
    if (sDate) { pWhere += ' AND DATE(p.payment_date) >= ?'; pParams.push(sDate); }
    if (eDate) { pWhere += ' AND DATE(p.payment_date) <= ?'; pParams.push(eDate); }

    const paymentStats = db.prepare(`
      SELECT
        COUNT(*) as totalSubmitted,
        SUM(CASE WHEN p.is_verified = 0 AND (p.status IS NULL OR p.status = 'PENDING_VERIFICATION') THEN 1 ELSE 0 END) as pendingVerification,
        SUM(CASE WHEN p.is_verified = 1 OR p.status = 'VERIFIED' THEN 1 ELSE 0 END) as verifiedPayments,
        SUM(CASE WHEN p.status = 'REJECTED' THEN 1 ELSE 0 END) as rejectedPayments
      FROM payments p
      ${pWhere}
    `).get(...pParams) as any;

    const todayCollection = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM payments
      WHERE (is_verified = 1 OR status = 'VERIFIED') AND DATE(payment_date) = ?
    `).get(todayStr) as { total: number };

    const thisMonthCollection = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM payments
      WHERE (is_verified = 1 OR status = 'VERIFIED') AND strftime('%Y-%m', payment_date) = ?
    `).get(thisMonthStr) as { total: number };

    // Outstanding amount across active orders
    const outstanding = db.prepare(`
      SELECT COALESCE(SUM(pending_amount), 0) as totalPending,
             SUM(CASE WHEN payment_status IN ('PAID', 'FULLY_PAID') THEN 1 ELSE 0 END) as fullyPaid,
             SUM(CASE WHEN payment_status IN ('PARTIALLY_PAID', 'PARTIAL_PAYMENT', 'ADVANCE_RECEIVED') THEN 1 ELSE 0 END) as partiallyPaid,
             SUM(CASE WHEN payment_status = 'UNPAID' THEN 1 ELSE 0 END) as unpaid
      FROM orders
      WHERE order_status != 'CANCELLED'
    `).get() as any;

    // Pending Payment Verification queue for quick audit
    const pendingVerificationList = db.prepare(`
      SELECT p.id, p.payment_number, p.order_id, p.amount, p.payment_date, p.payment_mode,
             p.reference_number, p.notes, p.proof_url, p.status, p.created_at,
             o.order_number, o.grand_total as order_total, o.pending_amount,
             v.company_name as vendor_name,
             u.name as received_by_name
      FROM payments p
      JOIN orders o ON p.order_id = o.id
      JOIN vendors v ON o.vendor_id = v.id
      LEFT JOIN users u ON p.received_by_id = u.id
      WHERE p.is_verified = 0 AND (p.status IS NULL OR p.status = 'PENDING_VERIFICATION')
      ORDER BY p.id DESC
      LIMIT 12
    `).all();

    // Recent Payments
    const recentPayments = db.prepare(`
      SELECT p.id, p.payment_number, p.order_id, p.amount, p.payment_date, p.payment_mode,
             p.reference_number, p.notes, p.proof_url, p.is_verified, p.status, p.created_at,
             o.order_number, v.company_name as vendor_name
      FROM payments p
      JOIN orders o ON p.order_id = o.id
      JOIN vendors v ON o.vendor_id = v.id
      ${pWhere}
      ORDER BY p.id DESC
      LIMIT 15
    `).all(...pParams);

    // Payment Collection Chart
    const isShort = sDate && eDate && (new Date(eDate).getTime() - new Date(sDate).getTime() <= 31 * 86400000);
    const dateGroup = isShort ? "DATE(p.payment_date)" : "strftime('%Y-%m', p.payment_date)";
    const paymentChart = db.prepare(`
      SELECT ${dateGroup} as period,
             SUM(p.amount) as total_collected,
             COUNT(*) as payment_count
      FROM payments p
      WHERE (p.is_verified = 1 OR p.status = 'VERIFIED')
        ${sDate ? 'AND DATE(p.payment_date) >= ?' : ''}
        ${eDate ? 'AND DATE(p.payment_date) <= ?' : ''}
      GROUP BY ${dateGroup}
      ORDER BY period ASC
    `).all(...(sDate && eDate ? [sDate, eDate] : sDate ? [sDate] : eDate ? [eDate] : []));

    return res.json({
      roleType: 'accounts',
      cards: {
        totalPaymentsSubmitted: paymentStats.totalSubmitted || 0,
        pendingVerification: paymentStats.pendingVerification || 0,
        verifiedPayments: paymentStats.verifiedPayments || 0,
        rejectedPayments: paymentStats.rejectedPayments || 0,
        todayCollection: todayCollection.total || 0,
        thisMonthCollection: thisMonthCollection.total || 0,
        outstandingAmount: outstanding.totalPending || 0,
        fullyPaidOrders: outstanding.fullyPaid || 0,
        partiallyPaidOrders: outstanding.partiallyPaid || 0,
        unpaidOrders: outstanding.unpaid || 0
      },
      pendingVerificationList,
      recentPayments,
      paymentChart,
      paymentBreakdown: {
        fullyPaid: outstanding.fullyPaid || 0,
        partiallyPaid: outstanding.partiallyPaid || 0,
        unpaid: outstanding.unpaid || 0
      }
    });
  }

  // -------------------------------------------------------------
  // 5. ADMIN & SUPER ADMIN – MASTER DASHBOARD
  // -------------------------------------------------------------
  // Complete company-wide information with multi-filter capability
  let orderWhere = 'WHERE 1=1';
  const orderParams: any[] = [];
  if (sDate) { orderWhere += ' AND DATE(o.created_at) >= ?'; orderParams.push(sDate); }
  if (eDate) { orderWhere += ' AND DATE(o.created_at) <= ?'; orderParams.push(eDate); }
  if (sales_person_id && sales_person_id !== 'ALL') {
    orderWhere += ' AND o.sales_person_id = ?';
    orderParams.push(Number(sales_person_id));
  }
  if (vendor_id && vendor_id !== 'ALL') {
    orderWhere += ' AND o.vendor_id = ?';
    orderParams.push(Number(vendor_id));
  }
  if (order_status && order_status !== 'ALL') {
    orderWhere += ' AND o.order_status = ?';
    orderParams.push(order_status);
  }

  // Status counts in period/filter
  const statusCounts = db.prepare(`
    SELECT o.order_status, COUNT(*) as count, SUM(o.grand_total) as total_val,
           SUM(o.amount_received) as received_val, SUM(o.pending_amount) as pending_val
    FROM orders o
    ${orderWhere}
    GROUP BY o.order_status
  `).all(...orderParams) as any[];

  const countsMap: Record<string, number> = {};
  let totalOrders = 0;
  let totalSalesValue = 0;
  let totalReceived = 0;
  let totalPending = 0;

  for (const row of statusCounts) {
    countsMap[row.order_status] = row.count;
    totalOrders += row.count;
    if (row.order_status !== 'CANCELLED') {
      totalSalesValue += row.total_val || 0;
      totalReceived += row.received_val || 0;
      totalPending += row.pending_val || 0;
    }
  }

  // Today's Sales & This Month Sales (respecting sales_person_id and vendor_id filter if applied)
  let todaySalesWhere = "WHERE o.order_status != 'CANCELLED' AND DATE(o.created_at) = ?";
  const todaySalesParams: any[] = [todayStr];
  if (sales_person_id && sales_person_id !== 'ALL') { todaySalesWhere += ' AND o.sales_person_id = ?'; todaySalesParams.push(Number(sales_person_id)); }
  if (vendor_id && vendor_id !== 'ALL') { todaySalesWhere += ' AND o.vendor_id = ?'; todaySalesParams.push(Number(vendor_id)); }
  const todaySales = db.prepare(`SELECT COALESCE(SUM(o.grand_total), 0) as total FROM orders o ${todaySalesWhere}`).get(...todaySalesParams) as { total: number };

  let monthSalesWhere = "WHERE o.order_status != 'CANCELLED' AND strftime('%Y-%m', o.created_at) = ?";
  const monthSalesParams: any[] = [thisMonthStr];
  if (sales_person_id && sales_person_id !== 'ALL') { monthSalesWhere += ' AND o.sales_person_id = ?'; monthSalesParams.push(Number(sales_person_id)); }
  if (vendor_id && vendor_id !== 'ALL') { monthSalesWhere += ' AND o.vendor_id = ?'; monthSalesParams.push(Number(vendor_id)); }
  const thisMonthSales = db.prepare(`SELECT COALESCE(SUM(o.grand_total), 0) as total FROM orders o ${monthSalesWhere}`).get(...monthSalesParams) as { total: number };

  // Collections (Today & This Month)
  let todayCollWhere = "WHERE (p.is_verified = 1 OR p.status = 'VERIFIED') AND DATE(p.payment_date) = ?";
  const todayCollParams: any[] = [todayStr];
  if (sales_person_id && sales_person_id !== 'ALL') { todayCollWhere += ' AND o.sales_person_id = ?'; todayCollParams.push(Number(sales_person_id)); }
  const todayCollection = db.prepare(`SELECT COALESCE(SUM(p.amount), 0) as total FROM payments p JOIN orders o ON p.order_id = o.id ${todayCollWhere}`).get(...todayCollParams) as { total: number };

  let monthCollWhere = "WHERE (p.is_verified = 1 OR p.status = 'VERIFIED') AND strftime('%Y-%m', p.payment_date) = ?";
  const monthCollParams: any[] = [thisMonthStr];
  if (sales_person_id && sales_person_id !== 'ALL') { monthCollWhere += ' AND o.sales_person_id = ?'; monthCollParams.push(Number(sales_person_id)); }
  const thisMonthCollection = db.prepare(`SELECT COALESCE(SUM(p.amount), 0) as total FROM payments p JOIN orders o ON p.order_id = o.id ${monthCollWhere}`).get(...monthCollParams) as { total: number };

  // Pending Verification
  const pendingVerification = db.prepare(`
    SELECT COUNT(*) as count FROM payments WHERE is_verified = 0 AND (status IS NULL OR status = 'PENDING_VERIFICATION')
  `).get() as { count: number };

  // Payment Status Breakdown
  const paymentDistribution = db.prepare(`
    SELECT
      SUM(CASE WHEN o.payment_status = 'UNPAID' THEN 1 ELSE 0 END) as unpaid,
      SUM(CASE WHEN o.payment_status IN ('PARTIALLY_PAID', 'PARTIAL_PAYMENT', 'ADVANCE_RECEIVED') THEN 1 ELSE 0 END) as partiallyPaid,
      SUM(CASE WHEN o.payment_status IN ('PAID', 'FULLY_PAID') THEN 1 ELSE 0 END) as fullyPaid
    FROM orders o
    ${orderWhere} AND o.order_status != 'CANCELLED'
  `).get(...orderParams) as any;

  // Packing metrics
  const packingMetrics = db.prepare(`
    SELECT
      SUM(CASE WHEN o.packing_status = 'PENDING_PACKING' OR (o.packing_status IS NULL AND o.order_status IN ('ACCEPTED', 'PROCESSING')) THEN 1 ELSE 0 END) as pendingPacking,
      SUM(CASE WHEN o.packing_status = 'IN_PROGRESS' OR o.production_status = 'IN_PRODUCTION' THEN 1 ELSE 0 END) as inProgress,
      SUM(CASE WHEN o.packing_status = 'PACKED' OR o.production_status = 'PRODUCTION_COMPLETED' THEN 1 ELSE 0 END) as packed,
      SUM(CASE WHEN o.packing_status = 'ON_HOLD' THEN 1 ELSE 0 END) as onHold,
      SUM(CASE WHEN o.order_status = 'READY_FOR_DISPATCH' OR o.packing_status = 'HANDED_OVER' THEN 1 ELSE 0 END) as readyDispatch
    FROM orders o
    ${orderWhere} AND o.order_status != 'CANCELLED'
  `).get(...orderParams) as any;

  // Dispatch & Delivery metrics
  const dispatchMetrics = db.prepare(`
    SELECT
      SUM(CASE WHEN o.order_status = 'READY_FOR_DISPATCH' THEN 1 ELSE 0 END) as readyDispatch,
      SUM(CASE WHEN o.dispatch_status IN ('PARTIALLY_DISPATCHED', 'FULLY_DISPATCHED') THEN 1 ELSE 0 END) as dispatched,
      SUM(CASE WHEN o.order_status = 'OUT_FOR_DELIVERY' THEN 1 ELSE 0 END) as outForDelivery,
      SUM(CASE WHEN o.dispatch_status = 'FULLY_DISPATCHED' AND o.delivery_status != 'DELIVERED' THEN 1 ELSE 0 END) as pendingDelivery,
      SUM(CASE WHEN o.delivery_status = 'DELIVERED' OR o.order_status = 'COMPLETED' THEN 1 ELSE 0 END) as delivered
    FROM orders o
    ${orderWhere} AND o.order_status != 'CANCELLED'
  `).get(...orderParams) as any;

  // Business data
  const totalVendorsCount = db.prepare("SELECT COUNT(*) as count FROM vendors WHERE status = 'active'").get() as { count: number };
  const totalProductsCount = db.prepare("SELECT COUNT(*) as count FROM products WHERE status = 'active'").get() as { count: number };
  const activeSalesPersonsCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role_id IN (SELECT id FROM roles WHERE slug = 'sales_person') AND status = 'active'").get() as { count: number };
  const activeUsersCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'active'").get() as { count: number };

  // Sales Person wise sales (for chart & performance ranking)
  let spFilterWhere = "WHERE u.role_id IN (SELECT id FROM roles WHERE slug = 'sales_person')";
  const spFilterParams: any[] = [];
  if (sDate) { spFilterWhere += ' AND (o.id IS NULL OR DATE(o.created_at) >= ?)'; spFilterParams.push(sDate); }
  if (eDate) { spFilterWhere += ' AND (o.id IS NULL OR DATE(o.created_at) <= ?)'; spFilterParams.push(eDate); }

  const salesPersonWiseSales = db.prepare(`
    SELECT u.id, u.name, u.employee_id,
           COUNT(o.id) as total_orders,
           COALESCE(SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.grand_total ELSE 0 END), 0) as total_sales,
           COALESCE(SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.amount_received ELSE 0 END), 0) as total_received,
           COALESCE(SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.pending_amount ELSE 0 END), 0) as pending_amount
    FROM users u
    LEFT JOIN orders o ON u.id = o.sales_person_id
    ${spFilterWhere}
    GROUP BY u.id
    ORDER BY total_sales DESC
  `).all(...spFilterParams);

  // Sales trend
  const isShort = sDate && eDate && (new Date(eDate).getTime() - new Date(sDate).getTime() <= 31 * 86400000);
  const dateGroup = isShort ? "DATE(o.created_at)" : "strftime('%Y-%m', o.created_at)";
  const salesTrend = db.prepare(`
    SELECT ${dateGroup} as period,
           COUNT(*) as orders_count,
           SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.grand_total ELSE 0 END) as total_sales,
           SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.amount_received ELSE 0 END) as total_received
    FROM orders o
    ${orderWhere}
    GROUP BY ${dateGroup}
    ORDER BY period ASC
    LIMIT 15
  `).all(...orderParams);

  // Top products
  const topProducts = db.prepare(`
    SELECT oi.product_name, oi.sku, p.image_url as product_image,
           SUM(oi.quantity) as total_qty, SUM(oi.line_amount) as total_amount
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    LEFT JOIN products p ON oi.product_id = p.id
    ${orderWhere} AND o.order_status != 'CANCELLED'
    GROUP BY oi.product_id, oi.sku
    ORDER BY total_amount DESC
    LIMIT 5
  `).all(...orderParams);

  // Top vendors
  const topVendors = db.prepare(`
    SELECT v.id, v.company_name, v.city, COUNT(o.id) as order_count,
           SUM(o.grand_total) as total_spent, SUM(o.pending_amount) as pending
    FROM vendors v
    JOIN orders o ON v.id = o.vendor_id
    ${orderWhere} AND o.order_status != 'CANCELLED'
    GROUP BY v.id
    ORDER BY total_spent DESC
    LIMIT 5
  `).all(...orderParams);

  // Recent orders
  const recentOrdersRaw = db.prepare(`
    SELECT o.id, o.order_number, o.order_status, o.grand_total, o.amount_received, o.pending_amount,
           o.created_at, o.required_delivery_date, o.packing_status, o.dispatch_status, o.delivery_status,
           v.company_name as vendor_name, u.name as sales_person_name, c.name as company_name
      FROM orders o
      JOIN vendors v ON o.vendor_id = v.id
      JOIN users u ON o.sales_person_id = u.id
      JOIN companies c ON o.company_id = c.id
      ${orderWhere}
      ORDER BY o.id DESC
      LIMIT 10
  `).all(...orderParams);

  const recentOrders = recentOrdersRaw.map((o: any) => {
    const items = db.prepare(`
      SELECT oi.*, p.name as product_name, p.sku, p.image_url as product_image, p.unit
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).all(o.id);
    return { ...o, items };
  });

  // Recent activities
  const recentActivities = db.prepare(`
    SELECT a.*, u.name as user_name, r.name as role_name
    FROM activity_logs a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN roles r ON u.role_id = r.id
    ORDER BY a.id DESC
    LIMIT 8
  `).all();

  // Dropdowns for Admin filters
  const salesPersonsList = db.prepare("SELECT id, name FROM users WHERE role_id IN (SELECT id FROM roles WHERE slug = 'sales_person') ORDER BY name ASC").all();
  const vendorsList = db.prepare("SELECT id, company_name as name FROM vendors ORDER BY company_name ASC").all();

  // Clean 4-step pipeline metrics: New -> Approved -> Packing -> Delivered
  // Packed but not delivered orders count under Packing
  const adminNewOrders = countsMap['NEW'] || 0;
  const adminApprovedOrders = countsMap['ACCEPTED'] || 0;
  const adminDeliveredOrders = (countsMap['DELIVERED'] || 0) + (countsMap['COMPLETED'] || 0);
  const adminCancelledOrders = countsMap['CANCELLED'] || 0;
  const adminPackingOrders = Math.max(0, totalOrders - adminNewOrders - adminApprovedOrders - adminDeliveredOrders - adminCancelledOrders);

  return res.json({
    roleType: 'master_admin',
    categories: {
      orders: {
        totalOrders,
        newOrders: adminNewOrders,
        approvedOrders: adminApprovedOrders,
        packingOrders: adminPackingOrders,
        deliveredOrders: adminDeliveredOrders,
        cancelledOrders: adminCancelledOrders,
      },
      sales: {
        totalSalesValue,
        todaySales: todaySales.total || 0,
        thisMonthSales: thisMonthSales.total || 0,
        salesPersonWiseSales,
        topSalesPersons: salesPersonWiseSales.slice(0, 5),
        topParties: topVendors,
        topVendors,
        topProducts
      },
      packing: {
        pendingPacking: packingMetrics.pendingPacking || 0,
        packingInProgress: packingMetrics.inProgress || 0,
        packed: packingMetrics.packed || 0,
        delivered: adminDeliveredOrders,
        onHold: packingMetrics.onHold || 0
      },
      payments: {
        totalOrderValue: totalSalesValue,
        verifiedReceived: totalReceived,
        balancePayment: totalPending,
        pendingAmount: totalPending,
        pendingVerification: pendingVerification.count || 0,
        todayCollection: todayCollection.total || 0,
        thisMonthCollection: thisMonthCollection.total || 0,
        unpaidOrders: paymentDistribution.unpaid || 0,
        partiallyPaidOrders: paymentDistribution.partiallyPaid || 0,
        fullyPaidOrders: paymentDistribution.fullyPaid || 0
      },
      business: {
        totalParties: totalVendorsCount.count || 0,
        totalVendors: totalVendorsCount.count || 0,
        totalProducts: totalProductsCount.count || 0,
        activeSalesPersons: activeSalesPersonsCount.count || 0,
        activeUsers: activeUsersCount.count || 0
      }
    },
    charts: {
      salesTrend,
      ordersByStatus: [
        { status: 'NEW', label: 'New', count: adminNewOrders, color: '#3b82f6' },
        { status: 'ACCEPTED', label: 'Approved', count: adminApprovedOrders, color: '#6366f1' },
        { status: 'PROCESSING', label: 'Packing', count: adminPackingOrders, color: '#f59e0b' },
        { status: 'DELIVERED', label: 'Delivered', count: adminDeliveredOrders, color: '#10b981' },
        { status: 'CANCELLED', label: 'Cancelled', count: adminCancelledOrders, color: '#ef4444' },
      ],
      receivedVsPending: {
        received: totalReceived,
        pending: totalPending,
        balance: totalPending,
        total: totalSalesValue
      },
      topProducts,
      topParties: topVendors,
      topVendors,
      salesPersonPerformance: salesPersonWiseSales
    },
    recentOrders,
    recentActivities,
    filterOptions: {
      salesPersons: salesPersonsList,
      parties: vendorsList,
      vendors: vendorsList,
      statuses: ['ALL', 'NEW', 'ACCEPTED', 'PROCESSING', 'DELIVERED', 'CANCELLED']
    },
    // Top-level aliases for backward compatibility if needed
    kpis: {
      totalOrders,
      newOrders: adminNewOrders,
      acceptedOrders: adminApprovedOrders,
      processingOrders: adminPackingOrders,
      readyForDispatch: 0,
      outForDelivery: 0,
      deliveredOrders: adminDeliveredOrders,
      completedOrders: countsMap['COMPLETED'] || 0,
      cancelledOrders: adminCancelledOrders,
    },
    financial: {
      totalOrderValue: totalSalesValue,
      totalAmountReceived: totalReceived,
      totalPendingAmount: totalPending,
      todayCollection: todayCollection.total || 0,
      thisMonthCollection: thisMonthCollection.total || 0,
      periodCollection: thisMonthCollection.total || 0
    },
    operational: {
      productionPending: packingMetrics.pendingPacking || 0,
      dispatchPending: dispatchMetrics.readyDispatch || 0,
      deliveryPending: dispatchMetrics.outForDelivery || 0,
      paymentPending: paymentDistribution.unpaid || 0
    },
    monthlyData: salesTrend,
    topSalesPersons: salesPersonWiseSales.slice(0, 5)
  });
});

// -------------------------------------------------------------
// BILLING COMPANIES (Two companies management)
// -------------------------------------------------------------

apiRouter.get('/companies', authMiddleware, (_req, res) => {
  const companies = db.prepare('SELECT * FROM companies ORDER BY id ASC').all();
  res.json({ companies });
});

apiRouter.post('/companies', authMiddleware, requirePermission('companies:manage'), (req: AuthRequest, res) => {
  const { name, code, logo_url, gst_number, address, city, state, pincode, mobile, email, bank_name, account_no, ifsc_code, branch, terms } = req.body;
  if (!name || !gst_number || !code) {
    return res.status(400).json({ error: 'Company Name, Code, and GSTIN are required' });
  }

  const result = db.prepare(`
    INSERT INTO companies (name, code, logo_url, gst_number, address, city, state, pincode, mobile, email, bank_name, account_no, ifsc_code, branch, terms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, code, logo_url || '', gst_number, address || '', city || '', state || '', pincode || '', mobile || '', email || '', bank_name || '', account_no || '', ifsc_code || '', branch || '', terms || '');

  logActivity(req.user!.id, 'COMPANY_CREATED', 'company', code, `Created company ${name}`);
  res.json({ id: result.lastInsertRowid, message: 'Company created successfully' });
});

apiRouter.put('/companies/:id', authMiddleware, requirePermission('companies:manage'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, logo_url, gst_number, address, city, state, pincode, mobile, email, bank_name, account_no, ifsc_code, branch, terms, status } = req.body;

  db.prepare(`
    UPDATE companies
    SET name = ?, logo_url = ?, gst_number = ?, address = ?, city = ?, state = ?, pincode = ?, mobile = ?, email = ?, bank_name = ?, account_no = ?, ifsc_code = ?, branch = ?, terms = ?, status = ?
    WHERE id = ?
  `).run(name, logo_url, gst_number, address, city, state, pincode, mobile, email, bank_name, account_no, ifsc_code, branch, terms, status || 'active', id);

  logActivity(req.user!.id, 'COMPANY_UPDATED', 'company', id, `Updated billing company ${name}`);
  res.json({ message: 'Company updated successfully' });
});

// -------------------------------------------------------------
// BRANDS & CATEGORIES
// -------------------------------------------------------------

apiRouter.get('/brands', authMiddleware, (_req, res) => {
  const brands = db.prepare('SELECT * FROM brands ORDER BY name ASC').all();
  res.json({ brands });
});

apiRouter.post('/brands', authMiddleware, requirePermission('products:manage'), (req: AuthRequest, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Brand name is required' });
  try {
    const r = db.prepare('INSERT INTO brands (name, description) VALUES (?, ?)').run(name, description || '');
    logActivity(req.user!.id, 'BRAND_CREATED', 'brand', r.lastInsertRowid.toString(), `Created brand ${name}`);
    res.json({ id: r.lastInsertRowid, message: 'Brand added successfully' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Brand already exists' });
  }
});

apiRouter.put('/brands/:id', authMiddleware, requirePermission('products:manage'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, description, status } = req.body;
  db.prepare('UPDATE brands SET name = ?, description = ?, status = ? WHERE id = ?').run(name, description, status || 'active', id);
  res.json({ message: 'Brand updated' });
});

apiRouter.get('/categories', authMiddleware, (_req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
  res.json({ categories });
});

apiRouter.post('/categories', authMiddleware, requirePermission('products:manage'), (req: AuthRequest, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required' });
  try {
    const r = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)').run(name, description || '');
    logActivity(req.user!.id, 'CATEGORY_CREATED', 'category', r.lastInsertRowid.toString(), `Created category ${name}`);
    res.json({ id: r.lastInsertRowid, message: 'Category added successfully' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Category already exists' });
  }
});

apiRouter.put('/categories/:id', authMiddleware, requirePermission('products:manage'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, description, status } = req.body;
  db.prepare('UPDATE categories SET name = ?, description = ?, status = ? WHERE id = ?').run(name, description, status || 'active', id);
  res.json({ message: 'Category updated' });
});

// -------------------------------------------------------------
// PRODUCTS CATALOG & RATE HISTORY
// -------------------------------------------------------------

apiRouter.get('/products', authMiddleware, (req, res) => {
  const { category_id, brand_id, search } = req.query;
  let sql = `
    SELECT p.*, b.name as brand_name, c.name as category_name
    FROM products p
    JOIN brands b ON p.brand_id = b.id
    JOIN categories c ON p.category_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (category_id) {
    sql += ' AND p.category_id = ?';
    params.push(category_id);
  }
  if (brand_id) {
    sql += ' AND p.brand_id = ?';
    params.push(brand_id);
  }
  if (search) {
    sql += ' AND (p.name LIKE ? OR p.sku LIKE ? OR b.name LIKE ? OR c.name LIKE ? OR p.item_colour LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }
  sql += ' ORDER BY p.name ASC';
  const products = db.prepare(sql).all(...params);
  res.json({ products });
});

apiRouter.get('/products/vendor-last-rate', authMiddleware, (req, res) => {
  const { vendor_id, product_id } = req.query;
  if (!vendor_id || !product_id) {
    return res.json({ lastRate: null });
  }
  const lastItem = db.prepare(`
    SELECT oi.rate, o.order_number, o.created_at
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.vendor_id = ? AND oi.product_id = ? AND o.order_status != 'CANCELLED'
    ORDER BY o.id DESC
    LIMIT 1
  `).get(vendor_id, product_id) as any;

  res.json({ lastRate: lastItem ? lastItem.rate : null, lastOrder: lastItem?.order_number, date: lastItem?.created_at });
});

apiRouter.post('/products', authMiddleware, requirePermission('products:manage'), (req: AuthRequest, res) => {
  const { name, brand_id, category_id, sku, unit, min_order_qty, standard_rate, description, image_url, item_colour, status } = req.body;
  const cleanUnit = (unit || '').toString().trim();
  if (!name || !brand_id || !category_id || !sku || !cleanUnit) {
    return res.status(400).json({ error: 'Name, Brand, Category, SKU and Packing Unit are required' });
  }
  try {
    const r = db.prepare(`
      INSERT INTO products (name, brand_id, category_id, sku, unit, min_order_qty, standard_rate, description, image_url, item_colour, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, brand_id, category_id, sku, cleanUnit, min_order_qty || 1, standard_rate || 0, description || '', image_url || '', item_colour || 'Golden Yellow', status || 'active');

    logActivity(req.user!.id, 'PRODUCT_CREATED', 'product', sku, `Added new product ${name} (${sku}) with packing unit ${cleanUnit}`);
    res.json({ id: r.lastInsertRowid, message: 'Product created successfully' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error creating product' });
  }
});

apiRouter.put('/products/:id', authMiddleware, requirePermission('products:manage'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, brand_id, category_id, sku, unit, min_order_qty, standard_rate, description, image_url, item_colour, status } = req.body;
  const cleanUnit = (unit || '').toString().trim();

  if (!cleanUnit) {
    return res.status(400).json({ error: 'Packing Unit is required' });
  }

  db.prepare(`
    UPDATE products
    SET name = ?, brand_id = ?, category_id = ?, sku = ?, unit = ?, min_order_qty = ?, standard_rate = ?, description = ?, image_url = ?, item_colour = ?, status = ?
    WHERE id = ?
  `).run(name, brand_id, category_id, sku, cleanUnit, min_order_qty, standard_rate, description, image_url, item_colour || 'Golden Yellow', status || 'active', id);

  logActivity(req.user!.id, 'PRODUCT_UPDATED', 'product', id, `Updated product specs for ${sku} (Packing Unit: ${cleanUnit})`);
  res.json({ message: 'Product updated successfully' });
});

// -------------------------------------------------------------
// VENDORS MANAGEMENT
// Sales Person sees ONLY assigned vendors. Admin sees ALL.
// -------------------------------------------------------------

apiRouter.get('/vendors', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const { search, city, state, sales_person_id } = req.query;

  let sql = `
    SELECT v.*, u.name as sales_person_name,
           u_creator.name as created_by_name,
           u_updater.name as updated_by_name,
           COUNT(o.id) as total_orders,
           SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.grand_total ELSE 0 END) as total_order_value,
           SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.amount_received ELSE 0 END) as amount_received,
           SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.pending_amount ELSE 0 END) as pending_amount
    FROM vendors v
    JOIN users u ON v.assigned_sales_person_id = u.id
    LEFT JOIN users u_creator ON v.created_by_id = u_creator.id
    LEFT JOIN users u_updater ON v.updated_by_id = u_updater.id
    LEFT JOIN orders o ON v.id = o.vendor_id
    WHERE 1=1
  `;
  const params: any[] = [];

  // Security Rule: Sales Person can ONLY see their own vendors!
  if (user.role_slug === 'sales_person') {
    sql += ' AND v.assigned_sales_person_id = ?';
    params.push(user.id);
  } else if (sales_person_id) {
    sql += ' AND v.assigned_sales_person_id = ?';
    params.push(sales_person_id);
  }

  if (search) {
    sql += ' AND (v.company_name LIKE ? OR v.contact_person LIKE ? OR v.vendor_code LIKE ? OR v.mobile LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (city) {
    sql += ' AND v.city = ?';
    params.push(city);
  }
  if (state) {
    sql += ' AND v.state = ?';
    params.push(state);
  }

  sql += ' GROUP BY v.id ORDER BY v.company_name ASC';
  const vendors = db.prepare(sql).all(...params);
  res.json({ vendors });
});

apiRouter.get('/vendors/:id', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;

  const vendor = db.prepare(`
    SELECT v.*,
           u.name as sales_person_name, u.mobile as sales_person_mobile,
           u_creator.name as created_by_name,
           u_updater.name as updated_by_name
    FROM vendors v
    JOIN users u ON v.assigned_sales_person_id = u.id
    LEFT JOIN users u_creator ON v.created_by_id = u_creator.id
    LEFT JOIN users u_updater ON v.updated_by_id = u_updater.id
    WHERE v.id = ?
  `).get(id) as any;

  if (!vendor) {
    return res.status(404).json({ error: 'Vendor not found' });
  }

  // Security Check: Sales Person can only view their assigned vendors
  if (user.role_slug === 'sales_person' && vendor.assigned_sales_person_id !== user.id) {
    return res.status(403).json({ error: 'Access denied: You can only view your own vendors' });
  }

  // Vendor order history
  const ordersRaw = db.prepare(`
    SELECT o.id, o.order_number, o.order_status, o.grand_total, o.amount_received, o.pending_amount,
           o.created_at, o.required_delivery_date, c.name as company_name
    FROM orders o
    JOIN companies c ON o.company_id = c.id
    WHERE o.vendor_id = ?
    ORDER BY o.id DESC
  `).all(id) as any[];

  const getVendorOrderItemsStmt = db.prepare(`
    SELECT oi.id, oi.product_id, oi.product_name, oi.sku, oi.quantity, oi.unit,
           COALESCE(p.image_url, 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=80&auto=format&fit=crop&q=80') as product_image
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `);

  const orders = ordersRaw.map((ord: any) => ({
    ...ord,
    items: getVendorOrderItemsStmt.all(ord.id)
  }));

  // Financial summary
  const summary = db.prepare(`
    SELECT
      COUNT(*) as total_orders,
      SUM(CASE WHEN order_status != 'CANCELLED' THEN grand_total ELSE 0 END) as total_value,
      SUM(CASE WHEN order_status != 'CANCELLED' THEN amount_received ELSE 0 END) as total_received,
      SUM(CASE WHEN order_status != 'CANCELLED' THEN pending_amount ELSE 0 END) as total_pending,
      SUM(CASE WHEN order_status = 'DELIVERED' OR order_status = 'COMPLETED' THEN 1 ELSE 0 END) as delivered_orders,
      SUM(CASE WHEN order_status IN ('NEW', 'ACCEPTED', 'PROCESSING', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY') THEN 1 ELSE 0 END) as pending_orders
    FROM orders
    WHERE vendor_id = ?
  `).get(id);

  res.json({ vendor, orders, summary });
});

apiRouter.post('/vendors', authMiddleware, requirePermission('vendors:create'), (req: AuthRequest, res) => {
  const user = req.user!;
  const {
    company_name, contact_person, mobile, alt_mobile, email, gstin, aadhaar_no,
    billing_address, delivery_address, city, state, pincode, assigned_sales_person_id, notes
  } = req.body;

  if (!company_name || !mobile || !billing_address || !city || !state) {
    return res.status(400).json({ error: 'Party Name, Mobile, Address, City and State are required' });
  }

  // Contact person is removed from UI; default to party name if not provided
  const finalContact = (contact_person && contact_person.trim()) || company_name.trim();

  // Automatic sales person assignment: if logged in as sales person, always assign to self!
  const assignedSalesId = user.role_slug === 'sales_person' ? user.id : (assigned_sales_person_id || user.id);

  // Generate unique vendor code
  const lastVendor = db.prepare('SELECT id FROM vendors ORDER BY id DESC LIMIT 1').get() as { id: number };
  const nextId = (lastVendor?.id || 0) + 1;
  const vendorCode = `PTY-${2000 + nextId}`;

  try {
    const result = db.prepare(`
      INSERT INTO vendors (
        vendor_code, company_name, contact_person, mobile, alt_mobile, email, gstin, aadhaar_no,
        billing_address, delivery_address, city, state, pincode, assigned_sales_person_id, created_by_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      vendorCode, company_name.trim(), finalContact, mobile.trim(), alt_mobile ? alt_mobile.trim() : null, email ? email.trim() : null, gstin ? gstin.trim().toUpperCase() : null, aadhaar_no ? aadhaar_no.trim() : null,
      billing_address.trim(), delivery_address ? delivery_address.trim() : billing_address.trim(), city.trim(), state.trim(), pincode ? pincode.trim() : null,
      assignedSalesId, user.id, notes ? notes.trim() : null
    );

    logActivity(user.id, 'PARTY_CREATED', 'party', vendorCode, `${user.name} created party ${company_name} (${vendorCode})`);

    const newVendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(result.lastInsertRowid);
    res.json({ vendor: newVendor, party: newVendor, message: 'Party profile created successfully' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create party profile' });
  }
});

apiRouter.put('/vendors/:id', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;

  // 1. Check user permission: must be super_admin or possess vendors:edit permission
  const hasEditPerm = user.role_slug === 'super_admin' || user.permissions.includes('vendors:edit');
  if (!hasEditPerm) {
    return res.status(403).json({ error: 'Access denied: Missing party edit permission' });
  }

  // 2. Locate existing vendor record
  const existing = db.prepare('SELECT * FROM vendors WHERE id = ?').get(id) as any;
  if (!existing) {
    return res.status(404).json({ error: 'Party not found' });
  }

  // 3. Security Rule: Sales Person can ONLY edit their own assigned vendors
  if (user.role_slug === 'sales_person' && existing.assigned_sales_person_id !== user.id) {
    return res.status(403).json({ error: 'Access denied: You can only edit your own assigned parties' });
  }

  const {
    company_name, contact_person, mobile, alt_mobile, email, gstin, aadhaar_no,
    billing_address, delivery_address, city, state, pincode, assigned_sales_person_id, status, notes
  } = req.body;

  if (!company_name || !mobile || !billing_address || !city || !state) {
    return res.status(400).json({ error: 'Party Name, Mobile, Billing Address, City and State are required' });
  }

  const finalContact = (contact_person && contact_person.trim()) || existing.contact_person || company_name.trim();

  // Sales Person cannot reassign to another sales person; Admin/Super Admin can reassign if specified
  const salesId = user.role_slug === 'sales_person'
    ? existing.assigned_sales_person_id
    : (assigned_sales_person_id ? Number(assigned_sales_person_id) : existing.assigned_sales_person_id);

  const now = new Date().toISOString();

  try {
    db.prepare(`
      UPDATE vendors
      SET company_name = ?,
          contact_person = ?,
          mobile = ?,
          alt_mobile = ?,
          email = ?,
          gstin = ?,
          aadhaar_no = ?,
          billing_address = ?,
          delivery_address = ?,
          city = ?,
          state = ?,
          pincode = ?,
          assigned_sales_person_id = ?,
          status = ?,
          notes = ?,
          updated_by_id = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      company_name.trim(),
      finalContact,
      mobile.trim(),
      alt_mobile ? alt_mobile.trim() : null,
      email ? email.trim() : null,
      gstin ? gstin.trim().toUpperCase() : null,
      aadhaar_no !== undefined ? (aadhaar_no ? aadhaar_no.trim() : null) : (existing.aadhaar_no || null),
      billing_address.trim(),
      delivery_address ? delivery_address.trim() : billing_address.trim(),
      city.trim(),
      state.trim(),
      pincode ? pincode.trim() : null,
      salesId,
      status || existing.status || 'active',
      notes !== undefined ? (notes ? notes.trim() : null) : existing.notes,
      user.id,
      now,
      id
    );

    // Record audit trail in activity_logs
    logActivity(
      user.id,
      'PARTY_PROFILE_UPDATED',
      'party',
      existing.vendor_code,
      `${user.name} updated profile for party ${company_name.trim()} (${existing.vendor_code})`
    );

    const updatedVendor = db.prepare(`
      SELECT v.*,
             u.name as sales_person_name, u.mobile as sales_person_mobile,
             u_creator.name as created_by_name,
             u_updater.name as updated_by_name
      FROM vendors v
      JOIN users u ON v.assigned_sales_person_id = u.id
      LEFT JOIN users u_creator ON v.created_by_id = u_creator.id
      LEFT JOIN users u_updater ON v.updated_by_id = u_updater.id
      WHERE v.id = ?
    `).get(id);

    return res.json({
      vendor: updatedVendor,
      party: updatedVendor,
      message: 'Party profile updated successfully.'
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to update party profile' });
  }
});

// -------------------------------------------------------------
// ORDERS WORKFLOW
// -------------------------------------------------------------

apiRouter.get('/orders', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const canViewAll = user.role_slug === 'super_admin' || user.permissions.includes('orders:view_all');
  const canViewOwn = user.permissions.includes('orders:view_own') || user.role_slug === 'sales_person';
  const otherAllowed = user.permissions.includes('packing:view') || user.permissions.includes('dispatch:view') || user.permissions.includes('payments:view') || user.role_slug === 'admin';
  if (!canViewAll && !canViewOwn && !otherAllowed) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to view orders' });
  }

  const {
    search, status, vendor_id, sales_person_id, company_id, product_id, tax_type,
    startDate, endDate, date_from, date_to, page = 1, limit = 20
  } = req.query;

  const sDate = (startDate || date_from) as string | undefined;
  const eDate = (endDate || date_to) as string | undefined;

  let sql = `
    SELECT o.*,
           v.company_name as vendor_name, v.city as vendor_city, v.state as vendor_state,
           u.name as sales_person_name,
           c.name as billing_company_name, c.code as billing_company_code,
           (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count,
           (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) as total_quantity,
           (SELECT SUM(produced_quantity) FROM order_items WHERE order_id = o.id) as total_produced,
           (SELECT SUM(dispatched_quantity) FROM order_items WHERE order_id = o.id) as total_dispatched,
           (SELECT SUM(delivered_quantity) FROM order_items WHERE order_id = o.id) as total_delivered,
           (SELECT GROUP_CONCAT(product_name || ' – ' || unit, ', ') FROM (SELECT product_name, unit FROM order_items WHERE order_id = o.id LIMIT 2)) as products_summary
    FROM orders o
    JOIN vendors v ON o.vendor_id = v.id
    JOIN users u ON o.sales_person_id = u.id
    JOIN companies c ON o.company_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];

  // Security Rule: Sales Person or view_own only sees own orders!
  if (user.role_slug === 'sales_person' || (!canViewAll && canViewOwn)) {
    sql += ' AND o.sales_person_id = ?';
    params.push(user.id);
  } else if (sales_person_id && sales_person_id !== 'ALL') {
    sql += ' AND (o.sales_person_id = ? OR u.name = ?)';
    params.push(sales_person_id, sales_person_id);
  }

  if (status && status !== 'ALL') {
    if (status === 'APPROVED' || status === 'ACCEPTED') {
      sql += " AND o.order_status IN ('ACCEPTED', 'APPROVED')";
    } else if (status === 'PACKING' || status === 'PROCESSING') {
      sql += " AND (o.order_status IN ('PROCESSING', 'PACKING', 'READY_FOR_DISPATCH') OR o.packing_status IN ('PACKING_IN_PROGRESS', 'IN_PROGRESS', 'PACKED', 'HANDED_OVER', 'ON_HOLD')) AND o.order_status NOT IN ('DELIVERED', 'COMPLETED', 'CANCELLED', 'NEW', 'ACCEPTED', 'APPROVED')";
    } else if (status === 'DELIVERED') {
      sql += " AND (o.order_status = 'DELIVERED' OR o.order_status = 'COMPLETED' OR o.delivery_status = 'DELIVERED')";
    } else {
      sql += ' AND o.order_status = ?';
      params.push(status);
    }
  }

  if (vendor_id && vendor_id !== 'ALL') {
    sql += ' AND (o.vendor_id = ? OR v.company_name = ?)';
    params.push(vendor_id, vendor_id);
  }

  if (company_id && company_id !== 'ALL') {
    sql += ' AND o.company_id = ?';
    params.push(company_id);
  }

  if (product_id && product_id !== 'ALL') {
    sql += ' AND o.id IN (SELECT order_id FROM order_items WHERE product_id = ? OR sku = ?)';
    params.push(product_id, product_id);
  }

  if (tax_type && tax_type !== 'ALL') {
    sql += ' AND o.tax_type = ?';
    params.push(tax_type);
  }

  if (search) {
    sql += ` AND (
      o.order_number LIKE ? OR
      v.company_name LIKE ? OR
      u.name LIKE ? OR
      o.id IN (SELECT order_id FROM order_items WHERE product_name LIKE ? OR sku LIKE ?)
    )`;
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }

  if (sDate) {
    sql += ' AND DATE(o.created_at) >= ?';
    params.push(sDate);
  }
  if (eDate) {
    sql += ' AND DATE(o.created_at) <= ?';
    params.push(eDate);
  }

  // Count total for pagination
  const countSql = `SELECT COUNT(*) as count FROM (${sql})`;
  const totalCount = (db.prepare(countSql).get(...params) as { count: number }).count;

  const pageNum = parseInt(page as string, 10) || 1;
  const pageLimit = parseInt(limit as string, 10) || 20;
  const offset = (pageNum - 1) * pageLimit;

  sql += ' ORDER BY o.id DESC LIMIT ? OFFSET ?';
  params.push(pageLimit, offset);

  const orders = db.prepare(sql).all(...params) as any[];

  const getItemsStmt = db.prepare(`
    SELECT oi.id, oi.product_id, oi.product_name, oi.sku, oi.quantity, oi.unit,
           COALESCE(p.image_url, 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=120&auto=format&fit=crop&q=80') as product_image
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `);

  const ordersWithItems = orders.map((o: any) => {
    const items = getItemsStmt.all(o.id);
    return { ...o, items };
  });

  res.json({
    orders: ordersWithItems,
    pagination: {
      total: totalCount,
      page: pageNum,
      limit: pageLimit,
      totalPages: Math.ceil(totalCount / pageLimit)
    }
  });
});

apiRouter.get('/orders/delivered', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const canViewAll = user.role_slug === 'super_admin' || user.permissions.includes('orders:view_all');
  const canViewOwn = user.permissions.includes('orders:view_own') || user.role_slug === 'sales_person';
  const otherAllowed = user.permissions.includes('packing:view') || user.permissions.includes('payments:view') || user.role_slug === 'admin';
  if (!canViewAll && !canViewOwn && !otherAllowed) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to view delivered orders' });
  }

  const { search, sales_person_id, vendor_id, startDate, endDate, date_from, date_to } = req.query;
  const sDate = (startDate || date_from) as string | undefined;
  const eDate = (endDate || date_to) as string | undefined;

  let filterSql = "WHERE (o.order_status = 'DELIVERED' OR o.order_status = 'COMPLETED' OR o.delivery_status = 'DELIVERED')";
  const params: any[] = [];

  if (user.role_slug === 'sales_person' || (!canViewAll && canViewOwn)) {
    filterSql += " AND o.sales_person_id = ?";
    params.push(user.id);
  } else if (sales_person_id && sales_person_id !== 'ALL') {
    filterSql += " AND (o.sales_person_id = ? OR u.name = ?)";
    params.push(sales_person_id, sales_person_id);
  }

  if (vendor_id && vendor_id !== 'ALL') {
    filterSql += " AND (o.vendor_id = ? OR v.company_name = ?)";
    params.push(vendor_id, vendor_id);
  }

  if (sDate) {
    filterSql += " AND DATE(COALESCE(o.delivered_at, o.created_at)) >= ?";
    params.push(sDate);
  }
  if (eDate) {
    filterSql += " AND DATE(COALESCE(o.delivered_at, o.created_at)) <= ?";
    params.push(eDate);
  }

  if (search) {
    filterSql += " AND (o.order_number LIKE ? OR v.company_name LIKE ? OR u.name LIKE ?)";
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  const deliveredOrders = db.prepare(`
    SELECT o.id, o.order_number, o.order_status, o.grand_total, o.amount_received, o.pending_amount,
           o.payment_status, o.delivery_address, o.delivered_at, o.created_at,
           COALESCE(o.delivered_by_name, 'Operations Team') as delivered_by_name,
           v.company_name as vendor_name, v.city as vendor_city,
           u.name as sales_person_name,
           (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count,
           (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) as total_quantity
    FROM orders o
    JOIN vendors v ON o.vendor_id = v.id
    JOIN users u ON o.sales_person_id = u.id
    ${filterSql}
    ORDER BY COALESCE(o.delivered_at, o.updated_at, o.created_at) DESC, o.id DESC
  `).all(...params) as any[];

  // Attach items summary
  const ordersWithItems = deliveredOrders.map(ord => {
    const items = db.prepare(`
      SELECT oi.id, oi.product_name, oi.unit, oi.quantity, oi.delivered_quantity, oi.sku
      FROM order_items oi
      WHERE oi.order_id = ?
    `).all(ord.id);
    return { ...ord, items };
  });

  return res.json({
    orders: ordersWithItems,
    totalCount: ordersWithItems.length,
    totalDeliveredValue: ordersWithItems.reduce((acc, o) => acc + (o.grand_total || 0), 0)
  });
});

apiRouter.get('/orders/:id', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;

  const order = db.prepare(`
    SELECT o.*,
           v.company_name as vendor_name, v.contact_person as vendor_contact, v.mobile as vendor_mobile,
           v.email as vendor_email, v.gstin as vendor_gstin, v.billing_address as vendor_billing_address,
           v.delivery_address as vendor_delivery_address, v.city as vendor_city, v.state as vendor_state, v.pincode as vendor_pincode,
           u.name as sales_person_name, u.email as sales_person_email, u.mobile as sales_person_mobile,
           c.name as billing_company_name, c.code as billing_company_code, c.logo_url as billing_company_logo,
           c.gst_number as billing_company_gst, c.address as billing_company_address, c.city as billing_company_city,
           c.state as billing_company_state, c.pincode as billing_company_pincode, c.mobile as billing_company_mobile,
           c.email as billing_company_email, c.bank_name as billing_company_bank, c.account_no as billing_company_account,
           c.ifsc_code as billing_company_ifsc, c.branch as billing_company_branch, c.terms as billing_company_terms
    FROM orders o
    JOIN vendors v ON o.vendor_id = v.id
    JOIN users u ON o.sales_person_id = u.id
    JOIN companies c ON o.company_id = c.id
    WHERE o.id = ? OR o.order_number = ?
  `).get(id, id) as any;

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  // Security check: Sales Person only sees own orders
  if (user.role_slug === 'sales_person' && order.sales_person_id !== user.id) {
    return res.status(403).json({ error: 'Access denied: You can only view your own orders' });
  }

  // Order Items
  const items = db.prepare(`
    SELECT oi.*, p.image_url as product_image, p.item_colour, b.name as brand_name, cat.name as category_name
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    JOIN brands b ON p.brand_id = b.id
    JOIN categories cat ON p.category_id = cat.id
    WHERE oi.order_id = ?
    ORDER BY oi.id ASC
  `).all(order.id);

  // Production Records
  const productionRecords = db.prepare(`
    SELECT pr.*, oi.product_name, oi.sku, u.name as logged_by_name
    FROM production_records pr
    JOIN order_items oi ON pr.order_item_id = oi.id
    JOIN users u ON pr.created_by_id = u.id
    WHERE pr.order_id = ?
    ORDER BY pr.id DESC
  `).all(order.id);

  // Dispatches
  const dispatches = db.prepare(`
    SELECT d.*, u.name as dispatched_by_name
    FROM dispatches d
    JOIN users u ON d.created_by_id = u.id
    WHERE d.order_id = ?
    ORDER BY d.id DESC
  `).all(order.id);

  // Deliveries
  const deliveries = db.prepare(`
    SELECT del.*, u.name as logged_by_name
    FROM deliveries del
    JOIN users u ON del.created_by_id = u.id
    WHERE del.order_id = ?
    ORDER BY del.id DESC
  `).all(order.id);

  // Payments
  const payments = db.prepare(`
    SELECT p.*, u.name as received_by_name, vu.name as verified_by_name
    FROM payments p
    JOIN users u ON p.received_by_id = u.id
    LEFT JOIN users vu ON p.verified_by_id = vu.id
    WHERE p.order_id = ?
    ORDER BY p.id DESC
  `).all(order.id);

  // Status History
  const history = db.prepare(`
    SELECT h.*, u.name as actor_name, r.name as actor_role
    FROM order_status_history h
    JOIN users u ON h.created_by_id = u.id
    JOIN roles r ON u.role_id = r.id
    WHERE h.order_id = ?
    ORDER BY h.id ASC
  `).all(order.id);

  // Activity Logs related to this order
  const logs = db.prepare(`
    SELECT a.*, u.name as actor_name
    FROM activity_logs a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.entity_id = ? OR a.entity_id = ?
    ORDER BY a.id DESC
  `).all(order.id.toString(), order.order_number);

  res.json({
    order,
    items,
    productionRecords,
    dispatches,
    deliveries,
    payments,
    history,
    logs
  });
});

// -------------------------------------------------------------
// CREATE ORDER (Multi-step)
// -------------------------------------------------------------

apiRouter.post('/orders', authMiddleware, requirePermission('orders:create'), (req: AuthRequest, res) => {
  const user = req.user!;
  const {
    company_id, vendor_id, items,
    required_delivery_date, delivery_address, delivery_contact_person, delivery_contact_number,
    special_instructions, notes, payment_terms,
    tax_type = 'GST_18',
    advance_payment_amount, payment_mode, payment_reference
  } = req.body;

  if (!company_id || !vendor_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Billing Company, Vendor, and at least one Product are required' });
  }

  // Verify vendor permission if Sales Person
  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(vendor_id) as any;
  if (!vendor) return res.status(404).json({ error: 'Selected vendor does not exist' });
  if (user.role_slug === 'sales_person' && vendor.assigned_sales_person_id !== user.id) {
    return res.status(403).json({ error: 'Unauthorized: You can only create orders for your assigned vendors' });
  }

  // Validate items & calculate line amounts
  // CORE BUSINESS RULE:
  // Estimated / Grand Total = SUM(Quantity * Manually Entered Selling Rate)
  let grandTotal = 0;
  for (const it of items) {
    if (!it.product_id || Number(it.quantity) <= 0 || Number(it.rate) <= 0) {
      return res.status(400).json({ error: 'All product rows must have valid product, quantity > 0, and rate > 0' });
    }
    const lineAmt = Math.round(Number(it.quantity) * Number(it.rate) * 100) / 100;
    grandTotal += lineAmt;
  }
  grandTotal = Math.round(grandTotal * 100) / 100;

  const isNonGst = tax_type === 'NON_GST';
  let subtotal = 0;
  let taxRate = 0;
  let taxAmount = 0;

  if (isNonGst) {
    subtotal = grandTotal;
    taxRate = 0;
    taxAmount = 0;
  } else {
    // Reverse GST 18%:
    // Subtotal Excl. GST = Grand Total / 1.18
    // GST @18% = Grand Total - Subtotal
    subtotal = Math.round((grandTotal / 1.18) * 100) / 100;
    taxRate = 18.0;
    taxAmount = Math.round((grandTotal - subtotal) * 100) / 100;
  }

  // Business requirement: No advance collection recorded during initial order creation.
  // Initial order finances:
  // Total Order Amount = Calculated Order Value (Grand Total)
  // Verified Received Amount = ₹0
  // Pending Amount = Full Order Amount (Grand Total)
  // Payment Status = Unpaid
  const amountReceived = 0;
  const pendingAmount = grandTotal;
  const initialPayStatus = 'UNPAID';

  // Generate unique Order ID
  const lastOrder = db.prepare('SELECT id FROM orders ORDER BY id DESC LIMIT 1').get() as { id: number };
  const nextOrderNum = `ORD-${10180 + (lastOrder?.id || 0) + 1}`;

  const salesPersonId = user.role_slug === 'sales_person' ? user.id : (vendor.assigned_sales_person_id || user.id);

  const orderResult = db.prepare(`
    INSERT INTO orders (
      order_number, company_id, vendor_id, sales_person_id, order_status,
      production_status, packing_status, dispatch_status, delivery_status, payment_status,
      payment_terms, tax_type, subtotal, discount_amount, tax_rate, tax_amount, grand_total,
      amount_received, pending_amount, required_delivery_date, delivery_address,
      delivery_contact_person, delivery_contact_number, special_instructions, notes,
      created_by_id
    ) VALUES (
      ?, ?, ?, ?, 'NEW',
      'NOT_ASSIGNED', 'PENDING_PACKING', 'NOT_DISPATCHED', 'PENDING', ?,
      ?, ?, ?, 0, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?
    )
  `).run(
    nextOrderNum, company_id, vendor_id, salesPersonId,
    initialPayStatus,
    payment_terms || 'Credit 30 Days',
    isNonGst ? 'NON_GST' : 'GST_18',
    subtotal, taxRate, taxAmount, grandTotal,
    amountReceived, pendingAmount,
    required_delivery_date || null,
    delivery_address || vendor.delivery_address || vendor.billing_address,
    delivery_contact_person || vendor.contact_person,
    delivery_contact_number || vendor.mobile,
    special_instructions || null,
    notes || null,
    user.id
  );

  const newOrderId = orderResult.lastInsertRowid as number;

  // Insert items
  const insertItemStmt = db.prepare(`
    INSERT INTO order_items (order_id, product_id, sku, product_name, unit, quantity, rate, line_amount, notes, item_availability)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE')
  `);

  for (const it of items) {
    const prod = db.prepare('SELECT name, sku, unit FROM products WHERE id = ?').get(it.product_id) as any;
    const lineAmt = Number(it.quantity) * Number(it.rate);
    insertItemStmt.run(newOrderId, it.product_id, prod.sku, prod.name, prod.unit, Number(it.quantity), Number(it.rate), lineAmt, it.notes || null);
  }

  // Record initial Status History
  db.prepare(`
    INSERT INTO order_status_history (order_id, stage_name, previous_status, new_status, notes, created_by_id)
    VALUES (?, 'Order Created', NULL, 'NEW', ?, ?)
  `).run(newOrderId, `Order submitted by ${user.name} (Awaiting client payment & Admin review)`, user.id);

  // Audit log & notification to Admin
  logActivity(user.id, 'ORDER_CREATED', 'order', nextOrderNum, `${user.name} created order ${nextOrderNum} for ${vendor.company_name} (Total: ₹${grandTotal.toLocaleString('en-IN')})`);
  sendNotification(null, 'admin', 'New Order Requires Review', `Order ${nextOrderNum} submitted by ${user.name} for ${vendor.company_name}`, 'warning', newOrderId);

  res.json({
    order_id: newOrderId,
    order_number: nextOrderNum,
    message: 'Order created successfully and submitted for Admin review!'
  });
});

// -------------------------------------------------------------
// EDIT ORDER (Updates existing order ID without creating duplicate)
// -------------------------------------------------------------

apiRouter.put('/orders/:id', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const isAdmin = ['super_admin', 'admin'].includes(user.role_slug) || user.permissions.includes('orders:edit_all');
  const hasEditPerm = isAdmin || user.permissions.includes('orders:edit');

  if (order.order_status === 'CANCELLED') {
    return res.status(400).json({ error: 'Cancelled orders cannot be edited.' });
  }

  // Security checks per Requirement 8:
  // - New / Pending Approval: Authorized Sales Person can edit their own order, or Admin/Super Admin.
  // - Approved: Editing requires appropriate Admin/authorized permission.
  // - Packing Started: Protect important commercial/product fields from unsafe changes unless Admin/Super Admin explicitly has permission.
  // - Delivered: Do NOT allow normal Sales Person to modify the delivered order. Admin/Super Admin controlled corrections only.
  if (order.order_status === 'DELIVERED') {
    if (!isAdmin) {
      return res.status(403).json({ error: 'Access denied: Only Administrators can modify delivered orders.' });
    }
  } else if (order.order_status === 'PROCESSING' || ['IN_PROGRESS', 'PACKED', 'PACKING_IN_PROGRESS'].includes(order.packing_status)) {
    if (!isAdmin) {
      return res.status(403).json({ error: 'Access denied: Packing has already started. Only Administrators can adjust commercial or product details.' });
    }
  } else if (order.order_status === 'ACCEPTED') {
    if (!hasEditPerm) {
      return res.status(403).json({ error: 'Access denied: Editing an approved order requires Admin authorization.' });
    }
  } else if (order.order_status === 'NEW') {
    if (user.role_slug === 'sales_person' && order.sales_person_id !== user.id) {
      return res.status(403).json({ error: 'Access denied: You can only edit your own orders.' });
    }
    if (!hasEditPerm && user.role_slug !== 'sales_person') {
      return res.status(403).json({ error: 'Access denied: You do not have permission to edit orders.' });
    }
  }

  const {
    company_id, vendor_id, items, tax_type = order.tax_type || 'GST_18', notes, delivery_address,
    delivery_contact_person, delivery_contact_number, required_delivery_date, special_instructions, payment_terms
  } = req.body;

  const targetCompanyId = company_id ? Number(company_id) : order.company_id;
  const targetVendorId = vendor_id ? Number(vendor_id) : order.vendor_id;

  // Validate items
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one product item is required.' });
  }

  let grandTotal = 0;
  for (const it of items) {
    if (!it.product_id || Number(it.quantity) <= 0 || Number(it.rate) <= 0) {
      return res.status(400).json({ error: 'All product rows must have valid product, quantity > 0, and rate > 0' });
    }
    const lineAmt = Math.round(Number(it.quantity) * Number(it.rate) * 100) / 100;
    grandTotal += lineAmt;
  }
  grandTotal = Math.round(grandTotal * 100) / 100;

  const isNonGst = tax_type === 'NON_GST';
  let subtotal = 0;
  let taxRate = 0;
  let taxAmount = 0;

  if (isNonGst) {
    subtotal = grandTotal;
    taxRate = 0;
    taxAmount = 0;
  } else {
    subtotal = Math.round((grandTotal / 1.18) * 100) / 100;
    taxRate = 18.0;
    taxAmount = Math.round((grandTotal - subtotal) * 100) / 100;
  }

  // Recalculate pending_amount = grandTotal - amount_received
  const amountReceived = Number(order.amount_received || 0);
  const pendingAmount = Math.max(0, Math.round((grandTotal - amountReceived) * 100) / 100);

  let newPaymentStatus = order.payment_status;
  if (amountReceived >= grandTotal && grandTotal > 0) {
    newPaymentStatus = 'FULLY_PAID';
  } else if (amountReceived > 0) {
    newPaymentStatus = 'PARTIALLY_PAID';
  } else {
    newPaymentStatus = 'UNPAID';
  }

  // Update order (same Order ID)
  db.prepare(`
    UPDATE orders
    SET company_id = ?,
        vendor_id = ?,
        tax_type = ?,
        subtotal = ?,
        tax_rate = ?,
        tax_amount = ?,
        grand_total = ?,
        pending_amount = ?,
        payment_status = ?,
        notes = ?,
        delivery_address = ?,
        delivery_contact_person = ?,
        delivery_contact_number = ?,
        required_delivery_date = ?,
        special_instructions = ?,
        payment_terms = ?,
        updated_by_id = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    targetCompanyId,
    targetVendorId,
    isNonGst ? 'NON_GST' : 'GST_18',
    subtotal,
    taxRate,
    taxAmount,
    grandTotal,
    pendingAmount,
    newPaymentStatus,
    notes !== undefined ? (notes ? notes.trim() : null) : order.notes,
    delivery_address !== undefined ? (delivery_address ? delivery_address.trim() : null) : order.delivery_address,
    delivery_contact_person !== undefined ? (delivery_contact_person ? delivery_contact_person.trim() : null) : order.delivery_contact_person,
    delivery_contact_number !== undefined ? (delivery_contact_number ? delivery_contact_number.trim() : null) : order.delivery_contact_number,
    required_delivery_date !== undefined ? (required_delivery_date || null) : order.required_delivery_date,
    special_instructions !== undefined ? (special_instructions ? special_instructions.trim() : null) : order.special_instructions,
    payment_terms !== undefined ? (payment_terms || 'Credit 30 Days') : order.payment_terms,
    user.id,
    id
  );

  // Update order items: delete existing, insert new ones
  db.prepare('DELETE FROM order_items WHERE order_id = ?').run(id);

  const insertItemStmt = db.prepare(`
    INSERT INTO order_items (order_id, product_id, sku, product_name, unit, quantity, rate, line_amount, notes, item_colour, item_availability)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE')
  `);

  for (const it of items) {
    const prod = db.prepare('SELECT name, sku, unit, item_colour FROM products WHERE id = ?').get(it.product_id) as any;
    const lineAmt = Math.round(Number(it.quantity) * Number(it.rate) * 100) / 100;
    insertItemStmt.run(
      id,
      it.product_id,
      prod?.sku || it.sku || 'SKU',
      prod?.name || it.product_name || 'Product',
      prod?.unit || it.unit || 'Ltr',
      Number(it.quantity),
      Number(it.rate),
      lineAmt,
      it.notes || null,
      it.item_colour || prod?.item_colour || 'Golden Yellow'
    );
  }

  // History & Audit Log
  db.prepare(`
    INSERT INTO order_status_history (order_id, stage_name, previous_status, new_status, notes, created_by_id)
    VALUES (?, 'Order Updated', ?, ?, ?, ?)
  `).run(id, order.order_status, order.order_status, `Order details updated by ${user.name}`, user.id);

  logActivity(
    user.id,
    'ORDER_UPDATED',
    'order',
    order.order_number,
    `${user.name} updated order ${order.order_number} (New Total: ₹${grandTotal.toLocaleString('en-IN')})`
  );

  const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  const updatedItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);

  res.json({
    order: updatedOrder,
    items: updatedItems,
    message: 'Order updated successfully.'
  });
});

// -------------------------------------------------------------
// ADMIN ACTIONS: ACCEPT, CANCEL, ASSIGN
// -------------------------------------------------------------

apiRouter.post('/orders/:id/accept', authMiddleware, requirePermission('orders:approve'), (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.order_status !== 'NEW') {
    return res.status(400).json({ error: `Cannot accept order in status ${order.order_status}` });
  }

  db.prepare(`
    UPDATE orders
    SET order_status = 'ACCEPTED', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  db.prepare(`
    INSERT INTO order_status_history (order_id, stage_name, previous_status, new_status, notes, created_by_id)
    VALUES (?, 'Order Accepted', 'NEW', 'ACCEPTED', ?, ?)
  `).run(id, `Approved by ${user.name}. Ready for production assignment.`, user.id);

  logActivity(user.id, 'ORDER_ACCEPTED', 'order', order.order_number, `${user.name} accepted order ${order.order_number}`);
  sendNotification(order.sales_person_id, null, 'Order Approved', `Your order ${order.order_number} has been approved by Admin`, 'success', order.id);

  res.json({ message: 'Order approved successfully' });
});

apiRouter.post('/orders/:id/cancel', authMiddleware, requirePermission('orders:cancel'), (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || reason.trim().length < 5) {
    return res.status(400).json({ error: 'A valid cancellation reason (min 5 characters) is required' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (['COMPLETED', 'CANCELLED'].includes(order.order_status)) {
    return res.status(400).json({ error: `Cannot cancel an order that is already ${order.order_status}` });
  }

  db.prepare(`
    UPDATE orders
    SET order_status = 'CANCELLED',
        cancellation_reason = ?,
        cancelled_by_id = ?,
        cancelled_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(reason.trim(), user.id, id);

  db.prepare(`
    INSERT INTO order_status_history (order_id, stage_name, previous_status, new_status, notes, created_by_id)
    VALUES (?, 'Order Cancelled', ?, 'CANCELLED', ?, ?)
  `).run(id, order.order_status, `Cancelled by ${user.name}. Reason: ${reason}`, user.id);

  logActivity(user.id, 'ORDER_CANCELLED', 'order', order.order_number, `${user.name} cancelled order ${order.order_number}. Reason: ${reason}`);
  sendNotification(order.sales_person_id, null, 'Order Cancelled', `Order ${order.order_number} was cancelled. Reason: ${reason}`, 'error', order.id);

  res.json({ message: 'Order has been cancelled' });
});

apiRouter.post('/orders/:id/assign-production', authMiddleware, requirePermission('orders:approve'), (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;
  const { notes } = req.body;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (!['ACCEPTED', 'NEW'].includes(order.order_status)) {
    return res.status(400).json({ error: `Order is already in ${order.order_status} stage` });
  }

  db.prepare(`
    UPDATE orders
    SET order_status = 'PROCESSING',
        production_status = 'ASSIGNED',
        assigned_to_production_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  db.prepare(`
    INSERT INTO order_status_history (order_id, stage_name, previous_status, new_status, notes, created_by_id)
    VALUES (?, 'Assigned to Production', ?, 'PROCESSING', ?, ?)
  `).run(id, order.order_status, notes || 'Assigned to manufacturing floor for batching', user.id);

  logActivity(user.id, 'ORDER_ASSIGNED_PROD', 'order', order.order_number, `${user.name} assigned order ${order.order_number} to production`);
  sendNotification(null, 'production_team', 'New Production Assignment', `Order ${order.order_number} has been assigned for plant formulation`, 'info', order.id);

  res.json({ message: 'Order successfully assigned to Production' });
});

// -------------------------------------------------------------
// PRODUCTION MODULE
// -------------------------------------------------------------

// -------------------------------------------------------------
// PACKING MANAGEMENT MODULE (Replaces Manufacturing/Production)
// Finished goods only: Check availability, pack items & handover to Dispatch
// -------------------------------------------------------------

const getPackingOrders = (req: AuthRequest, res: any) => {
  const user = req.user!;
  const canViewPacking = user.role_slug === 'super_admin' || user.permissions.includes('packing:view') || user.permissions.includes('production:view') || user.role_slug === 'admin' || user.role_slug === 'production_team';
  if (!canViewPacking) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to access Packing Management' });
  }

  const isSalesPerson = user.role_slug === 'sales_person';
  let filterClause = isSalesPerson ? `AND o.sales_person_id = ${user.id}` : '';

  const { sales_person_id, vendor_id, startDate, endDate, date_from, date_to, search } = req.query;
  const queryParams: any[] = [];

  const sDate = (startDate || date_from) as string | undefined;
  const eDate = (endDate || date_to) as string | undefined;

  if (sDate) {
    filterClause += ' AND DATE(o.created_at) >= ?';
    queryParams.push(sDate);
  }
  if (eDate) {
    filterClause += ' AND DATE(o.created_at) <= ?';
    queryParams.push(eDate);
  }

  if (sales_person_id && sales_person_id !== 'ALL') {
    filterClause += ' AND (o.sales_person_id = ? OR u.name = ?)';
    queryParams.push(sales_person_id, sales_person_id);
  }
  if (vendor_id && vendor_id !== 'ALL') {
    filterClause += ' AND (o.vendor_id = ? OR v.company_name = ?)';
    queryParams.push(vendor_id, vendor_id);
  }
  if (search) {
    filterClause += ' AND (o.order_number LIKE ? OR v.company_name LIKE ?)';
    const s = `%${search}%`;
    queryParams.push(s, s);
  }

  const orders = db.prepare(`
    SELECT o.id, o.order_number, o.order_status, o.production_status,
           o.vendor_id, o.sales_person_id,
           CASE
             WHEN o.order_status = 'DELIVERED' OR o.delivery_status = 'DELIVERED' THEN 'DELIVERED'
             WHEN o.packing_status IN ('HANDED_OVER_TO_DISPATCH', 'HANDED_OVER') THEN 'PACKED'
             WHEN o.packing_status IS NOT NULL THEN o.packing_status
             WHEN o.production_status = 'PRODUCTION_COMPLETED' THEN 'PACKED'
             WHEN o.production_status = 'IN_PRODUCTION' THEN 'PACKING_IN_PROGRESS'
             ELSE 'PENDING_PACKING'
           END as packing_status,
           o.packing_notes,
           o.required_delivery_date, o.created_at, o.delivered_at, o.delivered_by_name, o.grand_total,
           v.company_name as vendor_name, v.city as vendor_city,
           u.name as sales_person_name,
           (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count,
           (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) as total_qty
    FROM orders o
    JOIN vendors v ON o.vendor_id = v.id
    JOIN users u ON o.sales_person_id = u.id
    WHERE o.order_status NOT IN ('CANCELLED')
      AND o.order_status IN ('ACCEPTED', 'PROCESSING', 'ON_HOLD', 'NEW', 'DELIVERED', 'READY_FOR_DISPATCH')
      ${filterClause}
    ORDER BY CASE
      WHEN o.packing_status = 'PENDING_PACKING' OR o.production_status = 'ASSIGNED' THEN 1
      WHEN o.packing_status = 'PACKING_IN_PROGRESS' OR o.production_status = 'IN_PRODUCTION' THEN 2
      WHEN o.packing_status = 'PACKED' OR o.production_status = 'PRODUCTION_COMPLETED' THEN 3
      WHEN o.packing_status = 'ON_HOLD' THEN 4
      WHEN o.order_status = 'DELIVERED' THEN 5
      ELSE 6
    END, o.id DESC
  `).all(...queryParams) as any[];

  // Attach items with product images and item availability
  const ordersWithItems = orders.map((ord: any) => {
    const items = db.prepare(`
      SELECT oi.id, oi.product_id, oi.sku, oi.product_name, oi.unit, oi.quantity,
             COALESCE(oi.item_availability, 'AVAILABLE') as item_availability,
             p.image_url as product_image, p.item_colour, b.name as brand_name, c.name as category_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE oi.order_id = ?
    `).all(ord.id);
    return { ...ord, items };
  });

  // Dynamic lists of sales persons and vendors for filters
  const salesPersons = db.prepare(`
    SELECT DISTINCT u.id, u.name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE r.slug = 'sales_person' OR u.id IN (
      SELECT sales_person_id FROM orders WHERE order_status IN ('ACCEPTED', 'PROCESSING', 'READY_FOR_DISPATCH', 'NEW', 'ON_HOLD')
    )
    ORDER BY u.name ASC
  `).all();

  const vendors = db.prepare(`
    SELECT DISTINCT v.id, v.company_name as name
    FROM vendors v
    WHERE v.id IN (
      SELECT vendor_id FROM orders WHERE order_status IN ('ACCEPTED', 'PROCESSING', 'READY_FOR_DISPATCH', 'NEW', 'ON_HOLD')
    ) OR v.status = 'active'
    ORDER BY v.company_name ASC
  `).all();

  res.json({ orders: ordersWithItems, salesPersons, vendors });
};

apiRouter.get('/packing/orders', authMiddleware, getPackingOrders);
apiRouter.get('/production/orders', authMiddleware, getPackingOrders);

// Action 1: Toggle Item Availability (Item Ready / Not Available)
apiRouter.post('/orders/:id/toggle-item-availability', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;
  const { item_id, availability, hold_reason } = req.body;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const statusVal = availability === 'NOT_AVAILABLE' ? 'NOT_AVAILABLE' : 'AVAILABLE';
  db.prepare('UPDATE order_items SET item_availability = ? WHERE id = ? AND order_id = ?').run(statusVal, item_id, id);

  if (statusVal === 'NOT_AVAILABLE') {
    // Mark order ON HOLD and notify Admin
    db.prepare(`
      UPDATE orders
      SET packing_status = 'ON_HOLD',
          packing_notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(hold_reason || 'Item shortage reported during packing check', id);

    db.prepare(`
      INSERT INTO order_status_history (order_id, stage_name, previous_status, new_status, notes, created_by_id)
      VALUES (?, 'Packing On Hold', ?, 'ON_HOLD', ?, ?)
    `).run(id, order.packing_status || 'PENDING_PACKING', `Item shortage: ${hold_reason || 'Reported not available by packing team'}. Admin notified.`, user.id);

    logActivity(user.id, 'PACKING_ON_HOLD', 'order', order.order_number, `${user.name} marked ${order.order_number} ON HOLD due to item unavailability`);
    sendNotification(null, 'admin', 'Packing Order On Hold', `Order ${order.order_number} put on hold due to missing item stock`, 'warning', order.id);

    return res.json({ message: 'Item marked Not Available. Order is now ON HOLD and Admin has been notified.', packing_status: 'ON_HOLD' });
  } else {
    // Check if any other item is still NOT_AVAILABLE
    const notAvailCount = (db.prepare("SELECT COUNT(*) as count FROM order_items WHERE order_id = ? AND item_availability = 'NOT_AVAILABLE'").get(id) as { count: number }).count;
    if (notAvailCount === 0 && order.packing_status === 'ON_HOLD') {
      db.prepare("UPDATE orders SET packing_status = 'PENDING_PACKING', packing_notes = NULL WHERE id = ?").run(id);
    }
    return res.json({ message: 'Item marked Available and ready for packing.' });
  }
});

// Action 2: Start Packing
apiRouter.post('/orders/:id/start-packing', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  db.prepare(`
    UPDATE orders
    SET packing_status = 'PACKING_IN_PROGRESS',
        order_status = 'PROCESSING',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  db.prepare(`
    INSERT INTO order_status_history (order_id, stage_name, previous_status, new_status, notes, created_by_id)
    VALUES (?, 'Packing Started', ?, 'PACKING_IN_PROGRESS', ?, ?)
  `).run(id, order.packing_status || 'PENDING_PACKING', `Packing team initiated picking and drum/carton packing (Logged by ${user.name})`, user.id);

  logActivity(user.id, 'PACKING_STARTED', 'order', order.order_number, `${user.name} started packing order ${order.order_number}`);
  res.json({ message: 'Packing in progress', packing_status: 'PACKING_IN_PROGRESS' });
});

// Action 3: Complete Packing
apiRouter.post('/orders/:id/complete-packing', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Check if any items are NOT_AVAILABLE
  const notAvail = (db.prepare("SELECT COUNT(*) as count FROM order_items WHERE order_id = ? AND item_availability = 'NOT_AVAILABLE'").get(id) as { count: number }).count;
  if (notAvail > 0) {
    return res.status(400).json({ error: 'Cannot complete packing while one or more items are marked Not Available.' });
  }

  db.prepare(`UPDATE order_items SET produced_quantity = quantity WHERE order_id = ?`).run(id);

  db.prepare(`
    UPDATE orders
    SET packing_status = 'PACKED',
        order_status = 'PROCESSING',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  db.prepare(`
    INSERT INTO order_status_history (order_id, stage_name, previous_status, new_status, notes, created_by_id)
    VALUES (?, 'Packing Completed', ?, 'PACKED', ?, ?)
  `).run(id, order.packing_status || 'PACKING_IN_PROGRESS', `All ordered items packed, labeled and verified by ${user.name}. Ready for DELIVER.`, user.id);

  logActivity(user.id, 'PACKING_COMPLETED', 'order', order.order_number, `${user.name} completed packing for ${order.order_number}`);
  res.json({ message: 'Packing completed successfully! Status is Packed. Click DELIVER to mark Delivered.', packing_status: 'PACKED' });
});

// Action 4: Direct Delivery (New Final Workflow: Packed -> DELIVER Button -> Delivered)
apiRouter.post('/orders/:id/deliver', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (order.order_status === 'DELIVERED') {
    return res.status(400).json({ error: 'Order is already marked as Delivered' });
  }

  if (order.order_status === 'CANCELLED') {
    return res.status(400).json({ error: 'Cannot deliver a cancelled order' });
  }

  const isAuthorized =
    ['super_admin', 'admin', 'packing_team', 'production_team', 'sales_person'].includes(user.role_slug) ||
    user.permissions.includes('packing:deliver') ||
    user.permissions.includes('orders:deliver') ||
    user.permissions.includes('packing:manage') ||
    user.permissions.includes('packing:view') ||
    user.permissions.includes('orders:view_all') ||
    user.permissions.includes('orders:approve');

  if (!isAuthorized) {
    return res.status(403).json({ error: 'Access denied: You do not have permission to mark orders as Delivered' });
  }

  // Update line items: packed, dispatched, and delivered quantities match ordered quantity
  db.prepare(`
    UPDATE order_items
    SET produced_quantity = quantity,
        dispatched_quantity = quantity,
        delivered_quantity = quantity
    WHERE order_id = ?
  `).run(id);

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toLocaleTimeString('en-IN', { hour12: true });

  db.prepare(`
    UPDATE orders
    SET order_status = 'DELIVERED',
        delivery_status = 'DELIVERED',
        packing_status = 'PACKED',
        delivered_at = CURRENT_TIMESTAMP,
        delivered_by_id = ?,
        delivered_by_name = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(user.id, user.name, id);

  db.prepare(`
    INSERT INTO order_status_history (order_id, stage_name, previous_status, new_status, notes, created_by_id)
    VALUES (?, 'Order Delivered', ?, 'DELIVERED', ?, ?)
  `).run(id, order.order_status, `Order Delivered by ${user.name} on ${dateStr} at ${timeStr}`, user.id);

  logActivity(user.id, 'ORDER_DELIVERED', 'order', order.order_number, `${user.name} marked order ${order.order_number} as Delivered`);
  sendNotification(order.sales_person_id, null, 'Order Delivered', `Order ${order.order_number} has been Delivered!`, 'success', order.id);
  sendNotification(null, 'admin', 'Order Delivered', `Order ${order.order_number} delivered by ${user.name}`, 'info', order.id);

  res.json({
    message: 'Order marked as Delivered successfully!',
    order_status: 'DELIVERED',
    delivered_by_name: user.name,
    delivered_at: dateStr + ' ' + timeStr
  });
});

// Action 4: Handover to Dispatch Team
apiRouter.post('/orders/:id/handover-dispatch', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Update line items to show available packed quantity
  db.prepare('UPDATE order_items SET produced_quantity = quantity WHERE order_id = ?').run(id);

  db.prepare(`
    UPDATE orders
    SET packing_status = 'HANDED_OVER_TO_DISPATCH',
        production_status = 'PRODUCTION_COMPLETED',
        order_status = 'READY_FOR_DISPATCH',
        production_completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  db.prepare(`
    INSERT INTO order_status_history (order_id, stage_name, previous_status, new_status, notes, created_by_id)
    VALUES (?, 'Handed Over to Dispatch', ?, 'READY_FOR_DISPATCH', 'Packed consignment handed over to logistics bay. Ready for vehicle loading.', ?)
  `).run(id, order.packing_status || 'PACKED', user.id);

  logActivity(user.id, 'PACKING_HANDOVER', 'order', order.order_number, `${user.name} handed over packed order ${order.order_number} to Dispatch`);
  sendNotification(null, 'dispatch_team', 'Ready for Vehicle Loading', `Order ${order.order_number} packed and handed over to Dispatch bay`, 'success', order.id);

  res.json({ message: 'Order successfully handed over to Dispatch Team! Status updated to Ready for Dispatch.', packing_status: 'HANDED_OVER_TO_DISPATCH' });
});

// Backward compatibility handlers for legacy routes
apiRouter.post('/orders/:id/start-production', authMiddleware, (req: AuthRequest, res) => {
  db.prepare("UPDATE orders SET packing_status = 'PACKING_IN_PROGRESS', order_status = 'PROCESSING' WHERE id = ?").run(req.params.id);
  res.json({ message: 'Packing started' });
});
apiRouter.post('/orders/:id/mark-production-completed', authMiddleware, (req: AuthRequest, res) => {
  db.prepare('UPDATE order_items SET produced_quantity = quantity WHERE order_id = ?').run(req.params.id);
  db.prepare("UPDATE orders SET packing_status = 'HANDED_OVER_TO_DISPATCH', production_status = 'PRODUCTION_COMPLETED', order_status = 'READY_FOR_DISPATCH' WHERE id = ?").run(req.params.id);
  res.json({ message: 'Handed over to Dispatch' });
});

// -------------------------------------------------------------
// DISPATCH & DELIVERY MODULE
// -------------------------------------------------------------

apiRouter.get('/dispatch/orders', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const canViewDispatch = user.role_slug === 'super_admin' || user.permissions.includes('dispatch:view') || user.role_slug === 'admin' || user.role_slug === 'dispatch_team';
  if (!canViewDispatch) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to access Dispatch & Delivery' });
  }

  const isSalesPerson = user.role_slug === 'sales_person';
  let filterClause = isSalesPerson ? `AND o.sales_person_id = ${user.id}` : '';
  const queryParams: any[] = [];

  const { date_type, startDate, endDate, date_from, date_to, status, sales_person_id, vendor_id, search } = req.query;
  const sDate = (startDate || date_from) as string | undefined;
  const eDate = (endDate || date_to) as string | undefined;

  if (date_type === 'dispatch_date' && (sDate || eDate)) {
    filterClause += ' AND o.id IN (SELECT order_id FROM dispatches WHERE 1=1';
    if (sDate) { filterClause += ' AND DATE(dispatch_date) >= ?'; queryParams.push(sDate); }
    if (eDate) { filterClause += ' AND DATE(dispatch_date) <= ?'; queryParams.push(eDate); }
    filterClause += ')';
  } else if (date_type === 'delivery_date' && (sDate || eDate)) {
    filterClause += ' AND o.id IN (SELECT order_id FROM deliveries WHERE 1=1';
    if (sDate) { filterClause += ' AND DATE(delivery_date) >= ?'; queryParams.push(sDate); }
    if (eDate) { filterClause += ' AND DATE(delivery_date) <= ?'; queryParams.push(eDate); }
    filterClause += ')';
  } else if (sDate || eDate) {
    // Default: Order Date
    if (sDate) { filterClause += ' AND DATE(o.created_at) >= ?'; queryParams.push(sDate); }
    if (eDate) { filterClause += ' AND DATE(o.created_at) <= ?'; queryParams.push(eDate); }
  }

  if (sales_person_id && sales_person_id !== 'ALL') {
    filterClause += ' AND (o.sales_person_id = ? OR u.name = ?)';
    queryParams.push(sales_person_id, sales_person_id);
  }
  if (vendor_id && vendor_id !== 'ALL') {
    filterClause += ' AND (o.vendor_id = ? OR v.company_name = ?)';
    queryParams.push(vendor_id, vendor_id);
  }
  if (search) {
    filterClause += ' AND (o.order_number LIKE ? OR v.company_name LIKE ?)';
    const s = `%${search}%`;
    queryParams.push(s, s);
  }
  if (status && status !== 'ALL') {
    filterClause += ' AND o.order_status = ?';
    queryParams.push(status);
  }

  const orders = db.prepare(`
    SELECT o.id, o.order_number, o.order_status, o.dispatch_status, o.delivery_status,
           o.required_delivery_date, o.delivery_address, o.delivery_contact_person, o.delivery_contact_number,
           o.payment_status, o.grand_total, o.amount_received, o.pending_amount, o.created_at,
           v.company_name as vendor_name, v.city as vendor_city,
           u.name as sales_person_name,
           (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count,
           (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) as total_qty,
           (SELECT SUM(produced_quantity) FROM order_items WHERE order_id = o.id) as total_produced,
           (SELECT SUM(dispatched_quantity) FROM order_items WHERE order_id = o.id) as total_dispatched,
           (SELECT SUM(delivered_quantity) FROM order_items WHERE order_id = o.id) as total_delivered,
           (SELECT dispatch_date FROM dispatches WHERE order_id = o.id ORDER BY id DESC LIMIT 1) as last_dispatch_date,
           (SELECT delivery_date FROM deliveries WHERE order_id = o.id ORDER BY id DESC LIMIT 1) as last_delivery_date
    FROM orders o
    JOIN vendors v ON o.vendor_id = v.id
    JOIN users u ON o.sales_person_id = u.id
    WHERE o.order_status IN ('READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PROCESSING')
      AND (o.production_status = 'PRODUCTION_COMPLETED' OR o.dispatch_status != 'NOT_DISPATCHED')
      ${filterClause}
    ORDER BY CASE
      WHEN o.order_status = 'READY_FOR_DISPATCH' THEN 1
      WHEN o.order_status = 'OUT_FOR_DELIVERY' THEN 2
      ELSE 3
    END, o.id DESC
  `).all(...queryParams) as any[];

  const ordersWithItems = orders.map((o: any) => {
    const items = db.prepare(`
      SELECT oi.id, oi.product_id, oi.product_name, oi.sku, oi.unit, oi.quantity,
             oi.produced_quantity, oi.dispatched_quantity, oi.delivered_quantity,
             p.image_url as product_image, b.name as brand_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE oi.order_id = ?
    `).all(o.id);
    return { ...o, items };
  });

  const salesPersons = db.prepare(`
    SELECT DISTINCT u.id, u.name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE r.slug = 'sales_person' OR u.id IN (
      SELECT sales_person_id FROM orders WHERE order_status IN ('READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PROCESSING')
    )
    ORDER BY u.name ASC
  `).all();

  const vendors = db.prepare(`
    SELECT DISTINCT v.id, v.company_name as name
    FROM vendors v
    WHERE v.id IN (
      SELECT vendor_id FROM orders WHERE order_status IN ('READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PROCESSING')
    ) OR v.status = 'active'
    ORDER BY v.company_name ASC
  `).all();

  res.json({ orders: ordersWithItems, salesPersons, vendors });
});

apiRouter.post('/orders/:id/create-dispatch', authMiddleware, requirePermission('dispatch:create'), (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;
  const {
    transport_name, transport_contact, vehicle_number, lr_number, tracking_number,
    driver_name, driver_mobile, dispatch_date, notes, items
  } = req.body;

  if (!transport_name || !vehicle_number) {
    return res.status(400).json({ error: 'Transport Name and Vehicle Number are required' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Get order items
  const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id) as any[];
  const itemMap = new Map(orderItems.map(it => [it.id, it]));

  let totalDispatchQtyThisRun = 0;
  const dispatchItemsToInsert: { itemId: number; qty: number }[] = [];

  if (items && Array.isArray(items) && items.length > 0) {
    for (const dItem of items) {
      const dbIt = itemMap.get(Number(dItem.item_id));
      if (!dbIt) continue;
      const q = Number(dItem.quantity) || 0;
      if (q > 0) {
        const availableToDispatch = dbIt.produced_quantity - dbIt.dispatched_quantity;
        if (q > availableToDispatch) {
          return res.status(400).json({
            error: `Dispatch quantity (${q}) exceeds available produced stock (${availableToDispatch}) for ${dbIt.product_name}`
          });
        }
        dispatchItemsToInsert.push({ itemId: dbIt.id, qty: q });
        totalDispatchQtyThisRun += q;
      }
    }
  } else {
    // Dispatch all remaining produced items by default
    for (const dbIt of orderItems) {
      const remaining = dbIt.produced_quantity - dbIt.dispatched_quantity;
      if (remaining > 0) {
        dispatchItemsToInsert.push({ itemId: dbIt.id, qty: remaining });
        totalDispatchQtyThisRun += remaining;
      }
    }
  }

  if (totalDispatchQtyThisRun <= 0) {
    return res.status(400).json({ error: 'No items available to dispatch or quantity is 0' });
  }

  // Generate unique dispatch number
  const lastDispatch = db.prepare('SELECT id FROM dispatches ORDER BY id DESC LIMIT 1').get() as { id: number };
  const dispatchNum = `DSP-${8000 + (lastDispatch?.id || 0) + 1}`;

  const dDate = dispatch_date || new Date().toISOString().slice(0, 10);

  const dispRes = db.prepare(`
    INSERT INTO dispatches (
      dispatch_number, order_id, dispatch_date, transport_name, transport_contact,
      vehicle_number, lr_number, tracking_number, driver_name, driver_mobile,
      dispatch_quantity, notes, created_by_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    dispatchNum, id, dDate, transport_name, transport_contact || null,
    vehicle_number, lr_number || null, tracking_number || null, driver_name || null, driver_mobile || null,
    totalDispatchQtyThisRun, notes || null, user.id
  );

  const dispatchId = dispRes.lastInsertRowid as number;

  // Insert items and update order_items
  const insertDItem = db.prepare('INSERT INTO dispatch_items (dispatch_id, order_item_id, quantity) VALUES (?, ?, ?)');
  const updateOItem = db.prepare('UPDATE order_items SET dispatched_quantity = dispatched_quantity + ? WHERE id = ?');

  for (const di of dispatchItemsToInsert) {
    insertDItem.run(dispatchId, di.itemId, di.qty);
    updateOItem.run(di.qty, di.itemId);
  }

  // Check overall dispatch status
  const summary = db.prepare(`
    SELECT SUM(quantity) as total_qty, SUM(dispatched_quantity) as total_disp
    FROM order_items WHERE order_id = ?
  `).get(id) as { total_qty: number; total_disp: number };

  const isFullDispatch = summary.total_disp >= summary.total_qty;
  const nextDispStatus = isFullDispatch ? 'FULLY_DISPATCHED' : 'PARTIALLY_DISPATCHED';

  db.prepare(`
    UPDATE orders
    SET dispatch_status = ?,
        order_status = 'OUT_FOR_DELIVERY',
        delivery_status = 'OUT_FOR_DELIVERY',
        dispatched_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nextDispStatus, id);

  db.prepare(`
    INSERT INTO order_status_history (order_id, stage_name, previous_status, new_status, notes, created_by_id)
    VALUES (?, 'Order Dispatched', ?, 'OUT_FOR_DELIVERY', ?, ?)
  `).run(id, order.dispatch_status, `Dispatched via ${transport_name} (${vehicle_number}) LR #${lr_number || 'N/A'}. Qty: ${totalDispatchQtyThisRun}`, user.id);

  logActivity(user.id, 'ORDER_DISPATCHED', 'order', order.order_number, `${user.name} created dispatch ${dispatchNum} for ${order.order_number} (${vehicle_number})`);
  sendNotification(order.sales_person_id, null, 'Order Dispatched', `Order ${order.order_number} has been dispatched via ${transport_name} (${vehicle_number})`, 'info', order.id);

  res.json({
    message: `Dispatch ${dispatchNum} created successfully. Order is Out for Delivery.`,
    dispatch_number: dispatchNum,
    dispatch_status: nextDispStatus
  });
});

apiRouter.post('/orders/:id/update-delivery', authMiddleware, requirePermission('dispatch:update_delivery'), (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;
  const {
    dispatch_id, delivery_date, received_by, receiver_mobile, notes, items
  } = req.body;

  if (!received_by) {
    return res.status(400).json({ error: 'Receiver name / acknowledgement is required' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id) as any[];
  const itemMap = new Map(orderItems.map(it => [it.id, it]));

  let totalDeliveredQtyThisRun = 0;
  const deliveryItemsToInsert: { itemId: number; qty: number }[] = [];

  if (items && Array.isArray(items) && items.length > 0) {
    for (const dItem of items) {
      const dbIt = itemMap.get(Number(dItem.item_id));
      if (!dbIt) continue;
      const q = Number(dItem.quantity) || 0;
      if (q > 0) {
        const availableToDeliver = dbIt.dispatched_quantity - dbIt.delivered_quantity;
        if (q > availableToDeliver) {
          return res.status(400).json({
            error: `Delivered quantity (${q}) cannot exceed pending in-transit quantity (${availableToDeliver}) for ${dbIt.product_name}`
          });
        }
        deliveryItemsToInsert.push({ itemId: dbIt.id, qty: q });
        totalDeliveredQtyThisRun += q;
      }
    }
  } else {
    // Deliver all remaining dispatched quantities
    for (const dbIt of orderItems) {
      const remaining = dbIt.dispatched_quantity - dbIt.delivered_quantity;
      if (remaining > 0) {
        deliveryItemsToInsert.push({ itemId: dbIt.id, qty: remaining });
        totalDeliveredQtyThisRun += remaining;
      }
    }
  }

  if (totalDeliveredQtyThisRun <= 0) {
    return res.status(400).json({ error: 'No items remaining to deliver or quantity is 0' });
  }

  const dDate = delivery_date || new Date().toISOString().slice(0, 10);

  const delRes = db.prepare(`
    INSERT INTO deliveries (
      order_id, dispatch_id, delivery_date, delivered_quantity, received_by, receiver_mobile, notes, created_by_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, dispatch_id || null, dDate, totalDeliveredQtyThisRun, received_by, receiver_mobile || null, notes || null, user.id);

  const deliveryId = delRes.lastInsertRowid as number;

  // Insert items and update order_items
  const insertDelItem = db.prepare('INSERT INTO delivery_items (delivery_id, order_item_id, quantity) VALUES (?, ?, ?)');
  const updateOItem = db.prepare('UPDATE order_items SET delivered_quantity = delivered_quantity + ? WHERE id = ?');

  for (const di of deliveryItemsToInsert) {
    insertDelItem.run(deliveryId, di.itemId, di.qty);
    updateOItem.run(di.qty, di.itemId);
  }

  // Check overall delivery status
  const summary = db.prepare(`
    SELECT SUM(quantity) as total_qty, SUM(delivered_quantity) as total_del
    FROM order_items WHERE order_id = ?
  `).get(id) as { total_qty: number; total_del: number };

  const isFullDelivery = summary.total_del >= summary.total_qty;
  const nextDeliveryStatus = isFullDelivery ? 'DELIVERED' : 'PARTIALLY_DELIVERED';
  const nextOrderStatus = isFullDelivery ? 'DELIVERED' : order.order_status;

  db.prepare(`
    UPDATE orders
    SET delivery_status = ?,
        order_status = ?,
        delivered_at = CASE WHEN ? = 'DELIVERED' THEN CURRENT_TIMESTAMP ELSE delivered_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nextDeliveryStatus, nextOrderStatus, nextDeliveryStatus, id);

  db.prepare(`
    INSERT INTO order_status_history (order_id, stage_name, previous_status, new_status, notes, created_by_id)
    VALUES (?, 'Delivery Recorded', ?, ?, ?, ?)
  `).run(id, order.delivery_status, nextDeliveryStatus, `Received by ${received_by} (${receiver_mobile || 'No contact'}). Qty: ${totalDeliveredQtyThisRun}`, user.id);

  logActivity(user.id, 'DELIVERY_RECORDED', 'order', order.order_number, `${user.name} recorded delivery of ${totalDeliveredQtyThisRun} units for ${order.order_number}`);
  sendNotification(order.sales_person_id, null, 'Order Delivered', `Order ${order.order_number} has been received by ${received_by}`, 'success', order.id);

  res.json({
    message: isFullDelivery ? 'Order fully delivered! Note: Order will remain open until payment is verified.' : 'Partial delivery recorded successfully.',
    delivery_status: nextDeliveryStatus,
    order_status: nextOrderStatus
  });
});

// -------------------------------------------------------------
// PAYMENTS MODULE
// -------------------------------------------------------------

// Eligible Orders for Payment Submission (Strict ownership isolation for Sales Persons)
apiRouter.get('/payments/eligible-orders', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const isSalesPerson = user.role_slug === 'sales_person';
  let sql = `
    SELECT o.id, o.order_number, o.grand_total, o.amount_received, o.pending_amount,
           o.payment_status, o.order_status, o.sales_person_id,
           v.company_name as vendor_name,
           c.name as billing_company_name,
           u.name as sales_person_name
    FROM orders o
    JOIN vendors v ON o.vendor_id = v.id
    JOIN companies c ON o.company_id = c.id
    JOIN users u ON o.sales_person_id = u.id
    WHERE o.order_status != 'CANCELLED' AND o.pending_amount > 0.01
  `;
  const params: any[] = [];
  if (isSalesPerson) {
    sql += ' AND o.sales_person_id = ?';
    params.push(user.id);
  }
  sql += ' ORDER BY o.id DESC';
  const orders = db.prepare(sql).all(...params);
  res.json({ orders });
});

apiRouter.get('/payments', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const canView = user.role_slug === 'super_admin' || user.permissions.includes('payments:view') || user.permissions.includes('payments:add') || user.permissions.includes('payments:view_own') || user.permissions.includes('payments:view_all') || user.role_slug === 'admin' || user.role_slug === 'accounts' || user.role_slug === 'sales_person';
  if (!canView) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to access Payments & Ledger' });
  }

  const { search, status, payment_mode, date_type, startDate, endDate, date_from, date_to, sales_person_id, vendor_id, order_id } = req.query;
  const sDate = (startDate || date_from) as string | undefined;
  const eDate = (endDate || date_to) as string | undefined;

  let sql = `
    SELECT p.*,
           o.order_number, o.grand_total, o.grand_total as total_order_amount,
           o.amount_received as order_total_received, o.pending_amount, o.pending_amount as order_pending,
           o.payment_status as order_payment_status,
           o.sales_person_id as order_sales_person_id,
           v.company_name as vendor_name,
           c.name as billing_company_name,
           sp.name as sales_person_name,
           u.name as received_by_name,
           u.name as submitted_by_name,
           vu.name as verified_by_name,
           u_upd.name as updated_by_name
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    JOIN vendors v ON o.vendor_id = v.id
    JOIN companies c ON o.company_id = c.id
    JOIN users sp ON o.sales_person_id = sp.id
    JOIN users u ON p.received_by_id = u.id
    LEFT JOIN users vu ON p.verified_by_id = vu.id
    LEFT JOIN users u_upd ON p.updated_by_id = u_upd.id
    WHERE 1=1
  `;
  const params: any[] = [];

  // Security: Sales Person ONLY views payment records belonging to their own orders!
  // Backend MUST strictly enforce ownership. Do not take sales_person_id from query if user is sales_person.
  const isSalesPerson = user.role_slug === 'sales_person';
  if (isSalesPerson) {
    sql += ' AND o.sales_person_id = ?';
    params.push(user.id);
  } else if (sales_person_id && sales_person_id !== 'ALL') {
    sql += ' AND (o.sales_person_id = ? OR sp.name = ?)';
    params.push(sales_person_id, sales_person_id);
  }

  if (vendor_id && vendor_id !== 'ALL') {
    sql += ' AND (o.vendor_id = ? OR v.company_name = ?)';
    params.push(vendor_id, vendor_id);
  }

  if (order_id) {
    sql += ' AND (o.order_number LIKE ? OR o.id = ?)';
    params.push(`%${order_id}%`, order_id);
  }

  if (search) {
    sql += ' AND (p.payment_number LIKE ? OR o.order_number LIKE ? OR v.company_name LIKE ? OR p.reference_number LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  if (status === 'VERIFIED') {
    sql += ' AND (p.is_verified = 1 OR p.status = \'VERIFIED\')';
  } else if (status === 'PENDING' || status === 'PENDING_VERIFICATION') {
    sql += ' AND (p.is_verified = 0 AND (p.status IS NULL OR p.status = \'PENDING_VERIFICATION\'))';
  } else if (status === 'REJECTED') {
    sql += ' AND (p.is_verified = -1 OR p.status = \'REJECTED\')';
  }

  if (payment_mode && payment_mode !== 'ALL') {
    sql += ' AND p.payment_mode = ?';
    params.push(payment_mode);
  }

  // Date Filtering based on Date Type
  const dt = date_type || 'payment_date';
  let dateCol = 'p.payment_date';
  if (dt === 'submitted_date') {
    dateCol = 'DATE(p.created_at)';
  } else if (dt === 'verification_date') {
    dateCol = 'DATE(p.verified_at)';
  }

  if (sDate) {
    sql += ` AND ${dateCol} >= ?`;
    params.push(sDate);
  }
  if (eDate) {
    sql += ` AND ${dateCol} <= ?`;
    params.push(eDate);
  }

  sql += ' ORDER BY p.id DESC';
  const payments = db.prepare(sql).all(...params) as any[];

  // Compute exact summary figures for the filtered payments
  const totalAmount = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
  const verifiedList = payments.filter(p => p.is_verified === 1 || p.status === 'VERIFIED');
  const verifiedAmount = verifiedList.reduce((acc, p) => acc + (p.amount || 0), 0);
  const pendingList = payments.filter(p => p.is_verified === 0 && p.status !== 'REJECTED');
  const pendingAmount = pendingList.reduce((acc, p) => acc + (p.amount || 0), 0);
  const rejectedList = payments.filter(p => p.is_verified === -1 || p.status === 'REJECTED');
  const rejectedAmount = rejectedList.reduce((acc, p) => acc + (p.amount || 0), 0);

  // Compute accurate in-scope Order Book Totals (Total Order Value, Verified Received, Pending Balance)
  let orderScopeSql = "WHERE o.order_status != 'CANCELLED'";
  const orderScopeParams: any[] = [];
  if (isSalesPerson) {
    orderScopeSql += ' AND o.sales_person_id = ?';
    orderScopeParams.push(user.id);
  } else if (sales_person_id && sales_person_id !== 'ALL') {
    orderScopeSql += ' AND (o.sales_person_id = ? OR sp.name = ?)';
    orderScopeParams.push(sales_person_id, sales_person_id);
  }
  if (vendor_id && vendor_id !== 'ALL') {
    orderScopeSql += ' AND (o.vendor_id = ? OR v.company_name = ?)';
    orderScopeParams.push(vendor_id, vendor_id);
  }
  if (sDate) {
    orderScopeSql += ' AND DATE(o.created_at) >= ?';
    orderScopeParams.push(sDate);
  }
  if (eDate) {
    orderScopeSql += ' AND DATE(o.created_at) <= ?';
    orderScopeParams.push(eDate);
  }

  const orderFinancials = db.prepare(`
    SELECT
      COALESCE(SUM(o.grand_total), 0) as total_order_value,
      COALESCE(SUM(o.amount_received), 0) as total_verified_received,
      COALESCE(SUM(o.pending_amount), 0) as total_pending_amount
    FROM orders o
    JOIN users sp ON o.sales_person_id = sp.id
    JOIN vendors v ON o.vendor_id = v.id
    ${orderScopeSql}
  `).get(...orderScopeParams) as any;

  // Sales Persons List: for normal Sales Person, only return their own profile (no other reps exposed)
  const salesPersons = isSalesPerson
    ? [{ id: user.id, name: user.name }]
    : db.prepare(`
        SELECT DISTINCT u.id, u.name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE r.slug = 'sales_person' OR u.id IN (SELECT sales_person_id FROM orders)
        ORDER BY u.name ASC
      `).all();

  const vendors = isSalesPerson
    ? db.prepare(`
        SELECT DISTINCT v.id, v.company_name as name
        FROM vendors v
        WHERE v.assigned_sales_person_id = ? OR v.id IN (SELECT vendor_id FROM orders WHERE sales_person_id = ?)
        ORDER BY v.company_name ASC
      `).all(user.id, user.id)
    : db.prepare(`
        SELECT DISTINCT v.id, v.company_name as name
        FROM vendors v
        WHERE v.status = 'active' OR v.id IN (SELECT vendor_id FROM orders)
        ORDER BY v.company_name ASC
      `).all();

  res.json({
    payments,
    summary: {
      totalOrderValue: orderFinancials?.total_order_value || 0,
      verifiedReceived: orderFinancials?.total_verified_received || 0,
      pendingBalance: orderFinancials?.total_pending_amount || 0,
      totalPayments: payments.length,
      totalAmount,
      verifiedPayments: verifiedList.length,
      verifiedAmount,
      pendingVerification: pendingList.length,
      pendingAmount,
      rejectedPayments: rejectedList.length,
      rejectedAmount
    },
    salesPersons,
    vendors
  });
});

// Single Payment Details with strict data isolation
apiRouter.get('/payments/:id', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;

  const payment = db.prepare(`
    SELECT p.*,
           o.order_number, o.grand_total, o.grand_total as total_order_amount,
           o.amount_received as order_total_received, o.pending_amount, o.pending_amount as order_pending,
           o.payment_status as order_payment_status, o.sales_person_id,
           v.company_name as vendor_name,
           c.name as billing_company_name,
           sp.name as sales_person_name,
           u.name as received_by_name,
           u.name as submitted_by_name,
           vu.name as verified_by_name
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    JOIN vendors v ON o.vendor_id = v.id
    JOIN companies c ON o.company_id = c.id
    JOIN users sp ON o.sales_person_id = sp.id
    JOIN users u ON p.received_by_id = u.id
    LEFT JOIN users vu ON p.verified_by_id = vu.id
    WHERE p.id = ? OR p.payment_number = ?
  `).get(id, id) as any;

  if (!payment) {
    return res.status(404).json({ error: 'Payment record not found' });
  }

  // Security Check: Sales Person can ONLY access payment details for their own orders!
  if (user.role_slug === 'sales_person' && payment.sales_person_id !== user.id) {
    return res.status(403).json({ error: 'Forbidden: Access denied. You can only view payments for your own orders.' });
  }

  res.json({ payment });
});

// Order Payments List with strict data isolation
apiRouter.get('/orders/:id/payments', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;

  const order = db.prepare('SELECT id, order_number, sales_person_id FROM orders WHERE id = ? OR order_number = ?').get(id, id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Security Check: Sales Person can ONLY access payment records for their own orders!
  if (user.role_slug === 'sales_person' && order.sales_person_id !== user.id) {
    return res.status(403).json({ error: 'Forbidden: Access denied. You can only view payments for your own orders.' });
  }

  const payments = db.prepare(`
    SELECT p.*,
           u.name as received_by_name,
           u.name as submitted_by_name,
           vu.name as verified_by_name
    FROM payments p
    JOIN users u ON p.received_by_id = u.id
    LEFT JOIN users vu ON p.verified_by_id = vu.id
    WHERE p.order_id = ?
    ORDER BY p.id DESC
  `).all(order.id);

  res.json({ payments });
});

// Shared robust Payment Submission Handler
function executePaymentSubmission(req: AuthRequest, res: Response, targetOrderId: any, bodyData: any) {
  const user = req.user!;
  const canSubmit = user.role_slug === 'super_admin' || user.role_slug === 'admin' || user.role_slug === 'accounts' || user.role_slug === 'sales_person' || user.permissions.includes('payments:add') || user.permissions.includes('payments:submit') || user.permissions.includes('payments.add') || user.permissions.includes('payments.submit');

  if (!canSubmit) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to submit payment entries' });
  }

  const orderId = targetOrderId || bodyData.order_id;
  if (!orderId) {
    return res.status(400).json({ error: 'Please select an Order.' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ? OR order_number = ?').get(orderId, orderId) as any;
  if (!order) {
    return res.status(404).json({ error: 'Selected Order does not exist' });
  }

  if (order.order_status === 'CANCELLED') {
    return res.status(400).json({ error: 'Cannot record payment for a cancelled order' });
  }

  // Security Rule: Sales Person can ONLY submit payment against THEIR OWN Order!
  // Backend derives ownership from Order, not trusting frontend-submitted salesPersonId.
  if (user.role_slug === 'sales_person' && order.sales_person_id !== user.id) {
    return res.status(403).json({ error: 'You cannot submit payment against another Sales Person\'s order' });
  }

  const { amount, payment_date, payment_mode, reference_number, proof_url, notes } = bodyData;

  const paymentAmt = Number(amount);
  if (isNaN(paymentAmt) || paymentAmt <= 0) {
    return res.status(400).json({ error: 'Payment amount must be greater than ₹0.' });
  }

  // Recalculate current verified/pending amount on backend to guarantee freshness and prevent overpayment
  const verifiedResult = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM payments
    WHERE order_id = ? AND (is_verified = 1 OR status = 'VERIFIED')
  `).get(order.id) as { total: number };

  const currentVerified = verifiedResult?.total || 0;
  const currentPending = Math.max(0, order.grand_total - currentVerified);

  if (currentPending <= 0) {
    return res.status(400).json({ error: 'This order is already fully paid. No pending balance remains.' });
  }

  if (paymentAmt > currentPending + 0.01) {
    return res.status(400).json({
      error: `Payment amount (₹${paymentAmt.toLocaleString('en-IN')}) exceeds the pending order amount (₹${currentPending.toLocaleString('en-IN')}).`
    });
  }

  // Generate unique payment/transaction ID: PAY-10025 format
  const lastPayment = db.prepare('SELECT id FROM payments ORDER BY id DESC LIMIT 1').get() as { id: number };
  const nextNum = 10000 + (lastPayment?.id || 0) + 1;
  const payNumber = `PAY-${nextNum}`;

  // IMPORTANT: Do NOT immediately increase Verified Received!
  // Submitted payment ALWAYS starts as PENDING_VERIFICATION (is_verified = 0)
  const insertResult = db.prepare(`
    INSERT INTO payments (
      payment_number, order_id, amount, payment_date, payment_mode, reference_number,
      proof_url, status, notes, is_verified, received_by_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING_VERIFICATION', ?, 0, ?)
  `).run(
    payNumber, order.id, paymentAmt,
    payment_date || new Date().toISOString().slice(0, 10),
    payment_mode || 'Bank Transfer',
    reference_number || `TXN-${Date.now().toString().slice(-6)}`,
    proof_url || null,
    notes || null,
    user.id
  );

  const newPaymentId = insertResult.lastInsertRowid;

  // Create audit / order status history entry
  db.prepare(`
    INSERT INTO order_status_history (order_id, stage_name, previous_status, new_status, notes, created_by_id)
    VALUES (?, 'Payment Submitted', ?, ?, ?, ?)
  `).run(
    order.id,
    order.payment_status,
    order.payment_status,
    `Payment entry ${payNumber} of ₹${paymentAmt.toLocaleString('en-IN')} submitted by ${user.name} via ${payment_mode || 'Bank Transfer'} (Ref: ${reference_number || 'N/A'}). Awaiting Accounts Verification.`,
    user.id
  );

  logActivity(
    user.id,
    'PAYMENT_SUBMITTED',
    'payment',
    payNumber,
    `${user.name} submitted payment ${payNumber} of ₹${paymentAmt.toLocaleString('en-IN')} for ${order.order_number} (Pending Accounts Verification)`
  );

  sendNotification(
    null,
    'accounts',
    'Pending Payment Verification',
    `New payment ${payNumber} of ₹${paymentAmt.toLocaleString('en-IN')} submitted for ${order.order_number} by ${user.name}`,
    'warning',
    order.id
  );

  return res.json({
    success: true,
    message: 'Payment submitted successfully and sent for Accounts verification.',
    payment_id: newPaymentId,
    payment_number: payNumber,
    status: 'PENDING_VERIFICATION',
    amount: paymentAmt,
    current_verified: currentVerified,
    pending_amount: currentPending
  });
}

// Endpoint 1: POST /api/orders/:id/add-payment
apiRouter.post('/orders/:id/add-payment', authMiddleware, (req: AuthRequest, res: Response) => {
  executePaymentSubmission(req, res, req.params.id, req.body);
});

// Endpoint 2: POST /api/payments
apiRouter.post('/payments', authMiddleware, (req: AuthRequest, res: Response) => {
  executePaymentSubmission(req, res, req.body.order_id, req.body);
});

// Endpoint 3: POST /api/payments/add
apiRouter.post('/payments/add', authMiddleware, (req: AuthRequest, res: Response) => {
  executePaymentSubmission(req, res, req.body.order_id, req.body);
});

apiRouter.post('/payments/:id/verify', authMiddleware, requirePermission('payments:verify'), (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;

  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id) as any;
  if (!payment) return res.status(404).json({ error: 'Payment record not found' });
  if (payment.is_verified === 1) {
    return res.status(400).json({ error: 'Payment is already verified' });
  }

  // Mark payment verified
  db.prepare(`
    UPDATE payments
    SET is_verified = 1, status = 'VERIFIED', verified_by_id = ?, verified_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(user.id, id);

  // Recalculate order payment totals
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(payment.order_id) as any;
  const totalVerified = db.prepare(`
    SELECT SUM(amount) as total FROM payments WHERE order_id = ? AND is_verified = 1
  `).get(payment.order_id) as { total: number };

  const currentReceived = totalVerified.total || 0;
  const newPending = Math.max(0, order.grand_total - currentReceived);

  let nextPayStatus = 'UNPAID';
  if (currentReceived >= order.grand_total) {
    nextPayStatus = 'FULLY_PAID';
  } else if (currentReceived > 0) {
    nextPayStatus = 'PARTIALLY_PAID';
  }

  db.prepare(`
    UPDATE orders
    SET amount_received = ?,
        pending_amount = ?,
        payment_status = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(currentReceived, newPending, nextPayStatus, order.id);

  db.prepare(`
    INSERT INTO order_status_history (order_id, stage_name, previous_status, new_status, notes, created_by_id)
    VALUES (?, 'Payment Verified', ?, ?, ?, ?)
  `).run(order.id, order.payment_status, nextPayStatus, `Accounts verified payment of ₹${payment.amount.toLocaleString('en-IN')} (${payment.payment_mode} - Ref: ${payment.reference_number || 'N/A'}). Ledger updated.`, user.id);

  logActivity(user.id, 'PAYMENT_VERIFIED', 'payment', payment.payment_number, `${user.name} approved and verified payment ${payment.payment_number} of ₹${payment.amount.toLocaleString('en-IN')}`);
  sendNotification(payment.received_by_id, null, 'Payment Approved', `Your submitted payment of ₹${payment.amount.toLocaleString('en-IN')} for order ${order.order_number} has been verified by Accounts`, 'success', order.id);

  res.json({
    message: `Payment of ₹${payment.amount.toLocaleString('en-IN')} verified successfully. Ledger and order balance updated.`,
    amount_received: currentReceived,
    pending_amount: newPending,
    payment_status: nextPayStatus
  });
});

apiRouter.post('/payments/:id/reject', authMiddleware, requirePermission('payments:verify'), (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;
  const { rejection_reason } = req.body;

  if (!rejection_reason || !rejection_reason.trim()) {
    return res.status(400).json({ error: 'Rejection reason is required' });
  }

  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id) as any;
  if (!payment) return res.status(404).json({ error: 'Payment record not found' });
  if (payment.is_verified === 1) {
    return res.status(400).json({ error: 'Cannot reject a payment that has already been verified' });
  }

  db.prepare(`
    UPDATE payments
    SET is_verified = -1, status = 'REJECTED', rejection_reason = ?, verified_by_id = ?, verified_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(rejection_reason.trim(), user.id, id);

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(payment.order_id) as any;

  db.prepare(`
    INSERT INTO order_status_history (order_id, stage_name, previous_status, new_status, notes, created_by_id)
    VALUES (?, 'Payment Rejected', ?, ?, ?, ?)
  `).run(order.id, order.payment_status, order.payment_status, `Payment of ₹${payment.amount.toLocaleString('en-IN')} rejected by Accounts. Reason: ${rejection_reason.trim()}`, user.id);

  logActivity(user.id, 'PAYMENT_REJECTED', 'payment', payment.payment_number, `${user.name} rejected payment ${payment.payment_number}: ${rejection_reason.trim()}`);
  sendNotification(payment.received_by_id, null, 'Payment Rejected', `Payment of ₹${payment.amount.toLocaleString('en-IN')} for order ${order.order_number} was rejected: ${rejection_reason.trim()}`, 'warning', order.id);

  res.json({ message: 'Payment rejected. Submitting user has been notified.' });
});

// -------------------------------------------------------------
// EDIT PAYMENT (Updates existing payment ID without creating duplicate)
// -------------------------------------------------------------
apiRouter.put('/payments/:id', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;

  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id) as any;
  if (!payment) return res.status(404).json({ error: 'Payment entry not found' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(payment.order_id) as any;
  if (!order) return res.status(404).json({ error: 'Associated order not found' });

  const isSuperAdmin = user.role_slug === 'super_admin';
  const isAdmin = user.role_slug === 'admin' || isSuperAdmin;
  const isAccounts = user.role_slug === 'accounts';
  const hasVerifyPerm = user.permissions.includes('payments:verify');
  const hasAccountsOrAdminPerm = isAdmin || isAccounts || hasVerifyPerm || user.permissions.includes('payments:manage');

  // IMPORTANT PAYMENT RULES:
  // If payment is still "Pending Verification", authorized submitter / Admin can edit it.
  // If payment is already "Verified/Approved", normal Sales Person cannot edit it. Only Admin / Super Admin / Accounts with proper permission can edit/correct it.
  if (payment.is_verified === 1) {
    if (!hasAccountsOrAdminPerm) {
      return res.status(403).json({
        error: 'Access denied: Verified / approved payments can only be edited by Admin, Super Admin, or Accounts.'
      });
    }
  } else {
    // Pending Verification or Rejected
    const isSubmitter = payment.received_by_id === user.id;
    const isOrderSalesPerson = order.sales_person_id === user.id;
    const canEditPending = hasAccountsOrAdminPerm || isSubmitter || isOrderSalesPerson || user.permissions.includes('payments:add') || user.permissions.includes('payments:submit');
    if (!canEditPending) {
      return res.status(403).json({
        error: 'Access denied: You do not have permission to edit this payment entry.'
      });
    }
  }

  const { amount, payment_date, payment_mode, reference_number, proof_url, notes } = req.body;

  const newAmount = amount !== undefined ? Number(amount) : payment.amount;
  if (isNaN(newAmount) || newAmount <= 0) {
    return res.status(400).json({ error: 'Valid payment amount greater than 0 is required.' });
  }

  const oldAmount = payment.amount;
  const updatedDate = payment_date || payment.payment_date;
  const updatedMode = payment_mode || payment.payment_mode;
  const updatedRef = reference_number !== undefined ? (reference_number ? reference_number.trim() : null) : payment.reference_number;
  const updatedProof = proof_url !== undefined ? (proof_url ? proof_url.trim() : null) : payment.proof_url;
  const updatedNotes = notes !== undefined ? (notes ? notes.trim() : null) : payment.notes;

  // Save changes to the SAME Payment ID
  db.prepare(`
    UPDATE payments
    SET amount = ?,
        payment_date = ?,
        payment_mode = ?,
        reference_number = ?,
        proof_url = ?,
        notes = ?,
        updated_by_id = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    newAmount,
    updatedDate,
    updatedMode,
    updatedRef,
    updatedProof,
    updatedNotes,
    user.id,
    id
  );

  // Recalculate Verified Received and Balance Payment correctly
  // Order Total -> Verified Received -> Balance Payment
  const totalVerified = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE order_id = ? AND is_verified = 1
  `).get(order.id) as { total: number };

  const currentReceived = Math.round((totalVerified.total || 0) * 100) / 100;
  const newPending = Math.max(0, Math.round((order.grand_total - currentReceived) * 100) / 100);

  let nextPayStatus = 'UNPAID';
  if (currentReceived >= order.grand_total && order.grand_total > 0) {
    nextPayStatus = 'FULLY_PAID';
  } else if (currentReceived > 0) {
    nextPayStatus = 'PARTIALLY_PAID';
  }

  db.prepare(`
    UPDATE orders
    SET amount_received = ?,
        pending_amount = ?,
        payment_status = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(currentReceived, newPending, nextPayStatus, order.id);

  // Keep Payment Updated By + Updated Date/Time in audit history
  db.prepare(`
    INSERT INTO order_status_history (order_id, stage_name, previous_status, new_status, notes, created_by_id)
    VALUES (?, 'Payment Edited', ?, ?, ?, ?)
  `).run(
    order.id,
    order.payment_status,
    nextPayStatus,
    `Payment entry #${payment.payment_number} (${payment.is_verified === 1 ? 'Verified' : 'Pending'}) edited by ${user.name}: Amount ₹${oldAmount.toLocaleString('en-IN')} -> ₹${newAmount.toLocaleString('en-IN')}, Mode: ${updatedMode}, Ref: ${updatedRef || 'N/A'}. Order balances updated.`,
    user.id
  );

  logActivity(
    user.id,
    'PAYMENT_UPDATED',
    'payment',
    payment.payment_number,
    `${user.name} edited payment #${payment.payment_number} for order ${order.order_number}: ₹${oldAmount.toLocaleString('en-IN')} -> ₹${newAmount.toLocaleString('en-IN')}`
  );

  const updatedPayment = db.prepare(`
    SELECT p.*, o.order_number, o.grand_total as total_order_amount, o.pending_amount,
           v.company_name as vendor_name, c.name as billing_company_name,
           u_sub.name as received_by_name, u_ver.name as verified_by_name,
           u_upd.name as updated_by_name
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    JOIN vendors v ON o.vendor_id = v.id
    LEFT JOIN companies c ON o.company_id = c.id
    JOIN users u_sub ON p.received_by_id = u_sub.id
    LEFT JOIN users u_ver ON p.verified_by_id = u_ver.id
    LEFT JOIN users u_upd ON p.updated_by_id = u_upd.id
    WHERE p.id = ?
  `).get(id);

  res.json({
    success: true,
    message: 'Payment updated successfully.',
    payment: updatedPayment,
    order: {
      id: order.id,
      grand_total: order.grand_total,
      amount_received: currentReceived,
      pending_amount: newPending,
      payment_status: nextPayStatus
    }
  });
});

// -------------------------------------------------------------
// PACKING MANAGEMENT MODULE (Actions)
// -------------------------------------------------------------

apiRouter.post('/orders/:id/packing-action', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const canManagePacking = user.role_slug === 'super_admin' || user.permissions.includes('packing:manage') || user.permissions.includes('production:update') || user.role_slug === 'admin' || user.role_slug === 'production_team';
  if (!canManagePacking) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to manage packing actions' });
  }
  const { id } = req.params;
  const { action, item_id, availability, notes, rejection_reason } = req.body;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (action === 'START_PACKING') {
    db.prepare(`
      UPDATE orders
      SET packing_status = 'PACKING_IN_PROGRESS', order_status = 'PROCESSING', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    db.prepare(`
      INSERT INTO order_status_history (order_id, stage_name, previous_status, new_status, notes, created_by_id)
      VALUES (?, 'Packing Started', ?, 'PACKING_IN_PROGRESS', 'Packing team started picking and packing finished lubricant items', ?)
    `).run(id, order.packing_status, user.id);

    return res.json({ message: 'Order packing in progress' });
  }

  if (action === 'ITEM_AVAILABILITY') {
    if (!item_id || !availability) {
      return res.status(400).json({ error: 'item_id and availability are required' });
    }
    db.prepare(`UPDATE order_items SET item_availability = ? WHERE id = ? AND order_id = ?`).run(availability, item_id, id);

    if (availability === 'NOT_AVAILABLE') {
      db.prepare(`
        UPDATE orders
        SET packing_status = 'ON_HOLD', order_status = 'ON_HOLD', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(id);

      db.prepare(`
        INSERT INTO order_status_history (order_id, stage_name, previous_status, new_status, notes, created_by_id)
        VALUES (?, 'Order On Hold', ?, 'ON_HOLD', ?, ?)
      `).run(id, order.order_status, `Item marked Not Available by Packing Team. Order placed On Hold.`, user.id);

      sendNotification(null, 'admin', 'Order On Hold - Item Unavailable', `Order ${order.order_number} marked ON HOLD by packing team: item out of stock`, 'warning', order.id);
    }

    return res.json({ message: `Item availability updated to ${availability}` });
  }

  if (action === 'MARK_ON_HOLD') {
    db.prepare(`
      UPDATE orders
      SET packing_status = 'ON_HOLD', order_status = 'ON_HOLD', packing_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(notes || 'Item not available in warehouse', id);

    db.prepare(`
      INSERT INTO order_status_history (order_id, stage_name, previous_status, new_status, notes, created_by_id)
      VALUES (?, 'Order On Hold', ?, 'ON_HOLD', ?, ?)
    `).run(id, order.order_status, notes || 'Placed on hold by Packing Team', user.id);

    sendNotification(null, 'admin', 'Order Placed On Hold', `Order ${order.order_number} placed ON HOLD by packing team: ${notes || 'Stock unavailable'}`, 'warning', order.id);

    return res.json({ message: 'Order placed On Hold and Admin notified' });
  }

  if (action === 'PACKING_COMPLETED') {
    // Automatically ensure produced_quantity matches quantity for finished goods
    db.prepare(`UPDATE order_items SET produced_quantity = quantity WHERE order_id = ?`).run(id);

    db.prepare(`
      UPDATE orders
      SET packing_status = 'PACKED', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    db.prepare(`
      INSERT INTO order_status_history (order_id, stage_name, previous_status, new_status, notes, created_by_id)
      VALUES (?, 'Packing Completed', ?, 'PACKED', 'Finished products packed and sealed in warehouse', ?)
    `).run(id, order.packing_status, user.id);

    return res.json({ message: 'Packing completed successfully' });
  }

  if (action === 'HANDOVER_DISPATCH') {
    // Automatically set produced_quantity = quantity so dispatch team can dispatch immediately!
    db.prepare(`UPDATE order_items SET produced_quantity = quantity WHERE order_id = ?`).run(id);

    db.prepare(`
      UPDATE orders
      SET packing_status = 'HANDED_OVER',
          order_status = 'READY_FOR_DISPATCH',
          production_status = 'PRODUCTION_COMPLETED',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    db.prepare(`
      INSERT INTO order_status_history (order_id, stage_name, previous_status, new_status, notes, created_by_id)
      VALUES (?, 'Handed Over to Dispatch', ?, 'READY_FOR_DISPATCH', 'Order packed and handed over to Dispatch Team. Ready for vehicle loading.', ?)
    `).run(id, order.packing_status, user.id);

    sendNotification(null, 'dispatch', 'Ready for Dispatch', `Order ${order.order_number} has been packed and handed over for transport loading`, 'info', order.id);

    return res.json({ message: 'Order handed over to Dispatch Team successfully' });
  }

  if (action === 'DELIVER_ORDER') {
    // Direct delivery by packing team (New Workflow)
    db.prepare(`UPDATE order_items SET produced_quantity = quantity, delivered_quantity = quantity WHERE order_id = ?`).run(id);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toLocaleTimeString('en-IN', { hour12: true });

    db.prepare(`
      UPDATE orders
      SET order_status = 'DELIVERED',
          delivery_status = 'DELIVERED',
          packing_status = 'PACKED',
          delivered_at = CURRENT_TIMESTAMP,
          delivered_by_id = ?,
          delivered_by_name = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(user.id, user.name, id);

    db.prepare(`
      INSERT INTO order_status_history (order_id, stage_name, previous_status, new_status, notes, created_by_id)
      VALUES (?, 'Order Delivered', ?, 'DELIVERED', ?, ?)
    `).run(id, order.order_status, `Order Delivered by ${user.name} on ${dateStr} at ${timeStr}`, user.id);

    logActivity(user.id, 'ORDER_DELIVERED', 'order', order.order_number, `${user.name} confirmed direct delivery of order ${order.order_number}`);
    sendNotification(order.sales_person_id, null, 'Order Delivered', `Order ${order.order_number} has been Delivered!`, 'success', order.id);

    return res.json({
      message: 'Order marked as Delivered successfully!',
      order_status: 'DELIVERED',
      delivered_by_name: user.name,
      delivered_at: dateStr + ' ' + timeStr
    });
  }

  res.status(400).json({ error: 'Unknown packing action' });
});

// -------------------------------------------------------------
// STRICT ORDER COMPLETION RULE
// Rule: Order can ONLY be completed if Delivery = DELIVERED AND Payment = FULLY_PAID!
// -------------------------------------------------------------

apiRouter.post('/orders/:id/complete', authMiddleware, requirePermission('orders:complete'), (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (order.order_status === 'COMPLETED') {
    return res.status(400).json({ error: 'Order is already marked Completed' });
  }

  if (order.order_status === 'CANCELLED') {
    return res.status(400).json({ error: 'Cannot complete a cancelled order' });
  }

  // Business Rule 1: Must be Delivered
  if (order.delivery_status !== 'DELIVERED') {
    return res.status(400).json({
      error: `Strict Rule Violation: Order cannot be completed because goods have not been fully delivered yet. Current delivery status: ${order.delivery_status}.`
    });
  }

  // Business Rule 2: Must be Fully Paid
  if (order.payment_status !== 'FULLY_PAID' || order.pending_amount > 0) {
    return res.status(400).json({
      error: `Strict Rule Violation: Order cannot be completed because payment is outstanding. Pending balance: ₹${order.pending_amount.toLocaleString('en-IN')}. Please settle and verify payment before completion.`
    });
  }

  db.prepare(`
    UPDATE orders
    SET order_status = 'COMPLETED',
        completed_at = CURRENT_TIMESTAMP,
        completed_by_id = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(user.id, id);

  db.prepare(`
    INSERT INTO order_status_history (order_id, stage_name, previous_status, new_status, notes, created_by_id)
    VALUES (?, 'Order Closed & Completed', 'DELIVERED', 'COMPLETED', ?, ?)
  `).run(id, `Final closure authorized by ${user.name}. Verified full physical delivery & 100% financial settlement.`, user.id);

  logActivity(user.id, 'ORDER_COMPLETED', 'order', order.order_number, `${user.name} closed order ${order.order_number} as 100% completed`);
  sendNotification(order.sales_person_id, null, 'Order Completed', `Order ${order.order_number} has been closed as COMPLETED!`, 'success', order.id);

  res.json({ message: 'Order closed and marked COMPLETED successfully!' });
});

// -------------------------------------------------------------
// SALES PERSONS PERFORMANCE & PROFILES
// -------------------------------------------------------------

apiRouter.get('/sales-persons', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const isSalesPerson = user.role_slug === 'sales_person';
  const filterSalesPersonId = isSalesPerson ? `AND u.id = ${user.id}` : '';

  const salesPersons = db.prepare(`
    SELECT u.id, u.name, u.email, u.mobile, u.employee_id, u.avatar_url, u.status,
           COUNT(DISTINCT v.id) as vendor_count,
           COUNT(DISTINCT o.id) as total_orders,
           SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.grand_total ELSE 0 END) as total_sales,
           SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.amount_received ELSE 0 END) as total_received,
           SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.pending_amount ELSE 0 END) as total_pending
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN vendors v ON u.id = v.assigned_sales_person_id
    LEFT JOIN orders o ON u.id = o.sales_person_id
    WHERE r.slug = 'sales_person' ${filterSalesPersonId}
    GROUP BY u.id
    ORDER BY total_sales DESC
  `).all();

  res.json({ salesPersons });
});

apiRouter.get('/sales-persons/:id', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;
  const { period, startDate, endDate, date_from, date_to } = req.query;

  // Strict ownership check: Sales Person cannot view another Sales Person profile
  if (user.role_slug === 'sales_person' && Number(id) !== user.id) {
    return res.status(403).json({ error: 'Forbidden: Access denied. You can only view your own sales performance profile.' });
  }

  const person = db.prepare(`
    SELECT u.*, r.name as role_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = ?
  `).get(id) as any;

  if (!person) return res.status(404).json({ error: 'Sales person not found' });

  // Calculate start and end date from query or preset
  let sDate = (startDate || date_from) as string | undefined;
  let eDate = (endDate || date_to) as string | undefined;

  const ref = new Date();
  const formatYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  if (!sDate && !eDate && period) {
    if (period === 'today') {
      sDate = formatYMD(ref);
      eDate = formatYMD(ref);
    } else if (period === 'yesterday') {
      const y = new Date(ref);
      y.setDate(ref.getDate() - 1);
      sDate = formatYMD(y);
      eDate = formatYMD(y);
    } else if (period === 'this_week') {
      const day = ref.getDay();
      const diffToMon = day === 0 ? -6 : 1 - day;
      const mon = new Date(ref);
      mon.setDate(ref.getDate() + diffToMon);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      sDate = formatYMD(mon);
      eDate = formatYMD(sun);
    } else if (period === 'last_week') {
      const day = ref.getDay();
      const diffToMon = day === 0 ? -6 : 1 - day;
      const thisMon = new Date(ref);
      thisMon.setDate(ref.getDate() + diffToMon);
      const lastMon = new Date(thisMon);
      lastMon.setDate(thisMon.getDate() - 7);
      const lastSun = new Date(lastMon);
      lastSun.setDate(lastMon.getDate() + 6);
      sDate = formatYMD(lastMon);
      eDate = formatYMD(lastSun);
    } else if (period === 'this_month') {
      const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
      const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
      sDate = formatYMD(start);
      eDate = formatYMD(end);
    } else if (period === 'last_month') {
      const start = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
      const end = new Date(ref.getFullYear(), ref.getMonth(), 0);
      sDate = formatYMD(start);
      eDate = formatYMD(end);
    } else if (period === 'this_year') {
      const start = new Date(ref.getFullYear(), 0, 1);
      const end = new Date(ref.getFullYear(), 11, 31);
      sDate = formatYMD(start);
      eDate = formatYMD(end);
    }
  }

  let dateFilter = '';
  const filterParams: any[] = [id];
  if (sDate) {
    dateFilter += ' AND DATE(o.created_at) >= ?';
    filterParams.push(sDate);
  }
  if (eDate) {
    dateFilter += ' AND DATE(o.created_at) <= ?';
    filterParams.push(eDate);
  }

  const metrics = db.prepare(`
    SELECT
      COUNT(DISTINCT o.id) as total_orders,
      COALESCE(SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.grand_total ELSE 0 END), 0) as total_order_value,
      COALESCE(SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.amount_received ELSE 0 END), 0) as amount_received,
      COALESCE(SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.pending_amount ELSE 0 END), 0) as pending_amount,
      SUM(CASE WHEN o.order_status = 'NEW' THEN 1 ELSE 0 END) as new_orders,
      SUM(CASE WHEN o.order_status = 'ACCEPTED' THEN 1 ELSE 0 END) as approved_orders,
      SUM(CASE WHEN o.order_status = 'PROCESSING' OR (o.packing_status IN ('PENDING_PACKING', 'IN_PROGRESS', 'PACKING_IN_PROGRESS', 'PACKED') AND o.order_status NOT IN ('DELIVERED', 'COMPLETED', 'CANCELLED')) THEN 1 ELSE 0 END) as packing_orders,
      SUM(CASE WHEN o.order_status = 'DELIVERED' OR o.delivery_status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered_orders,
      SUM(CASE WHEN o.order_status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_orders,
      COUNT(DISTINCT o.vendor_id) as active_parties_in_period
    FROM orders o
    WHERE o.sales_person_id = ? ${dateFilter}
  `).get(...filterParams) as any;

  // Total assigned parties count
  const partyCountRow = db.prepare('SELECT COUNT(*) as count FROM vendors WHERE assigned_sales_person_id = ?').get(id) as { count: number };

  const ordersRaw = db.prepare(`
    SELECT o.*, v.company_name as vendor_name, v.company_name as party_name, v.city as vendor_city, c.name as company_name
    FROM orders o
    JOIN vendors v ON o.vendor_id = v.id
    JOIN companies c ON o.company_id = c.id
    WHERE o.sales_person_id = ? ${dateFilter}
    ORDER BY o.id DESC
  `).all(...filterParams) as any[];

  const getSalesOrderItemsStmt = db.prepare(`
    SELECT oi.id, oi.product_id, oi.product_name, oi.sku, oi.quantity, oi.unit, oi.rate, oi.line_amount,
           COALESCE(p.image_url, 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=80&auto=format&fit=crop&q=80') as product_image
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `);

  const orders = ordersRaw.map((ord: any) => ({
    ...ord,
    items: getSalesOrderItemsStmt.all(ord.id)
  }));

  // Top products in this period
  const topProducts = db.prepare(`
    SELECT oi.product_name, oi.sku, oi.unit,
           COALESCE(p.image_url, 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=80&auto=format&fit=crop&q=80') as product_image,
           SUM(oi.quantity) as total_qty,
           SUM(oi.line_amount) as total_amount
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE o.sales_person_id = ? ${dateFilter} AND o.order_status != 'CANCELLED'
    GROUP BY oi.product_id, oi.sku
    ORDER BY total_amount DESC
    LIMIT 10
  `).all(...filterParams);

  // Top parties in this period
  const topParties = db.prepare(`
    SELECT v.id, v.company_name, v.company_name as party_name, v.city,
           COUNT(o.id) as order_count,
           SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.grand_total ELSE 0 END) as total_spent,
           SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.amount_received ELSE 0 END) as total_received,
           SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.pending_amount ELSE 0 END) as balance_payment
    FROM vendors v
    JOIN orders o ON v.id = o.vendor_id
    WHERE o.sales_person_id = ? ${dateFilter}
    GROUP BY v.id
    ORDER BY total_spent DESC
    LIMIT 10
  `).all(...filterParams);

  // Sales Trend chart in this period
  const isShortRange = sDate && eDate && (new Date(eDate).getTime() - new Date(sDate).getTime() <= 35 * 86400000);
  const trendGroup = isShortRange ? "DATE(o.created_at)" : "strftime('%Y-%m', o.created_at)";
  const salesTrend = db.prepare(`
    SELECT ${trendGroup} as period,
           COUNT(*) as orders_count,
           SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.grand_total ELSE 0 END) as total_sales,
           SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.amount_received ELSE 0 END) as total_received,
           SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.pending_amount ELSE 0 END) as balance_payment
    FROM orders o
    WHERE o.sales_person_id = ? ${dateFilter}
    GROUP BY ${trendGroup}
    ORDER BY period ASC
  `).all(...filterParams);

  const parties = db.prepare('SELECT *, company_name as party_name FROM vendors WHERE assigned_sales_person_id = ? ORDER BY company_name ASC').all(id);

  res.json({
    person,
    metrics: {
      ...metrics,
      party_count: metrics?.active_parties_in_period || 0,
      total_assigned_parties: partyCountRow.count || 0
    },
    orders,
    parties,
    vendors: parties,
    topProducts,
    topParties,
    topVendors: topParties,
    salesTrend,
    dateRange: {
      startDate: sDate || '',
      endDate: eDate || ''
    }
  });
});

// -------------------------------------------------------------
// REPORTS MODULE
// -------------------------------------------------------------

apiRouter.get('/reports/:type', authMiddleware, requirePermission('reports:view'), (req: AuthRequest, res) => {
  const user = req.user!;
  const isSalesPerson = user.role_slug === 'sales_person';
  const { type } = req.params;
  const { company_id, sales_person_id, vendor_id, status, date_from, date_to } = req.query;

  let whereClauses: string[] = ['1=1'];
  const params: any[] = [];

  // Strict backend data isolation for Sales Persons in all reports
  if (isSalesPerson) {
    if (type === 'sales-person') {
      whereClauses.push('u.id = ?');
      params.push(user.id);
    } else if (type === 'vendor') {
      whereClauses.push('v.assigned_sales_person_id = ?');
      params.push(user.id);
    } else if (type !== 'product') {
      whereClauses.push('o.sales_person_id = ?');
      params.push(user.id);
    }
  } else {
    if (sales_person_id && sales_person_id !== 'ALL') {
      whereClauses.push('o.sales_person_id = ?');
      params.push(sales_person_id);
    }
  }

  if (company_id) {
    whereClauses.push('o.company_id = ?');
    params.push(company_id);
  }
  if (vendor_id && vendor_id !== 'ALL') {
    whereClauses.push('o.vendor_id = ?');
    params.push(vendor_id);
  }
  if (status && status !== 'ALL') {
    if (status === 'APPROVED' || status === 'ACCEPTED') {
      whereClauses.push("o.order_status IN ('ACCEPTED', 'APPROVED')");
    } else if (status === 'PACKING' || status === 'PROCESSING') {
      whereClauses.push("o.order_status IN ('PROCESSING', 'PACKING', 'READY_FOR_DISPATCH')");
    } else if (status === 'DELIVERED') {
      whereClauses.push("o.order_status IN ('DELIVERED', 'COMPLETED', 'OUT_FOR_DELIVERY')");
    } else {
      whereClauses.push('o.order_status = ?');
      params.push(status);
    }
  }
  if (date_from) {
    whereClauses.push('DATE(o.created_at) >= ?');
    params.push(date_from);
  }
  if (date_to) {
    whereClauses.push('DATE(o.created_at) <= ?');
    params.push(date_to);
  }

  const whereStr = whereClauses.join(' AND ');

  if (type === 'orders') {
    const data = db.prepare(`
      SELECT o.order_number, o.created_at,
             CASE
               WHEN o.order_status = 'NEW' THEN 'New'
               WHEN o.order_status IN ('ACCEPTED', 'APPROVED') THEN 'Approved'
               WHEN o.order_status IN ('PROCESSING', 'PACKING', 'READY_FOR_DISPATCH') THEN 'Packing'
               WHEN o.order_status IN ('DELIVERED', 'COMPLETED', 'OUT_FOR_DELIVERY') THEN 'Delivered'
               WHEN o.order_status = 'CANCELLED' THEN 'Cancelled'
               ELSE o.order_status
             END as order_status,
             o.payment_status, o.grand_total, o.amount_received, o.pending_amount,
             v.company_name as vendor_name, u.name as sales_person_name, c.name as company_name
      FROM orders o
      JOIN vendors v ON o.vendor_id = v.id
      JOIN users u ON o.sales_person_id = u.id
      JOIN companies c ON o.company_id = c.id
      WHERE ${whereStr}
      ORDER BY o.id DESC
    `).all(...params);
    return res.json({ report: 'Order Master Report', data });
  }

  if (type === 'sales-person') {
    const data = db.prepare(`
      SELECT u.name, u.employee_id,
             COUNT(o.id) as orders_count,
             SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.grand_total ELSE 0 END) as total_sales,
             SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.amount_received ELSE 0 END) as total_received,
             SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.pending_amount ELSE 0 END) as total_pending,
             SUM(CASE WHEN o.order_status IN ('DELIVERED', 'COMPLETED') THEN 1 ELSE 0 END) as delivered_orders
      FROM users u
      JOIN orders o ON u.id = o.sales_person_id
      WHERE ${whereStr}
      GROUP BY u.id
      ORDER BY total_sales DESC
    `).all(...params);
    return res.json({ report: 'Sales Person Performance Report', data });
  }

  if (type === 'vendor') {
    const data = db.prepare(`
      SELECT v.company_name, v.city, v.state, u.name as sales_person_name,
             COUNT(o.id) as orders_count,
             SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.grand_total ELSE 0 END) as total_order_value,
             SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.amount_received ELSE 0 END) as total_received,
             SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.pending_amount ELSE 0 END) as total_pending
      FROM vendors v
      JOIN orders o ON v.id = o.vendor_id
      JOIN users u ON v.assigned_sales_person_id = u.id
      WHERE ${whereStr}
      GROUP BY v.id
      ORDER BY total_order_value DESC
    `).all(...params);
    return res.json({ report: 'Vendor-wise Sales Analysis', data });
  }

  if (type === 'product') {
    const data = db.prepare(`
      SELECT oi.sku, oi.product_name, oi.unit,
             SUM(oi.quantity) as total_quantity,
             SUM(oi.line_amount) as total_sales_value,
             AVG(oi.rate) as average_selling_rate
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE ${whereStr} AND o.order_status != 'CANCELLED'
      GROUP BY oi.product_id, oi.sku
      ORDER BY total_sales_value DESC
    `).all(...params);
    return res.json({ report: 'Product-wise Sales Analysis', data });
  }

  if (type === 'outstanding') {
    const data = db.prepare(`
      SELECT o.order_number, o.created_at, o.grand_total, o.amount_received, o.pending_amount, o.order_status,
             v.company_name as vendor_name, v.mobile as vendor_mobile, u.name as sales_person_name, c.name as company_name
      FROM orders o
      JOIN vendors v ON o.vendor_id = v.id
      JOIN users u ON o.sales_person_id = u.id
      JOIN companies c ON o.company_id = c.id
      WHERE ${whereStr} AND o.pending_amount > 0 AND o.order_status != 'CANCELLED'
      ORDER BY o.pending_amount DESC
    `).all(...params);
    return res.json({ report: 'Outstanding Payment Ledger', data });
  }

  if (type === 'dispatch') {
    const data = db.prepare(`
      SELECT d.dispatch_number, d.dispatch_date, d.transport_name, d.vehicle_number, d.lr_number, d.dispatch_quantity,
             o.order_number, v.company_name as vendor_name, o.delivery_status
      FROM dispatches d
      JOIN orders o ON d.order_id = o.id
      JOIN vendors v ON o.vendor_id = v.id
      WHERE ${whereStr}
      ORDER BY d.id DESC
    `).all(...params);
    return res.json({ report: 'Dispatch & Fleet Logistics Report', data });
  }

  return res.status(400).json({ error: 'Unknown report type' });
});

// -------------------------------------------------------------
// USERS & ROLES MANAGEMENT
// -------------------------------------------------------------

apiRouter.get('/users', authMiddleware, requirePermission('users:manage'), (_req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.name, u.email, u.mobile, u.employee_id, u.avatar_url, u.status, u.created_at,
           r.name as role_name, r.slug as role_slug, r.id as role_id
    FROM users u
    JOIN roles r ON u.role_id = r.id
    ORDER BY u.id ASC
  `).all();
  res.json({ users });
});

apiRouter.post('/users', authMiddleware, requirePermission('users:manage'), (req: AuthRequest, res) => {
  const { name, email, password, role_id, mobile, employee_id } = req.body;
  if (!name || !email || !password || !role_id) {
    return res.status(400).json({ error: 'Name, email, password, and role are required' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (existing) return res.status(400).json({ error: 'A user with this email already exists' });

  const password_hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role_id, mobile, employee_id, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
  `).run(name, email, password_hash, role_id, mobile || null, employee_id || null);

  logActivity(req.user!.id, 'USER_CREATED', 'user', email, `Created user account for ${name} (${email})`);
  res.json({ id: result.lastInsertRowid, message: 'User created successfully' });
});

apiRouter.put('/users/:id', authMiddleware, requirePermission('users:manage'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, email, password, role_id, mobile, employee_id, status } = req.body;

  if (password && password.trim().length >= 6) {
    const password_hash = bcrypt.hashSync(password, 10);
    db.prepare(`
      UPDATE users
      SET name = ?, email = ?, password_hash = ?, role_id = ?, mobile = ?, employee_id = ?, status = ?
      WHERE id = ?
    `).run(name, email, password_hash, role_id, mobile, employee_id, status || 'active', id);
  } else {
    db.prepare(`
      UPDATE users
      SET name = ?, email = ?, role_id = ?, mobile = ?, employee_id = ?, status = ?
      WHERE id = ?
    `).run(name, email, role_id, mobile, employee_id, status || 'active', id);
  }

  logActivity(req.user!.id, 'USER_UPDATED', 'user', id, `Updated user credentials for ID ${id}`);
  res.json({ message: 'User updated successfully' });
});

apiRouter.get('/roles', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const canManage = user.role_slug === 'super_admin' || user.role_slug === 'admin' ||
    user.permissions?.includes('roles:manage') || user.permissions?.includes('roles.manage');
  const canView = canManage || user.permissions?.includes('roles:view') || user.permissions?.includes('roles.view');

  if (!canView) {
    return res.status(403).json({ error: 'Forbidden: Missing permission to view roles' });
  }

  const roles = db.prepare('SELECT * FROM roles ORDER BY id ASC').all() as any[];
  const permissions = db.prepare('SELECT * FROM permissions ORDER BY module ASC, id ASC').all();

  for (const r of roles) {
    const perms = db.prepare(`
      SELECT p.id, p.code, p.module, p.action, p.description FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ?
      ORDER BY p.module ASC, p.id ASC
    `).all(r.id);
    r.permissions = perms;
    r.permission_ids = perms.map((p: any) => p.id);
  }

  res.json({ roles, allPermissions: permissions });
});

apiRouter.get('/roles/:id/permissions', authMiddleware, (req: AuthRequest, res) => {
  const roleId = Number(req.params.id);
  if (!roleId || isNaN(roleId)) return res.status(400).json({ error: 'Valid numeric role ID required' });

  const role = db.prepare('SELECT id, name, slug, description, is_system FROM roles WHERE id = ?').get(roleId) as any;
  if (!role) return res.status(404).json({ error: 'Role not found' });

  const perms = db.prepare(`
    SELECT p.id, p.code, p.module, p.action, p.description
    FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = ?
    ORDER BY p.module ASC, p.id ASC
  `).all(roleId);

  res.json({
    role,
    permissions: perms,
    permission_ids: perms.map((p: any) => p.id)
  });
});

const handleSaveRolePermissions = (req: AuthRequest, res: any) => {
  const user = req.user!;
  const canManage = user.role_slug === 'super_admin' || user.role_slug === 'admin' ||
    user.permissions?.includes('roles:manage') || user.permissions?.includes('roles.manage');

  if (!canManage) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to manage roles' });
  }

  const roleId = Number(req.params.id);
  if (!roleId || isNaN(roleId)) {
    return res.status(400).json({ error: 'Valid numeric role ID required' });
  }

  const role = db.prepare('SELECT id, name, slug, description, is_system FROM roles WHERE id = ?').get(roleId) as any;
  if (!role) {
    return res.status(404).json({ error: `Role with ID ${roleId} not found` });
  }

  const rawList = Array.isArray(req.body.permission_ids)
    ? req.body.permission_ids
    : (Array.isArray(req.body.permissions) ? req.body.permissions : null);

  if (!rawList) {
    return res.status(400).json({ error: 'permission_ids array required' });
  }

  // Fetch all permissions in database to validate
  const allDbPerms = db.prepare('SELECT id, code, module, action FROM permissions').all() as any[];
  const idMap = new Map<number, any>();
  const codeMap = new Map<string, any>();

  for (const p of allDbPerms) {
    idMap.set(p.id, p);
    codeMap.set(p.code.toLowerCase(), p);
    codeMap.set(p.code.replace(/:/g, '.').toLowerCase(), p);
    codeMap.set(p.code.replace(/\./g, ':').toLowerCase(), p);
  }

  const validPermIds = new Set<number>();
  const invalidItems: any[] = [];

  for (const item of rawList) {
    if (typeof item === 'number' && idMap.has(item)) {
      validPermIds.add(item);
    } else if (typeof item === 'string') {
      const num = parseInt(item.trim(), 10);
      if (!isNaN(num) && idMap.has(num)) {
        validPermIds.add(num);
      } else {
        const match = codeMap.get(item.trim().toLowerCase());
        if (match) {
          validPermIds.add(match.id);
        } else {
          invalidItems.push(item);
        }
      }
    } else {
      invalidItems.push(item);
    }
  }

  if (invalidItems.length > 0) {
    return res.status(400).json({
      error: `Invalid permission identifier(s): ${invalidItems.join(', ')}`
    });
  }

  const finalPermIds = Array.from(validPermIds);

  // Execute atomic database transaction
  const updateTx = db.transaction((rId: number, pIds: number[]) => {
    // 1. Delete all old role-permission mappings for this role
    db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(rId);

    // 2. Insert currently selected permissions
    const insertStmt = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
    for (const pid of pIds) {
      insertStmt.run(rId, pid);
    }
  });

  try {
    updateTx(roleId, finalPermIds);
  } catch (dbErr: any) {
    console.error('Failed to update role permissions transaction:', dbErr);
    return res.status(500).json({ error: `Database transaction failed: ${dbErr?.message || 'Unknown error'}` });
  }

  logActivity(
    user.id,
    'ROLE_PERMS_UPDATED',
    'role',
    String(roleId),
    `Updated permissions matrix for role "${role.name}" (${finalPermIds.length} permissions active)`
  );

  return res.json({
    success: true,
    message: 'Permissions saved successfully.',
    role_id: roleId,
    role_name: role.name,
    permission_count: finalPermIds.length,
    permission_ids: finalPermIds
  });
};

apiRouter.put('/roles/:id/permissions', authMiddleware, handleSaveRolePermissions);
apiRouter.post('/roles/:id/permissions', authMiddleware, handleSaveRolePermissions);

// -------------------------------------------------------------
// CREATE CUSTOM ROLE
// -------------------------------------------------------------
apiRouter.post('/roles', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const canManage = user.role_slug === 'super_admin' || user.role_slug === 'admin' ||
    user.permissions?.includes('roles:manage') || user.permissions?.includes('roles.manage');

  if (!canManage) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to create roles.' });
  }

  const { name, description, permission_ids } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Role name is required.' });
  }

  const trimmedName = name.trim();
  const existingRole = db.prepare('SELECT id FROM roles WHERE LOWER(name) = LOWER(?)').get(trimmedName);
  if (existingRole) {
    return res.status(400).json({ error: `A role with the name "${trimmedName}" already exists.` });
  }

  // Generate unique slug
  let baseSlug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!baseSlug) baseSlug = 'custom_role';
  let slug = baseSlug;
  let counter = 1;
  while (db.prepare('SELECT id FROM roles WHERE slug = ?').get(slug)) {
    slug = `${baseSlug}_${counter++}`;
  }

  const desc = description !== undefined && description !== null && description.trim() !== ''
    ? description.trim()
    : `Custom role created by ${user.name}`;

  const insertResult = db.prepare(`
    INSERT INTO roles (name, slug, description, is_system, created_at)
    VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)
  `).run(trimmedName, slug, desc);

  const newRoleId = Number(insertResult.lastInsertRowid);

  // If initial permission_ids provided, save them
  if (Array.isArray(permission_ids) && permission_ids.length > 0) {
    const insertPerm = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
    for (const pid of permission_ids) {
      if (typeof pid === 'number') {
        insertPerm.run(newRoleId, pid);
      }
    }
  }

  logActivity(
    user.id,
    'ROLE_CREATED',
    'role',
    String(newRoleId),
    `${user.name} created custom role "${trimmedName}" (slug: ${slug})`
  );

  const newRole = db.prepare('SELECT * FROM roles WHERE id = ?').get(newRoleId) as any;
  const perms = db.prepare(`
    SELECT p.id, p.code, p.module, p.action, p.description
    FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = ?
    ORDER BY p.module ASC, p.id ASC
  `).all(newRoleId);
  newRole.permissions = perms;
  newRole.permission_ids = perms.map((p: any) => p.id);

  res.status(201).json({
    success: true,
    message: `Custom role "${trimmedName}" created successfully.`,
    role: newRole
  });
});

// -------------------------------------------------------------
// EDIT CUSTOM ROLE
// -------------------------------------------------------------
apiRouter.put('/roles/:id', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const canManage = user.role_slug === 'super_admin' || user.role_slug === 'admin' ||
    user.permissions?.includes('roles:manage') || user.permissions?.includes('roles.manage');

  if (!canManage) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to edit roles.' });
  }

  const roleId = Number(req.params.id);
  if (!roleId || isNaN(roleId)) return res.status(400).json({ error: 'Valid numeric role ID required.' });

  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(roleId) as any;
  if (!role) return res.status(404).json({ error: 'Role not found.' });

  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Role name is required.' });
  }

  const trimmedName = name.trim();
  if (role.is_system === 1 && trimmedName.toLowerCase() !== role.name.toLowerCase()) {
    return res.status(400).json({ error: 'Cannot rename core system roles.' });
  }

  const nameConflict = db.prepare('SELECT id FROM roles WHERE LOWER(name) = LOWER(?) AND id != ?').get(trimmedName, roleId);
  if (nameConflict) {
    return res.status(400).json({ error: `A role with the name "${trimmedName}" already exists.` });
  }

  const updatedDesc = description !== undefined ? description.trim() : role.description;

  db.prepare(`
    UPDATE roles
    SET name = ?, description = ?
    WHERE id = ?
  `).run(trimmedName, updatedDesc, roleId);

  logActivity(
    user.id,
    'ROLE_UPDATED',
    'role',
    String(roleId),
    `${user.name} updated role details for "${trimmedName}"`
  );

  const updatedRole = db.prepare('SELECT * FROM roles WHERE id = ?').get(roleId) as any;
  const perms = db.prepare(`
    SELECT p.id, p.code, p.module, p.action, p.description
    FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = ?
    ORDER BY p.module ASC, p.id ASC
  `).all(roleId);
  updatedRole.permissions = perms;
  updatedRole.permission_ids = perms.map((p: any) => p.id);

  res.json({
    success: true,
    message: 'Role updated successfully.',
    role: updatedRole
  });
});

// -------------------------------------------------------------
// DELETE CUSTOM ROLE
// -------------------------------------------------------------
apiRouter.delete('/roles/:id', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const canManage = user.role_slug === 'super_admin' || user.role_slug === 'admin' ||
    user.permissions?.includes('roles:manage') || user.permissions?.includes('roles.manage');

  if (!canManage) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to delete roles.' });
  }

  const roleId = Number(req.params.id);
  if (!roleId || isNaN(roleId)) return res.status(400).json({ error: 'Valid numeric role ID required.' });

  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(roleId) as any;
  if (!role) return res.status(404).json({ error: 'Role not found.' });

  if (role.is_system === 1) {
    return res.status(400).json({ error: `Core system role "${role.name}" cannot be deleted.` });
  }

  const assignedUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE role_id = ?').get(roleId) as { count: number };
  if (assignedUsers.count > 0) {
    return res.status(400).json({
      error: `Cannot delete role "${role.name}": ${assignedUsers.count} user(s) currently assigned. Please reassign them to another role first.`
    });
  }

  db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(roleId);
  db.prepare('DELETE FROM roles WHERE id = ?').run(roleId);

  logActivity(
    user.id,
    'ROLE_DELETED',
    'role',
    String(roleId),
    `${user.name} deleted custom role "${role.name}" (slug: ${role.slug})`
  );

  res.json({
    success: true,
    message: `Custom role "${role.name}" deleted successfully.`
  });
});

// -------------------------------------------------------------
// NOTIFICATIONS & AUDIT LOGS
// -------------------------------------------------------------

apiRouter.get('/notifications', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const notifs = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ? OR role_slug = ? OR (user_id IS NULL AND role_slug IS NULL)
    ORDER BY id DESC
    LIMIT 20
  `).all(user.id, user.role_slug);

  const unreadCount = db.prepare(`
    SELECT COUNT(*) as count FROM notifications
    WHERE (user_id = ? OR role_slug = ? OR (user_id IS NULL AND role_slug IS NULL)) AND is_read = 0
  `).get(user.id, user.role_slug) as { count: number };

  res.json({ notifications: notifs, unreadCount: unreadCount.count });
});

apiRouter.post('/notifications/:id/read', authMiddleware, (req, res) => {
  const { id } = req.params;
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
  res.json({ success: true });
});

apiRouter.post('/notifications/read-all', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  db.prepare(`
    UPDATE notifications SET is_read = 1
    WHERE user_id = ? OR role_slug = ?
  `).run(user.id, user.role_slug);
  res.json({ success: true });
});

apiRouter.get('/activity-logs', authMiddleware, requirePermission('activity:view'), (_req, res) => {
  const logs = db.prepare(`
    SELECT a.*, u.name as user_name, u.email as user_email, r.name as role_name
    FROM activity_logs a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN roles r ON u.role_id = r.id
    ORDER BY a.id DESC
    LIMIT 100
  `).all();
  res.json({ logs });
});

// -------------------------------------------------------------
// BILLS MODULE (Invoice viewing/reporting from existing Orders & Payments)
// -------------------------------------------------------------

apiRouter.get('/bills', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  const isSuperAdmin = user.role_slug === 'super_admin';
  const isAdmin = user.role_slug === 'admin' || isSuperAdmin;
  const isAccounts = user.role_slug === 'accounts';
  const canViewAll = isSuperAdmin || isAdmin || isAccounts || user.permissions.includes('bills:view_all');
  const canViewOwn = user.permissions.includes('bills:view_own') || user.role_slug === 'sales_person';

  // Packing Team & unauthorized roles: No payment/financial access unless specifically granted
  if (!canViewAll && !canViewOwn) {
    return res.status(403).json({ error: 'Access denied: You do not have permission to access the Bills module.' });
  }

  const {
    tax_type, startDate, endDate, date_from, date_to,
    vendor_id, party_id, sales_person_id, payment_status, search
  } = req.query;

  const sDate = (startDate || date_from) as string | undefined;
  const eDate = (endDate || date_to) as string | undefined;
  const vId = (party_id || vendor_id) as string | undefined;

  let sql = `
    SELECT o.id as id,
           o.id as order_id,
           o.order_number,
           REPLACE(o.order_number, 'ORD-', 'INV-') as invoice_number,
           o.created_at as order_date,
           o.created_at as invoice_date,
           o.created_at,
           o.order_status,
           o.tax_type,
           o.tax_rate,
           o.subtotal,
           o.tax_amount,
           o.grand_total as bill_amount,
           o.amount_received as received_amount,
           o.pending_amount as balance_payment,
           o.payment_status,
           o.payment_terms,
           o.notes,
           v.id as party_id,
           v.company_name as party_name,
           v.city as party_city,
           v.state as party_state,
           v.gstin as party_gstin,
           v.mobile as party_mobile,
           v.billing_address as party_address,
           c.id as company_id,
           c.name as company_name,
           c.code as company_code,
           c.gst_number as company_gstin,
           SUBSTR(c.gst_number, 3, 10) as company_pan,
           c.address as company_address,
           c.city as company_city,
           c.state as company_state,
           c.pincode as company_pincode,
           c.mobile as company_mobile,
           c.email as company_email,
           c.bank_name as company_bank,
           c.account_no as company_account,
           c.ifsc_code as company_ifsc,
           c.branch as company_branch,
           c.terms as company_terms,
           u.id as sales_person_id,
           u.name as sales_person_name,
           u.mobile as sales_person_mobile,
           u.email as sales_person_email,
           (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count,
           (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) as total_quantity,
           (SELECT GROUP_CONCAT(product_name || ' – ' || unit, ', ') FROM (SELECT product_name, unit FROM order_items WHERE order_id = o.id LIMIT 2)) as products_summary
    FROM orders o
    JOIN vendors v ON o.vendor_id = v.id
    JOIN users u ON o.sales_person_id = u.id
    JOIN companies c ON o.company_id = c.id
    WHERE o.order_status != 'CANCELLED'
  `;
  const params: any[] = [];

  // Security Rule: Sales Person or view_own can ONLY see their own bills!
  if (user.role_slug === 'sales_person' || (!canViewAll && canViewOwn)) {
    sql += ' AND o.sales_person_id = ?';
    params.push(user.id);
  } else if (sales_person_id && sales_person_id !== 'ALL') {
    sql += ' AND (o.sales_person_id = ? OR u.name = ?)';
    params.push(sales_person_id, sales_person_id);
  }

  // Tax Type filter: ALL / GST / Non-GST
  if (tax_type && tax_type !== 'ALL') {
    if (tax_type === 'GST' || tax_type === 'GST_18') {
      sql += " AND (o.tax_type = 'GST_18' OR o.tax_type IS NULL OR o.tax_type = '')";
    } else if (tax_type === 'NON_GST') {
      sql += " AND o.tax_type = 'NON_GST'";
    }
  }

  // Party filter
  if (vId && vId !== 'ALL') {
    sql += ' AND (o.vendor_id = ? OR v.company_name = ?)';
    params.push(vId, vId);
  }

  // Payment Status filter: ALL / PAID / PARTIAL / UNPAID
  if (payment_status && payment_status !== 'ALL') {
    if (payment_status === 'PAID') {
      sql += ' AND o.pending_amount <= 0 AND o.amount_received > 0';
    } else if (payment_status === 'PARTIAL') {
      sql += ' AND o.amount_received > 0 AND o.pending_amount > 0';
    } else if (payment_status === 'UNPAID') {
      sql += ' AND (o.amount_received <= 0 OR o.amount_received IS NULL)';
    } else {
      sql += ' AND o.payment_status = ?';
      params.push(payment_status);
    }
  }

  // Date Range filter
  if (sDate) {
    sql += ' AND DATE(o.created_at) >= DATE(?)';
    params.push(sDate);
  }
  if (eDate) {
    sql += ' AND DATE(o.created_at) <= DATE(?)';
    params.push(eDate);
  }

  // Search filter
  if (search) {
    sql += ` AND (
      o.order_number LIKE ? OR
      REPLACE(o.order_number, 'ORD-', 'INV-') LIKE ? OR
      v.company_name LIKE ? OR
      u.name LIKE ?
    )`;
    const sTerm = `%${search}%`;
    params.push(sTerm, sTerm, sTerm, sTerm);
  }

  sql += ' ORDER BY o.id DESC';

  const rows = db.prepare(sql).all(...params) as any[];

  let totalBillsCount = 0;
  let gstBillsCount = 0;
  let nonGstBillsCount = 0;
  let totalBillingAmount = 0;
  let totalReceived = 0;
  let balancePayment = 0;

  const processedBills = rows.map(r => {
    const isNonGst = r.tax_type === 'NON_GST';
    const billAmt = Number(r.bill_amount) || 0;
    const recAmt = Number(r.received_amount) || 0;
    const balAmt = Math.max(0, Number(r.balance_payment) || (billAmt - recAmt));

    let taxableAmt = 0;
    let gstAmt = 0;
    let cgstAmt = 0;
    let sgstAmt = 0;

    if (isNonGst) {
      taxableAmt = billAmt;
      gstAmt = 0;
      cgstAmt = 0;
      sgstAmt = 0;
    } else {
      taxableAmt = Math.round((billAmt / 1.18) * 100) / 100;
      gstAmt = Math.round((billAmt - taxableAmt) * 100) / 100;
      cgstAmt = Math.round((gstAmt / 2) * 100) / 100;
      sgstAmt = Math.round((gstAmt - cgstAmt) * 100) / 100;
    }

    let pStatus = 'UNPAID';
    if (balAmt <= 0 && recAmt > 0) {
      pStatus = 'PAID';
    } else if (recAmt > 0) {
      pStatus = 'PARTIAL';
    }

    totalBillsCount += 1;
    if (isNonGst) {
      nonGstBillsCount += 1;
    } else {
      gstBillsCount += 1;
    }
    totalBillingAmount += billAmt;
    totalReceived += recAmt;
    balancePayment += balAmt;

    return {
      ...r,
      tax_type: isNonGst ? 'NON_GST' : 'GST_18',
      bill_amount: billAmt,
      taxable_amount: taxableAmt,
      gst_amount: gstAmt,
      cgst_amount: cgstAmt,
      sgst_amount: sgstAmt,
      received_amount: recAmt,
      balance_payment: balAmt,
      payment_status: pStatus
    };
  });

  res.json({
    bills: processedBills,
    summary: {
      total_bills: totalBillsCount,
      gst_bills: gstBillsCount,
      non_gst_bills: nonGstBillsCount,
      total_billing_amount: Math.round(totalBillingAmount * 100) / 100,
      total_received: Math.round(totalReceived * 100) / 100,
      balance_payment: Math.round(balancePayment * 100) / 100
    }
  });
});

apiRouter.get('/bills/:id', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const user = req.user!;
  const isSuperAdmin = user.role_slug === 'super_admin';
  const isAdmin = user.role_slug === 'admin' || isSuperAdmin;
  const isAccounts = user.role_slug === 'accounts';
  const canViewAll = isSuperAdmin || isAdmin || isAccounts || user.permissions.includes('bills:view_all');
  const canViewOwn = user.permissions.includes('bills:view_own') || user.role_slug === 'sales_person';

  if (!canViewAll && !canViewOwn) {
    return res.status(403).json({ error: 'Access denied: You do not have permission to view bills.' });
  }

  const order = db.prepare(`
    SELECT o.*,
           REPLACE(o.order_number, 'ORD-', 'INV-') as invoice_number,
           o.created_at as order_date,
           o.created_at as invoice_date,
           v.company_name as party_name,
           v.contact_person as party_contact,
           v.city as party_city,
           v.state as party_state,
           v.billing_address as party_address,
           v.gstin as party_gstin,
           v.mobile as party_mobile,
           v.email as party_email,
           c.name as company_name,
           c.code as company_code,
           c.gst_number as company_gstin,
           SUBSTR(c.gst_number, 3, 10) as company_pan,
           c.address as company_address,
           c.city as company_city,
           c.state as company_state,
           c.pincode as company_pincode,
           c.mobile as company_mobile,
           c.email as company_email,
           c.bank_name as company_bank,
           c.account_no as company_account,
           c.ifsc_code as company_ifsc,
           c.branch as company_branch,
           c.terms as company_terms,
           u.name as sales_person_name,
           u.mobile as sales_person_mobile,
           u.email as sales_person_email
    FROM orders o
    JOIN vendors v ON o.vendor_id = v.id
    JOIN users u ON o.sales_person_id = u.id
    JOIN companies c ON o.company_id = c.id
    WHERE o.id = ?
  `).get(id) as any;

  if (!order) {
    return res.status(404).json({ error: 'Bill/Order not found' });
  }

  // Check sales person ownership
  if (!canViewAll && canViewOwn && order.sales_person_id !== user.id) {
    return res.status(403).json({ error: 'Forbidden: You can only view your own bills.' });
  }

  const items = db.prepare(`
    SELECT oi.*, p.description as product_description, p.image_url as product_image
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
    ORDER BY oi.id ASC
  `).all(id) as any[];

  const payments = db.prepare(`
    SELECT p.*, u.name as received_by_name, vu.name as verified_by_name
    FROM payments p
    LEFT JOIN users u ON p.received_by_id = u.id
    LEFT JOIN users vu ON p.verified_by_id = vu.id
    WHERE p.order_id = ? AND p.is_verified = 1
    ORDER BY p.payment_date ASC
  `).all(id) as any[];

  const isNonGst = order.tax_type === 'NON_GST';
  const billAmt = Number(order.grand_total) || 0;
  const recAmt = Number(order.amount_received) || 0;
  const balAmt = Math.max(0, Number(order.pending_amount) || (billAmt - recAmt));

  let taxableAmt = 0;
  let gstAmt = 0;
  let cgstAmt = 0;
  let sgstAmt = 0;

  if (isNonGst) {
    taxableAmt = billAmt;
    gstAmt = 0;
    cgstAmt = 0;
    sgstAmt = 0;
  } else {
    taxableAmt = Math.round((billAmt / 1.18) * 100) / 100;
    gstAmt = Math.round((billAmt - taxableAmt) * 100) / 100;
    cgstAmt = Math.round((gstAmt / 2) * 100) / 100;
    sgstAmt = Math.round((gstAmt - cgstAmt) * 100) / 100;
  }

  let pStatus = 'UNPAID';
  if (balAmt <= 0 && recAmt > 0) {
    pStatus = 'PAID';
  } else if (recAmt > 0) {
    pStatus = 'PARTIAL';
  }

  const bill = {
    ...order,
    bill_amount: billAmt,
    taxable_amount: taxableAmt,
    gst_amount: gstAmt,
    cgst_amount: cgstAmt,
    sgst_amount: sgstAmt,
    received_amount: recAmt,
    balance_payment: balAmt,
    payment_status: pStatus,
    items,
    payments
  };

  res.json({ bill });
});

// -------------------------------------------------------------
// SETTINGS & DEMO RESET
// -------------------------------------------------------------

apiRouter.get('/settings', authMiddleware, (_req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all() as { key: string; value: string }[];
  const settingsObj: Record<string, string> = {};
  for (const r of rows) settingsObj[r.key] = r.value;
  res.json({ settings: settingsObj });
});

apiRouter.post('/settings/reset-demo', authMiddleware, (req: AuthRequest, res) => {
  // Reset seed
  seedDatabase(true);
  logActivity(req.user?.id || null, 'SYSTEM_RESET', 'system', 'seed', 'Demo database was reset to factory state');
  res.json({ message: 'Demo database has been restored to factory test state with all 52 orders and test scenarios.' });
});
