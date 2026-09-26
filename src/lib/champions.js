// Campeones de LoL: nombres en español (src/champions.json, de Data Dragon) e iconos en public/img/champions.
// Para añadir iconos de campeones nuevos: `npm run champions`.
import { existsSync, readFileSync } from 'node:fs';

const NAMES = JSON.parse(readFileSync(new URL('../champions.json', import.meta.url), 'utf8'));
const iconDir = new URL('../../public/img/champions/', import.meta.url);

export const championName = (id) => NAMES[id] || id;

export function championIcon(id) {
  return existsSync(new URL(`${id}.png`, iconDir)) ? `/img/champions/${id}.png` : null;
}

export const parseChampions = (value) => String(value || '').split(',').map((s) => s.trim()).filter(Boolean);

/**
 * Convierte lo que se escribe en el panel ("Miss Fortune, jinx, Bardo") en ids de Data Dragon.
 * Acepta el id o el nombre en español, sin importar mayúsculas, espacios ni tildes.
 */
export function resolveChampions(input) {
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const index = new Map();
  for (const [id, name] of Object.entries(NAMES)) { index.set(norm(id), id); index.set(norm(name), id); }
  const ids = [];
  const unknown = [];
  for (const part of String(input || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const id = index.get(norm(part));
    if (id) { if (!ids.includes(id)) ids.push(id); } else unknown.push(part);
  }
  return { ids: ids.slice(0, 5), unknown };
}

export const allChampionIds = () => Object.keys(NAMES);
