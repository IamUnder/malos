// Página de un partido (resumen, marcador, votaciones de MVP/fraude) y tabla de estadísticas de la temporada.
import { html } from 'hono/html';
import { GAMES, POINTS, VOTE_POST_HOURS, MIN_VERDICT_VOTES, parseScore, scoreOptions } from '../data.js';
import { formatDate, formatDateTime } from '../lib/format.js';
import { championIcon, championName } from '../lib/champions.js';
import { layout } from './layout.js';
import { alert, avatar, isLive, roleLabel } from './components.js';

const fmtKda = (x) => (Number.isFinite(x) ? x.toFixed(2).replace('.', ',') : '—');
const kdaOf = (s) => (s.kills + s.assists) / Math.max(1, s.deaths);
const names = (players) => players.map((p) => p.nick).join(' y ');
const when = (ms) => formatDate(new Date(ms).toISOString(), { weekday: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export function championCell(id) {
  if (!id) return html`<span class="muted">—</span>`;
  const src = championIcon(id);
  return html`<span class="champ-cell">${src ? html`<img src="${src}" alt="" width="28" height="28" loading="lazy">` : ''}${championName(id)}</span>`;
}

/**
 * Marcador del partido: una fila por jugador con campeón y K/D/A.
 * Marca el mejor KDA y, si el veredicto está cerrado, al MVP y al fraude.
 */
export function scoreboard(stats, { mvpIds = new Set(), fraudIds = new Set(), bestIds = new Set() } = {}) {
  if (!stats.length) return '';
  const badges = (s) => html`${mvpIds.has(s.player_id) ? html`<span class="badge mvp">MVP</span>` : ''}${fraudIds.has(s.player_id) ? html`<span class="badge fraud">Fraude</span>` : ''}${bestIds.has(s.player_id) ? html`<span class="badge kda">Mejor KDA</span>` : ''}`;
  return html`<div class="table-wrap"><table class="scoreboard">
    <thead><tr><th>Jugador</th><th>Campeón</th><th class="num">K / D / A</th><th class="num">KDA</th></tr></thead>
    <tbody>${stats.map((s) => html`<tr class="${mvpIds.has(s.player_id) ? 'row-mvp' : ''}${fraudIds.has(s.player_id) ? ' row-fraud' : ''}">
      <td><span class="player-cell">${avatar({ nick: s.nick, champions: s.player_champions }, { size: 32 })}<span><b>${s.nick}</b> ${badges(s)}<br><small class="muted">${roleLabel(s.role)}</small></span></span></td>
      <td>${championCell(s.champion)}</td>
      <td class="num">${s.kills} / ${s.deaths} / ${s.assists}</td>
      <td class="num"><b>${fmtKda(kdaOf(s))}</b></td>
    </tr>`)}</tbody>
  </table></div>`;
}

/** Tabla de la temporada: partidos, K/D/A, KDA medio y veces MVP/fraude según el veredicto. */
export function seasonTable(rows) {
  const played = rows.filter((r) => r.games > 0);
  if (!played.length) return html`<p class="empty">Las estadísticas aparecerán en cuanto se juegue el primer partido.</p>`;
  return html`<div class="table-wrap"><table class="season">
    <thead><tr><th>Jugador</th><th class="num">PJ</th><th class="num">K</th><th class="num">D</th><th class="num">A</th><th class="num">KDA</th><th class="num" title="Veces MVP según el veredicto">MVP</th><th class="num" title="Veces fraude según el veredicto">Fraude</th></tr></thead>
    <tbody>${played.map((r) => html`<tr>
      <td><span class="player-cell">${avatar(r, { size: 32 })}<span><b>${r.nick}</b><br><small class="muted">${roleLabel(r.role)}</small></span></span></td>
      <td class="num">${r.games}</td><td class="num">${r.kills}</td><td class="num">${r.deaths}</td><td class="num">${r.assists}</td>
      <td class="num"><b>${fmtKda(r.kda)}</b></td>
      <td class="num">${r.mvp || '—'}</td><td class="num">${r.fraud || '—'}</td>
    </tr>`)}</tbody>
  </table></div>
  <p class="muted" style="margin-top:10px;font-size:.85rem">KDA = (asesinatos + asistencias) / muertes. MVP y fraude: veredicto de la afición tras cada partido (o de los números, si hubo menos de ${MIN_VERDICT_VOTES} votos).</p>`;
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

function scoreTally(scores, total) {
  if (!scores?.length) return '';
  return html`<div class="stack" style="gap:8px"><p class="eyebrow">Resultado</p>
    <ul class="score-tally">${scores.map((r) => html`<li><b class="mono">${r.score}</b><span class="bar" aria-hidden="true"><i style="width:${Math.round((r.votes / total) * 100)}%"></i></span><span class="mono muted">${Math.round((r.votes / total) * 100)}%</span></li>`)}</ul>
  </div>`;
}

function tallyBlock(title, tally, note, { hidden = null } = {}) {
  const head = html`<div><h3>${title}</h3><p class="muted">${tally.total} ${tally.total === 1 ? 'voto' : 'votos'}${note ? ` · ${note}` : ''}</p></div>`;
  // Oculto para no influir: solo se enseña el número de votos y el motivo.
  if (hidden) return html`<section class="panel stack">${head}<p class="hidden-tally">${hidden}</p></section>`;
  return html`<section class="panel stack">
    ${head}
    <div class="grid-2">
      <div class="stack" style="gap:8px"><p class="eyebrow">MVP</p>${tallyList(tally.mvp, tally.total, 'mvp')}</div>
      <div class="stack" style="gap:8px"><p class="eyebrow">Fraude</p>${tallyList(tally.fraud, tally.total, 'fraud')}</div>
    </div>
    ${scoreTally(tally.scores, tally.total)}
  </section>`;
}

function scorePicker(match, selected) {
  return html`<div class="score-picker">
    ${scoreOptions(match.best_of).map((sc) => {
      const [a, b] = sc.split('-').map(Number);
      return html`<label><input type="radio" name="score" value="${sc}" required ${sc === selected ? 'checked' : ''}>
        <span class="${a > b ? 'win' : 'loss'}"><b class="mono">${sc}</b><small>${a > b ? 'Gana Malos' : 'Pierde Malos'}</small></span></label>`;
    })}
  </div>`;
}

/** Cómo le ha ido a este socio en la porra de este partido (tarjeta del resumen). */
function myPorraCard(result) {
  if (!result) return '';
  const line = (state, label, pts) => html`<li class="${state}"><span>${state === 'hit' ? '✓' : state === 'miss' ? '✗' : '…'}</span> ${label}${state === 'hit' ? html` <b>+${pts}</b>` : ''}</li>`;
  const pending = result.final ? null : 'pending';
  return html`<div class="sum-card my-porra">
    <p class="eyebrow">Tu porra</p>
    <p class="porra-points mono">+${result.points}<small> pts${result.final ? '' : ' de momento'}</small></p>
    <ul>
      ${line(pending || (result.mvp ? 'hit' : 'miss'), 'MVP', POINTS.mvp)}
      ${line(pending || (result.fraud ? 'hit' : 'miss'), 'Fraude', POINTS.fraud)}
      ${result.hasScore ? (result.exact ? line('hit', 'Resultado exacto', POINTS.exact) : line(result.winner ? 'hit' : 'miss', 'Ganador', POINTS.winner)) : line('pending', 'Resultado', POINTS.exact)}
      ${result.hasStats ? line(result.kda ? 'hit' : 'miss', 'Mejor KDA', POINTS.kda) : line('pending', 'Mejor KDA', POINTS.kda)}
    </ul>
    <a href="/oraculo">El Oráculo →</a>
  </div>`;
}

function votePicker(name, candidates, selected) {
  return html`<div class="picker">
    ${candidates.map((p) => html`<label>
      <input type="radio" name="${name}" value="${p.id}" required ${p.id === selected ? 'checked' : ''}>
      <span>${avatar(p, { size: 40 })}<b>${p.nick}</b><small>${roleLabel(p.role)}</small></span>
    </label>`)}
  </div>`;
}

function voteForm({ match, phase, candidates, member, myVote, closes }) {
  const title = phase === 'pre' ? '¿Quién va a ser el MVP y quién el fraude?' : '¿Quién ha sido el MVP y quién el fraude?';
  const hint = phase === 'pre'
    ? 'Tu predicción. Puedes cambiarla hasta que empiece el partido.'
    : `Tu veredicto. Es secreto hasta que se cierre, el ${when(closes)}. Hasta entonces puedes cambiarlo.`;
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
    ${phase === 'pre' ? html`<fieldset class="field"><legend>Resultado <span class="muted">· al mejor de ${match.best_of || 1}</span></legend>${scorePicker(match, myVote?.score)}</fieldset>
      <p class="hint muted">Puntos de El Oráculo: MVP +${POINTS.mvp} · fraude +${POINTS.fraud} · resultado exacto +${POINTS.exact} (o +${POINTS.winner} si aciertas solo el ganador) · +${POINTS.kda} si tu MVP es el mejor KDA del partido.</p>` : ''}
    <button class="btn" type="submit">${myVote ? 'Cambiar mi voto' : 'Votar'}</button>
  </form>`;
}

/** Tarjetas del resumen de un partido ya jugado. */
function summary({ verdict, myResult }) {
  const verdictCard = (label, players, kind) => html`<div class="sum-card ${kind}">
    <p class="eyebrow">${label}</p>
    ${verdict.closed
      ? (players.length
        ? html`<div class="sum-players">${players.map((p) => html`<span>${avatar(p, { size: 44 })}<b>${p.nick}</b></span>`)}</div>
          <small class="muted">${verdict.byFans ? `Votado por la afición (${verdict.votes} votos)` : `Por los números: hubo menos de ${MIN_VERDICT_VOTES} votos`}</small>`
        : html`<p class="muted">Sin veredicto</p>`)
      : html`<p class="sum-secret">Se revela el ${when(verdict.closes)}</p><small class="muted">${verdict.votes} ${verdict.votes === 1 ? 'voto' : 'votos'} hasta ahora</small>`}
  </div>`;
  const best = verdict.kdaBest;
  return html`<section class="summary">
    ${verdictCard('MVP de la afición', verdict.mvp, 'mvp')}
    ${verdictCard('Fraude de la afición', verdict.fraud, 'fraud')}
    <div class="sum-card kda">
      <p class="eyebrow">MVP de los números</p>
      ${best.length
        ? html`<div class="sum-players">${best.map((s) => html`<span>${avatar({ nick: s.nick, champions: s.player_champions }, { size: 44 })}<b>${s.nick}</b></span>`)}</div>
          <small class="muted">Mejor KDA: ${best[0].kills}/${best[0].deaths}/${best[0].assists} · ${fmtKda(kdaOf(best[0]))}</small>`
        : html`<p class="muted">Cuando se publiquen las estadísticas</p>`}
    </div>
    ${myPorraCard(myResult)}
  </section>`;
}

export function matchPage({ match, phase, candidates, member, myVotes, preTally, postTally, verdict, flash, myResult }) {
  const started = Date.now() >= new Date(match.starts_at).getTime();
  const score = parseScore(match.result);
  const outcome = score ? (score[0] > score[1] ? 'Victoria' : score[0] < score[1] ? 'Derrota' : 'Empate') : '';
  const stats = verdict.stats;
  const ids = (list, key = 'id') => new Set(list.map((x) => x[key]));

  const head = html`<section class="match-head${score ? (score[0] > score[1] ? ' won' : ' lost') : ''}"><div class="wrap stack" style="gap:12px">
      <p class="eyebrow" style="color:var(--mostaza)">${[match.competition, GAMES[match.game], formatDateTime(match.starts_at)].filter(Boolean).join(' · ')}</p>
      ${score
        ? html`<h1 class="final-score">Malos <span class="mono">${score[0]}<i>–</i>${score[1]}</span> ${match.opponent}</h1>
          <p class="outcome">${outcome}</p>`
        : html`<h1>Malos <span>vs</span> ${match.opponent}</h1>`}
      <div class="row-actions" style="align-items:center">
        ${!score ? (isLive(match) ? html`<span class="live">EN DIRECTO</span>` : started ? html`<span class="pill">Pendiente de resultado</span>` : html`<span class="pill">${formatDateTime(match.starts_at)}</span>`) : ''}
        ${match.stream_url ? html`<a class="btn small" href="${match.stream_url}" target="_blank" rel="noopener">${score ? 'Ver la retransmisión' : 'Verlo en directo'}</a>` : ''}
      </div>
    </div></section>`;

  // Partido aún por jugar: la predicción manda.
  if (!started) {
    return layout({
      title: `Malos vs ${match.opponent}`,
      path: '/partidos',
      body: html`${head}<div class="narrow wide" id="votar">
        ${flash ? alert(flash.kind, flash.message) : ''}
        ${voteForm({ match, phase, candidates, member, myVote: myVotes.pre })}
        ${tallyBlock('Predicción de la afición', preTally, 'antes del partido', {
          // Mientras se puede predecir, solo la ve quien ya ha votado: así nadie se deja arrastrar por la mayoría.
          hidden: !myVotes.pre ? (member ? 'Vota tu predicción para ver qué opina el resto de la afición.' : 'Se verá cuando empiece el partido. Los socios la ven en cuanto votan.') : null,
        })}
        <p><a href="/partidos">Todos los partidos</a></p>
      </div>`,
    });
  }

  // Partido empezado o terminado: primero lo que ha pasado, después la votación.
  const body = html`${head}
    <div class="narrow wide" id="votar">
      ${flash ? alert(flash.kind, flash.message) : ''}
      ${summary({ verdict, myResult })}
      <section class="stack">
        <h2>Marcador</h2>
        ${stats.length
          ? scoreboard(stats, {
            mvpIds: verdict.closed ? ids(verdict.mvp) : new Set(),
            fraudIds: verdict.closed ? ids(verdict.fraud) : new Set(),
            bestIds: ids(verdict.kdaBest, 'player_id'),
          })
          : html`<p class="empty">Las estadísticas del partido se publican pronto.</p>`}
      </section>
      ${phase === 'post'
        ? voteForm({ match, phase, candidates, member, myVote: myVotes.post, closes: verdict.closes })
        : verdict.closed ? '' : html`<p class="alert info">El veredicto se abre el ${when(verdict.opens)} y dura ${VOTE_POST_HOURS} horas.</p>`}
      ${tallyBlock('Veredicto de la afición', postTally, `después del partido`, {
        hidden: verdict.closed ? null : `Secreto hasta el ${when(verdict.closes)}.`,
      })}
      ${tallyBlock('Predicción de la afición', preTally, 'antes del partido')}
      <p><a href="/partidos">Todos los partidos</a></p>
    </div>`;
  return layout({ title: `Malos ${match.result || 'vs'} ${match.opponent}`, path: '/partidos', body });
}

/** Resumen del último partido para la portada. Sale aunque no haya KDA. */
export function lastMatchCard({ match, verdict }) {
  if (!match) return '';
  const best = verdict.kdaBest[0];
  return html`<a class="last-match" href="/partidos/${match.id}">
    <p class="eyebrow">Último partido · ${formatDate(match.starts_at, { day: 'numeric', month: 'long' })}</p>
    <p class="lm-score">Malos <b>${match.result}</b> ${match.opponent}</p>
    <dl>
      <div><dt>MVP afición</dt><dd>${verdict.closed ? names(verdict.mvp) || '—' : 'Votación abierta'}</dd></div>
      <div><dt>Fraude</dt><dd>${verdict.closed ? names(verdict.fraud) || '—' : 'Se revela pronto'}</dd></div>
      <div><dt>Mejor KDA</dt><dd>${best ? `${names(verdict.kdaBest.map((s) => ({ nick: s.nick })))} · ${best.kills}/${best.deaths}/${best.assists}` : 'Pendiente'}</dd></div>
    </dl>
    <span class="lm-link">${verdict.closed ? 'Ver marcador →' : 'Ver marcador y votar →'}</span>
  </a>`;
}
