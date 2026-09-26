// Fechas siempre en hora de España, da igual en qué zona horaria corra el servidor.
const TZ = 'Europe/Madrid';

export function formatDate(iso, options = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-ES', { timeZone: TZ, ...options }).format(new Date(iso));
}

export const formatDateTime = (iso) =>
  formatDate(iso, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/** "vs Rival · jue 2 oct, 20:00" — cabe en el campo de la tarjeta del Wallet. */
export function formatMatchShort(match) {
  const when = formatDate(match.starts_at, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `vs ${match.opponent} · ${when}`;
}

/** Valor para <input type="datetime-local"> en hora de España. */
export function toLocalInput(iso) {
  if (!iso) return '';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Interpreta "2026-10-02T20:00" (de un formulario) como hora de España y devuelve un Date. */
export function fromLocalInput(value) {
  const [date, time = '00:00'] = String(value).split('T');
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Diferencia entre UTC y Madrid en ese instante (cambia con el horario de verano).
  const offset = new Date(guess).getTime() - new Date(toLocalInput(new Date(guess).toISOString()) + ':00Z').getTime();
  return new Date(guess + offset);
}

export const pad = (n) => String(n).padStart(4, '0');
