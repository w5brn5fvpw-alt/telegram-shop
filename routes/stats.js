const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/overview', (req, res) => {
  const totalRevenue = db.prepare(
    `SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE status != 'cancelled'`
  ).get().total;
  const ordersCount = db.prepare(
    `SELECT COUNT(*) as c FROM orders WHERE status != 'cancelled'`
  ).get().c;
  const newOrders = db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status = 'new'`).get().c;
  const lowStock = db.prepare(`
    SELECT v.id, v.size, v.color, v.stock_qty, p.name as product_name
    FROM variants v JOIN products p ON p.id = v.product_id
    WHERE v.stock_qty <= 3
    ORDER BY v.stock_qty ASC
    LIMIT 20
  `).all();

  res.json({ totalRevenue, ordersCount, newOrders, lowStock });
});

router.get('/top-products', (req, res) => {
  const rows = db.prepare(`
    SELECT oi.product_name, SUM(oi.qty) as total_qty, SUM(oi.price * oi.qty) as total_revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status != 'cancelled'
    GROUP BY oi.product_name
    ORDER BY total_qty DESC
    LIMIT 10
  `).all();
  res.json(rows);
});

router.get('/revenue-by-day', (req, res) => {
  const rows = db.prepare(`
    SELECT date(created_at) as day, SUM(total) as revenue, COUNT(*) as orders
    FROM orders
    WHERE status != 'cancelled'
    GROUP BY day
    ORDER BY day ASC
    LIMIT 30
  `).all();
  res.json(rows);
});

module.exports = router;
