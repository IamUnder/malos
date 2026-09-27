import { Hono } from 'hono';
import { config } from '../config.js';
import * as data from '../data.js';
import { sendAccessLink } from '../lib/mail.js';
import { tooMany, turnstileOk } from '../lib/guard.js';
import { memberCheckCode, memberCheckPath, safeEqual } from '../lib/auth.js';
import { currentMember, forgetMember, rememberMember } from '../lib/member-session.js';
import * as views from '../views/public.js';
import * as matchView from '../views/match.js';
import { privacy, legalNotice } from '../views/legal.js';

export const publicRoutes = new Hono();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Sin SMTP, en desarrollo y en pruebas se enseña el enlace en pantalla. Nunca en producción: cualquiera podría
// apuntarse con un email ajeno.
// También si el envío falla (p. ej. dominio aún sin verificar en el proveedor de email).
const devLinkFor = (member, sent) =>
  ((!config.mail.enabled || !sent) && (!config.isProd || config.testMode) ? `/socio/${member.access_token}` : null);

/** Envía el enlace y devuelve si salió bien. Un fallo de email no rompe el alta. */
const trySend = (member) => sendAccessLink(member).then(() => true, (err) => { console.error('[mail]', err.message); return false; });

const FLASH = {
  favorito: { kind: 'ok', message: 'Favorito guardado. ¡Que se note en el ranking!' },
  bloqueado: { kind: 'error', message: 'Todavía no puedes cambiar de favorito.' },
  oraculo: { kind: 'ok', message: 'Preferencia de El Oráculo guardada.' },
};

publicRoutes.get('/', (c) => {
  const played = data.lastPlayedMatch();
  return c.html(views.homePage({
    stats: data.stats(),
    match: data.nextMatch(),
    rank: data.ranking(),
    players: data.listPlayers(),
    posts: data.listPosts(3),
    upcoming: data.upcomingMatches(4),
    season: data.seasonStats('lol'),
    oracle: data.oracleStandings().filter((r) => !r.hidden).slice(0, 5),
    last: played ? { match: played, stats: data.matchStats(played.id), postTally: data.voteTally(played.id, 'post') } : {},
  }));
});

publicRoutes.get('/plantilla', (c) => c.html(views.rosterPage({ players: data.listPlayers() })));
publicRoutes.get('/ranking', (c) => c.html(views.rankingPage({ rank: data.ranking() })));
publicRoutes.get('/partidos', (c) => c.html(views.matchesPage({ upcoming: data.upcomingMatches(20), results: data.recentResults(20) })));
const VOTE_FLASH = {
  votado: { kind: 'ok', message: '¡Voto guardado! Puedes cambiarlo mientras la votación siga abierta.' },
  igual: { kind: 'error', message: 'El MVP y el fraude no pueden ser el mismo jugador.' },
  cerrada: { kind: 'error', message: 'Esta votación ya está cerrada.' },
  resultado: { kind: 'error', message: 'Elige también el resultado del partido.' },
  socio: { kind: 'error', message: 'Para votar tienes que ser socio. Entra desde el enlace de tu email.' },
};

publicRoutes.get('/partidos/:id{[0-9]+}', (c) => {
  const match = data.getMatch(Number(c.req.param('id')));
  if (!match) return c.notFound();
  const member = currentMember(c);
  const myVotes = member ? data.memberVotes(match.id, member.id) : {};
  const myResult = match.result && myVotes.pre
    ? (() => { const o = data.matchOutcome(match); return { ...data.scorePrediction(myVotes.pre, o), final: o.final }; })()
    : null;
  return c.html(matchView.matchPage({
    match,
    myResult,
    phase: data.votePhase(match),
    candidates: data.voteCandidates(match),
    member,
    myVotes,
    preTally: data.voteTally(match.id, 'pre'),
    postTally: data.voteTally(match.id, 'post'),
    stats: data.matchStats(match.id),
    flash: VOTE_FLASH[c.req.query('ok')],
  }));
});

publicRoutes.post('/partidos/:id{[0-9]+}/votar', async (c) => {
  const match = data.getMatch(Number(c.req.param('id')));
  if (!match) return c.notFound();
  const back = (key) => c.redirect(`/partidos/${match.id}?ok=${key}#votar`);
  const member = currentMember(c);
  if (!member) return back('socio');
  const form = await c.req.parseBody();
  const phase = data.votePhase(match);
  if (!phase || form.phase !== phase) return back('cerrada');
  const allowed = new Set(data.voteCandidates(match).map((p) => p.id));
  const mvpId = Number(form.mvp);
  const fraudId = Number(form.fraud);
  if (!allowed.has(mvpId) || !allowed.has(fraudId)) return c.redirect(`/partidos/${match.id}`);
  if (mvpId === fraudId) return back('igual');
  const score = String(form.score || '');
  if (phase === 'pre' && !data.scoreOptions(match.best_of).includes(score)) return back('resultado');
  data.castVote({ match, member, phase, mvpId, fraudId, score });
  return back('votado');
});

publicRoutes.get('/oraculo', (c) => {
  const all = data.oracleStandings();
  const member = currentMember(c);
  return c.html(views.oraclePage({
    rows: all.filter((r) => !r.hidden || r.member_id === member?.id),
    me: member ? all.find((r) => r.member_id === member.id) || null : null,
    member,
  }));
});

publicRoutes.get('/noticias', (c) => c.html(views.newsPage({ posts: data.listPosts(50) })));
publicRoutes.get('/privacidad', (c) => c.html(views.legalPage({ title: 'Privacidad', path: '/privacidad', content: privacy })));
publicRoutes.get('/aviso-legal', (c) => c.html(views.legalPage({ title: 'Aviso legal', path: '/aviso-legal', content: legalNotice })));

// ---------- Alta ----------

publicRoutes.get('/hazte-socio', (c) => c.html(views.joinPage({ players: data.listPlayers() })));

publicRoutes.post('/hazte-socio', async (c) => {
  const form = await c.req.parseBody();
  const values = {
    nick: String(form.nick || '').trim().replace(/\s+/g, ' ').slice(0, 24),
    email: String(form.email || '').trim().slice(0, 120),
    favorite: form.favorite,
    age: form.age,
    privacy: form.privacy,
  };
  const players = data.listPlayers();
  const fail = (error, status = 400) => c.html(views.joinPage({ players, values, error }), status);

  if (form.website) return c.redirect('/'); // bot que rellena el campo trampa
  if (tooMany(c, 'join', 8, 3600e3)) return fail('Demasiados intentos desde esta conexión. Prueba dentro de un rato.', 429);
  if (values.nick.length < 2) return fail('El nick tiene que tener al menos 2 caracteres.');
  if (!EMAIL_RE.test(values.email)) return fail('Ese email no parece válido. Revísalo.');
  if (!values.age) return fail(`Tienes que tener ${config.minAge} años o más para hacerte socio.`);
  if (!values.privacy) return fail('Tienes que aceptar la política de privacidad.');
  const favorite = values.favorite ? data.getPlayer(Number(values.favorite)) : null;
  if (values.favorite && !favorite?.active) return fail('Ese jugador no está en la plantilla. Elige otro.');
  if (players.length && !favorite) return fail('Elige a tu jugador favorito.');
  if (!(await turnstileOk(c, form['cf-turnstile-response']))) return fail('No hemos podido comprobar que no eres un bot. Vuelve a intentarlo.');

  const { member } = data.createMember({ nick: values.nick, email: values.email, favoritePlayerId: favorite?.id });
  // Mismo mensaje exista o no el email: así no se puede averiguar quién es socio.
  const sent = await trySend(member);
  return c.html(views.checkEmailPage({ email: values.email, devLink: devLinkFor(member, sent) }));
});

// ---------- Recuperar el enlace ----------

publicRoutes.get('/mi-tarjeta', (c) => {
  const member = currentMember(c);
  if (member) return c.redirect(`/socio/${member.access_token}`);
  return c.html(views.recoverPage({}));
});

publicRoutes.post('/olvidar-dispositivo', (c) => { forgetMember(c); return c.redirect('/'); });

publicRoutes.post('/mi-tarjeta', async (c) => {
  const { email } = await c.req.parseBody();
  if (tooMany(c, 'recover', 5, 3600e3)) return c.html(views.recoverPage({ error: 'Demasiados intentos. Prueba dentro de un rato.' }), 429);
  const member = data.memberByEmail(email);
  const sent = member ? await trySend(member) : false;
  return c.html(views.recoverPage({ sent: true, devLink: member ? devLinkFor(member, sent) : null }));
});

// ---------- Carné ----------

function loadMember(c) {
  const member = data.memberByToken(c.req.param('token'));
  return member || null;
}

publicRoutes.get('/socio/:token', (c) => {
  let member = loadMember(c);
  if (!member) return c.notFound();
  const justVerified = !member.verified_at;
  member = data.verifyMember(member);
  rememberMember(c, member);

  const favorite = member.favorite_player_id ? data.getPlayer(member.favorite_player_id) : null;
  // Si su favorito ya no está en la plantilla, puede elegir otro sin esperar.
  const lockedUntil = favorite?.active ? data.favoriteLockedUntil(member) : null;
  c.header('Cache-Control', 'no-store');
  c.header('Referrer-Policy', 'no-referrer');
  return c.html(views.cardPage({
    member,
    favorite,
    players: data.listPlayers(),
    lockedUntil,
    pushCount: data.countSubscriptions(member.id),
    justVerified,
    flash: FLASH[c.req.query('ok')] || FLASH[c.req.query('error')],
    checkPath: memberCheckPath(member),
    oracle: data.oracleStandings().find((r) => r.member_id === member.id) || null,
  }));
});

publicRoutes.post('/socio/:token/favorito', async (c) => {
  const member = loadMember(c);
  if (!member?.verified_at) return c.notFound();
  const { favorite } = await c.req.parseBody();
  const player = data.getPlayer(Number(favorite));
  const current = member.favorite_player_id ? data.getPlayer(member.favorite_player_id) : null;
  const back = `/socio/${member.access_token}`;
  if (!player?.active) return c.redirect(back);
  if (current?.active && data.favoriteLockedUntil(member)) return c.redirect(`${back}?error=bloqueado`);
  if (player.id !== member.favorite_player_id) data.changeFavorite(member, player.id);
  return c.redirect(`${back}?ok=favorito`);
});

publicRoutes.post('/socio/:token/oraculo', async (c) => {
  const member = loadMember(c);
  if (!member?.verified_at) return c.notFound();
  const { hidden } = await c.req.parseBody();
  data.setOracleHidden(member.id, hidden === '1');
  return c.redirect(`/socio/${member.access_token}?ok=oraculo#oraculo`);
});

publicRoutes.post('/socio/:token/baja', async (c) => {
  const member = loadMember(c);
  if (!member) return c.notFound();
  const { confirm } = await c.req.parseBody();
  if (!confirm) return c.redirect(`/socio/${member.access_token}`);
  data.deleteMember(member.id);
  forgetMember(c);
  return c.html(views.goodbyePage());
});

// Comprobación pública de carné: /s/<número>-<código>
publicRoutes.get('/s/:code', (c) => {
  const [num, code] = c.req.param('code').split('-');
  const number = Number(num);
  const member = number && code && safeEqual(code, memberCheckCode(number)) ? data.memberByNumber(number) : null;
  c.header('X-Robots-Tag', 'noindex');
  return c.html(views.checkPage({ member }), member ? 200 : 404);
});

// ---------- Avisos push ----------

publicRoutes.post('/api/push/subscribe', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const member = data.memberByToken(String(body.token || ''));
  const sub = body.subscription;
  if (!member?.verified_at) return c.json({ error: 'Socio no encontrado' }, 404);
  if (!sub?.endpoint?.startsWith('https://') || !sub.keys?.p256dh || !sub.keys?.auth) return c.json({ error: 'Suscripción no válida' }, 400);
  if (data.countSubscriptions(member.id) >= 10) return c.json({ error: 'Demasiados dispositivos' }, 429);
  data.saveSubscription(member.id, sub);
  return c.json({ ok: true });
});

publicRoutes.post('/api/push/unsubscribe', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const member = data.memberByToken(String(body.token || ''));
  if (member && body.endpoint) data.deleteSubscription(String(body.endpoint));
  return c.json({ ok: true });
});

// ---------- PWA ----------

publicRoutes.get('/manifest.webmanifest', (c) => {
  // En la página del carné, el manifiesto apunta al carné del socio: así, al añadir la web a la
  // pantalla de inicio (necesario para los avisos en iPhone), la app se abre directamente en su carné.
  const t = c.req.query('t');
  const member = t ? data.memberByToken(t) : null;
  c.header('Content-Type', 'application/manifest+json');
  return c.body(JSON.stringify({
    name: 'Malos',
    short_name: 'Malos',
    description: 'Club de socios de Malos',
    lang: 'es',
    start_url: member ? `/socio/${member.access_token}` : '/',
    scope: '/',
    display: 'standalone',
    background_color: '#e3b93c',
    theme_color: '#14120c',
    icons: [
      { src: '/img/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/img/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/img/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }));
});

publicRoutes.get('/api/health', (c) => {
  data.stats();
  return c.json({ status: 'ok' });
});
