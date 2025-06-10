export const priceConfig = {
  startPrice: 100, // Price in USDC where we start buying SOL
  endPrice: 190, // Price in USDC where we start selling SOL
  monitoringInterval: 1 * 1 * 60 * 1000, // 4 hours in milliseconds
  swapPercentage: 0.9, // 90% of available balance to swap
}; 