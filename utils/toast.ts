// Simple toast notification utility
// This can be replaced with a more sophisticated toast library like react-hot-toast

interface ToastOptions {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

class ToastManager {
  private container: HTMLElement | null = null;

  constructor() {
    this.createContainer();
  }

  private createContainer(): void {
    if (typeof document === 'undefined') return;

    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      pointer-events: none;
    `;
    document.body.appendChild(this.container);
  }

  show(options: ToastOptions): void {
    if (!this.container) return;

    const { message, type = 'info', duration = 3000 } = options;

    const toast = document.createElement('div');
    toast.style.cssText = `
      background: ${this.getBackgroundColor(type)};
      color: white;
      padding: 12px 16px;
      border-radius: 4px;
      margin-bottom: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      pointer-events: auto;
      cursor: pointer;
      font-size: 14px;
      max-width: 300px;
      word-wrap: break-word;
    `;

    toast.textContent = message;
    toast.onclick = () => this.removeToast(toast);

    this.container.appendChild(toast);

    // Auto remove after duration
    setTimeout(() => this.removeToast(toast), duration);
  }

  private getBackgroundColor(type: string): string {
    switch (type) {
      case 'success':
        return '#10b981';
      case 'error':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      case 'info':
      default:
        return '#3b82f6';
    }
  }

  private removeToast(toast: HTMLElement): void {
    if (toast.parentNode) {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }
  }
}

const toastManager = new ToastManager();

export const showToast = {
  success: (message: string, description?: string) => {
    toastManager.show({
      message: description ? `${message}: ${description}` : message,
      type: 'success'
    });
  },
  error: (message: string, description?: string) => {
    toastManager.show({
      message: description ? `${message}: ${description}` : message,
      type: 'error'
    });
  },
  info: (message: string, description?: string) => {
    toastManager.show({
      message: description ? `${message}: ${description}` : message,
      type: 'info'
    });
  },
  warning: (message: string, description?: string) => {
    toastManager.show({
      message: description ? `${message}: ${description}` : message,
      type: 'warning'
    });
  }
};

// For backward compatibility
export default showToast;
