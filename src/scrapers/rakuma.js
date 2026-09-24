const { fetchHtml, decodeEntities } = require('../lib/http');

/**
 * ラクマの検索結果を取得する
 * @param {{keywords: string[], soldOnly?: boolean}} params
 * @returns {Promise<Array<{site:string,itemId:string,title:string,price:number,url:string}>>}
 */
async function search({ keywords, soldOnly = false }) {
  const query = encodeURIComponent(keywords.join(' '));
  const transaction = soldOnly ? 'sold' : 'selling';
  const url = `https://fril.jp/s?query=${query}&transaction=${transaction}`;
  const html = await fetchHtml(url);

  const linkRegex = /<a href="(https:\/\/item\.fril\.jp\/[a-f0-9]+)" class="link_search_title"/g;
  const links = [];
  let lm;
  while ((lm = linkRegex.exec(html)) !== null) {
    links.push({ index: lm.index, url: lm[1] });
  }

  const itemRegex = /data-rat-item_name="([^"]+)"[\s\S]{1,300}?data-rat-price="(\d+)"/g;
  const items = [];
  const seen = new Set();
  let m;
  while ((m = itemRegex.exec(html)) !== null) {
    const title = decodeEntities(m[1]);
    const price = parseInt(m[2], 10);
    const link = [...links].reverse().find((l) => l.index < m.index);
    if (!link || seen.has(link.url)) continue;
    seen.add(link.url);
    items.push({ site: 'rakuma', itemId: link.url.split('/').filter(Boolean).pop(), title, price, url: link.url });
  }
  return items;
}

module.exports = { search };
