// Página de un partido (votaciones de MVP/fraude y marcador) y tabla de estadísticas de la temporada.
import { html } from 'hono/html';
import { GAMES, VOTE_POST_DAYS, winners } from '../data.js';
import { formatDate, formatDateTime } from '../lib/format.js';
import { championIcon, championName } from '../lib/champions.js';
import { layout } from './layout.js';
import { alert, avatar, isLive, roleLabel } from './components.js';

const fmtKda = (x) => (Number.isFinite(x) ? x.toFixed(2).replace('.', ',') : '—');

export function championCell(id) {
  if (!id) return html`<span class="muted">—</span>`;
  const src = championIcon(id);
  return html`<span class="champ-cell">${src ? html`<img src="${src}" alt="" width="28" height="28" loading="lazy">` : ''}${championName(id)}</span>`;
}

/** Marcador del partido: una fila por jugador con campeón y K/D/A. */
export function scoreboard(stats) {
  if (!stats.length) return '';
  return html`<div class="table-wrap"><table class="scoreboard">
    <thead><tr><th>Jugador</th><th>Campeón</th><th class="num">K / D / A</th><th class="num">KDA</th></tr></thead>
    <tbody>${stats.map((s) => html`<tr>
      <td><span class="player-cell">${avatar({ nick: s.nick, champions: s.player_champions }, { size: 32 })}<span><b>${s.nick}</b><br><small class="muted">${roleLabel(s.role)}</small></span></span></td>
      <td>${championCell(s.champion)}</td>
      <td class="num">${s.kills} / ${s.deaths} / ${s.assists}</td>
      <td class="num"><b>${fmtKda((s.kills + s.assists) / Math.max(1, s.deaths))}</b></td>
    </tr>`)}</tbody>
  </table></div>`;
}

/** Tabla de la temporada: partidos, K/D/A, KDA medio y veces MVP/fraude según la afición. */
export function seasonTable(rows) {
  const played = rows.filter((r) => r.games > 0);
  if (!played.length) return html`<p class="empty">Las estadísticas aparecerán en cuanto se juegue el primer partido.</p>`;
  return html`<div class="table-wrap"><table class="season">
    <thead><tr><th>Jugador</th><th class="num">PJ</th><th class="num">K</th><th class="num">D</th><th class="num">A</th><th class="num">KDA</th><th class="num" title="Veces MVP según la afición">MVP</th><th class="num" title="Veces fraude según la afición">Fraude</th></tr></thead>
    <tbody>${played.map((r) => html`<tr>
      <td><span class="player-cell">${avatar(r, { size: 32 })}<span><b>${r.nick}</b><br><small class="muted">${roleLabel(r.role)}</small></span></span></td>
      <td class="num">${r.games}</td><td class="num">${r.kills}</td><td class="num">${r.deaths}</td><td class="num">${r.assists}</td>
      <td class="num"><b>${fmtKda(r.kda)}</b></td>
      <td class="num">${r.mvp || '—'}</td><td class="num">${r.fraud || '—'}</td>
    </tr>`)}</tbody>
  </table></div>
  <p class="muted" style="margin-top:10px;font-size:.85rem">KDA = (asesinatos + asistencias) / muertes. MVP y fraude: veredicto de la afición tras cada partido.</p>`;
}

function tallyList(rows, total, kind) {
  if (!total) return html`<p class="muted">Sin votos todavía.</p>`;
  return html`<ol class="tally tally-${kind}">
    ${rows.map((r) => html`<li>
      ${avatar(r, { size: 32 })}
      <span class="tally-nick">${r.nick}</span>
      <span class="tally-votes mono">${r.votes} · ${Math.round(r.share * 100)}%</span>
      <span class="bar" aria-hidden="true"><i style="width:${Math.round(r.share * 100)}%"></i></span>
    </li>`)}
  </ol>`;
}

function tallyBlock(title, tally, note) {
  return html`<section class="panel stack">
    <div><h3>${title}</h3><p class="muted">${tally.total} ${tally.total === 1 ? 'voto' : 'votos'}${note ? ` · ${note}` : ''}</p></div>
    <div class="grid-2">
      <div class="stack" style="gap:8px"><p class="eyebrow">MVP</p>${tallyList(tally.mvp, tally.total, 'mvp')}</div>
      <div class="stack" style="gap:8px"><p class="eyebrow">Fraude</p>${tallyList(tally.fraud, tally.total, 'fraud')}</div>
    </div>
  </section>`;
}

function votePicker(name, candidates, selected) {
  return html`<div class="picker">
    ${candidates.map((p) => html`<label>
      <input type="radio" name="${name}" value="${p.id}" required ${p.id === selected ? 'checked' : ''}>
      <span>${avatar(p, { size: 40 })}<b>${p.nick}</b><small>${roleLabel(p.role)}</small></span>
    </label>`)}
  </div>`;
}

function voteForm({ match, phase, candidates, member, myVote }) {
  const title = phase === 'pre' ? '¿Quién va a ser el MVP y quién el fraude?' : '¿Quién ha sido el MVP y quién el fraude?';
  const hint = phase === 'pre'
    ? 'Tu predicción. Puedes cambiarla hasta que empiece el partido.'
    : `Tu veredicto final. Puedes cambiarlo hasta ${VOTE_POST_DAYS} días después del partido.`;
  if (!member) {
    return html`<section class="panel stack vote-cta">
      <h3>${title}</h3>
      <p>Solo votan los socios. Hacerse socio es gratis y lleva un minuto.</p>
      <div class="row-actions"><a class="btn small" href="/hazte-socio">Hazte socio</a><a class="btn small ghost" href="/mi-tarjeta">Ya soy socio</a></div>
    </section>`;
  }
  return html`<form class="panel form" method="post" action="/partidos/${match.id}/votar">
    <input type="hidden" name="phase" value="${phase}">
    <div><h3>${title}</h3><p class="muted">${hint}${myVote ? ' Ya has votado: puedes cambiar tu voto.' : ''}</p></div>
    <fieldset class="field"><legend>MVP <span class="muted">· el mejor del partido</span></legend>${votePicker('mvp', candidates, myVote?.mvp_id)}</fieldset>
    <fieldset class="field"><legend>Fraude <span class="muted">· el que no apareció</span></legend>${votePicker('fraud', candidates, myVote?.fraud_id)}</fieldset>
    <button class="btn" type="submit">${myVote ? 'Cambiar mi voto' : 'Votar'}</button>
  </form>`;
}

export function matchPage({ match, phase, candidates, member, myVotes, preTally, postTally, stats, flash }) {
  const played = Boolean(match.result);
  const status = played
    ? html`<span class="pill ok">Final · ${match.result}</span>`
    : isLive(match) ? html`<span class="live">EN DIRECTO</span>` : html`<span class="pill">${formatDateTime(match.starts_at)}</span>`;

  const verdict = played && postTally.total ? winners(postTally.mvp).map((p) => p.nick).join(' y ') : '';
  const body = html`<section class="match-head"><div class="wrap stack" style="gap:12px">
      <p class="eyebrow" style="color:var(--mostaza)">${[match.competition, GAMES[match.game]].filter(Boolean).join(' · ')}</p>
      <h1>Malos <span>vs</span> ${match.opponent}</h1>
      <div class="row-actions" style="align-items:center">${status}
        ${match.stream_url ? html`<a class="btn small" href="${match.stream_url}" target="_blank" rel="noopener">${played ? 'Ver la retransmisión' : 'Verlo en directo'}</a>` : ''}
      </div>
      ${verdict ? html`<p class="verdict">MVP de la afición: <b>${verdict}</b></p>` : ''}
    </div></section>
    <div class="narrow wide" id="votar">
      ${flash ? alert(flash.kind, flash.message) : ''}
      ${phase ? voteForm({ match, phase, candidates, member, myVote: myVotes[phase] }) : ''}
      ${!phase && !played ? html`<p class="alert info">Partido en juego: la predicción ya está cerrada. La votación final se abre cuando termine.</p>` : ''}
      ${played && !phase ? html`<p class="alert info">La votación de este partido ya está cerrada.</p>` : ''}
      ${stats.length ? html`<section class="stack"><h2>Marcador</h2>${scoreboard(stats)}</section>` : ''}
      ${played ? tallyBlock('Veredicto final de la afición', postTally, 'después del partido') : ''}
      ${tallyBlock('Predicción de la afición', preTally, 'antes del partido')}
      <p><a href="/partidos">Todos los partidos</a></p>
    </div>`;
  return layout({ title: `Malos vs ${match.opponent}`, path: '/partidos', body });
}

/** Resumen del último partido para la portada. */
export function lastMatchCard({ match, stats, postTally }) {
  if (!match) return '';
  const mvp = winners(postTally.mvp).map((p) => p.nick).join(' y ');
  const fraud = winners(postTally.fraud).map((p) => p.nick).join(' y ');
  const best = stats.slice().sort((a, b) => (b.kills + b.assists) / Math.max(1, b.deaths) - (a.kills + a.assists) / Math.max(1, a.deaths))[0];
  return html`<a class="last-match" href="/partidos/${match.id}">
    <p class="eyebrow">Último partido · ${formatDate(match.starts_at, { day: 'numeric', month: 'long' })}</p>
    <p class="lm-score">Malos <b>${match.result}</b> ${match.opponent}</p>
    <dl>
      <div><dt>MVP afición</dt><dd>${mvp || 'Votación abierta'}</dd></div>
      <div><dt>Fraude</dt><dd>${fraud || '—'}</dd></div>
      ${best ? html`<div><dt>Mejor KDA</dt><dd>${best.nick} · ${best.kills}/${best.deaths}/${best.assists}</dd></div>` : ''}
    </dl>
    <span class="lm-link">Ver marcador y votar →</span>
  </a>`;
}
