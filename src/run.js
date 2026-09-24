require('dotenv').config();
const rakuma = require('./scrapers/rakuma');
const yahooAuction = require('./scrapers/yahooAuction');
const mercari = require('./scrapers/mercari');
const { estimateSalePrice } = require('./lib/marketPrice');
const { filterCandidates } = require('./lib/profitCalc');
const sheets = require('./lib/sheets');
const { sendGmailNotification } = require('./lib/notifyGmail');
const { sendLineNotification } = require('./lib/notifyLine');

async function collectItemsForCondition(condition) {
  const [mercariItems, rakumaItems, yahooItems] = await Promise.all([
    mercari.search({ keywords: condition.keywords }).catch((e) => {
      console.error(`[メルカリ] ${condition.genre} の取得に失敗:`, e.message);
      return [];
    }),
    rakuma.search({ keywords: condition.keywords }).catch((e) => {
      console.error(`[ラクマ] ${condition.genre} の取得に失敗:`, e.message);
      return [];
    }),
    yahooAuction.search({ keywords: condition.keywords }).catch((e) => {
      console.error(`[ヤフオク] ${condition.genre} の取得に失敗:`, e.message);
      return [];
    }),
  ]);
  return [...mercariItems, ...rakumaItems, ...yahooItems];
}

async function run() {
  const conditions = await sheets.getConditions();
  if (conditions.length === 0) {
    console.log('有効な条件がありません。終了します。');
    return;
  }

  const recipients = await sheets.getRecipients();
  const notifiedMap = await sheets.getNotifiedMap();
  const settings = await sheets.getSettings();

  /** @type {Array<object>} */
  const toNotify = [];

  for (const condition of conditions) {
    console.log(`[条件: ${condition.genre}] キーワード=${condition.keywords.join(' ')}`);
    const estimatedSalePrice = await estimateSalePrice(condition.keywords);
    if (!estimatedSalePrice) {
      console.log(`  → メルカリの売り切れ実績が見つからず、相場を推定できないためスキップします`);
      continue;
    }

    const items = await collectItemsForCondition(condition);
    const candidates = filterCandidates(items, condition, estimatedSalePrice, settings.forSite).map((item) => ({
      ...item,
      genre: condition.genre,
    }));

    for (const item of candidates) {
      const key = `${item.site}:${item.itemId}`;
      const prev = notifiedMap.get(key);
      if (prev && prev.price === item.price) {
        continue; // 前回と同じ価格のまま → 通知しない
      }
      toNotify.push(item);
      await sheets.upsertNotified(item, prev ? prev.rowIndex : null);
    }
  }

  if (toNotify.length === 0) {
    console.log('通知対象はありませんでした。');
    return;
  }

  console.log(`通知対象: ${toNotify.length}件`);

  const gmailTargets = recipients.filter((r) => r.gmailEnabled && r.email).map((r) => r.email);
  if (gmailTargets.length > 0) {
    await sendGmailNotification(gmailTargets, toNotify);
  }

  const lineTargets = recipients.filter((r) => r.lineEnabled && r.lineUserId);
  for (const recipient of lineTargets) {
    await sendLineNotification(recipient.lineUserId, toNotify);
  }

  console.log('通知を送信しました。');
}

run().catch((e) => {
  console.error('実行中にエラーが発生しました:', e);
  process.exit(1);
});
