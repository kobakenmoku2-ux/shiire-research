const MERCARI_FEE_RATE = 0.10;

/**
 * @param {number} purchasePrice 仕入れ価格(出品価格)
 * @param {number} estimatedSalePrice 想定売値(メルカリ相場)
 * @param {number} estimatedShippingCost 想定送料
 * @returns {{ expectedProfit: number, profitRate: number }}
 */
function calcProfit(purchasePrice, estimatedSalePrice, estimatedShippingCost) {
  const netSale = estimatedSalePrice * (1 - MERCARI_FEE_RATE);
  const expectedProfit = netSale - estimatedShippingCost - purchasePrice;
  const profitRate = purchasePrice > 0 ? (expectedProfit / purchasePrice) * 100 : 0;
  return { expectedProfit: Math.round(expectedProfit), profitRate: Math.round(profitRate * 10) / 10 };
}

/**
 * 出品中の商品リストから、条件(価格帯・目標利益率)を満たすものだけ抽出する
 * @param {Array<{price:number,title:string,url:string,site:string,itemId:string}>} items
 * @param {{priceMin:number,priceMax:number,targetProfitRate:number,estimatedShippingCost:number}} condition
 * @param {number} estimatedSalePrice
 */
function filterCandidates(items, condition, estimatedSalePrice) {
  const { priceMin, priceMax, targetProfitRate, estimatedShippingCost } = condition;
  return items
    .filter((item) => item.price >= priceMin && item.price <= priceMax)
    .map((item) => {
      const { expectedProfit, profitRate } = calcProfit(item.price, estimatedSalePrice, estimatedShippingCost);
      return { ...item, estimatedSalePrice, expectedProfit, profitRate };
    })
    .filter((item) => item.profitRate >= targetProfitRate);
}

module.exports = { calcProfit, filterCandidates, MERCARI_FEE_RATE };
