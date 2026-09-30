import { useContext } from 'react';
import { NotificationContext, type NotifyFn } from './notification-context';

export function useNotify(): NotifyFn {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotify debe usarse dentro de <NotificationProvider>');
  }
  return context;
}
