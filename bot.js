const { Telegraf, Markup } = require('telegraf');

function createBot(token, webappUrl, adminIds) {
  const bot = new Telegraf(token);
  const base = webappUrl.replace(/\/$/, '');

  bot.start((ctx) => {
    const isAdmin = adminIds.includes(String(ctx.from.id));
    const buttons = [Markup.button.webApp('🛍 Открыть каталог', base)];
    if (isAdmin) {
      buttons.push(Markup.button.webApp('⚙️ Админ-панель', `${base}/admin.html`));
    }
    ctx.reply(
      'Добро пожаловать! Здесь можно посмотреть каталог и оформить заказ — мы свяжемся с вами для подтверждения.',
      Markup.keyboard(buttons).resize()
    );
  });

  bot.command('admin', (ctx) => {
    const isAdmin = adminIds.includes(String(ctx.from.id));
    if (!isAdmin) return ctx.reply('Эта команда доступна только администратору магазина.');
    ctx.reply(
      'Панель управления магазином:',
      Markup.keyboard([Markup.button.webApp('⚙️ Открыть панель', `${base}/admin.html`)]).resize()
    );
  });

  return bot;
}

module.exports = createBot;
