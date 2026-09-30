import './Loading.css';

interface LoadingProps {
  label?: string;
  fullPage?: boolean;
}

export function Loading({ label = 'Cargando…', fullPage = false }: LoadingProps) {
  return (
    <div className={fullPage ? 'loading loading--full' : 'loading'} role="status">
      <span className="loading__spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
