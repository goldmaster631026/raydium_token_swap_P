import fs from 'fs';
import path from 'path';

interface SwapLog {
  timestamp: string;
  type: 'BUY' | 'SELL';
  amount: number;
  price: number;
  transactionId?: string;
  status: 'SUCCESS' | 'FAILED' | 'SIMULATED';
}

export class SwapLogger {
  private logFile: string;

  constructor(logFile: string = 'log.csv') {
    this.logFile = logFile;
    this.initializeLogFile();
  }

  private initializeLogFile() {
    if (!fs.existsSync(this.logFile)) {
      const header = 'timestamp,type,amount,price,transactionId,status\n';
      fs.writeFileSync(this.logFile, header);
    }
  }

  public logSwap(log: SwapLog) {
    const logEntry = [
      log.timestamp,
      log.type,
      log.amount,
      log.price,
      log.transactionId || '',
      log.status
    ].join(',') + '\n';

    fs.appendFileSync(this.logFile, logEntry);
  }
} 