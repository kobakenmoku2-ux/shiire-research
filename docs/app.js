const CONFIG = window.SHIIRE_CONFIG;
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

let accessToken = null;
let tokenClient = null;

const els = {
  signinView: document.getElementById('signin-view'),
  mainView: document.getElementById('main-view'),
  signinBtn: document.getElementById('google-signin-button'),
  signoutBtn: document.getElementById('signout-btn'),
  tabBtns: document.querySelectorAll('.tab-btn'),
  conditionsTab: document.getElementById('conditions-tab'),
  recipientsTab: document.getElementById('recipients-tab'),
  conditionsTbody: document.getElementById('conditions-tbody'),
  recipientsTbody: document.getElementById('recipients-tbody'),
  newConditionBtn: document.getElementById('new-condition-btn'),
  newRecipientBtn: document.getElementById('new-recipient-btn'),
  detailOverlay: document.getElementById('detail-overlay'),
  detailCard: document.getElementById('detail-card'),
  statusMessage: document.getElementById('status-message'),
  helpBtn: document.getElementById('help-btn'),
  helpOverlay: document.getElementById('help-overlay'),
  helpCard: document.getElementById('help-card'),
  biometricBtn: document.getElementById('biometric-btn'),
};

const HELP_HTML = `
  <h2>使い方</h2>
  <p>このツールは、メルカリ・ラクマ・ヤフオクを自動で見回って、条件に合う中古PCが出品されたらメール・LINEで知らせてくれます。</p>
  <p><b>①「条件」タブ</b><br>
  探したい商品を登録します。「＋新規登録」で追加、一覧の行をクリックすると内容を修正できます。</p>
  <ul>
    <li>商品ジャンル名：分かりやすい名前(例: ThinkPad)</li>
    <li>キーワード：カンマ区切りで複数入力できます。入力した単語を全部含む出品だけが対象になります</li>
    <li>価格帯：この金額の範囲内の出品だけをチェックします</li>
    <li>目標利益率：この利益率(%)以上が見込める時だけ通知します</li>
    <li>想定送料：利益計算に使う送料の目安です</li>
    <li>有効にする：チェックを外すと、その条件は一時的にチェックされなくなります</li>
  </ul>
  <p><b>②「通知先」タブ</b><br>
  通知を受け取るメールアドレス・LINEを登録します。チェックを外せば、その人には送られなくなります。</p>
  <p><b>③自動でのチェック</b><br>
  毎日5時〜22時の1時間おきに自動でチェックします。一度通知した商品は、値段が変わらない限り再通知しません。</p>
  <p><b>④仕入れ・交渉</b><br>
  通知に載っているリンクから商品ページを開いて、購入や出品者への連絡はご自身のアプリから行ってください(このツールは自動購入はしません)。</p>
  <div class="form-actions" style="justify-content:flex-end;">
    <button class="primary-btn" id="help-close">閉じる</button>
  </div>
`;

function openHelp() {
  els.helpCard.innerHTML = HELP_HTML;
  els.helpOverlay.classList.remove('hidden');
  document.getElementById('help-close').addEventListener('click', () => {
    els.helpOverlay.classList.add('hidden');
  });
}

els.helpBtn.addEventListener('click', openHelp);
els.biometricBtn.addEventListener('click', registerBiometric);

function showStatus(text) {
  els.statusMessage.textContent = text;
  els.statusMessage.classList.toggle('hidden', !text);
}

// ---------- Google 認証(ログイン状態の保持) ----------

const TOKEN_KEY = 'shiire_token';
const TOKEN_EXPIRY_KEY = 'shiire_token_expiry';
const WEBAUTHN_ID_KEY = 'shiire_webauthn_id';

function saveToken(token, expiresInSec) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + expiresInSec * 1000 - 60000));
}

function loadValidToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = Number(localStorage.getItem(TOKEN_EXPIRY_KEY) || 0);
  if (token && Date.now() < expiry) return token;
  return null;
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

function hasBiometric() {
  return !!localStorage.getItem(WEBAUTHN_ID_KEY);
}

function bufToBase64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64urlToBuf(str) {
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function registerBiometric() {
  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'リサーチ管理画面' },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: 'shiire-user',
          displayName: 'shiire-user',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        timeout: 60000,
      },
    });
    localStorage.setItem(WEBAUTHN_ID_KEY, bufToBase64url(cred.rawId));
    alert('設定できました。次回からFace ID/Touch IDで開けます。');
  } catch (e) {
    alert('設定に失敗しました: ' + e.message);
  }
}

async function verifyBiometric() {
  const storedId = localStorage.getItem(WEBAUTHN_ID_KEY);
  if (!storedId) return true; // 未設定ならスキップ
  try {
    await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ id: base64urlToBuf(storedId), type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return true;
  } catch (e) {
    return false;
  }
}

function enterApp(token) {
  accessToken = token;
  els.signinView.classList.add('hidden');
  els.mainView.classList.remove('hidden');
  loadConditions();
  loadRecipients();
}

window.addEventListener('load', () => {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: SCOPE,
    callback: async (resp) => {
      if (resp.error) {
        showStatus('ログインに失敗しました: ' + resp.error);
        return;
      }
      saveToken(resp.access_token, resp.expires_in || 3600);
      enterApp(resp.access_token);
    },
  });

  tryAutoLogin();
});

async function tryAutoLogin() {
  const cached = loadValidToken();
  if (cached) {
    if (await verifyBiometric()) {
      enterApp(cached);
      return;
    }
    // 生体認証に失敗した場合は手動ログイン画面へ
    return;
  }
  // トークンが無い/期限切れ → 裏側で静かに再取得を試みる(Google側のセッションが生きていれば画面は出ない)
  tokenClient.requestAccessToken({ prompt: '' });
}

els.signinBtn.addEventListener('click', () => {
  tokenClient.requestAccessToken({ prompt: '' });
});

els.signoutBtn.addEventListener('click', () => {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
  clearToken();
  els.mainView.classList.add('hidden');
  els.signinView.classList.remove('hidden');
});

// ---------- タブ切り替え ----------

els.tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    els.tabBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    els.conditionsTab.classList.toggle('hidden', tab !== 'conditions');
    els.recipientsTab.classList.toggle('hidden', tab !== 'recipients');
  });
});

// ---------- Sheets API ヘルパー ----------

async function sheetsGet(range) {
  const url = `${SHEETS_BASE}/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`読み込みに失敗しました(${res.status})`);
  const data = await res.json();
  return data.values || [];
}

async function sheetsUpdateRow(sheetName, rowNumber, values) {
  const range = `${sheetName}!A${rowNumber}:Z${rowNumber}`;
  const url = `${SHEETS_BASE}/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [values] }),
  });
  if (!res.ok) throw new Error(`更新に失敗しました(${res.status})`);
}

async function sheetsAppendRow(sheetName, values) {
  const range = `${sheetName}!A:Z`;
  const url = `${SHEETS_BASE}/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [values] }),
  });
  if (!res.ok) throw new Error(`登録に失敗しました(${res.status})`);
}

function newId() {
  return 'c' + Date.now().toString(36);
}

// ---------- 条件タブ ----------

let conditionsCache = [];

async function loadConditions() {
  showStatus('読み込み中...');
  try {
    const rows = await sheetsGet('条件!A2:H1000');
    conditionsCache = rows.map((r, i) => ({
      rowNumber: i + 2,
      id: r[0] || '',
      genre: r[1] || '',
      keywords: r[2] || '',
      priceMin: r[3] || '',
      priceMax: r[4] || '',
      targetProfitRate: r[5] || '',
      shippingCost: r[6] || '',
      active: (r[7] || '').toString().toUpperCase() === 'TRUE',
    }));
    renderConditions();
    showStatus('');
  } catch (e) {
    showStatus(e.message);
  }
}

function renderConditions() {
  els.conditionsTbody.innerHTML = '';
  conditionsCache.forEach((c) => {
    const tr = document.createElement('tr');
    if (!c.active) tr.classList.add('inactive-row');
    tr.innerHTML = `
      <td>${escapeHtml(c.genre)}</td>
      <td>${escapeHtml(c.keywords)}</td>
      <td>¥${c.priceMin || 0}〜¥${c.priceMax || 0}</td>
      <td>${c.targetProfitRate || 0}%</td>
      <td>${c.active ? '有効' : '無効'}</td>
    `;
    tr.addEventListener('click', () => openConditionDetail(c));
    els.conditionsTbody.appendChild(tr);
  });
}

function openConditionDetail(condition) {
  const c = condition || {
    rowNumber: null,
    id: '',
    genre: '',
    keywords: '',
    priceMin: '',
    priceMax: '',
    targetProfitRate: '',
    shippingCost: '0',
    active: true,
  };
  els.detailCard.innerHTML = `
    <h2>${c.rowNumber ? '条件を修正' : '新規条件を登録'}</h2>
    <div class="field"><label>商品ジャンル名</label><input type="text" id="f-genre" value="${escapeAttr(c.genre)}"></div>
    <div class="field"><label>キーワード(カンマ区切りで複数可)</label><input type="text" id="f-keywords" value="${escapeAttr(c.keywords)}"><div class="hint">例: ThinkPad,X13,16GB</div></div>
    <div class="field"><label>価格帯 下限</label><input type="number" id="f-price-min" value="${escapeAttr(c.priceMin)}"></div>
    <div class="field"><label>価格帯 上限</label><input type="number" id="f-price-max" value="${escapeAttr(c.priceMax)}"></div>
    <div class="field"><label>目標利益率(%)</label><input type="number" id="f-target-rate" value="${escapeAttr(c.targetProfitRate)}"></div>
    <div class="field"><label>想定送料(円)</label><input type="number" id="f-shipping" value="${escapeAttr(c.shippingCost || '0')}"></div>
    <div class="field checkbox-field"><input type="checkbox" id="f-active" ${c.active ? 'checked' : ''}><label for="f-active">この条件を有効にする</label></div>
    <div class="form-actions">
      <button class="secondary-btn" id="detail-cancel">キャンセル</button>
      <button class="primary-btn" id="detail-save">保存</button>
    </div>
  `;
  els.detailOverlay.classList.remove('hidden');
  document.getElementById('detail-cancel').addEventListener('click', closeDetail);
  document.getElementById('detail-save').addEventListener('click', async () => {
    const values = [
      c.id || newId(),
      document.getElementById('f-genre').value.trim(),
      document.getElementById('f-keywords').value.trim(),
      document.getElementById('f-price-min').value,
      document.getElementById('f-price-max').value,
      document.getElementById('f-target-rate').value,
      document.getElementById('f-shipping').value,
      document.getElementById('f-active').checked ? 'TRUE' : 'FALSE',
    ];
    try {
      if (c.rowNumber) {
        await sheetsUpdateRow('条件', c.rowNumber, values);
      } else {
        await sheetsAppendRow('条件', values);
      }
      closeDetail();
      await loadConditions();
    } catch (e) {
      alert(e.message);
    }
  });
}

// ---------- 通知先タブ ----------

let recipientsCache = [];

async function loadRecipients() {
  try {
    const rows = await sheetsGet('通知先!A2:F1000');
    recipientsCache = rows.map((r, i) => ({
      rowNumber: i + 2,
      id: r[0] || '',
      label: r[1] || '',
      email: r[2] || '',
      gmailEnabled: (r[3] || '').toString().toUpperCase() === 'TRUE',
      lineUserId: r[4] || '',
      lineEnabled: (r[5] || '').toString().toUpperCase() === 'TRUE',
    }));
    renderRecipients();
  } catch (e) {
    showStatus(e.message);
  }
}

function renderRecipients() {
  els.recipientsTbody.innerHTML = '';
  recipientsCache.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.label)}</td>
      <td>${escapeHtml(r.email)}${r.gmailEnabled ? '' : '(OFF)'}</td>
      <td>${r.lineUserId ? (r.lineEnabled ? '有効' : 'OFF') : '未設定'}</td>
    `;
    tr.addEventListener('click', () => openRecipientDetail(r));
    els.recipientsTbody.appendChild(tr);
  });
}

function openRecipientDetail(recipient) {
  const r = recipient || {
    rowNumber: null,
    id: '',
    label: '',
    email: '',
    gmailEnabled: true,
    lineUserId: '',
    lineEnabled: false,
  };
  els.detailCard.innerHTML = `
    <h2>${r.rowNumber ? '通知先を修正' : '新規通知先を登録'}</h2>
    <div class="field"><label>名前</label><input type="text" id="f-label" value="${escapeAttr(r.label)}"></div>
    <div class="field"><label>メールアドレス</label><input type="email" id="f-email" value="${escapeAttr(r.email)}"></div>
    <div class="field checkbox-field"><input type="checkbox" id="f-gmail-enabled" ${r.gmailEnabled ? 'checked' : ''}><label for="f-gmail-enabled">Gmail通知を送る</label></div>
    <div class="field"><label>LINEユーザーID</label><input type="text" id="f-line-id" value="${escapeAttr(r.lineUserId)}"></div>
    <div class="field checkbox-field"><input type="checkbox" id="f-line-enabled" ${r.lineEnabled ? 'checked' : ''}><label for="f-line-enabled">LINE通知を送る</label></div>
    <div class="form-actions">
      <button class="secondary-btn" id="detail-cancel">キャンセル</button>
      <button class="primary-btn" id="detail-save">保存</button>
    </div>
  `;
  els.detailOverlay.classList.remove('hidden');
  document.getElementById('detail-cancel').addEventListener('click', closeDetail);
  document.getElementById('detail-save').addEventListener('click', async () => {
    const values = [
      r.id || newId(),
      document.getElementById('f-label').value.trim(),
      document.getElementById('f-email').value.trim(),
      document.getElementById('f-gmail-enabled').checked ? 'TRUE' : 'FALSE',
      document.getElementById('f-line-id').value.trim(),
      document.getElementById('f-line-enabled').checked ? 'TRUE' : 'FALSE',
    ];
    try {
      if (r.rowNumber) {
        await sheetsUpdateRow('通知先', r.rowNumber, values);
      } else {
        await sheetsAppendRow('通知先', values);
      }
      closeDetail();
      await loadRecipients();
    } catch (e) {
      alert(e.message);
    }
  });
}

function closeDetail() {
  els.detailOverlay.classList.add('hidden');
  els.detailCard.innerHTML = '';
}

els.newConditionBtn.addEventListener('click', () => openConditionDetail(null));
els.newRecipientBtn.addEventListener('click', () => openRecipientDetail(null));

// ---------- ユーティリティ ----------

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(str) {
  return escapeHtml(str);
}
