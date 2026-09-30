export interface AppConfig {
  env: string;
  port: number;
  database: {
    url: string;
  };
  /** Origen exacto permitido para CORS con credenciales. Sin valor,
   * CORS queda deshabilitado (no se usa "*" nunca, por las cookies de sesión). */
  corsOrigin?: string;
}

const DEFAULT_DEV_CORS_ORIGIN = 'http://localhost:5173';

export default (): AppConfig => {
  const env = process.env.NODE_ENV ?? 'development';

  return {
    env,
    port: parseInt(process.env.PORT ?? '3000', 10),
    database: {
      url: process.env.DATABASE_URL ?? '',
    },
    corsOrigin:
      process.env.CORS_ORIGIN ??
      (env === 'production' ? undefined : DEFAULT_DEV_CORS_ORIGIN),
  };
};
