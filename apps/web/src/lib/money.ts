/**
 * Formatea un monto en quetzales con el signo antes de la "Q" (`-Q130`, no
 * `Q-130`) y sin decimales ".00" cuando no aportan info. Centralizado porque
 * antes de la Fase 18 existían ~10 copias de este mismo formateo, cada una
 * con el mismo bug de signo para montos negativos (reembolsos, utilidad
 * negativa, etc.).
 */
export function formatMoney(value: string | number): string {
  const n = typeof value === 'number' ? value : Number(value);
  const sign = n < 0 ? '-' : '';
  const digits = Math.abs(n).toFixed(2).replace(/\.00$/, '');
  return `${sign}Q${digits}`;
}
