import { html } from 'hono/html';
import { config } from '../config.js';
import { GAMES } from '../data.js';
import { formatDate, formatDateTime, pad } from '../lib/format.js';
import { championIcon, championName, parseChampions } from '../lib/champions.js';

const ROLE_LABELS = { top: 'Top', jungla: 'Jungla', mid: 'Mid', adc: 'ADC', support: 'Support', suplente: 'Suplente', coach: 'Coach' };
export const roleLabel = (role) => ROLE_LABELS[role] || role;

/** "Jorge «Under»" — el nombre real, si lo hay, con el nick. */
export const fullName = (p) => (p.name ? `${p.name} «${p.nick}»` : p.nick);

/** Foto del jugador: de momento, el icono de su campeón principal (o su inicial si no hay icono). */
export function avatar(player, { size = 56 } = {}) {
  const [main] = parseChampions(player.champions);
  const src = main && championIcon(main);
  return src
    ? html`<img class="avatar" src="${src}" alt="" width="${size}" height="${size}" loading="lazy">`
    : html`<span class="avatar avatar-empty" style="width:${size}px;height:${size}px" aria-hidden="true">${player.nick.slice(0, 1)}</span>`;
}

/** Fila de iconos de sus campeones más jugados. */
export function champions(player, { size = 28 } = {}) {
  const ids = parseChampions(player.champions);
  if (!ids.length) return '';
  return html`<span class="champs" aria-label="Campeones: ${ids.map(championName).join(', ')}">
    ${ids.map((id) => {
      const src = championIcon(id);
      return src
        ? html`<img src="${src}" alt="" title="${championName(id)}" width="${size}" height="${size}" loading="lazy">`
        : html`<span class="champ-text" title="${championName(id)}">${championName(id)}</span>`;
    })}
  </span>`;
}

export const isLive = (match) => {
  const start = new Date(match.starts_at).getTime();
  return Date.now() >= start && Date.now() < start + 3 * 3600e3;
};

export function matchbar(match) {
  if (!match) return '';
  return html`<section class="matchbar" aria-label="Próximo partido">
    <div class="wrap">
      ${isLive(match) ? html`<span class="live">EN DIRECTO</span>` : html`<span class="eyebrow" style="color:var(--mostaza)">Próximo partido</span>`}
      <p class="vs">Malos <span>vs</span> ${match.opponent}</p>
      <p class="when">${formatDateTime(match.starts_at)}${match.competition ? ` · ${match.competition}` : ''}</p>
      <div class="matchbar-actions">
        <a class="btn ghost-light" href="/partidos/${match.id}">Vota MVP y fraude</a>
        ${match.stream_url ? html`<a class="btn" href="${match.stream_url}" target="_blank" rel="noopener">Verlo en directo</a>` : ''}
      </div>
    </div>
  </section>`;
}

export function standings(rows, { limit } = {}) {
  const list = limit ? rows.slice(0, limit) : rows;
  if (list.length === 0) {
    return html`<p class="empty">Aún no hay jugadores en la plantilla. En cuanto se publique, aquí verás quién tiene más fans.</p>`;
  }
  const max = Math.max(1, ...list.map((r) => r.fans));
  return html`<ol class="standings">
    ${list.map((p, i) => html`<li>
      <span class="pos mono">${i + 1}</span>
      <span class="who">
        ${avatar(p, { size: 44 })}
        <span class="who-text">
          <span class="nick">${p.nick}</span>
          <span class="role">${roleLabel(p.role)}${p.name ? ` · ${p.name}` : ''}${p.game !== 'lol' ? ` · ${GAMES[p.game] || p.game}` : ''}</span>
        </span>
      </span>
      <span class="fans">${p.fans}<small>${p.fans === 1 ? 'fan' : 'fans'} · ${Math.round(p.share * 100)}%</small></span>
      <span class="bar" aria-hidden="true"><i style="width:${Math.round((p.fans / max) * 100)}%"></i></span>
    </li>`)}
  </ol>`;
}

/** Tarjetas de la plantilla, ordenadas por rol. */
export function roster(players) {
  if (players.length === 0) return html`<p class="empty">La plantilla se publicará pronto.</p>`;
  return html`<ul class="roster">
    ${players.map((p) => html`<li>
      ${avatar(p, { size: 96 })}
      <p class="role">${roleLabel(p.role)}</p>
      <h3>${p.nick}</h3>
      ${p.name ? html`<p class="realname">${p.name}</p>` : ''}
      ${champions(p)}
    </li>`)}
  </ul>`;
}

export function fixtures(matches) {
  if (matches.length === 0) return html`<p class="empty">No hay partidos programados todavía.</p>`;
  return html`<ul class="fixtures">
    ${matches.map((m) => html`<li>
      <span class="date">${formatDate(m.starts_at, { month: 'short' })}<b>${formatDate(m.starts_at, { day: 'numeric' })}</b></span>
      <span>
        <a class="opp" href="/partidos/${m.id}">vs ${m.opponent}</a><br>
        <span class="comp">${[m.competition, GAMES[m.game], formatDate(m.starts_at, { weekday: 'long', hour: '2-digit', minute: '2-digit' })].filter(Boolean).join(' · ')}</span>
      </span>
      ${m.result
        ? html`<span class="res">${m.result}</span>`
        : isLive(m) ? html`<span class="live">DIRECTO</span>` : m.stream_url ? html`<a class="btn small ghost" href="${m.stream_url}" target="_blank" rel="noopener">Stream</a>` : ''}
    </li>`)}
  </ul>`;
}

export function news(posts) {
  if (posts.length === 0) return html`<p class="empty">Todavía no hay noticias.</p>`;
  return html`<div class="news">
    ${posts.map((p) => html`<article id="n${p.id}">
      <p class="eyebrow">${formatDate(p.created_at)}</p>
      <h3>${p.title}</h3>
      <p class="body">${p.body}</p>
    </article>`)}
  </div>`;
}

export function supportBlock() {
  if (!config.kofiUrl) return '';
  return html`<section class="support" aria-labelledby="apoya">
    <div class="wrap">
      <span class="l-plate" aria-hidden="true">L</span>
      <div>
        <h2 id="apoya">Mantén el servidor en marcha</h2>
        <p>Esta web la paga y la mantiene un miembro del equipo de su bolsillo. Si te apetece echar una mano con el dominio y el servidor, cualquier aportación ayuda. Hacerse socio es y será siempre gratis.</p>
        <p class="costs">Gastos: dominio malos.es ≈ 10 €/año · servidor propio</p>
      </div>
      <a class="btn" href="${config.kofiUrl}" target="_blank" rel="noopener">Invítame a un café</a>
    </div>
  </section>`;
}

/** El carné de socio. `favorite` es el jugador (o null). */
export function carnet(member, favorite) {
  const verified = Boolean(member.verified_at);
  const rookie = verified && Date.now() - new Date(member.verified_at).getTime() < 30 * 86400e3;
  return html`<div class="carnet${verified ? '' : ' pending'}" role="img" aria-label="${verified ? `Carné de socio número ${member.number} de ${member.nick}` : 'Carné pendiente de confirmar'}">
    <div class="row">
      <span class="club">MALOS</span>
      ${rookie ? html`<span class="l-plate rookie" title="Socio nuevo: menos de 30 días">L</span>` : ''}
    </div>
    <p class="num"><small>SOCIO Nº</small>${verified ? `#${pad(member.number)}` : '#????'}</p>
    <dl>
      <dt>Nombre</dt><dd>${member.nick}</dd>
      <dt>Favorito</dt><dd>${favorite?.nick ?? '—'}</dd>
      <dt>Desde</dt><dd>${verified ? formatDate(member.verified_at, { month: 'short', year: 'numeric' }) : 'Pendiente'}</dd>
    </dl>
  </div>`;
}

export function playerPicker(players, selectedId, { name = 'favorite', required = false } = {}) {
  if (players.length === 0) return html`<p class="hint">La plantilla aún no está publicada. Podrás elegir favorito desde tu tarjeta cuando lo esté.</p>`;
  return html`<div class="picker">
    ${players.map((p) => html`<label>
      <input type="radio" name="${name}" value="${p.id}" ${p.id === selectedId ? 'checked' : ''} ${required ? 'required' : ''}>
      <span>${avatar(p, { size: 40 })}<b>${p.nick}</b><small>${roleLabel(p.role)}${p.game !== 'lol' ? ` · ${GAMES[p.game] || p.game}` : ''}</small></span>
    </label>`)}
  </div>`;
}

export const alert = (kind, message) => (message ? html`<p class="alert ${kind}" role="${kind === 'error' ? 'alert' : 'status'}">${message}</p>` : '');
