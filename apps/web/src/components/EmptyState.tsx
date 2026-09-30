import type { ReactNode } from 'react';
import { Heart } from './Heart';
import './EmptyState.css';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  /** El corazon es una de las pocas ubicaciones pensadas para la marca
   * (CONTEXT.md). Por defecto encendido, pero puede apagarse si el
   * estado vacio ya tiene su propio icono. */
  showHeart?: boolean;
}

export function EmptyState({ title, description, action, showHeart = true }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {showHeart ? <Heart size={32} className="empty-state__heart" /> : null}
      <h3 className="empty-state__title">{title}</h3>
      {description ? <p className="empty-state__description">{description}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
