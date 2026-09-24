const { chromium } = require('playwright');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * メルカリの検索結果を取得する。検索結果はブラウザ上のJavaScriptで後から描画されるため、
 * 単純なHTTPアクセスでは取得できず、実際にブラウザ(Playwright)でページを開いて取得する。
 * @param {{keywords: string[], soldOnly?: boolean}} params
 * @returns {Promise<Array<{site:string,itemId:string,title:string,price:number,url:string}>>}
 */
async function search({ keywords, soldOnly = false }) {
  const query = encodeURIComponent(keywords.join(' '));
  const status = soldOnly ? 'sold_out%7Ctrading' : 'on_sale';
  const url = `https://jp.mercari.com/search?keyword=${query}&status=${status}`;

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ userAgent: UA });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    const html = await page.content();
    return parseItems(html);
  } finally {
    await browser.close();
  }
}

function parseItems(html) {
  const items = [];
  const seen = new Set();
  const regex =
    /href="(\/item\/(m\d+))(?:\?[^"]*)?"[\s\S]{1,2000}?data-testid="item-tile-price"[\s\S]{1,300}?>¥<\/span><span[^>]*>([\d,]+)<\/span>[\s\S]{1,800}?data-testid="thumbnail-item-name"[^>]*>([^<]+)<\/(?:p|span)>/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const itemId = m[2];
    if (seen.has(itemId)) continue;
    seen.add(itemId);
    items.push({
      site: 'mercari',
      itemId,
      title: m[4],
      price: parseInt(m[3].replace(/,/g, ''), 10),
      url: `https://jp.mercari.com${m[1]}`,
    });
  }
  return items;
}

module.exports = { search };
