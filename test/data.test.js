import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Base de datos temporal: nunca toca data/malos.db.
process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), 'malos-')), 'test.db');
const data = await import('../src/data.js');
const { db } = await import('../src/db.js');
const { memberCheckCode } = await import('../src/lib/auth.js');
const { fromLocalInput, toLocalInput } = await import('../src/lib/format.js');

data.savePlayer({ nick: 'Uno', role: 'top', game: 'lol', sort: 0, active: true });
data.savePlayer({ nick: 'Dos', role: 'mid', game: 'lol', sort: 1, active: true });
const [uno, dos] = data.listPlayers();

test('el número de socio se asigna al confirmar, en orden, y no se reutiliza', () => {
  const a = data.createMember({ nick: 'a', email: 'A@Test.es', favoritePlayerId: uno.id }).member;
  const b = data.createMember({ nick: 'b', email: 'b@test.es', favoritePlayerId: dos.id }).member;
  assert.equal(a.number, null);
  assert.equal(data.verifyMember(b).number, 1);
  assert.equal(data.verifyMember(a).number, 2);
  assert.equal(data.verifyMember(data.memberById(a.id)).number, 2, 'confirmar dos veces no cambia el número');

  data.deleteMember(a.id);
  const c = data.createMember({ nick: 'c', email: 'c@test.es', favoritePlayerId: uno.id }).member;
  assert.equal(data.verifyMember(c).number, 3);
});

test('el mismo email no crea otro socio ni cambia sus datos', () => {
  const again = data.createMember({ nick: 'otro', email: ' b@TEST.es ', favoritePlayerId: uno.id });
  assert.equal(again.created, false);
  assert.equal(again.member.nick, 'b');
  assert.equal(again.member.favorite_player_id, dos.id);
});

test('el ranking solo cuenta socios confirmados', () => {
  data.createMember({ nick: 'sin confirmar', email: 'x@test.es', favoritePlayerId: dos.id });
  const rank = data.ranking();
  assert.deepEqual(rank.map((p) => [p.nick, p.fans]), [['Uno', 1], ['Dos', 1]]);
  assert.equal(rank.reduce((s, p) => s + p.share, 0), 1);
});

test('no se puede cambiar de favorito hasta que pasa el plazo', () => {
  const m = data.memberByEmail('b@test.es');
  assert.ok(data.favoriteLockedUntil(m) instanceof Date);
  db.prepare('UPDATE members SET favorite_changed_at = ? WHERE id = ?').run(new Date(Date.now() - 40 * 86400e3).toISOString(), m.id);
  assert.equal(data.favoriteLockedUntil(data.memberById(m.id)), null);
});

test('las altas sin confirmar de más de 7 días se borran', () => {
  const old = data.createMember({ nick: 'viejo', email: 'viejo@test.es' }).member;
  db.prepare('UPDATE members SET created_at = ? WHERE id = ?').run(new Date(Date.now() - 8 * 86400e3).toISOString(), old.id);
  assert.equal(data.purgeUnverified(), 1);
  assert.equal(data.memberById(old.id), undefined);
});

test('borrar un socio borra sus suscripciones push', () => {
  const m = data.memberByEmail('c@test.es');
  data.saveSubscription(m.id, { endpoint: 'https://push.example/1', keys: { p256dh: 'k', auth: 'a' } });
  assert.equal(data.countSubscriptions(m.id), 1);
  data.deleteMember(m.id);
  assert.equal(data.allSubscriptions().length, 0);
});

test('el código de comprobación de carné es estable y distinto por número', () => {
  assert.equal(memberCheckCode(7), memberCheckCode(7));
  assert.notEqual(memberCheckCode(7), memberCheckCode(8));
});

test('las fechas del panel se interpretan en hora de España (con horario de verano)', () => {
  assert.equal(fromLocalInput('2026-07-10T20:00').toISOString(), '2026-07-10T18:00:00.000Z');
  assert.equal(fromLocalInput('2026-12-10T20:00').toISOString(), '2026-12-10T19:00:00.000Z');
  assert.equal(toLocalInput('2026-07-10T18:00:00.000Z'), '2026-07-10T20:00');
});
