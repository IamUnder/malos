// Campeones de LoL: nombres en español (src/champions.json, de Data Dragon) e iconos en public/img/champions.
// Están todos los iconos en el repo. Si Riot saca un campeón nuevo: `npm run champions`.
import { existsSync, readFileSync } from 'node:fs';

const NAMES = JSON.parse(readFileSync(new URL('../champions.json', import.meta.url), 'utf8'));
const iconDir = new URL('../../public/img/champions/', import.meta.url);

export const championName = (id) => NAMES[id] || id;

export function championIcon(id) {
  return existsSync(new URL(`${id}.png`, iconDir)) ? `/img/champions/${id}.png` : null;
}

export const parseChampions = (value) => String(value || '').split(',').map((s) => s.trim()).filter(Boolean);

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
const INDEX = new Map();
for (const [id, name] of Object.entries(NAMES)) { INDEX.set(norm(id), id); INDEX.set(norm(name), id); }

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** Un campeón a partir de lo que se escriba: id, nombre en español o una errata pequeña ("yummi" → Yuumi). */
export function resolveChampion(text) {
  const key = norm(String(text || ''));
  if (!key) return null;
  if (INDEX.has(key)) return { id: INDEX.get(key), corrected: false };
  // Errata: el más parecido, si está claro (1 letra de margen en nombres cortos, 2 en largos) y no hay empate.
  const max = key.length <= 4 ? 1 : 2;
  let best = null;
  let tie = false;
  for (const [k, id] of INDEX) {
    const d = distance(key, k);
    if (d > max) continue;
    if (!best || d < best.d) { best = { id, d }; tie = false; } else if (d === best.d && id !== best.id) tie = true;
  }
  return best && !tie ? { id: best.id, corrected: true } : null;
}

/**
 * Convierte lo que se escribe en el panel ("Miss Fortune, jinx, Bardo") en ids de Data Dragon.
 * Devuelve también lo que no reconoce y lo que ha corregido, para avisar en el panel.
 */
export function resolveChampions(input) {
  const ids = [];
  const unknown = [];
  const corrected = [];
  for (const part of String(input || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const found = resolveChampion(part);
    if (!found) { unknown.push(part); continue; }
    if (found.corrected) corrected.push(`${part} → ${championName(found.id)}`);
    if (!ids.includes(found.id)) ids.push(found.id);
  }
  return { ids: ids.slice(0, 5), unknown, corrected };
}

export const allChampionIds = () => Object.keys(NAMES);
