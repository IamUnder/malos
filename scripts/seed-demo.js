// Datos de ejemplo para desarrollo local: `npm run seed:demo`.
// No lo ejecutes en producción: la plantilla real se da de alta desde /admin/jugadores.
import { db } from '../src/db.js';
import { createMember, verifyMember, saveMatch, createPost, listPlayers, stats, getMatch, saveMatchStats, castVote, memberById } from '../src/data.js';
import { seedRoster } from '../src/roster.js';

if (process.env.NODE_ENV === 'production') {
  console.error('seed-demo no se ejecuta en producción.');
  process.exit(1);
}
if (stats().members + stats().pending > 0) {
  console.log('Ya hay socios: no se cargan datos de ejemplo.');
  process.exit(0);
}

seedRoster();
const players = listPlayers();

const day = 86400e3;
const nextId = saveMatch({ startsAt: new Date(Date.now() + 2 * day), opponent: 'Rival de ejemplo', competition: 'Liga UCLM · Jornada 3', game: 'lol', bestOf: 3, streamUrl: 'https://www.twitch.tv/' });
saveMatch({ startsAt: new Date(Date.now() + 9 * day), opponent: 'Otro rival', competition: 'Liga UCLM · Jornada 4', game: 'lol' });
const pastId = saveMatch({ startsAt: new Date(Date.now() - 2 * day), opponent: 'Rival pasado', competition: 'Liga UCLM · Jornada 2', game: 'lol', bestOf: 3, result: '2-1' });
// KDA de ejemplo del partido pasado (mismo orden que la plantilla: top, jungla, mid, adc, support)
const kda = [['Ornn', 3, 4, 11], ['Viego', 7, 2, 9], ['Sylas', 9, 3, 6], ['Jinx', 11, 1, 5], ['Thresh', 1, 5, 18]];
saveMatchStats(pastId, kda.map(([champion, kills, deaths, assists], i) => ({ playerId: players[i].id, champion, kills, deaths, assists })));

createPost({ title: 'Arranca la web de socios', body: 'Ya puedes hacerte socio de Malos: número de socio, avisos de los partidos y vota a tu jugador favorito.\n\n(Noticia de ejemplo)' });

// Socios de ejemplo repartidos entre jugadores para que el ranking tenga algo que enseñar.
const weights = [9, 14, 6, 11, 4];
let n = 0;
weights.forEach((count, i) => {
  for (let k = 0; k < count; k++) {
    const { member } = createMember({ nick: `fan${++n}`, email: `fan${n}@ejemplo.test`, favoritePlayerId: players[i].id });
    verifyMember(member);
  }
});
// Votos de ejemplo: predicción del próximo partido y veredicto del pasado.
const all = db.prepare('SELECT id FROM members').all().map((r) => memberById(r.id));
const pick = (i, k) => players[(i * 7 + k) % players.length].id;
all.forEach((member, i) => {
  const mvp = pick(i, 1);
  let fraud = pick(i, 3);
  if (fraud === mvp) fraud = players[(players.findIndex((p) => p.id === mvp) + 1) % players.length].id;
  const scores = ['2-0', '2-1', '1-2', '0-2'];
  castVote({ match: getMatch(nextId), member, phase: 'pre', mvpId: mvp, fraudId: fraud, score: scores[i % 4] });
  castVote({ match: getMatch(pastId), member, phase: 'pre', mvpId: pick(i, 2), fraudId: pick(i, 2) === players[4].id ? players[0].id : players[4].id, score: scores[(i * 3) % 4] });
  if (i % 3) castVote({ match: getMatch(pastId), member, phase: 'post', mvpId: i % 2 ? players[3].id : players[1].id, fraudId: players[4].id });
});

// El primer socio, con el favorito cambiado hace tiempo, para probar el cambio de favorito.
db.prepare('UPDATE members SET favorite_changed_at = ? WHERE number = 1').run(new Date(Date.now() - 60 * day).toISOString());

const first = db.prepare('SELECT access_token FROM members WHERE number = 1').get();
console.log(`Datos de ejemplo cargados: ${players.length} jugadores, ${n} socios.`);
console.log(`Carné del socio #0001: http://localhost:3000/socio/${first.access_token}`);
