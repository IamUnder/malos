// Sesión del panel de administración (una sola contraseña, cookie firmada) y utilidades de firma.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getSignedCookie, setSignedCookie, deleteCookie } from 'hono/cookie';
import { config } from '../config.js';

const COOKIE = 'malos_admin';
const MAX_AGE = 7 * 86400;

export function sign(value) {
  return createHmac('sha256', config.sessionSecret).update(String(value)).digest('base64url');
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Código corto para comprobar un carné en un evento sin que se puedan adivinar los demás. */
export const memberCheckCode = (number) => sign(`check:${number}`).slice(0, 8);
export const memberCheckPath = (member) => `/s/${member.number}-${memberCheckCode(member.number)}`;

export async function loginAdmin(c, password) {
  if (!safeEqual(password, config.adminPassword)) return false;
  await setSignedCookie(c, COOKIE, String(Date.now() + MAX_AGE * 1000), config.sessionSecret, {
    httpOnly: true, sameSite: 'Strict', secure: config.isProd, path: '/', maxAge: MAX_AGE,
  });
  return true;
}

export const logoutAdmin = (c) => deleteCookie(c, COOKIE, { path: '/' });

export async function requireAdmin(c, next) {
  const expires = Number(await getSignedCookie(c, config.sessionSecret, COOKIE));
  if (!expires || expires < Date.now()) return c.redirect('/admin/login');
  await next();
}
