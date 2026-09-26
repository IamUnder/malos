// Consultas de la aplicación. Todo lo que toca la base de datos pasa por aquí.
import { randomBytes, randomUUID } from 'node:crypto';
import { db, tx, now, getSetting, setSetting } from './db.js';
import { config } from './config.js';

const token = (bytes = 24) => randomBytes(bytes).toString('base64url');

export const GAMES = { lol: 'League of Legends', valorant: 'Valorant' };

// Un partido sigue siendo "el próximo" hasta 3 h después de empezar (mientras se juega).
const LIVE_WINDOW_MS = 3 * 3600e3;
const liveCutoff = () => new Date(Date.now() - LIVE_WINDOW_MS).toISOString();

// ---------- Jugadores y ranking ----------

export function listPlayers({ includeInactive = false } = {}) {
  return db.prepare(`
    SELECT * FROM players ${includeInactive ? '' : 'WHERE active = 1'}
    ORDER BY game, sort, nick COLLATE NOCASE
  `).all();
}

export const getPlayer = (id) => db.prepare('SELECT * FROM players WHERE id = ?').get(id);

export function savePlayer({ id, nick, name, role, game, champions, bio, sort, active }) {
  const values = [nick, name || '', role || '', game || 'lol', (champions || []).join(','), bio || '', Number(sort) || 0, active ? 1 : 0];
  if (id) db.prepare('UPDATE players SET nick=?, name=?, role=?, game=?, champions=?, bio=?, sort=?, active=? WHERE id=?').run(...values, id);
  else db.prepare('INSERT INTO players (nick, name, role, game, champions, bio, sort, active) VALUES (?,?,?,?,?,?,?,?)').run(...values);
}

/** Jugadores activos con su número de fans (solo cuentan socios con email confirmado). */
export function ranking(game) {
  const rows = db.prepare(`
    SELECT p.*, COUNT(m.id) AS fans
    FROM players p
    LEFT JOIN members m ON m.favorite_player_id = p.id AND m.verified_at IS NOT NULL
    WHERE p.active = 1 ${game ? 'AND p.game = ?' : ''}
    GROUP BY p.id
    ORDER BY fans DESC, p.sort, p.nick COLLATE NOCASE
  `).all(...(game ? [game] : []));
  const total = rows.reduce((sum, r) => sum + r.fans, 0);
  return rows.map((r) => ({ ...r, share: total ? r.fans / total : 0 }));
}

// ---------- Partidos y noticias ----------

export const nextMatch = () =>
  db.prepare("SELECT * FROM matches WHERE starts_at >= ? AND result = '' ORDER BY starts_at LIMIT 1").get(liveCutoff());

export const upcomingMatches = (limit = 5) =>
  db.prepare("SELECT * FROM matches WHERE starts_at >= ? AND result = '' ORDER BY starts_at LIMIT ?").all(liveCutoff(), limit);

export const recentResults = (limit = 5) =>
  db.prepare("SELECT * FROM matches WHERE result != '' ORDER BY starts_at DESC LIMIT ?").all(limit);

export const listMatches = (limit = 50) => db.prepare('SELECT * FROM matches ORDER BY starts_at DESC LIMIT ?').all(limit);
export const getMatch = (id) => db.prepare('SELECT * FROM matches WHERE id = ?').get(id);
export const deleteMatch = (id) => db.prepare('DELETE FROM matches WHERE id = ?').run(id);

export function saveMatch({ id, startsAt, opponent, competition, game, streamUrl, result }) {
  const values = [startsAt.toISOString(), opponent, competition || '', game || 'lol', streamUrl || '', result || ''];
  if (id) db.prepare('UPDATE matches SET starts_at=?, opponent=?, competition=?, game=?, stream_url=?, result=? WHERE id=?').run(...values, id);
  else db.prepare('INSERT INTO matches (starts_at, opponent, competition, game, stream_url, result) VALUES (?,?,?,?,?,?)').run(...values);
}

export const listPosts = (limit = 10) => db.prepare('SELECT * FROM posts ORDER BY created_at DESC LIMIT ?').all(limit);
export const getPost = (id) => db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
export const deletePost = (id) => db.prepare('DELETE FROM posts WHERE id = ?').run(id);

export function createPost({ title, body }) {
  const { lastInsertRowid } = db.prepare('INSERT INTO posts (title, body, created_at) VALUES (?,?,?)').run(title, body, now());
  return getPost(lastInsertRowid);
}

export const markPostPushed = (id, count) => db.prepare('UPDATE posts SET pushed_to = ? WHERE id = ?').run(count, id);

// ---------- Socios ----------

export const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

export const memberByToken = (t) => db.prepare('SELECT * FROM members WHERE access_token = ?').get(t);
export const memberById = (id) => db.prepare('SELECT * FROM members WHERE id = ?').get(id);
export const memberByEmail = (email) => db.prepare('SELECT * FROM members WHERE email = ?').get(normalizeEmail(email));
export const memberByNumber = (n) => db.prepare('SELECT * FROM members WHERE number = ?').get(n);

/**
 * Crea el socio sin número. Si el email ya existe, devuelve el existente (para reenviarle el enlace)
 * sin tocar sus datos: así nadie puede cambiar el favorito de otro solo sabiendo su email.
 */
export function createMember({ nick, email, favoritePlayerId }) {
  const existing = memberByEmail(email);
  if (existing) return { member: existing, created: false };
  const id = randomUUID();
  const ts = now();
  db.prepare(`
    INSERT INTO members (id, nick, email, favorite_player_id, access_token, created_at, favorite_changed_at)
    VALUES (?,?,?,?,?,?,?)
  `).run(id, nick, normalizeEmail(email), favoritePlayerId || null, token(), ts, ts);
  return { member: memberById(id), created: true };
}

/** Confirma el email y asigna el siguiente número de socio. Idempotente. */
export function verifyMember(member) {
  if (member.verified_at) return member;
  return tx(() => {
    // Contador que solo sube: el número de un socio dado de baja no se vuelve a dar.
    const { max } = db.prepare('SELECT COALESCE(MAX(number), 0) AS max FROM members').get();
    const next = Math.max(Number(getSetting('last_member_number', 0)), max) + 1;
    setSetting('last_member_number', next);
    db.prepare('UPDATE members SET number = ?, verified_at = ? WHERE id = ?').run(next, now(), member.id);
    return memberById(member.id);
  });
}

/** Fecha a partir de la que puede volver a cambiar de favorito, o null si ya puede. */
export function favoriteLockedUntil(member) {
  if (!member.favorite_player_id || !member.favorite_changed_at) return null;
  const at = new Date(member.favorite_changed_at).getTime() + config.favoriteCooldownDays * 86400e3;
  return at > Date.now() ? new Date(at) : null;
}

export const changeFavorite = (member, playerId) =>
  db.prepare('UPDATE members SET favorite_player_id = ?, favorite_changed_at = ? WHERE id = ?').run(playerId, now(), member.id);

export const deleteMember = (id) => db.prepare('DELETE FROM members WHERE id = ?').run(id);

/** Los socios sin confirmar de hace más de 7 días se borran: no tienen número ni cuentan en el ranking. */
export const purgeUnverified = () =>
  db.prepare('DELETE FROM members WHERE verified_at IS NULL AND created_at < ?').run(new Date(Date.now() - 7 * 86400e3).toISOString()).changes;

export function listMembers({ q = '', limit = 200 } = {}) {
  const like = `%${q}%`;
  return db.prepare(`
    SELECT m.*, p.nick AS favorite_nick,
      (SELECT COUNT(*) FROM push_subscriptions s WHERE s.member_id = m.id) AS devices
    FROM members m LEFT JOIN players p ON p.id = m.favorite_player_id
    WHERE m.nick LIKE ? OR m.email LIKE ? OR CAST(m.number AS TEXT) = ?
    ORDER BY m.number IS NULL, m.number DESC, m.created_at DESC
    LIMIT ?
  `).all(like, like, q, limit);
}

export function stats() {
  return db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM members WHERE verified_at IS NOT NULL) AS members,
      (SELECT COUNT(*) FROM members WHERE verified_at IS NULL) AS pending,
      (SELECT COUNT(DISTINCT member_id) FROM push_subscriptions) AS withPush,
      (SELECT COUNT(*) FROM push_subscriptions) AS devices,
      (SELECT COUNT(*) FROM members WHERE verified_at >= ?) AS lastWeek
  `).get(new Date(Date.now() - 7 * 86400e3).toISOString());
}

// ---------- Avisos push ----------

export function saveSubscription(memberId, { endpoint, keys }) {
  db.prepare(`
    INSERT INTO push_subscriptions (endpoint, p256dh, auth, member_id, created_at) VALUES (?,?,?,?,?)
    ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, member_id = excluded.member_id
  `).run(endpoint, keys.p256dh, keys.auth, memberId, now());
}

export const deleteSubscription = (endpoint) => db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);

export const countSubscriptions = (memberId) =>
  db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE member_id = ?').get(memberId).n;

export const allSubscriptions = () =>
  db.prepare(`
    SELECT s.* FROM push_subscriptions s JOIN members m ON m.id = s.member_id WHERE m.verified_at IS NOT NULL
  `).all();
