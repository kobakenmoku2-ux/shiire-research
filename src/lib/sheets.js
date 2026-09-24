const { google } = require('googleapis');

const SHEET_CONDITIONS = '条件';
const SHEET_RECIPIENTS = '通知先';
const SHEET_NOTIFIED = '通知履歴';

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('環境変数 GOOGLE_SERVICE_ACCOUNT_JSON が設定されていません');
  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function getSheetsClient() {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
}

function spreadsheetId() {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error('環境変数 GOOGLE_SHEET_ID が設定されていません');
  return id;
}

async function readRows(sheetName) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${sheetName}!A2:Z`,
  });
  return res.data.values || [];
}

/** 条件シートを読み込む。有効(active)な行のみ返す */
async function getConditions() {
  const rows = await readRows(SHEET_CONDITIONS);
  // 列: id, genre, keywords(カンマ区切り), price_min, price_max, target_profit_rate, shipping_cost, active
  return rows
    .filter((r) => (r[7] || '').toString().toUpperCase() === 'TRUE')
    .map((r) => ({
      id: r[0],
      genre: r[1],
      keywords: (r[2] || '').split(',').map((s) => s.trim()).filter(Boolean),
      priceMin: Number(r[3] || 0),
      priceMax: Number(r[4] || Infinity),
      targetProfitRate: Number(r[5] || 0),
      estimatedShippingCost: Number(r[6] || 0),
    }));
}

/** 通知先シートを読み込む */
async function getRecipients() {
  const rows = await readRows(SHEET_RECIPIENTS);
  // 列: id, label, email, gmail_enabled, line_user_id, line_enabled
  return rows.map((r) => ({
    id: r[0],
    label: r[1],
    email: r[2],
    gmailEnabled: (r[3] || '').toString().toUpperCase() === 'TRUE',
    lineUserId: r[4],
    lineEnabled: (r[5] || '').toString().toUpperCase() === 'TRUE',
  }));
}

/** 通知済み商品の一覧を { "site:itemId": price } の形で返す */
async function getNotifiedMap() {
  const rows = await readRows(SHEET_NOTIFIED);
  const map = new Map();
  rows.forEach((r, i) => {
    const key = `${r[1]}:${r[0]}`; // site:itemId
    map.set(key, { rowIndex: i + 2, price: Number(r[2] || 0) });
  });
  return map;
}

/** 通知履歴シートに新規追加、または既存行の価格・日時を更新する */
async function upsertNotified(item, existingRowIndex) {
  const sheets = await getSheetsClient();
  const now = new Date().toISOString();
  const row = [item.itemId, item.site, item.price, now, item.url, item.title];
  if (existingRowIndex) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId(),
      range: `${SHEET_NOTIFIED}!A${existingRowIndex}:F${existingRowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [row] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId(),
      range: `${SHEET_NOTIFIED}!A:F`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });
  }
}

module.exports = { getConditions, getRecipients, getNotifiedMap, upsertNotified };
