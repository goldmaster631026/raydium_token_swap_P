import { priceConfig } from './priceConfig';

export class PriceManager {
  private priceList: number[] = [];
  private isInitialPhase: boolean = true;

  constructor() {
    this.priceList = [];
  }

  public addPrice(price: number): void {
    if (this.isInitialPhase) {
      this.priceList.push(price);
      if (this.priceList.length >= priceConfig.priceListSize) {
        this.isInitialPhase = false;
      }
    } else {
      // Remove oldest price and add new price (FIFO)
      this.priceList.shift();
      this.priceList.push(price);
    }
  }

  public getCurrentInterval(): number {
    return this.isInitialPhase ? priceConfig.initialInterval : priceConfig.tradingInterval;
  }

  public shouldEmergencySwap(currentPrice: number): boolean {
    if (this.priceList.length < 2) return false;
    
    const previousPrice = this.priceList[this.priceList.length - 2];
    const priceDrop = previousPrice - currentPrice;
    
    return priceDrop > priceConfig.priceDropThreshold && priceConfig.flag === -1;
  }

  public calculateThresholds(): { buyThreshold: number; sellThreshold: number } {
    if (this.priceList.length < 2) {
      return { buyThreshold: 0, sellThreshold: 0 };
    }

    // Calculate mean
    const mean = this.priceList.reduce((sum, price) => sum + price, 0) / this.priceList.length;

    // Calculate standard deviation
    const squaredDiffs = this.priceList.map(price => Math.pow(price - mean, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / this.priceList.length;
    const stdDev = Math.sqrt(variance);

    return {
      buyThreshold: mean - (priceConfig.buyThresholdMultiplier * stdDev),
      sellThreshold: mean + (priceConfig.sellThresholdMultiplier * stdDev)
    };
  }

  public getPriceList(): number[] {
    return [...this.priceList];
  }

  public isReadyForTrading(): boolean {
    return this.priceList.length === priceConfig.priceListSize;
  }
} 