/**
 * Enhanced retry utility with exponential backoff for network operations
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryCondition?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    retryCondition = () => true,
    onRetry
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      return {
        success: true,
        data: result,
        attempts: attempt
      };
    } catch (error) {
      lastError = error as Error;

      // Don't retry if we've exhausted attempts or condition fails
      if (attempt === maxAttempts || !retryCondition(lastError)) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelay * Math.pow(backoffMultiplier, attempt - 1),
        maxDelay
      );

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt, lastError);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: maxAttempts
  };
}

/**
 * Retry function specifically for network operations
 */
export async function retryNetworkOperation<T>(
  fn: () => Promise<T>,
  options: Omit<RetryOptions, 'retryCondition'> = {}
): Promise<RetryResult<T>> {
  return retryWithBackoff(fn, {
    ...options,
    retryCondition: (error: Error) => {
      // Retry on network-related errors
      const networkErrors = [
        'network',
        'fetch',
        'timeout',
        'connection',
        'offline',
        'unreachable'
      ];

      const shouldRetry = networkErrors.some(keyword =>
        error.message.toLowerCase().includes(keyword)
      );

      return shouldRetry;
    }
  });
}

/**
 * Enhanced API call with retry logic
 */
export async function apiCallWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<RetryResult<Response>> {
  return retryNetworkOperation(async () => {
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  }, retryOptions);
}

/**
 * Check if the user is online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Wait for online status
 */
export function waitForOnline(timeout: number = 30000): Promise<boolean> {
  return new Promise((resolve) => {
    if (navigator.onLine) {
      resolve(true);
      return;
    }

    const handleOnline = () => {
      clearTimeout(timeoutId);
      window.removeEventListener('online', handleOnline);
      resolve(true);
    };

    const timeoutId = setTimeout(() => {
      window.removeEventListener('online', handleOnline);
      resolve(false);
    }, timeout);

    window.addEventListener('online', handleOnline);
  });
}

/**
 * Network status monitor
 */
export class NetworkMonitor {
  private listeners: Set<(online: boolean) => void> = new Set();
  private currentStatus: boolean = navigator.onLine;

  constructor() {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  private handleOnline = () => {
    this.currentStatus = true;
    this.notifyListeners(true);
  };

  private handleOffline = () => {
    this.currentStatus = false;
    this.notifyListeners(false);
  };

  private notifyListeners(online: boolean) {
    this.listeners.forEach(listener => {
      try {
        listener(online);
      } catch (error) {
        console.error('Network monitor listener error:', error);
      }
    });
  }

  public addListener(listener: (online: boolean) => void): () => void {
    this.listeners.add(listener);

    // Immediately notify current status
    listener(this.currentStatus);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  public isOnline(): boolean {
    return this.currentStatus;
  }

  public destroy() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.listeners.clear();
  }
}

// Export singleton instance
export const networkMonitor = new NetworkMonitor();
