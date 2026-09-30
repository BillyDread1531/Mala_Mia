import type { AppNotification } from '../notifications/notification-context';
import './Toast.css';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

const LABELS: Record<ToastType, string> = {
  success: 'Éxito',
  info: 'Información',
  warning: 'Advertencia',
  error: 'Error',
};

interface ToastProps {
  notification: AppNotification;
  onDismiss: (id: string) => void;
}

export function Toast({ notification, onDismiss }: ToastProps) {
  return (
    <div className={`toast toast--${notification.type}`}>
      <span className="toast__indicator" aria-hidden="true" />
      <div className="toast__body">
        <span className="toast__label">{LABELS[notification.type]}</span>
        <p className="toast__message">{notification.message}</p>
      </div>
      <button
        type="button"
        className="toast__close"
        aria-label="Cerrar notificación"
        onClick={() => onDismiss(notification.id)}
      >
        ×
      </button>
    </div>
  );
}
