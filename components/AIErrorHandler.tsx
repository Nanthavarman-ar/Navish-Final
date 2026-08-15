import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';

interface AIErrorHandlerProps {
  children: ReactNode;
  fallbackComponent?: ReactNode;
}

interface AIErrorHandlerState {
  hasError: boolean;
  error: Error | null;
  errorType: 'network' | 'analysis' | 'speech' | 'general';
  retryCount: number;
  isOnline: boolean;
}

class AIErrorHandler extends Component<AIErrorHandlerProps, AIErrorHandlerState> {
  private maxRetries = 3;
  private retryTimeouts = [1000, 2000, 4000]; // Exponential backoff

  constructor(props: AIErrorHandlerProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorType: 'general',
      retryCount: 0,
      isOnline: navigator.onLine
    };
  }

  static getDerivedStateFromError(error: Error): Partial<AIErrorHandlerState> {
    // Determine error type based on error message
    let errorType: AIErrorHandlerState['errorType'] = 'general';

    if (error.message.includes('network') || error.message.includes('fetch')) {
      errorType = 'network';
    } else if (error.message.includes('analysis') || error.message.includes('structural')) {
      errorType = 'analysis';
    } else if (error.message.includes('speech') || error.message.includes('recognition')) {
      errorType = 'speech';
    }

    return {
      hasError: true,
      error,
      errorType,
      retryCount: 0
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('AI Error Handler caught an error:', error, errorInfo);

    // Log to external service in production
    if (process.env.NODE_ENV === 'production') {
      // Could integrate with error reporting service like Sentry
      console.error('AI Feature Error:', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        errorType: this.state.errorType,
        timestamp: new Date().toISOString()
      });
    }
  }

  componentDidMount() {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  handleOnline = () => {
    this.setState({ isOnline: true });
    if (this.state.hasError && this.state.errorType === 'network') {
      this.attemptRecovery();
    }
  };

  handleOffline = () => {
    this.setState({ isOnline: false });
  };

  attemptRecovery = () => {
    const { retryCount, errorType } = this.state;

    if (retryCount < this.maxRetries) {
      const delay = this.retryTimeouts[retryCount] || 4000;

      setTimeout(() => {
        this.setState(prevState => ({
          hasError: false,
          error: null,
          retryCount: prevState.retryCount + 1
        }));
      }, delay);
    }
  };

  handleManualRetry = () => {
    this.attemptRecovery();
  };

  getErrorMessage = () => {
    const { errorType, isOnline } = this.state;

    if (!isOnline) {
      return {
        title: 'Connection Lost',
        message: 'AI features require an internet connection. Please check your network and try again.',
        icon: <WifiOff className="w-5 h-5 text-red-500" />
      };
    }

    switch (errorType) {
      case 'network':
        return {
          title: 'Network Error',
          message: 'Unable to connect to AI services. This might be a temporary issue.',
          icon: <Wifi className="w-5 h-5 text-orange-500" />
        };
      case 'analysis':
        return {
          title: 'Analysis Engine Error',
          message: 'The structural analysis encountered an issue. The AI will attempt to recover automatically.',
          icon: <AlertTriangle className="w-5 h-5 text-yellow-500" />
        };
      case 'speech':
        return {
          title: 'Voice Recognition Error',
          message: 'Speech recognition is not available or encountered an error. Please check your microphone permissions.',
          icon: <AlertTriangle className="w-5 h-5 text-purple-500" />
        };
      default:
        return {
          title: 'AI Feature Error',
          message: 'An unexpected error occurred in the AI feature. Please try again.',
          icon: <AlertTriangle className="w-5 h-5 text-red-500" />
        };
    }
  };

  render() {
    if (this.state.hasError) {
      const { title, message, icon } = this.getErrorMessage();
      const { retryCount, isOnline } = this.state;
      const maxRetries = this.maxRetries;

      if (this.props.fallbackComponent) {
        return this.props.fallbackComponent;
      }

      return (
        <div className="flex items-center justify-center h-full bg-slate-900 p-6">
          <div className="max-w-md w-full">
            <Alert className="border-orange-200 bg-orange-50">
              <div className="flex items-start gap-3">
                {icon}
                <div className="flex-1">
                  <AlertDescription className="text-slate-700">
                    <div className="font-semibold mb-2">{title}</div>
                    <div className="mb-4">{message}</div>

                    {retryCount < maxRetries && isOnline && (
                      <div className="mb-4">
                        <div className="text-sm text-slate-600 mb-2">
                          Automatic recovery attempt {retryCount + 1} of {maxRetries}...
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div
                            className="bg-orange-500 h-2 rounded-full transition-all duration-1000"
                            style={{
                              width: `${((maxRetries - retryCount) / maxRetries) * 100}%`
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        onClick={this.handleManualRetry}
                        disabled={retryCount >= maxRetries || !isOnline}
                        size="sm"
                        variant="outline"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry Now
                      </Button>

                      <Button
                        onClick={() => window.location.reload()}
                        size="sm"
                        variant="outline"
                      >
                        Restart
                      </Button>
                    </div>

                    {!isOnline && (
                      <div className="mt-3 p-3 bg-slate-100 rounded text-sm">
                        <WifiOff className="w-4 h-4 inline mr-2" />
                        You're currently offline. Some AI features require an internet connection.
                      </div>
                    )}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AIErrorHandler;
