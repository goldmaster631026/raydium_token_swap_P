export const priceConfig = {
  priceListSize: 10,
  initialInterval: 30 * 60 * 1000, // 12 minutes in milliseconds preparing price_List
  tradingInterval: 60 * 60 * 1000, // 1 hour in milliseconds
  priceDropThreshold: 5.4, // $5.4 price drop threshold
  emergencySwapPercentage: 0.92, // 92% for emergency swap
  normalSwapPercentage: 0.7, // 65% for normal trading
  minUSDCBalance: 5, // Minimum USDC balance for buying
  minSOLBalance: 0.03, // Minimum SOL balance for selling
  buyThresholdMultiplier: 0.8, // μ - 0.5*σ for buy threshold
  sellThresholdMultiplier: 1.0, // μ + 1.0*σ for sell threshold
  flag: 0, // Flag to control swap decisions: 0 (initial), 1 (after SOL->USDC), -1 (after USDC->SOL)
}; 