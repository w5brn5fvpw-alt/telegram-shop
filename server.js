require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const createBot = require('./bot');
const productsRouter = require('./routes/products');
const ordersRouterFactory = require('./routes/orders');
const statsRouter = require('./routes/stats');

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);

if (!BOT_TOKEN) {
  console.error('Ошибка: BOT_TOKEN не задан в .env');
  process.exit(1);
}
if (!WEBAPP_URL) {
  console.error('Ошибка: WEBAPP_URL не задан в .env (нужен публичный https-адрес)');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'webapp')));

const bot = createBot(BOT_TOKEN, WEBAPP_URL, ADMIN_IDS);

app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouterFactory(bot, ADMIN_IDS));
app.use('/api/stats', statsRouter);

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

bot.launch().then(() => console.log('Telegram-бот запущен'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
