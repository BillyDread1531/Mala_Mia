import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Toast, type ToastType } from '../components/Toast';
import { NotificationContext, type AppNotification, type NotifyFn } from './notification-context';

const AUTO_DISMISS_MS = 4500;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const dismiss = useCallback((id: string) => {
    setNotifications((current) => current.filter((n) => n.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = crypto.randomUUID();
      setNotifications((current) => [...current, { id, type, message }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const notify = useMemo<NotifyFn>(
    () =>
      Object.assign((type: ToastType, message: string) => push(type, message), {
        success: (message: string) => push('success', message),
        info: (message: string) => push('info', message),
        warning: (message: string) => push('warning', message),
        error: (message: string) => push('error', message),
      }),
    [push],
  );

  return (
    <NotificationContext.Provider value={notify}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {notifications.map((notification) => (
          <Toast key={notification.id} notification={notification} onDismiss={dismiss} />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}
