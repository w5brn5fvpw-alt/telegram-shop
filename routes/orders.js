const express = require('express');
const db = require('../db');

module.exports = function ordersRouter(bot, adminChatIds) {
  const router = express.Router();

  // Оформление заказа покупателем
  router.post('/', (req, res) => {
    const { customer_tg_id, customer_name, customer_phone, customer_comment, items } = req.body;
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'Корзина пуста' });
    }
    if (!customer_phone) {
      return res.status(400).json({ error: 'Укажите телефон для связи' });
    }

    const variantStmt = db.prepare('SELECT * FROM variants WHERE id = ?');
    const productStmt = db.prepare('SELECT * FROM products WHERE id = ?');
    let total = 0;
    const resolved = [];

    for (const item of items) {
      const variant = variantStmt.get(item.variant_id);
      if (!variant) return res.status(400).json({ error: `Вариант товара не найден` });
      if (variant.stock_qty < item.qty) {
        const product = productStmt.get(variant.product_id);
        return res.status(400).json({ error: `Недостаточно на складе: ${product?.name || ''} (${variant.size}, ${variant.color})` });
      }
      const product = productStmt.get(variant.product_id);
      total += product.price * item.qty;
      resolved.push({ variant, product, qty: item.qty });
    }

    const orderInfo = db.prepare(`
      INSERT INTO orders (customer_tg_id, customer_name, customer_phone, customer_comment, total)
      VALUES (?, ?, ?, ?, ?)
    `).run(customer_tg_id || null, customer_name || '', customer_phone, customer_comment || '', total);

    const orderId = orderInfo.lastInsertRowid;
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, variant_id, product_name, size, color, price, qty)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const decrementStock = db.prepare('UPDATE variants SET stock_qty = stock_qty - ? WHERE id = ?');

    for (const { variant, product, qty } of resolved) {
      insertItem.run(orderId, variant.id, product.name, variant.size, variant.color, product.price, qty);
      decrementStock.run(qty, variant.id);
    }

    if (bot && adminChatIds && adminChatIds.length) {
      const itemsText = resolved
        .map((i) => `• ${i.product.name} (${i.variant.size}, ${i.variant.color}) × ${i.qty}`)
        .join('\n');
      const message = [
        `🛍 Новый заказ №${orderId}`,
        itemsText,
        '',
        `Итого: ${total} ₽`,
        `Клиент: ${customer_name || '—'}`,
        `Телефон: ${customer_phone}`,
        customer_comment ? `Комментарий: ${customer_comment}` : null,
      ].filter(Boolean).join('\n');

      for (const chatId of adminChatIds) {
        bot.telegram.sendMessage(chatId, message).catch(() => {});
      }
    }

    res.json({ id: orderId, total });
  });

  router.get('/', (req, res) => {
    const { status } = req.query;
    const orders = status
      ? db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC').all(status)
      : db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    const itemsStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
    for (const o of orders) o.items = itemsStmt.all(o.id);
    res.json(orders);
  });

  router.patch('/:id/status', (req, res) => {
    const { status } = req.body;
    const allowed = ['new', 'confirmed', 'done', 'cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Некорректный статус' });
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ ok: true });
  });

  return router;
};
