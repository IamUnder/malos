// Imágenes de las noticias. Se guardan junto a la base de datos (volumen /app/data, que entra en
// las copias) y se sirven en /uploads/<nombre>. El navegador del admin ya las reduce antes de
// subirlas (máx. 1600 px), así que aquí no se procesa nada: solo se comprueba que sean imágenes.
import { randomBytes } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config } from '../config.js';
import { UPLOAD_RE } from './markdown.js';

export const UPLOAD_DIR = join(dirname(config.dbPath), 'uploads');
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const TYPES = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
};

/** Tipo real según los primeros bytes (no se fía de la extensión ni del navegador). */
function sniff(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (buf.subarray(0, 4).toString('latin1') === 'GIF8') return 'gif';
  return null;
}

/** Guarda una imagen subida. Devuelve { url } o { error } con un mensaje para el admin. */
export async function saveUpload(file) {
  if (!file || typeof file.arrayBuffer !== 'function') return { error: 'No ha llegado ninguna imagen.' };
  if (file.size > MAX_UPLOAD_BYTES) return { error: 'La imagen pesa demasiado (máximo 4 MB).' };
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniff(buf);
  if (!ext) return { error: 'Ese archivo no es una imagen JPG, PNG, WebP o GIF.' };
  mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = `${randomBytes(12).toString('hex')}.${ext}`;
  writeFileSync(join(UPLOAD_DIR, name), buf);
  return { url: `/uploads/${name}` };
}

/** Lee una imagen para servirla, o null si el nombre no es válido o no existe. */
export function readUpload(name) {
  const url = `/uploads/${name}`;
  if (!UPLOAD_RE.test(url)) return null;
  const path = join(UPLOAD_DIR, name);
  if (!existsSync(path)) return null;
  return { body: readFileSync(path), type: TYPES[name.split('.').pop()] };
}
