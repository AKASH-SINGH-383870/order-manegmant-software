const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'data', 'lubricant_erp.db');
const db = new Database(dbPath);

// Update top 8 orders to Today (2026-10-05)
db.prepare('UPDATE orders SET created_at = ? WHERE id IN (65, 64, 63, 62, 1, 2, 3, 4)').run('2026-10-05 09:30:00');
db.prepare('UPDATE payments SET payment_date = ?, created_at = ?, verified_at = ? WHERE order_id IN (65, 64, 63, 62, 1, 2, 3, 4)').run('2026-10-05', '2026-10-05 09:45:00', '2026-10-05 10:00:00');
db.prepare('UPDATE dispatches SET dispatch_date = ? WHERE order_id IN (1, 2, 3, 4)').run('2026-10-05');

// Update next 6 orders to Yesterday (2026-10-04)
db.prepare('UPDATE orders SET created_at = ? WHERE id IN (5, 6, 7, 8, 9, 10)').run('2026-10-04 11:20:00');
db.prepare('UPDATE payments SET payment_date = ?, created_at = ?, verified_at = ? WHERE order_id IN (5, 6, 7, 8, 9, 10)').run('2026-10-04', '2026-10-04 11:35:00', '2026-10-04 12:00:00');
db.prepare('UPDATE dispatches SET dispatch_date = ? WHERE order_id IN (5, 6, 7, 8, 9, 10)').run('2026-10-04');

// Update next 6 orders to Oct 2-3 (2026-10-02, 2026-10-03)
db.prepare('UPDATE orders SET created_at = ? WHERE id IN (11, 12, 13)').run('2026-10-02 14:15:00');
db.prepare('UPDATE orders SET created_at = ? WHERE id IN (14, 15, 16)').run('2026-10-03 16:45:00');
db.prepare('UPDATE payments SET payment_date = ?, created_at = ? WHERE order_id IN (11, 12, 13)').run('2026-10-02', '2026-10-02 14:30:00');
db.prepare('UPDATE payments SET payment_date = ?, created_at = ? WHERE order_id IN (14, 15, 16)').run('2026-10-03', '2026-10-03 17:00:00');

const check = db.prepare(`
  SELECT 
    SUM(CASE WHEN DATE(created_at) = '2026-10-05' THEN 1 ELSE 0 END) as today_cnt,
    SUM(CASE WHEN DATE(created_at) = '2026-10-04' THEN 1 ELSE 0 END) as yesterday_cnt,
    SUM(CASE WHEN strftime('%Y-%m', created_at) = '2026-10' THEN 1 ELSE 0 END) as this_month_cnt,
    SUM(CASE WHEN strftime('%Y-%m', created_at) = '2026-09' THEN 1 ELSE 0 END) as last_month_cnt,
    COUNT(*) as total_cnt
  FROM orders
`).get();

console.log('Updated distribution:', check);
