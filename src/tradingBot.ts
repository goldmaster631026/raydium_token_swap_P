import RaydiumSwap from './RaydiumSwap';
import { PriceManager } from './priceManager';
import { priceConfig } from './priceConfig';
import { swapConfig } from './swapConfig';
import { Liquidity } from '@raydium-io/raydium-sdk';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import { SwapLogger } from './swapLogger';

export class TradingBot {
  private raydiumSwap: RaydiumSwap;
  private priceManager: PriceManager;
  private swapLogger: SwapLogger;
  private isRunning: boolean = false;

  constructor(rpcUrl: string, walletPrivateKey: string) {
    this.raydiumSwap = new RaydiumSwap(rpcUrl, walletPrivateKey);
    this.priceManager = new PriceManager();
    this.swapLogger = new SwapLogger();
  }

  public async start() {
    this.isRunning = true;
    await this.initialize();
    await this.runTradingLoop();
  }

  private async initialize() {
    await this.raydiumSwap.loadPoolKeys(swapConfig.liquidityFile);
  }

  private async runTradingLoop() {
    while (this.isRunning) {
      try {
        const currentPrice = await this.fetchCurrentPrice();
        console.log(`Current SOL price: ${currentPrice.toFixed(2)} USDC`);
        console.log(`Current flag: ${priceConfig.flag}`);
        
        this.priceManager.addPrice(currentPrice);

        if (this.priceManager.isReadyForTrading()) {
          await this.executeTradingStrategy(currentPrice);
        }

        // Wait for the next interval
        await new Promise(resolve => setTimeout(resolve, this.priceManager.getCurrentInterval()));
      } catch (error) {
        console.error('Error in trading loop:', error);
        // Wait for 1 minute before retrying on error
        await new Promise(resolve => setTimeout(resolve, 60 * 1000));
      }
    }
  }

  private async fetchCurrentPrice(): Promise<number> {
    await this.raydiumSwap.loadPoolKeys(swapConfig.liquidityFile);
    const poolInfo = this.raydiumSwap.findPoolInfoForTokens(swapConfig.tokenAAddress, swapConfig.tokenBAddress);
    if (!poolInfo) {
      throw new Error('Pool info not found');
    }

    // Get pool info to calculate price
    const poolInfoData = await Liquidity.fetchInfo({ connection: this.raydiumSwap.connection, poolKeys: poolInfo });
    
    // Calculate price based on pool reserves
    const baseReserve = Number(poolInfoData.baseReserve) / Math.pow(10, poolInfoData.baseDecimals);
    const quoteReserve = Number(poolInfoData.quoteReserve) / Math.pow(10, poolInfoData.quoteDecimals);
    
    // Calculate price (USDC per SOL)
    const priceInUsdc = quoteReserve / baseReserve;
    // console.log(`Sol price: ${priceInUsdc}`);
    return priceInUsdc;
  }

  private async getSOLBalance(): Promise<number> {
    const solBalance = await this.raydiumSwap.connection.getBalance(this.raydiumSwap.wallet.publicKey);
    return solBalance / Math.pow(10, 9); // Convert lamports to SOL
  }

  private async getUSDCBalance(): Promise<number> {
    const tokenAccounts = await this.raydiumSwap.getOwnerTokenAccounts();
    const tokenAccount = tokenAccounts.find(account => 
      account.accountInfo.mint.toString() === swapConfig.tokenBAddress
    );
    return tokenAccount ? Number(tokenAccount.accountInfo.amount) / Math.pow(10, 6) : 0;
  }

  private async executeTradingStrategy(currentPrice: number) {
    // Check for emergency swap condition
    if (this.priceManager.shouldEmergencySwap(currentPrice)) {
      console.log('Emergency swap condition met: Price drop > $5.4');
      await this.executeEmergencySwap();
      return;
    }

    // Calculate trading thresholds
    const { buyThreshold, sellThreshold } = this.priceManager.calculateThresholds();
    console.log(`Buy threshold: ${buyThreshold.toFixed(2)} USDC`);
    console.log(`Sell threshold: ${sellThreshold.toFixed(2)} USDC`);

    // Get current balances
    const solBalance = await this.getSOLBalance();
    const usdcBalance = await this.getUSDCBalance();
    console.log(`Current SOL balance: ${solBalance.toFixed(4)} SOL`);
    console.log(`Current USDC balance: ${usdcBalance.toFixed(2)} USDC`);

    // Execute buy if conditions are met
    if (currentPrice <= buyThreshold && usdcBalance > priceConfig.minUSDCBalance) {
      console.log(`Price below buy threshold, buying SOL with ${(usdcBalance * priceConfig.normalSwapPercentage).toFixed(2)} USDC`);
      await this.executeBuy(usdcBalance * priceConfig.normalSwapPercentage);
      priceConfig.flag = -1;
      console.log('Flag set to -1 after USDC->SOL swap');
    }
    // Execute sell if conditions are met
    else if (currentPrice >= sellThreshold && solBalance > priceConfig.minSOLBalance) {
      console.log(`Price above sell threshold, selling ${(solBalance * priceConfig.normalSwapPercentage).toFixed(4)} SOL`);
      await this.executeSell(solBalance * priceConfig.normalSwapPercentage);
      priceConfig.flag = 1;
      console.log('Flag set to 1 after SOL->USDC swap');
    }
    else {
      console.log('Price within thresholds or balance conditions not met, no action needed');
    }
  }

  private async executeEmergencySwap() {
    const solBalance = await this.getSOLBalance();
    if (solBalance > 0) {
      console.log(`Executing emergency swap: selling ${(solBalance * priceConfig.emergencySwapPercentage).toFixed(4)} SOL`);
      await this.executeSell(solBalance * priceConfig.emergencySwapPercentage);
    }
  }

  private async executeBuy(amount: number) {
    const poolKeys = this.raydiumSwap.findPoolInfoForTokens(
      swapConfig.tokenAAddress,
      swapConfig.tokenBAddress
    );

    if (!poolKeys) {
      console.error('Pool not found for token pair');
      return;
    }

    const currentPrice = await this.fetchCurrentPrice();
    const tx = await this.raydiumSwap.getSwapTransaction(
      swapConfig.tokenAAddress,
      amount,
      poolKeys,
      swapConfig.maxLamports,
      swapConfig.useVersionedTransaction,
      'in'
    );

    if (swapConfig.executeSwap) {
      try {
        const txid = swapConfig.useVersionedTransaction
          ? await this.raydiumSwap.sendVersionedTransaction(tx as VersionedTransaction, swapConfig.maxRetries)
          : await this.raydiumSwap.sendLegacyTransaction(tx as Transaction, swapConfig.maxRetries);
        console.log(`Swap executed: scan`);
        
        this.swapLogger.logSwap({
          timestamp: new Date().toISOString(),
          type: 'BUY',
          amount: amount,
          price: currentPrice,
          transactionId: txid,
          status: 'SUCCESS'
        });
      } catch (error) {
        console.error('Swap failed:', error);
        this.swapLogger.logSwap({
          timestamp: new Date().toISOString(),
          type: 'BUY',
          amount: amount,
          price: currentPrice,
          status: 'FAILED'
        });
      }
    } else {
      const simRes = swapConfig.useVersionedTransaction
        ? await this.raydiumSwap.simulateVersionedTransaction(tx as VersionedTransaction)
        : await this.raydiumSwap.simulateLegacyTransaction(tx as Transaction);
      console.log('Swap simulation:', simRes);
      
      this.swapLogger.logSwap({
        timestamp: new Date().toISOString(),
        type: 'BUY',
        amount: amount,
        price: currentPrice,
        status: 'SIMULATED'
      });
    }
  }

  private async executeSell(amount: number) {
    const poolKeys = this.raydiumSwap.findPoolInfoForTokens(
      swapConfig.tokenAAddress,
      swapConfig.tokenBAddress
    );

    if (!poolKeys) {
      console.error('Pool not found for token pair');
      return;
    }

    const currentPrice = await this.fetchCurrentPrice();
    const tx = await this.raydiumSwap.getSwapTransaction(
      swapConfig.tokenBAddress,
      amount,
      poolKeys,
      swapConfig.maxLamports,
      swapConfig.useVersionedTransaction,
      'in'
    );

    if (swapConfig.executeSwap) {
      try {
        const txid = swapConfig.useVersionedTransaction
          ? await this.raydiumSwap.sendVersionedTransaction(tx as VersionedTransaction, swapConfig.maxRetries)
          : await this.raydiumSwap.sendLegacyTransaction(tx as Transaction, swapConfig.maxRetries);
        console.log(`Swap executed: scan`);
        
        this.swapLogger.logSwap({
          timestamp: new Date().toISOString(),
          type: 'SELL',
          amount: amount,
          price: currentPrice,
          transactionId: txid,
          status: 'SUCCESS'
        });
      } catch (error) {
        console.error('Swap failed:', error);
        this.swapLogger.logSwap({
          timestamp: new Date().toISOString(),
          type: 'SELL',
          amount: amount,
          price: currentPrice,
          status: 'FAILED'
        });
      }
    } else {
      const simRes = swapConfig.useVersionedTransaction
        ? await this.raydiumSwap.simulateVersionedTransaction(tx as VersionedTransaction)
        : await this.raydiumSwap.simulateLegacyTransaction(tx as Transaction);
      console.log('Swap simulation:', simRes);
      
      this.swapLogger.logSwap({
        timestamp: new Date().toISOString(),
        type: 'SELL',
        amount: amount,
        price: currentPrice,
        status: 'SIMULATED'
      });
    }
  }

  public stop() {
    this.isRunning = false;
  }
} 