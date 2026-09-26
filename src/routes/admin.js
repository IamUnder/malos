import { Hono } from 'hono';
import * as data from '../data.js';
import { broadcast } from '../lib/push.js';
import { loginAdmin, logoutAdmin, requireAdmin } from '../lib/auth.js';
import { tooMany } from '../lib/guard.js';
import { fromLocalInput, pad } from '../lib/format.js';
import * as views from '../views/admin.js';
import { resolveChampions } from '../lib/champions.js';

export const adminRoutes = new Hono();

adminRoutes.use('*', async (c, next) => {
  c.header('X-Robots-Tag', 'noindex');
  c.header('Cache-Control', 'no-store');
  await next();
});

adminRoutes.get('/login', (c) => c.html(views.loginPage({})));
adminRoutes.post('/login', async (c) => {
  if (tooMany(c, 'admin-login', 10, 15 * 60e3)) return c.html(views.loginPage({ error: 'Demasiados intentos. Espera 15 minutos.' }), 429);
  const { password } = await c.req.parseBody();
  if (await loginAdmin(c, String(password || ''))) return c.redirect('/admin');
  return c.html(views.loginPage({ error: 'Contraseña incorrecta.' }), 401);
});
adminRoutes.post('/logout', (c) => { logoutAdmin(c); return c.redirect('/'); });

adminRoutes.use('*', requireAdmin);

// Mensajes tras una acción: ?ok=<clave>
const FLASH = {
  publicado: (q) => ({ kind: 'ok', message: q.enviados ? `Publicado. Aviso enviado a ${q.enviados} dispositivos${Number(q.fallidos) ? ` (${q.fallidos} fallidos)` : ''}.` : 'Publicado en la web.' }),
  borrado: () => ({ kind: 'ok', message: 'Borrado.' }),
  guardado: () => ({ kind: 'ok', message: 'Guardado.' }),
  faltan: () => ({ kind: 'error', message: 'Faltan campos obligatorios.' }),
  desconocidos: (q) => ({ kind: 'error', message: `Guardado, pero no reconozco estos campeones: ${q.nombres}. Revisa cómo se escriben.` }),
};
const flashOf = (c) => FLASH[c.req.query('ok')]?.(c.req.query()) || null;

adminRoutes.get('/', (c) => c.html(views.dashboardPage({
  stats: data.stats(), rank: data.ranking(), recent: data.listMembers({ limit: 8 }), flash: flashOf(c),
})));

// ---------- Noticias y avisos ----------

adminRoutes.get('/avisos', (c) => c.html(views.noticesPage({ posts: data.listPosts(100), stats: data.stats(), flash: flashOf(c) })));

adminRoutes.post('/avisos', async (c) => {
  const form = await c.req.parseBody();
  const title = String(form.title || '').trim().slice(0, 80);
  const body = String(form.body || '').trim().slice(0, 4000);
  if (!title || !body) return c.redirect('/admin/avisos?ok=faltan');
  const post = data.createPost({ title, body });
  if (!form.push) return c.redirect('/admin/avisos?ok=publicado');
  const { sent, failed } = await broadcast({ title, body: body.slice(0, 180), url: `/noticias#n${post.id}` });
  data.markPostPushed(post.id, sent);
  return c.redirect(`/admin/avisos?ok=publicado&enviados=${sent}&fallidos=${failed}`);
});

adminRoutes.post('/avisos/:id/borrar', (c) => { data.deletePost(Number(c.req.param('id'))); return c.redirect('/admin/avisos?ok=borrado'); });

// ---------- Partidos ----------

adminRoutes.get('/partidos', (c) => {
  const editar = Number(c.req.query('editar'));
  return c.html(views.matchesAdminPage({ matches: data.listMatches(), editing: editar ? data.getMatch(editar) : null, flash: flashOf(c) }));
});

adminRoutes.post('/partidos', async (c) => {
  const f = await c.req.parseBody();
  const opponent = String(f.opponent || '').trim().slice(0, 60);
  const startsAt = fromLocalInput(String(f.startsAt || ''));
  if (!opponent || Number.isNaN(startsAt.getTime())) return c.redirect('/admin/partidos?ok=faltan');
  data.saveMatch({
    id: Number(f.id) || null,
    startsAt,
    opponent,
    competition: String(f.competition || '').trim().slice(0, 60),
    game: String(f.game || 'lol'),
    streamUrl: /^https:\/\//.test(String(f.streamUrl || '')) ? String(f.streamUrl) : '',
    result: String(f.result || '').trim().slice(0, 20),
  });
  return c.redirect('/admin/partidos?ok=guardado');
});

adminRoutes.post('/partidos/:id/borrar', (c) => { data.deleteMatch(Number(c.req.param('id'))); return c.redirect('/admin/partidos?ok=borrado'); });

// ---------- Jugadores ----------

adminRoutes.get('/jugadores', (c) => {
  const fans = new Map(data.ranking().map((p) => [p.id, p.fans]));
  const players = data.listPlayers({ includeInactive: true }).map((p) => ({ ...p, fans: fans.get(p.id) ?? 0 }));
  const editar = Number(c.req.query('editar'));
  return c.html(views.playersAdminPage({ players, editing: editar ? data.getPlayer(editar) : null, flash: flashOf(c) }));
});

adminRoutes.post('/jugadores', async (c) => {
  const f = await c.req.parseBody();
  const nick = String(f.nick || '').trim().slice(0, 24);
  if (!nick) return c.redirect('/admin/jugadores?ok=faltan');
  const { ids, unknown } = resolveChampions(f.champions);
  data.savePlayer({
    id: Number(f.id) || null,
    nick,
    name: String(f.name || '').trim().slice(0, 40),
    role: String(f.role || ''),
    game: String(f.game || 'lol'),
    champions: ids,
    sort: f.sort,
    active: Boolean(f.active),
  });
  if (unknown.length) return c.redirect(`/admin/jugadores?ok=desconocidos&nombres=${encodeURIComponent(unknown.join(', '))}`);
  return c.redirect('/admin/jugadores?ok=guardado');
});

// ---------- Socios ----------

adminRoutes.get('/socios', (c) => {
  const q = String(c.req.query('q') || '').trim();
  return c.html(views.membersAdminPage({ members: data.listMembers({ q, limit: 500 }), q, flash: flashOf(c) }));
});

adminRoutes.post('/socios/:id/borrar', (c) => { data.deleteMember(c.req.param('id')); return c.redirect('/admin/socios?ok=borrado'); });

adminRoutes.get('/socios.csv', (c) => {
  const cell = (v) => {
    const s = String(v ?? '');
    // Evita que Excel ejecute fórmulas si un nick empieza por =, +, - o @.
    return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  const rows = data.listMembers({ limit: 100000 }).map((m) =>
    [m.number ? pad(m.number) : '', m.nick, m.email, m.favorite_nick, m.verified_at || '', m.devices].map(cell).join(','));
  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', 'attachment; filename="socios-malos.csv"');
  return c.body(`﻿"numero","nick","email","favorito","confirmado","dispositivos"\n${rows.join('\n')}\n`);
});
