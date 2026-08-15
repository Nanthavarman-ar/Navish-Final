export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: string;
  data?: any;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private context: string = 'PresentationManager';

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  setContext(context: string): void {
    this.context = context;
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: Error | any): void {
    this.log(LogLevel.ERROR, message, error);
  }

  private log(level: LogLevel, message: string, data?: any): void {
    if (level < this.logLevel) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context: this.context,
      data
    };

    // Add to internal log storage
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // Remove oldest log
    }

    // Output to console in simple format
    const levelStr = LogLevel[level];
    if (level === LogLevel.ERROR && data) {
      this.outputToConsole(level, `[${levelStr}] ${message}`, data);
    } else {
      this.outputToConsole(level, `[${levelStr}] ${message}`);
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const levelStr = LogLevel[entry.level];
    const contextStr = entry.context ? `[${entry.context}]` : '';
    const dataStr = entry.data ? `\n${JSON.stringify(entry.data, null, 2)}` : '';

    return `${timestamp} ${levelStr} ${contextStr} ${entry.message}${dataStr}`;
  }

  private outputToConsole(level: LogLevel, message: string, data?: any): void {
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(message);
        break;
      case LogLevel.INFO:
        console.info(message);
        break;
      case LogLevel.WARN:
        console.warn(message);
        break;
      case LogLevel.ERROR:
        if (data !== undefined) {
          console.error(message, data);
        } else {
          console.error(message);
        }
        break;
    }
  }

  getLogs(level?: LogLevel): LogEntry[] {
    if (level !== undefined) {
      return this.logs.filter(log => log.level >= level);
    }
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  exportLogs(): string {
    return this.logs.map(entry => this.formatLogEntry(entry)).join('\n');
  }

  // Convenience method for performance logging
  time(label: string): () => void {
    const start = performance.now();
    this.debug(`Starting timer: ${label}`);

    return () => {
      const end = performance.now();
      const duration = end - start;
      this.info(`Timer ${label} completed in ${duration.toFixed(2)}ms`);
    };
  }
}

// Global logger instance
export const logger = Logger.getInstance();
