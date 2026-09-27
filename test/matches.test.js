import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), 'malos-')), 'test.db');
const data = await import('../src/data.js');

for (const [i, nick] of ['Top', 'Jungla', 'Mid', 'Adc', 'Supp', 'Suplente'].entries()) {
  data.savePlayer({ nick, role: 'top', game: 'lol', sort: i, active: true });
}
const players = data.listPlayers();
const [top, jungla, mid] = players;
const socio = (n) => data.verifyMember(data.createMember({ nick: `s${n}`, email: `s${n}@t.es` }).member);
const DAY = 86400e3;

test('la votación de predicción está abierta hasta que empieza el partido', () => {
  const id = data.saveMatch({ startsAt: new Date(Date.now() + DAY), opponent: 'A', game: 'lol' });
  const m = data.getMatch(id);
  assert.equal(data.votePhase(m), 'pre');
  assert.equal(data.votePhase(m, Date.now() + 2 * DAY), null, 'en juego: cerrada');
});

test('al poner el resultado se abre la confirmación durante 7 días', () => {
  const id = data.saveMatch({ startsAt: new Date(Date.now() - DAY), opponent: 'B', game: 'lol' });
  assert.equal(data.getMatch(id).closed_at, null);
  data.saveMatch({ id, startsAt: new Date(Date.now() - DAY), opponent: 'B', game: 'lol', result: '2-1' });
  const m = data.getMatch(id);
  assert.ok(m.closed_at);
  assert.equal(data.votePhase(m), 'post');
  assert.equal(data.votePhase(m, Date.now() + 8 * DAY), null);
  // Volver a guardar con resultado no reinicia el plazo.
  data.saveMatch({ id, startsAt: new Date(Date.now() - DAY), opponent: 'B', game: 'lol', result: '2-1' });
  assert.equal(data.getMatch(id).closed_at, m.closed_at);
});

test('un socio vota una vez por fase y puede cambiar su voto', () => {
  const id = data.saveMatch({ startsAt: new Date(Date.now() + DAY), opponent: 'C', game: 'lol' });
  const match = data.getMatch(id);
  const a = socio(1);
  const b = socio(2);
  data.castVote({ match, member: a, phase: 'pre', mvpId: top.id, fraudId: mid.id });
  data.castVote({ match, member: a, phase: 'pre', mvpId: jungla.id, fraudId: mid.id }); // cambia de idea
  data.castVote({ match, member: b, phase: 'pre', mvpId: jungla.id, fraudId: top.id });
  const t = data.voteTally(id, 'pre');
  assert.equal(t.total, 2);
  assert.deepEqual(t.mvp.map((r) => [r.nick, r.votes]), [['Jungla', 2]]);
  assert.deepEqual(data.winners(t.fraud).map((r) => r.nick).sort(), ['Mid', 'Top'], 'empate: ganan los dos');
  assert.equal(data.memberVotes(id, a.id).pre.mvp_id, jungla.id);
});

test('tras meter estadísticas solo se puede votar a quien jugó', () => {
  const id = data.saveMatch({ startsAt: new Date(Date.now() - DAY), opponent: 'D', game: 'lol', result: '0-2' });
  const match = data.getMatch(id);
  assert.equal(data.voteCandidates(match).length, players.length);
  data.saveMatchStats(id, [
    { playerId: top.id, champion: 'Ornn', kills: 2, deaths: 4, assists: 6 },
    { playerId: mid.id, champion: 'Sylas', kills: 8, deaths: 1, assists: 3 },
  ]);
  assert.deepEqual(data.voteCandidates(match).map((p) => p.nick), ['Top', 'Mid']);
});

test('las estadísticas de la temporada suman KDA y cuentan MVP/fraude confirmados', () => {
  const id = data.saveMatch({ startsAt: new Date(Date.now() - 2 * DAY), opponent: 'E', game: 'lol', result: '2-0' });
  data.saveMatchStats(id, [
    { playerId: top.id, champion: 'Urgot', kills: 4, deaths: 2, assists: 4 },
    { playerId: mid.id, champion: 'Yasuo', kills: 0, deaths: 9, assists: 1 },
  ]);
  const match = data.getMatch(id);
  data.castVote({ match, member: socio(3), phase: 'post', mvpId: top.id, fraudId: mid.id });

  const season = data.seasonStats('lol');
  const t = season.find((r) => r.id === top.id);
  const m = season.find((r) => r.id === mid.id);
  assert.deepEqual([t.games, t.kills, t.deaths, t.assists], [2, 6, 6, 10]);
  assert.equal(t.kda, 16 / 6);
  assert.equal(t.mvp, 1);
  assert.equal(m.fraud, 1);
  assert.equal(season[0].games > 0, true, 'primero los que han jugado');
});
