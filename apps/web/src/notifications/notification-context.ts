import { createContext } from 'react';
import type { ToastType } from '../components/Toast';

export interface AppNotification {
  id: string;
  type: ToastType;
  message: string;
}

export interface NotifyFn {
  (type: ToastType, message: string): void;
  success: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
  error: (message: string) => void;
}

export const NotificationContext = createContext<NotifyFn | undefined>(undefined);
