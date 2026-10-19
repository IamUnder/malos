// Tarjeta de socio en Google Wallet (solo Android: Google Wallet no existe en iPhone).
//
// - Una "clase" común para todos (malos_socio) con lo que comparten: el próximo partido y los avisos.
// - Un "objeto" por socio con sus datos. Se crea cuando el socio pulsa "Añadir a Google Wallet":
//   el enlace lleva un JWT firmado con la clave de la cuenta de servicio que contiene el objeto.
// - Los avisos se mandan como mensajes de la clase (TEXT_AND_NOTIFY): llegan a todas las tarjetas a la vez.
//   Google limita las notificaciones a 3 por tarjeta cada 24 h.
//
// Sin dependencias: firma RS256 con node:crypto y llamadas REST con fetch.
import { createSign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { config } from '../config.js';
import { memberCheckPath } from './auth.js';
import { formatDate, formatMatchShort, pad } from './format.js';

const API = 'https://walletobjects.googleapis.com/walletobjects/v1';
const SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer';

const { issuerId, keyFile } = config.googleWallet;
const key = issuerId && existsSync(keyFile) ? JSON.parse(readFileSync(keyFile, 'utf8')) : null;
// Solo en producción: la clase y los avisos son los reales, y un servidor de desarrollo con la clave
// a mano los pisaría (próximo partido de ejemplo, avisos de prueba a los socios). Para probar en local
// a propósito: GOOGLE_WALLET_ALLOW_DEV=true.
const allowed = config.isProd || process.env.GOOGLE_WALLET_ALLOW_DEV === 'true';
export const enabled = allowed && Boolean(key?.private_key && key?.client_email);

const CLASS_ID = `${issuerId}.malos_socio`;
const objectId = (member) => `${issuerId}.socio_${member.id.replace(/[^\w.-]/g, '_')}`;
const es = (value) => ({ defaultValue: { language: 'es', value: String(value) } });

const b64url = (data) => Buffer.from(typeof data === 'string' ? data : JSON.stringify(data)).toString('base64url');

function signJwt(claims) {
  const unsigned = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url(claims)}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url');
  return `${unsigned}.${signature}`;
}

// ---------- Token de acceso (OAuth 2, cuenta de servicio) ----------

let cachedToken = null;
async function accessToken() {
  if (cachedToken && cachedToken.expires > Date.now() + 60e3) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt({ iss: key.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`Google OAuth ${res.status}: ${await res.text()}`);
  const { access_token: value, expires_in: ttl } = await res.json();
  cachedToken = { value, expires: Date.now() + ttl * 1000 };
  return value;
}

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`Google Wallet ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : {};
}

// ---------- Clase (común a todas las tarjetas) ----------

function classBody(nextMatch) {
  return {
    id: CLASS_ID,
    multipleDevicesAndHoldersAllowedStatus: 'ONE_USER_ALL_DEVICES',
    textModulesData: [{
      id: 'proximo_partido',
      header: 'Próximo partido',
      body: nextMatch ? `${formatMatchShort(nextMatch)}${nextMatch.competition ? ` · ${nextMatch.competition}` : ''}` : 'Por anunciar',
    }],
    linksModuleData: { uris: [{ id: 'web', uri: config.siteUrl, description: 'malos.es' }] },
  };
}

/** Crea o actualiza la clase. Se llama al arrancar y cada vez que cambia el próximo partido. */
export async function syncClass(nextMatch) {
  if (!enabled) return;
  const body = classBody(nextMatch);
  try {
    await api('PUT', `/genericClass/${CLASS_ID}`, body);
  } catch (err) {
    if (err.status !== 404) throw err;
    await api('POST', '/genericClass', body);
  }
}

// ---------- Objeto (la tarjeta de cada socio) ----------

function objectBody(member, favorite) {
  const number = `#${pad(member.number)}`;
  return {
    id: objectId(member),
    classId: CLASS_ID,
    state: 'ACTIVE',
    cardTitle: es('MALOS'),
    subheader: es('Socio'),
    header: es(member.nick),
    hexBackgroundColor: '#e3b93c',
    logo: { sourceUri: { uri: `${config.siteUrl}/img/wallet-logo.png` }, contentDescription: es('Escudo de Malos') },
    barcode: { type: 'QR_CODE', value: `${config.siteUrl}${memberCheckPath(member)}`, alternateText: `Socio ${number}` },
    textModulesData: [
      { id: 'numero', header: 'Nº de socio', body: number },
      { id: 'favorito', header: 'Jugador favorito', body: favorite?.nick ?? '—' },
      { id: 'desde', header: 'Socio desde', body: formatDate(member.verified_at, { month: 'long', year: 'numeric' }) },
    ],
    linksModuleData: { uris: [{ id: 'carne', uri: `${config.siteUrl}/socio/${member.access_token}`, description: 'Mi carné en malos.es' }] },
  };
}

/** Enlace "Añadir a Google Wallet": el JWT lleva el objeto completo y Google lo crea al guardarlo. */
export function saveUrl(member, favorite) {
  const jwt = signJwt({
    iss: key.client_email,
    aud: 'google',
    typ: 'savetowallet',
    origins: [config.siteUrl],
    payload: { genericObjects: [objectBody(member, favorite)] },
  });
  return `https://pay.google.com/gp/v/save/${jwt}`;
}

/** Actualiza la tarjeta de un socio (p. ej. al cambiar de favorito). Si aún no la ha guardado, no hace nada. */
export async function updateMember(member, favorite) {
  if (!enabled || !member.number) return;
  try {
    await api('PUT', `/genericObject/${objectId(member)}`, objectBody(member, favorite));
  } catch (err) {
    if (err.status !== 404) throw err;
  }
}

/** Da de baja la tarjeta (al borrar el socio): queda caducada en el móvil. */
export async function expireMember(member) {
  if (!enabled || !member.number) return;
  try {
    await api('PATCH', `/genericObject/${objectId(member)}`, { state: 'EXPIRED' });
  } catch (err) {
    if (err.status !== 404) throw err;
  }
}

/** Aviso a todas las tarjetas a la vez, con notificación en el móvil. */
export async function broadcastMessage({ title, body }) {
  if (!enabled) return false;
  await api('POST', `/genericClass/${CLASS_ID}/addMessage`, {
    message: {
      id: `aviso_${Date.now()}`,
      header: title.slice(0, 60),
      body: body.slice(0, 300),
      messageType: 'TEXT_AND_NOTIFY',
    },
  });
  return true;
}

/** Ejecuta una llamada a Google Wallet sin bloquear ni romper la petición web si falla. */
export function inBackground(promise, what) {
  Promise.resolve(promise).catch((err) => console.error(`[google-wallet] ${what}:`, err.message));
}
