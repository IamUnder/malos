import { html } from 'hono/html';
import { config } from '../config.js';
import { GAMES } from '../data.js';
import { formatDate, formatDateTime, pad, toLocalInput } from '../lib/format.js';
import { layout } from './layout.js';
import { alert, avatar, roleLabel, standings } from './components.js';
import { championName, parseChampions } from '../lib/champions.js';

const page = (path, title, body) => layout({ title: `Admin · ${title}`, path, admin: true, scripts: ['/js/admin.js'], body: html`<section class="section"><div class="wrap stack" style="gap:28px">${body}</div></section>` });

const flashBox = (flash) => (flash ? alert(flash.kind, flash.message) : '');

const ROLES = ['top', 'jungla', 'mid', 'adc', 'support', 'suplente', 'coach'];

export function loginPage({ error }) {
  return layout({
    title: 'Admin',
    admin: true,
    body: html`<div class="narrow">
      <h2>Panel de Malos</h2>
      ${alert('error', error)}
      <form class="panel form" method="post" action="/admin/login">
        <div class="field"><label for="password">Contraseña</label><input id="password" name="password" type="password" required autocomplete="current-password" autofocus></div>
        <button class="btn" type="submit">Entrar</button>
      </form>
    </div>`,
  });
}

export function dashboardPage({ stats, rank, recent, flash }) {
  return page('/admin', 'Resumen', html`
    <h2>Resumen</h2>
    ${flashBox(flash)}
    ${config.push.enabled ? '' : alert('info', 'Los avisos push están desactivados: faltan VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY en el .env.')}
    ${config.mail.enabled ? '' : alert('info', 'No hay SMTP configurado: los enlaces de confirmación solo salen en el log del servidor.')}
    <div class="tiles">
      <div class="tile"><b>${stats.members}</b><span>socios confirmados</span></div>
      <div class="tile"><b>${stats.lastWeek}</b><span>nuevos esta semana</span></div>
      <div class="tile"><b>${stats.withPush}</b><span>con avisos activados</span></div>
      <div class="tile"><b>${stats.pending}</b><span>sin confirmar email</span></div>
    </div>
    <div class="cols">
      <div class="stack"><h3>Ranking</h3>${standings(rank)}</div>
      <div class="stack"><h3>Últimas altas</h3>${membersTable(recent, { compact: true })}</div>
    </div>`);
}

export function noticesPage({ posts, stats, flash }) {
  return page('/admin/avisos', 'Avisos', html`
    <h2>Noticias y avisos</h2>
    ${flashBox(flash)}
    <form class="panel form" method="post" action="/admin/avisos">
      <div class="field"><label for="title">Título</label><input id="title" name="title" type="text" required maxlength="80" placeholder="Hoy jugamos contra Los Pollos a las 20:00"></div>
      <div class="field"><label for="body">Texto de la noticia</label><textarea id="body" name="body" required maxlength="4000"></textarea></div>
      <label class="check"><input type="checkbox" name="push" ${config.push.enabled ? 'checked' : 'disabled'}>
        <span>Mandar también como aviso al móvil a los <b>${stats.withPush}</b> socios con avisos activados.
        <span class="hint">El aviso muestra el título y el principio del texto. Úsalo solo para lo importante: si se abusa, la gente los desactiva.</span></span></label>
      <button class="btn" type="submit">Publicar</button>
    </form>
    <div class="table-wrap"><table>
      <thead><tr><th>Fecha</th><th>Título</th><th>Aviso</th><th></th></tr></thead>
      <tbody>${posts.map((p) => html`<tr>
        <td class="num">${formatDate(p.created_at, { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
        <td>${p.title}</td>
        <td>${p.pushed_to ? html`<span class="pill ok">${p.pushed_to} disp.</span>` : html`<span class="pill">No</span>`}</td>
        <td><form method="post" action="/admin/avisos/${p.id}/borrar" data-confirm="¿Borrar esta noticia?"><button class="btn small ghost" type="submit">Borrar</button></form></td>
      </tr>`)}</tbody>
    </table></div>`);
}

export function matchesAdminPage({ matches, editing, flash }) {
  const m = editing || {};
  return page('/admin/partidos', 'Partidos', html`
    <h2>Partidos</h2>
    ${flashBox(flash)}
    <form class="panel form" method="post" action="/admin/partidos">
      ${m.id ? html`<input type="hidden" name="id" value="${m.id}">` : ''}
      <h3>${m.id ? 'Editar partido' : 'Nuevo partido'}</h3>
      <div class="grid-2">
        <div class="field"><label for="opponent">Rival</label><input id="opponent" name="opponent" type="text" required maxlength="60" value="${m.opponent || ''}"></div>
        <div class="field"><label for="startsAt">Fecha y hora (España)</label><input id="startsAt" name="startsAt" type="datetime-local" required value="${toLocalInput(m.starts_at)}"></div>
        <div class="field"><label for="competition">Competición</label><input id="competition" name="competition" type="text" maxlength="60" placeholder="Liga UCLM · Jornada 3" value="${m.competition || ''}"></div>
        <div class="field"><label for="game">Juego</label><select id="game" name="game">${Object.entries(GAMES).map(([k, v]) => html`<option value="${k}" ${k === (m.game || 'lol') ? 'selected' : ''}>${v}</option>`)}</select></div>
        <div class="field"><label for="streamUrl">Enlace del directo</label><input id="streamUrl" name="streamUrl" type="url" placeholder="https://twitch.tv/..." value="${m.stream_url || ''}"></div>
        <div class="field"><label for="result">Resultado</label><input id="result" name="result" type="text" maxlength="20" placeholder="Vacío si no se ha jugado · p. ej. 2-1" value="${m.result || ''}"></div>
      </div>
      <div class="row-actions">
        <button class="btn" type="submit">${m.id ? 'Guardar cambios' : 'Añadir partido'}</button>
        ${m.id ? html`<a class="btn ghost" href="/admin/partidos">Cancelar</a>` : ''}
      </div>
    </form>
    <div class="table-wrap"><table>
      <thead><tr><th>Fecha</th><th>Rival</th><th>Competición</th><th>Resultado</th><th></th></tr></thead>
      <tbody>${matches.map((x) => html`<tr>
        <td class="num">${formatDateTime(x.starts_at)}</td>
        <td><b>${x.opponent}</b></td>
        <td>${x.competition}</td>
        <td class="num">${x.result || '—'}</td>
        <td><div class="row-actions">
          <a class="btn small ghost" href="/admin/partidos?editar=${x.id}">Editar</a>
          <form method="post" action="/admin/partidos/${x.id}/borrar" data-confirm="¿Borrar este partido?"><button class="btn small ghost" type="submit">Borrar</button></form>
        </div></td>
      </tr>`)}</tbody>
    </table></div>`);
}

export function playersAdminPage({ players, editing, flash }) {
  const p = editing || { active: 1, game: 'lol' };
  return page('/admin/jugadores', 'Jugadores', html`
    <h2>Jugadores</h2>
    ${flashBox(flash)}
    <form class="panel form" method="post" action="/admin/jugadores">
      ${p.id ? html`<input type="hidden" name="id" value="${p.id}">` : ''}
      <h3>${p.id ? `Editar a ${p.nick}` : 'Nuevo jugador'}</h3>
      <div class="grid-2">
        <div class="field"><label for="nick">Nick</label><input id="nick" name="nick" type="text" required maxlength="24" value="${p.nick || ''}"></div>
        <div class="field"><label for="name">Nombre real</label><input id="name" name="name" type="text" maxlength="40" value="${p.name || ''}"><span class="hint">Opcional. Solo si el jugador quiere que salga.</span></div>
        <div class="field"><label for="champions">Campeones favoritos</label><input id="champions" name="champions" type="text" maxlength="200" placeholder="Thresh, Bardo, Karma" value="${parseChampions(p.champions).map(championName).join(', ')}"><span class="hint">Separados por comas, hasta 5. El primero hace de foto.</span></div>
        <div class="field"><label for="role">Rol</label><select id="role" name="role">${ROLES.map((r) => html`<option value="${r}" ${r === p.role ? 'selected' : ''}>${roleLabel(r)}</option>`)}</select></div>
        <div class="field"><label for="game">Juego</label><select id="game" name="game">${Object.entries(GAMES).map(([k, v]) => html`<option value="${k}" ${k === p.game ? 'selected' : ''}>${v}</option>`)}</select></div>
        <div class="field"><label for="sort">Orden</label><input id="sort" name="sort" type="number" value="${p.sort ?? 0}"><span class="hint">Para desempatar en el ranking y ordenar la lista.</span></div>
      </div>
      <label class="check"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}><span>En la plantilla. Si lo quitas, deja de salir en el ranking pero sus fans no pierden el voto: se les pedirá que elijan otro.</span></label>
      <div class="row-actions">
        <button class="btn" type="submit">${p.id ? 'Guardar cambios' : 'Añadir jugador'}</button>
        ${p.id ? html`<a class="btn ghost" href="/admin/jugadores">Cancelar</a>` : ''}
      </div>
    </form>
    <div class="table-wrap"><table>
      <thead><tr><th></th><th>Nick</th><th>Nombre</th><th>Rol</th><th>Juego</th><th>Fans</th><th>Estado</th><th></th></tr></thead>
      <tbody>${players.map((x) => html`<tr>
        <td>${avatar(x, { size: 36 })}</td>
        <td><b>${x.nick}</b></td><td>${x.name}</td><td>${roleLabel(x.role)}</td><td>${GAMES[x.game] || x.game}</td><td class="num">${x.fans}</td>
        <td>${x.active ? html`<span class="pill ok">Plantilla</span>` : html`<span class="pill">Retirado</span>`}</td>
        <td><a class="btn small ghost" href="/admin/jugadores?editar=${x.id}">Editar</a></td>
      </tr>`)}</tbody>
    </table></div>`);
}

function membersTable(members, { compact = false } = {}) {
  if (members.length === 0) return html`<p class="empty">Todavía no hay socios.</p>`;
  return html`<div class="table-wrap"><table>
    <thead><tr><th>Nº</th><th>Nick</th>${compact ? '' : html`<th>Email</th>`}<th>Favorito</th>${compact ? '' : html`<th>Avisos</th><th>Alta</th><th></th>`}</tr></thead>
    <tbody>${members.map((m) => html`<tr>
      <td class="num">${m.number ? `#${pad(m.number)}` : html`<span class="pill warn">Sin confirmar</span>`}</td>
      <td>${m.nick}</td>
      ${compact ? '' : html`<td>${m.email}</td>`}
      <td>${m.favorite_nick || '—'}</td>
      ${compact ? '' : html`
        <td class="num">${m.devices}</td>
        <td class="num">${formatDate(m.created_at, { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
        <td><form method="post" action="/admin/socios/${m.id}/borrar" data-confirm="¿Borrar a este socio? No se puede deshacer."><button class="btn small ghost" type="submit">Borrar</button></form></td>`}
    </tr>`)}</tbody>
  </table></div>`;
}

export function membersAdminPage({ members, q, flash }) {
  return page('/admin/socios', 'Socios', html`
    <h2>Socios</h2>
    ${flashBox(flash)}
    <form class="row-actions" method="get" action="/admin/socios">
      <input type="text" name="q" value="${q}" placeholder="Buscar por nick, email o número" style="max-width:360px">
      <button class="btn small" type="submit">Buscar</button>
      <a class="btn small ghost" href="/admin/socios.csv">Exportar CSV</a>
    </form>
    ${membersTable(members)}
    <p class="muted">Borrar un socio elimina también su voto y sus avisos (derecho de supresión). Su número no se reutiliza.</p>`);
}
