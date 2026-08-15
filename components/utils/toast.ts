import { toast } from 'sonner';

export const showToast = {
  success: (message: string, description?: string) => {
    toast.success(message, {
      description,
      duration: 4000,
    });
  },
  error: (message: string, description?: string) => {
    toast.error(message, {
      description,
      duration: 5000,
    });
  },
  info: (message: string, description?: string) => {
    toast.info(message, {
      description,
      duration: 4000,
    });
  },
  warning: (message: string, description?: string) => {
    toast.warning(message, {
      description,
      duration: 4000,
    });
  },
  loading: (message: string, description?: string): string | number => {
    return toast.loading(message, { description });
  },
  update: (id: string | number, message: string, description?: string) => {
    toast.message(message, { id, description });
  },
  dismiss: (toastId?: string | number) => {
    toast.dismiss(toastId);
  },
};
