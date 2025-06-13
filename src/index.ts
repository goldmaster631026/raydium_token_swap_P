import dotenv from 'dotenv';
import { TradingBot } from './tradingBot';

// Load environment variables
dotenv.config();

const RPC_URL = process.env.RPC_URL;
const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;

if (!RPC_URL || !WALLET_PRIVATE_KEY) {
  console.error('Please provide RPC_URL and WALLET_PRIVATE_KEY in .env file');
  process.exit(1);
}

async function main() {
  const tradingBot = new TradingBot(RPC_URL, WALLET_PRIVATE_KEY);
  
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('Stopping trading bot...');
    tradingBot.stop();
    process.exit(0);
  });

  try {
    console.log('Start');
    await tradingBot.start();
  } catch (error) {
    console.error('Error starting:', error);
    process.exit(1);
  }
}

main();
