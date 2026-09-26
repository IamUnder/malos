// Protección de formularios públicos: límite de peticiones por IP y Cloudflare Turnstile (opcional).
import { config } from '../config.js';

const hits = new Map();

/** Detrás de Cloudflare la IP real llega en cf-connecting-ip. */
export const clientIp = (c) =>
  c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0].trim() || 'local';

/** true si esta IP ha superado `max` peticiones en la ventana `windowMs` para `bucket`. */
export function tooMany(c, bucket, max, windowMs) {
  const key = `${bucket}:${clientIp(c)}`;
  const t = Date.now();
  const recent = (hits.get(key) || []).filter((at) => t - at < windowMs);
  recent.push(t);
  hits.set(key, recent);
  return recent.length > max;
}

// Limpieza periódica para que el mapa no crezca sin límite.
setInterval(() => {
  const t = Date.now();
  for (const [key, list] of hits) if (list.every((at) => t - at > 3600e3)) hits.delete(key);
}, 600e3).unref();

export async function turnstileOk(c, token) {
  if (!config.turnstile.enabled) return true;
  if (!token) return false;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: config.turnstile.secret, response: token, remoteip: clientIp(c) }),
  }).catch(() => null);
  return Boolean(res?.ok && (await res.json()).success);
}
