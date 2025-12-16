import { create } from 'zustand';

type Toast = {
  id: string;
  title?: string;
  description?: string;
  timeout?: number;
  href?: string;
};

type ToastState = {
  toasts: Toast[];
  pushToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
};

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  pushToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          id: crypto.randomUUID(),
          timeout: 3500,
          ...toast,
        },
      ],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
