export const SESSION_COOKIE_NAME = 'mala_mia_session';

/**
 * Límite práctico que respetan los navegadores modernos para Max-Age de
 * cookies (~400 días). La sesión real no expira por inactividad: la
 * controla `user_sessions.revoked_at` en el servidor (ver CONTEXT.md #18).
 * Esto solo evita que el navegador borre la cookie antes de tiempo.
 */
export const SESSION_COOKIE_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000;
