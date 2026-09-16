const express = require('express');
const router = express.Router();
const db = require('../db');

function attachVariants(products) {
  const variantsStmt = db.prepare('SELECT * FROM variants WHERE product_id = ? ORDER BY size, color');
  for (const p of products) p.variants = variantsStmt.all(p.id);
  return products;
}

// Каталог для покупателей (только активные товары)
router.get('/', (req, res) => {
  const products = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = 1
    ORDER BY p.created_at DESC
  `).all();
  res.json(attachVariants(products));
});

// Полный список для админ-панели (включая скрытые товары)
router.get('/admin', (req, res) => {
  const products = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ORDER BY p.created_at DESC
  `).all();
  res.json(attachVariants(products));
});

router.get('/categories', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY name').all());
});

router.post('/categories', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)').run(name);
  const row = db.prepare('SELECT * FROM categories WHERE name = ?').get(name);
  res.json(row);
});

router.delete('/categories/:id', (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Создать товар (можно сразу с вариантами)
router.post('/', (req, res) => {
  const { name, description = '', category_id = null, price, photo_url = '', variants = [] } = req.body;
  if (!name || price == null) return res.status(400).json({ error: 'name и price обязательны' });

  const info = db.prepare(`
    INSERT INTO products (name, description, category_id, price, photo_url)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, description, category_id, price, photo_url);

  const productId = info.lastInsertRowid;
  const insertVariant = db.prepare(`
    INSERT INTO variants (product_id, size, color, sku, stock_qty) VALUES (?, ?, ?, ?, ?)
  `);
  for (const v of variants) {
    insertVariant.run(productId, v.size, v.color, v.sku || null, v.stock_qty || 0);
  }
  res.json({ id: productId });
});

router.put('/:id', (req, res) => {
  const { name, description, category_id, price, photo_url, is_active } = req.body;
  db.prepare(`
    UPDATE products SET name = ?, description = ?, category_id = ?, price = ?, photo_url = ?, is_active = ?
    WHERE id = ?
  `).run(name, description, category_id, price, photo_url, is_active ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Варианты (размер/цвет/остаток)
router.post('/:id/variants', (req, res) => {
  const { size, color, sku, stock_qty = 0 } = req.body;
  if (!size || !color) return res.status(400).json({ error: 'size и color обязательны' });
  const info = db.prepare(`
    INSERT INTO variants (product_id, size, color, sku, stock_qty) VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, size, color, sku || null, stock_qty);
  res.json({ id: info.lastInsertRowid });
});

router.patch('/variants/:variantId/stock', (req, res) => {
  const { stock_qty, delta } = req.body;
  if (delta != null) {
    db.prepare('UPDATE variants SET stock_qty = MAX(0, stock_qty + ?) WHERE id = ?').run(delta, req.params.variantId);
  } else if (stock_qty != null) {
    db.prepare('UPDATE variants SET stock_qty = ? WHERE id = ?').run(Math.max(0, stock_qty), req.params.variantId);
  } else {
    return res.status(400).json({ error: 'stock_qty или delta обязательны' });
  }
  const row = db.prepare('SELECT * FROM variants WHERE id = ?').get(req.params.variantId);
  res.json(row);
});

router.delete('/variants/:variantId', (req, res) => {
  db.prepare('DELETE FROM variants WHERE id = ?').run(req.params.variantId);
  res.json({ ok: true });
});

module.exports = router;
