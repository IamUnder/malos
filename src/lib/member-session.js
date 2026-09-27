// Recordar al socio en este dispositivo: al abrir su enlace personal se guarda una cookie con él,
// y así "Mi tarjeta" y las votaciones funcionan sin volver a pedir el email.
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { config } from '../config.js';
import { memberByToken } from '../data.js';

const COOKIE = 'malos_socio';
const MAX_AGE = 365 * 86400;

export function rememberMember(c, member) {
  setCookie(c, COOKIE, member.access_token, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'Lax', // Lax para que siga funcionando al llegar desde un enlace (email, redes)
    path: '/',
    maxAge: MAX_AGE,
  });
}

export const forgetMember = (c) => deleteCookie(c, COOKIE, { path: '/' });

/** El socio recordado en este dispositivo, o null. Si la cookie ya no vale (baja), se borra. */
export function currentMember(c) {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  const member = memberByToken(token);
  if (!member?.verified_at) { forgetMember(c); return null; }
  return member;
}
