// Plantilla inicial de League of Legends. Se carga una sola vez, al arrancar con la tabla de
// jugadores vacía. Después se gestiona desde /admin/jugadores (editar esto ya no cambia nada).
// Los campeones son ids de Data Dragon; el primero hace de foto mientras no haya oficiales.
import { db, getSetting, setSetting } from './db.js';

export const ROSTER = [
  { nick: 'Dame mi bici', name: 'Ángel', role: 'top', champions: ['Ornn', 'TahmKench', 'Urgot'] },
  { nick: 'Under', name: 'Jorge', role: 'jungla', champions: ['Viego', 'Vi', 'Graves'] },
  { nick: 'Kaelosio', name: 'Carlos', role: 'mid', champions: ['Katarina', 'Sylas', 'Yasuo'] },
  { nick: 'Luque', name: 'José Manuel', role: 'adc', champions: ['MissFortune', 'Jinx', 'Aphelios'] },
  { nick: 'SuppLawyer', name: 'Antonio', role: 'support', champions: ['Thresh', 'Bard', 'Karma'] },
];

export function seedRoster() {
  if (getSetting('roster_seeded')) return;
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM players').get();
  if (n === 0) {
    const insert = db.prepare("INSERT INTO players (nick, name, role, game, champions, sort, active) VALUES (?, ?, ?, 'lol', ?, ?, 1)");
    ROSTER.forEach((p, i) => insert.run(p.nick, p.name, p.role, p.champions.join(','), i));
    console.log(`[db] plantilla inicial cargada (${ROSTER.length} jugadores)`);
  }
  setSetting('roster_seeded', '1');
}
