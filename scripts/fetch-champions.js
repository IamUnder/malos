// Actualiza la lista de campeones y descarga los iconos que falten de los jugadores de la base de datos.
// Uso: `npm run champions` (necesita internet). Fuente: Data Dragon, el CDN público de Riot Games.
import { existsSync, writeFileSync } from 'node:fs';
import { listPlayers } from '../src/data.js';
import { parseChampions } from '../src/lib/champions.js';

const DDRAGON = 'https://ddragon.leagueoflegends.com';
const [version] = await (await fetch(`${DDRAGON}/api/versions.json`)).json();
const { data } = await (await fetch(`${DDRAGON}/cdn/${version}/data/es_ES/champion.json`)).json();

const names = Object.fromEntries(Object.entries(data).sort().map(([id, c]) => [id, c.name]));
writeFileSync(new URL('../src/champions.json', import.meta.url), `${JSON.stringify(names, null, 0)}\n`);
console.log(`Lista de campeones actualizada (${Object.keys(names).length}, versión ${version}).`);

const wanted = new Set(listPlayers({ includeInactive: true }).flatMap((p) => parseChampions(p.champions)));
for (const id of wanted) {
  const file = new URL(`../public/img/champions/${id}.png`, import.meta.url);
  if (existsSync(file) || !names[id]) continue;
  const res = await fetch(`${DDRAGON}/cdn/${version}/img/champion/${id}.png`);
  if (!res.ok) { console.warn(`No se pudo descargar ${id}`); continue; }
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log(`+ ${id}`);
}
