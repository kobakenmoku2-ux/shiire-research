/**
 * @param {number} purchasePrice 仕入れ価格(出品価格。原価)
 * @param {number} estimatedSalePrice 想定売値(メルカリ相場)
 * @param {number} shippingCost 仕入れ側の送料(送料込みなら0)
 * @param {number} feeRate 販売手数料率(例: 0.10)
 * @returns {{ expectedProfit: number, profitRate: number }}
 */
function calcProfit(purchasePrice, estimatedSalePrice, shippingCost, feeRate) {
  const netSale = estimatedSalePrice * (1 - feeRate);
  const expectedProfit = netSale - shippingCost - purchasePrice;
  const profitRate = purchasePrice > 0 ? (expectedProfit / purchasePrice) * 100 : 0;
  return { expectedProfit: Math.round(expectedProfit), profitRate: Math.round(profitRate * 10) / 10 };
}

/**
 * shippingStatus('included'|'separate'|'unknown')から、実際にかかる送料を求める。
 * - 'included'(送料込みと判明): 0円
 * - 'separate'(送料別と判明。今のところヤフオクのみ判定可能): 指定の送料
 * - 'unknown'(ラクマ・メルカリ。一覧からは判定不可): 別途指定の「要確認時の想定送料」(デフォルト0円)
 */
function resolveShippingCost(shippingStatus, shippingWhenSeparate, shippingWhenUnknown) {
  if (shippingStatus === 'separate') return shippingWhenSeparate;
  if (shippingStatus === 'included') return 0;
  return shippingWhenUnknown;
}

/**
 * 出品中の商品リストから、条件(価格帯・目標利益率)を満たすものだけ抽出する
 * @param {Array<{price:number,title:string,url:string,site:string,itemId:string,shippingStatus?:string}>} items
 * @param {{priceMin:number,priceMax:number,targetProfitRate:number,estimatedShippingCost:number|null}} condition
 * @param {number} estimatedSalePrice
 * @param {(site:string) => {feeRate:number,defaultShipping:number,unknownShipping:number}} getSettingsForSite
 */
function filterCandidates(items, condition, estimatedSalePrice, getSettingsForSite) {
  const { priceMin, priceMax, targetProfitRate } = condition;

  return items
    .filter((item) => item.price >= priceMin && item.price <= priceMax)
    .map((item) => {
      const siteSettings = getSettingsForSite(item.site);
      const shippingWhenSeparate =
        condition.estimatedShippingCost === null || condition.estimatedShippingCost === undefined
          ? siteSettings.defaultShipping
          : condition.estimatedShippingCost;
      const shippingStatus = item.shippingStatus || 'unknown';
      const shippingCost = resolveShippingCost(shippingStatus, shippingWhenSeparate, siteSettings.unknownShipping);
      const { expectedProfit, profitRate } = calcProfit(item.price, estimatedSalePrice, shippingCost, siteSettings.feeRate);
      return { ...item, shippingStatus, shippingCost, estimatedSalePrice, expectedProfit, profitRate };
    })
    .filter((item) => item.profitRate >= targetProfitRate);
}

function shippingStatusLabel(shippingStatus) {
  if (shippingStatus === 'included') return '送料込み';
  if (shippingStatus === 'separate') return '送料別';
  return '要確認(送料込みの可能性が高いですが、購入前に商品ページでご確認ください)';
}

module.exports = { calcProfit, filterCandidates, resolveShippingCost, shippingStatusLabel };
