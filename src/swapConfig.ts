export const swapConfig = {
  executeSwap: true, // Send tx when true, simulate tx when false
  useVersionedTransaction: true,
  tokenAAmount: 0.003, 
  tokenAAddress: "So11111111111111111111111111111111111111112", 
  tokenBAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", 
  maxLamports: 1500, // Micro lamports for priority fee
  direction: "in" as "in" | "out", // Swap direction: 'in' or 'out'
  liquidityFile: "trimmed_mainnet.json",
  maxRetries: 5,
};
