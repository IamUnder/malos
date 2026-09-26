// SQLite integrado en Node (node:sqlite): sin dependencias nativas ni servidor de base de datos aparte.
// Las migraciones se aplican solas al arrancar, en orden, usando PRAGMA user_version.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

const migrations = [
  // 1 — esquema inicial
  `
  CREATE TABLE players (
    id          INTEGER PRIMARY KEY,
    nick        TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT '',
    game        TEXT NOT NULL DEFAULT 'lol',
    bio         TEXT NOT NULL DEFAULT '',
    sort        INTEGER NOT NULL DEFAULT 0,
    active      INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE members (
    id                   TEXT PRIMARY KEY,
    number               INTEGER UNIQUE,             -- se asigna al confirmar el email
    nick                 TEXT NOT NULL,
    email                TEXT NOT NULL UNIQUE,
    favorite_player_id   INTEGER REFERENCES players(id) ON DELETE SET NULL,
    access_token         TEXT NOT NULL UNIQUE,       -- enlace personal /socio/<token>
    created_at           TEXT NOT NULL,
    verified_at          TEXT,
    favorite_changed_at  TEXT
  );
  CREATE INDEX members_favorite ON members(favorite_player_id) WHERE verified_at IS NOT NULL;

  CREATE TABLE matches (
    id           INTEGER PRIMARY KEY,
    starts_at    TEXT NOT NULL,                      -- ISO 8601 con zona horaria
    opponent     TEXT NOT NULL,
    competition  TEXT NOT NULL DEFAULT '',
    game         TEXT NOT NULL DEFAULT 'lol',
    stream_url   TEXT NOT NULL DEFAULT '',
    result       TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE posts (
    id            INTEGER PRIMARY KEY,
    title         TEXT NOT NULL,
    body          TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    pushed_to     INTEGER NOT NULL DEFAULT 0          -- a cuántos dispositivos llegó el aviso (0 = no se avisó)
  );

  -- Dispositivos que han activado los avisos push (uno por navegador o móvil).
  CREATE TABLE push_subscriptions (
    endpoint    TEXT PRIMARY KEY,
    p256dh      TEXT NOT NULL,
    auth        TEXT NOT NULL,
    member_id   TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL
  );
  CREATE INDEX push_subscriptions_member ON push_subscriptions(member_id);

  CREATE TABLE settings (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
  );
  `,
  // 2 — nombre real y campeones favoritos de cada jugador (hacen de foto mientras no haya oficiales)
  `
  ALTER TABLE players ADD COLUMN name TEXT NOT NULL DEFAULT '';
  ALTER TABLE players ADD COLUMN champions TEXT NOT NULL DEFAULT '';  -- ids de Data Dragon separados por comas
  `,
];

mkdirSync(dirname(config.dbPath), { recursive: true });
export const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

const current = db.prepare('PRAGMA user_version').get().user_version;
for (let v = current; v < migrations.length; v++) {
  db.exec('BEGIN');
  try {
    db.exec(migrations[v]);
    db.exec(`PRAGMA user_version = ${v + 1}`);
    db.exec('COMMIT');
    console.log(`[db] migración ${v + 1} aplicada`);
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export const now = () => new Date().toISOString();

export function getSetting(key, fallback = '') {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? fallback;
}

export function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(value));
}
