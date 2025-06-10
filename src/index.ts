import RaydiumSwap from './RaydiumSwap';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import 'dotenv/config';
import { swapConfig } from './swapConfig';
import { priceConfig } from './priceConfig';
import { Liquidity } from '@raydium-io/raydium-sdk';

/**
 * Gets the current SOL price in USDC
 */
const getSolPrice = async (raydiumSwap: RaydiumSwap): Promise<number> => {
  await raydiumSwap.loadPoolKeys(swapConfig.liquidityFile);
  const poolInfo = raydiumSwap.findPoolInfoForTokens(swapConfig.tokenAAddress, swapConfig.tokenBAddress);
  if (!poolInfo) {
    throw new Error('Pool info not found');
  }

  // Get pool info to calculate price
  const poolInfoData = await Liquidity.fetchInfo({ connection: raydiumSwap.connection, poolKeys: poolInfo });
  
  // Calculate price based on pool reserves
  const baseReserve = Number(poolInfoData.baseReserve) / Math.pow(10, poolInfoData.baseDecimals);
  const quoteReserve = Number(poolInfoData.quoteReserve) / Math.pow(10, poolInfoData.quoteDecimals);
  
  // Calculate price (USDC per SOL)
  const priceInUsdc = quoteReserve / baseReserve;
  // console.log(`Current SOL price: ${priceInUsdc.toFixed(2)} USDC`);
  return priceInUsdc;
};

/**
 * Gets the token balance for a given mint address
 */
const getTokenBalance = async (raydiumSwap: RaydiumSwap, mintAddress: string): Promise<number> => {
  // Handle SOL balance separately since it's not an SPL token
  if (mintAddress === "So11111111111111111111111111111111111111112") {
    const solBalance = await raydiumSwap.connection.getBalance(raydiumSwap.wallet.publicKey);
    return solBalance / Math.pow(10, 9); // Convert lamports to SOL
  }

  // Handle SPL tokens
  const tokenAccounts = await raydiumSwap.getOwnerTokenAccounts();
  const tokenAccount = tokenAccounts.find(account => 
    account.accountInfo.mint.toString() === mintAddress
  );
  return tokenAccount ? Number(tokenAccount.accountInfo.amount) / Math.pow(10, 6) : 0;
};

/**
 * Performs a swap operation
 */
const performSwap = async (
  raydiumSwap: RaydiumSwap,
  fromToken: string,
  toToken: string,
  amount: number,
  direction: 'in' | 'out'
) => {
  await raydiumSwap.loadPoolKeys(swapConfig.liquidityFile);
  const poolInfo = raydiumSwap.findPoolInfoForTokens(fromToken, toToken);
  if (!poolInfo) {
    throw new Error('Pool info not found');
  }

  const tx = await raydiumSwap.getSwapTransaction(
    toToken,
    amount,
    poolInfo,
    swapConfig.maxLamports,
    swapConfig.useVersionedTransaction,
    direction
  );

  if (swapConfig.executeSwap) {
    const txid = swapConfig.useVersionedTransaction
      ? await raydiumSwap.sendVersionedTransaction(tx as VersionedTransaction, swapConfig.maxRetries)
      : await raydiumSwap.sendLegacyTransaction(tx as Transaction, swapConfig.maxRetries);
    console.log(`Swap executed: https://solscan.io/tx/${txid}`);
  } else {
    const simRes = swapConfig.useVersionedTransaction
      ? await raydiumSwap.simulateVersionedTransaction(tx as VersionedTransaction)
      : await raydiumSwap.simulateLegacyTransaction(tx as Transaction);
    console.log('Swap simulation:', simRes);
  }
};

/**
 * Main monitoring and swapping loop
 */
const monitorAndSwap = async () => {
  const raydiumSwap = new RaydiumSwap(process.env.RPC_URL, process.env.WALLET_PRIVATE_KEY);
  console.log('Price monitoring bot initialized');

  while (true) {
    try {
      const currentPrice = await getSolPrice(raydiumSwap);
      console.log(`Current SOL price: ${currentPrice.toFixed(2)} USDC`);
      const usdcBalance = await getTokenBalance(raydiumSwap, swapConfig.tokenBAddress);
      console.log(`USDC balance: ${usdcBalance} USDC`);
      const solBalance = await getTokenBalance(raydiumSwap, swapConfig.tokenAAddress);
      console.log(`SOL balance: ${solBalance} SOL`);

      if (currentPrice <= priceConfig.startPrice) {
        // Price is low, buy SOL with USDC
        
        if (usdcBalance > 0) {
          const swapAmount = usdcBalance * priceConfig.swapPercentage;
          console.log(`Price below threshold (${priceConfig.startPrice} USDC), buying SOL with ${swapAmount} USDC`);
          await performSwap(
            raydiumSwap,
            swapConfig.tokenBAddress,
            swapConfig.tokenAAddress,
            swapAmount,
            'in'
          );
        }
      } else if (currentPrice >= priceConfig.endPrice) {
        // Price is high, sell SOL for USDC
        
        if (solBalance > 0) {
          const swapAmount = solBalance * priceConfig.swapPercentage;
          console.log(`Price above threshold (${priceConfig.endPrice} USDC), selling ${swapAmount} SOL for USDC`);
          await performSwap(
            raydiumSwap,
            swapConfig.tokenAAddress,
            swapConfig.tokenBAddress,
            swapAmount,
            'in'
          );
        }
      } else {
        console.log('Price within thresholds, no action needed');
      }
    } catch (error) {
      console.error('Error in monitoring loop:', error);
    }

    // Wait for the next monitoring interval
    await new Promise(resolve => setTimeout(resolve, priceConfig.monitoringInterval));
  }
};

// Start the monitoring loop
monitorAndSwap();
