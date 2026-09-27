import { html, raw } from 'hono/html';
import { config } from '../config.js';
import { formatDate, pad } from '../lib/format.js';
import { layout } from './layout.js';
import { alert, carnet, fixtures, matchbar, news, playerPicker, roster, standings, supportBlock } from './components.js';

export function homePage({ stats, match, rank, players, posts, upcoming }) {
  const body = html`
  <section class="hero">
    <div class="wrap">
      <div>
        <p class="eyebrow" style="color:var(--tinta-2)">Club de socios · Ciudad Real</p>
        <h1>Hazte socio de Ma<span class="l-plate" aria-label="L">L</span>os</h1>
        <p class="lead">Gratis. Te llevas tu número de socio, te avisamos de cada partido y votas a tu jugador favorito.</p>
        <div class="actions">
          <a class="btn" href="/hazte-socio">Quiero mi número</a>
          <p class="counter"><b>${stats.members}</b>${stats.members === 1 ? 'socio' : 'socios'} ya dentro</p>
        </div>
      </div>
      <img class="crest" src="/img/crest-outline.png" alt="Escudo de Malos" width="182" height="329">
    </div>
  </section>
  ${matchbar(match)}
  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <div class="stack" style="gap:8px">
          <p class="eyebrow">Clasificación de fans</p>
          <h2>¿Quién manda aquí?</h2>
        </div>
        <p class="muted">Cada socio vota a un jugador. Solo cuentan los socios con el email confirmado.</p>
      </div>
      ${standings(rank, { limit: 5 })}
      ${rank.length > 5 ? html`<p style="margin-top:16px"><a href="/ranking">Ver la clasificación completa</a></p>` : ''}
    </div>
  </section>
  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <div class="stack" style="gap:8px"><p class="eyebrow">League of Legends</p><h2>La plantilla</h2></div>
        <p class="muted">Mientras llegan las fotos oficiales, cada uno sale con su campeón de confianza.</p>
      </div>
      ${roster(players)}
    </div>
  </section>
  <section class="section">
    <div class="wrap cols">
      <div class="stack" style="gap:24px">
        <h2>Noticias</h2>
        ${news(posts)}
        ${posts.length ? html`<p><a href="/noticias">Todas las noticias</a></p>` : ''}
      </div>
      <div class="stack" style="gap:24px">
        <h2>Calendario</h2>
        ${fixtures(upcoming)}
        <p><a href="/partidos">Partidos y resultados</a></p>
      </div>
    </div>
  </section>
  ${supportBlock()}`;
  return layout({ path: '/', body });
}

export function rankingPage({ rank }) {
  return layout({
    title: 'Ranking de fans',
    path: '/ranking',
    body: html`<section class="section"><div class="wrap">
      <div class="section-head">
        <div class="stack" style="gap:8px"><p class="eyebrow">Clasificación de fans</p><h2>Ranking de jugadores</h2></div>
        <p class="muted">¿Tu favorito va perdiendo? Pásale el enlace a tus amigos: <b>${config.siteUrl.replace(/^https?:\/\//, '')}/hazte-socio</b></p>
      </div>
      ${standings(rank)}
    </div></section>${supportBlock()}`,
  });
}

export function rosterPage({ players }) {
  return layout({
    title: 'Plantilla',
    path: '/plantilla',
    body: html`<section class="section"><div class="wrap">
      <div class="section-head">
        <div class="stack" style="gap:8px"><p class="eyebrow">League of Legends</p><h2>La plantilla</h2></div>
        <p class="muted">¿Ya tienes favorito? <a href="/hazte-socio">Hazte socio y vótale</a>.</p>
      </div>
      ${roster(players)}
    </div></section>`,
  });
}

export function matchesPage({ upcoming, results }) {
  return layout({
    title: 'Partidos',
    path: '/partidos',
    body: html`<section class="section"><div class="wrap cols">
      <div class="stack" style="gap:24px"><h2>Próximos</h2>${fixtures(upcoming)}</div>
      <div class="stack" style="gap:24px"><h2>Resultados</h2>${fixtures(results)}</div>
    </div></section>`,
  });
}

export function newsPage({ posts }) {
  return layout({
    title: 'Noticias',
    path: '/noticias',
    body: html`<section class="section"><div class="wrap stack" style="gap:28px"><h2>Noticias</h2>${news(posts)}</div></section>`,
  });
}

export function joinPage({ players, values = {}, error }) {
  const body = html`<div class="narrow">
    <div class="stack" style="gap:10px">
      <p class="eyebrow">Gratis · 1 minuto</p>
      <h2>Hazte socio</h2>
      <p>Te mandamos un email para confirmar. Al abrirlo recibes tu número de socio; cuanto antes entres, más bajo el número.</p>
    </div>
    ${alert('error', error)}
    <form class="panel form" method="post" action="/hazte-socio">
      <div class="field">
        <label for="nick">Tu nombre o nick</label>
        <input id="nick" name="nick" type="text" required maxlength="24" autocomplete="nickname" value="${values.nick || ''}">
        <span class="hint">Es el que sale en tu carné. Máximo 24 caracteres.</span>
      </div>
      <div class="field">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" required maxlength="120" autocomplete="email" value="${values.email || ''}">
        <span class="hint">Solo para confirmar que eres tú y darte acceso a tu carné. No lo compartimos.</span>
      </div>
      <fieldset class="field">
        <legend>Tu jugador favorito</legend>
        ${playerPicker(players, Number(values.favorite) || null)}
        <span class="hint">Se puede cambiar cada ${config.favoriteCooldownDays} días.</span>
      </fieldset>
      <label class="check"><input type="checkbox" name="age" required ${values.age ? 'checked' : ''}><span>Tengo ${config.minAge} años o más.</span></label>
      <label class="check"><input type="checkbox" name="privacy" required ${values.privacy ? 'checked' : ''}><span>He leído la <a href="/privacidad" target="_blank">política de privacidad</a> y acepto que se guarden mi nick, mi email y mi jugador favorito para gestionar mi carné.</span></label>
      <!-- Campo trampa para bots: las personas no lo ven. -->
      <div class="visually-hidden" aria-hidden="true"><label>No rellenes esto <input name="website" tabindex="-1" autocomplete="off"></label></div>
      ${config.turnstile.enabled ? html`<div class="cf-turnstile" data-sitekey="${config.turnstile.siteKey}" data-language="es"></div>` : ''}
      <button class="btn" type="submit">Enviar y confirmar email</button>
    </form>
  </div>`;
  const scripts = config.turnstile.enabled ? ['https://challenges.cloudflare.com/turnstile/v0/api.js'] : [];
  return layout({ title: 'Hazte socio', path: '/hazte-socio', body, scripts });
}

export function checkEmailPage({ email, devLink }) {
  return layout({
    title: 'Revisa tu email',
    body: html`<div class="narrow">
      <h2>Mira tu email</h2>
      <p>Si <b>${email}</b> es correcto, te acabamos de mandar un enlace. Ábrelo para confirmar y recibir tu número de socio.</p>
      <p class="muted">¿No llega? Mira en spam o promociones. El enlace no caduca.</p>
      ${devLink ? html`<p class="alert info">Entorno de pruebas (el email no está configurado o ha fallado): <a href="${devLink}">abrir el enlace</a></p>` : ''}
    </div>`,
  });
}

export function recoverPage({ sent, error, devLink }) {
  return layout({
    title: 'Mi tarjeta',
    path: '/mi-tarjeta',
    body: html`<div class="narrow">
      <div class="stack" style="gap:10px">
        <h2>Mi tarjeta</h2>
        <p>Tu carné está en el enlace que te mandamos por email. Si lo has perdido, te lo reenviamos.</p>
      </div>
      ${sent ? alert('ok', 'Si ese email es de un socio, le acabamos de mandar su enlace.') : ''}
      ${alert('error', error)}
      ${devLink ? html`<p class="alert info">Entorno de pruebas (el email no está configurado o ha fallado): <a href="${devLink}">abrir el enlace</a></p>` : ''}
      <form class="panel form" method="post" action="/mi-tarjeta">
        <div class="field">
          <label for="email">Email con el que te apuntaste</label>
          <input id="email" name="email" type="email" required autocomplete="email">
        </div>
        <button class="btn" type="submit">Reenviar mi enlace</button>
      </form>
      <p class="muted">¿Aún no eres socio? <a href="/hazte-socio">Apúntate aquí</a>.</p>
    </div>`,
  });
}

export function cardPage({ member, favorite, players, lockedUntil, pushCount, justVerified, flash, checkPath }) {
  const verified = Boolean(member.verified_at);
  const body = html`<div class="narrow">
    ${justVerified ? alert('ok', `¡Dentro! Eres el socio número ${member.number}.`) : ''}
    ${flash ? alert(flash.kind, flash.message) : ''}
    ${carnet(member, favorite)}

    ${verified ? html`
    <section class="panel stack" id="avisos" data-push-key="${config.push.publicKey}" data-token="${member.access_token}" data-count="${pushCount}">
      <h3>Avisos de partidos</h3>
      <p>Te avisamos en el móvil cuando haya partido o noticia importante. Pocos y útiles, prometido.</p>
      <p class="push-status muted" aria-live="polite">${pushCount ? `Avisos activados en ${pushCount} ${pushCount === 1 ? 'dispositivo' : 'dispositivos'}.` : 'Avisos desactivados en este dispositivo.'}</p>
      <div class="row-actions">
        <button class="btn small push-on" type="button" hidden>Activar avisos aquí</button>
        <button class="btn small ghost push-off" type="button" hidden>Desactivar en este dispositivo</button>
      </div>
      <div class="alert info push-ios" hidden>
        En iPhone, los avisos solo funcionan si guardas esta página como app: pulsa <b>Compartir</b> y luego <b>Añadir a pantalla de inicio</b>. Ábrela desde el icono y vuelve a pulsar «Activar avisos».
      </div>
      <p class="push-unsupported muted" hidden>Este navegador no admite avisos push.</p>
      ${config.push.enabled ? '' : html`<p class="muted">Los avisos todavía no están activos en el servidor.</p>`}
    </section>

    <section class="panel stack">
      <h3>Tu jugador favorito</h3>
      ${lockedUntil
        ? html`<p>Ahora mismo es <b>${favorite?.nick ?? '—'}</b>. Podrás cambiarlo a partir del ${formatDate(lockedUntil.toISOString())}.</p>`
        : html`<form class="form" method="post" action="/socio/${member.access_token}/favorito">
            ${playerPicker(players, member.favorite_player_id, { required: true })}
            ${players.length ? html`<button class="btn small" type="submit">Guardar favorito</button>
              <p class="hint muted">Después tendrás que esperar ${config.favoriteCooldownDays} días para volver a cambiarlo.</p>` : ''}
          </form>`}
    </section>

    <section class="panel stack">
      <h3>Comprobar el carné</h3>
      <p>En eventos, enseña este enlace para demostrar que eres socio:</p>
      <p class="mono" style="overflow-wrap:anywhere"><a href="${checkPath}">${config.siteUrl.replace(/^https?:\/\//, '')}${checkPath}</a></p>
    </section>` : html`<p class="alert info">Falta un paso: confirma tu email con el enlace que te mandamos.</p>`}

    <details class="panel">
      <summary><b>Darme de baja</b></summary>
      <form class="form" method="post" action="/socio/${member.access_token}/baja" style="margin-top:16px">
        <p>Se borran tu carné, tu voto y tus avisos. Tu número de socio no se vuelve a dar a nadie. No se puede deshacer.</p>
        <label class="check"><input type="checkbox" name="confirm" required><span>Sí, quiero borrar mi cuenta de socio.</span></label>
        <button class="btn small danger" type="submit">Borrar mi cuenta</button>
      </form>
    </details>
    <p class="muted">Guarda esta página en favoritos: es tu acceso al carné. No compartas el enlace.</p>
  </div>`;
  return layout({ title: verified ? `Socio #${pad(member.number)}` : 'Tu carné', body, scripts: ['/js/card.js'], manifest: `/manifest.webmanifest?t=${member.access_token}` });
}

export function checkPage({ member }) {
  return layout({
    title: 'Comprobar carné',
    body: html`<div class="narrow">
      ${member
        ? html`<p class="alert ok">Carné válido</p>
          <p class="eyebrow">Socio nº</p>
          <p class="mono" style="font-size:3rem;font-weight:700;line-height:1">#${pad(member.number)}</p>
          <p style="font:900 2rem/1 var(--display);text-transform:uppercase">${member.nick}</p>
          <p class="muted">Socio desde el ${formatDate(member.verified_at)}</p>`
        : html`<p class="alert error">Este carné no existe o se ha dado de baja.</p>`}
    </div>`,
  });
}

export function goodbyePage() {
  return layout({
    title: 'Baja completada',
    body: html`<div class="narrow"><h2>Hasta pronto</h2><p>Hemos borrado tu cuenta de socio. Si algún día vuelves, te esperamos con un número nuevo.</p><p><a href="/">Volver al inicio</a></p></div>`,
  });
}

export function notFoundPage() {
  return layout({
    title: 'No encontrado',
    body: html`<div class="narrow"><p class="eyebrow">Error 404</p><h2>Esta página se ha ido a la jungla</h2><p>No existe o ha cambiado de sitio.</p><p><a class="btn small" href="/">Volver al inicio</a></p></div>`,
  });
}

export function legalPage({ title, path, content }) {
  return layout({ title, path, body: html`<section class="section"><div class="wrap prose">${raw(content)}</div></section>` });
}
