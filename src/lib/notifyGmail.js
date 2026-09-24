const nodemailer = require('nodemailer');

function getTransporter() {
  const user = process.env.GMAIL_SENDER_ADDRESS;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error('GMAIL_SENDER_ADDRESS / GMAIL_APP_PASSWORD が設定されていません');
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

const SITE_LABEL = { mercari: 'メルカリ', rakuma: 'ラクマ', yahoo_auction: 'ヤフオク' };

/**
 * @param {string[]} toAddresses
 * @param {Array<object>} items 通知対象の商品(profitCalcの結果込み)
 */
async function sendGmailNotification(toAddresses, items) {
  if (toAddresses.length === 0 || items.length === 0) return;
  const transporter = getTransporter();
  const lines = items.map((item) => {
    return [
      `【${item.genre}】${SITE_LABEL[item.site] || item.site}`,
      item.title,
      `仕入れ値: ¥${item.price.toLocaleString()} / 想定売値: ¥${item.estimatedSalePrice.toLocaleString()}`,
      `期待利益: ¥${item.expectedProfit.toLocaleString()}(利益率 ${item.profitRate}%)`,
      item.url,
      '',
    ].join('\n');
  });

  await transporter.sendMail({
    from: process.env.GMAIL_SENDER_ADDRESS,
    to: toAddresses.join(','),
    subject: `【仕入れ候補】${items.length}件見つかりました`,
    text: lines.join('\n'),
  });
}

module.exports = { sendGmailNotification };
