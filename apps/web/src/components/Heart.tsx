import { useId } from 'react';

interface HeartProps {
  size?: number;
  className?: string;
  /** Solo cuando el corazón transmite un significado que el texto cercano
   * no cubre (ej. estado vacío). Si es puramente decorativo, se omite y
   * el SVG queda aria-hidden. */
  title?: string;
}

/**
 * Marca distintiva de MALA MÍA. Úsese con intención (logo, login,
 * confirmaciones, estados vacíos), no como relleno decorativo repetido.
 */
export function Heart({ size = 24, className, title }: HeartProps) {
  const gradientId = `mala-mia-heart-${useId()}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="24" y2="24">
          <stop offset="0%" stopColor="var(--color-accent)" />
          <stop offset="100%" stopColor="var(--color-accent-strong)" />
        </linearGradient>
      </defs>
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill={`url(#${gradientId})`}
      />
    </svg>
  );
}
