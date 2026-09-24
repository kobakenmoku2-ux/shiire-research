const { shippingStatusLabel } = require('./profitCalc');

const SITE_LABEL = { mercari: 'メルカリ', rakuma: 'ラクマ', yahoo_auction: 'ヤフオク' };

function buildMessageText(item) {
  return [
    `【${item.genre}】${SITE_LABEL[item.site] || item.site}`,
    item.title,
    `仕入れ値: ¥${item.price.toLocaleString()} / 想定売値: ¥${item.estimatedSalePrice.toLocaleString()}`,
    `送料: ${shippingStatusLabel(item.shippingStatus)}${item.shippingCost ? `(¥${item.shippingCost.toLocaleString()}として計算)` : ''}`,
    `期待利益: ¥${item.expectedProfit.toLocaleString()}(利益率 ${item.profitRate}%)`,
    item.url,
  ].join('\n');
}

/**
 * @param {string} lineUserId 送信先のLINEユーザーID
 * @param {Array<object>} items 通知対象の商品(profitCalcの結果込み)
 */
async function sendLineNotification(lineUserId, items) {
  if (!lineUserId || items.length === 0) return;
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN が設定されていません');

  // LINEの1メッセージは最大5件まで。5件ずつ分けて送る
  const chunks = [];
  for (let i = 0; i < items.length; i += 5) chunks.push(items.slice(i, i + 5));

  for (const chunk of chunks) {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: chunk.map((item) => ({ type: 'text', text: buildMessageText(item) })),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`LINE通知に失敗しました: ${res.status} ${body}`);
    }
  }
}

module.exports = { sendLineNotification };
