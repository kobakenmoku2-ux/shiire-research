const mercari = require('../scrapers/mercari');

function median(numbers) {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * メルカリの売り切れ実績から、想定売値(相場の中央値)を推定する
 * @param {string[]} keywords
 * @returns {Promise<number>}
 */
async function estimateSalePrice(keywords) {
  const soldItems = await mercari.search({ keywords, soldOnly: true });
  return median(soldItems.map((i) => i.price));
}

module.exports = { estimateSalePrice, median };
