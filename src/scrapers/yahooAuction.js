const { fetchHtml, decodeEntities } = require('../lib/http');

/**
 * ヤフオクの検索結果を取得する
 * @param {{keywords: string[], soldOnly?: boolean}} params
 * @returns {Promise<Array<{site:string,itemId:string,title:string,price:number,url:string}>>}
 */
async function search({ keywords, soldOnly = false }) {
  const query = encodeURIComponent(keywords.join(' '));
  const status = soldOnly ? '&va_new=1&exflg=1' : ''; // 落札相場を見る場合は完了品検索に切り替える
  const base = soldOnly
    ? `https://auctions.yahoo.co.jp/closedsearch/closedsearch?p=${query}&va=${query}`
    : `https://auctions.yahoo.co.jp/search/search?p=${query}&va=${query}`;
  const html = await fetchHtml(base);

  const regex =
    /data-auction-price="(\d+)"[\s\S]{1,300}?href="(https:\/\/auctions\.yahoo\.co\.jp\/jp\/auction\/[a-z0-9]+)"[\s\S]{1,1200}?alt="([^"]+)"/g;
  const items = [];
  const seen = new Set();
  let m;
  while ((m = regex.exec(html)) !== null) {
    const price = parseInt(m[1], 10);
    const url = m[2];
    const title = decodeEntities(m[3]);
    if (seen.has(url)) continue;
    seen.add(url);
    items.push({ site: 'yahoo_auction', itemId: url.split('/').pop(), title, price, url });
  }
  return items;
}

module.exports = { search };
