import { html } from 'hono/html';
import { config } from '../config.js';

const NAV = [
  ['/', 'Inicio'],
  ['/plantilla', 'Plantilla'],
  ['/ranking', 'Ranking'],
  ['/oraculo', 'Oráculo'],
  ['/partidos', 'Partidos'],
  ['/noticias', 'Noticias'],
  ['/mi-tarjeta', 'Mi tarjeta'],
];

export function layout({ title, description, path = '/', body, admin = false, scripts = [], manifest = '/manifest.webmanifest' }) {
  const fullTitle = title ? `${title} · Malos` : 'Malos · Club de fans';
  return html`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${fullTitle}</title>
  <meta name="description" content="${description || 'Hazte socio de Malos: número de socio, avisos de los partidos y vota a tu jugador favorito.'}">
  <meta name="theme-color" content="#14120c">
  <link rel="icon" href="/img/favicon-32.png" sizes="32x32">
  <link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
  <link rel="manifest" href="${manifest}">
  <link rel="preload" href="/fonts/big-shoulders.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/css/site.css">
  <meta property="og:title" content="${fullTitle}">
  <meta property="og:image" content="${config.siteUrl}/img/og.png">
  <meta property="og:url" content="${config.siteUrl}${path}">
  ${admin || config.testMode ? html`<meta name="robots" content="noindex, nofollow">` : ''}
</head>
<body>
  ${config.testMode ? html`<p class="testbar">Entorno de pruebas: los datos se pueden borrar en cualquier momento.</p>` : ''}
  <header class="top${admin ? ' admin-top' : ''}">
    <div class="wrap">
      <a class="brand" href="${admin ? '/admin' : '/'}"><img src="/img/crest.png" alt="" width="20" height="38"><span>MALOS</span></a>
      <nav class="nav" aria-label="Principal">
        ${admin ? adminNav(path) : NAV.map(([href, label]) => html`<a href="${href}" ${href === path ? html`aria-current="page"` : ''}>${label}</a>`)}
      </nav>
    </div>
  </header>
  <main>${body}</main>
  ${admin ? '' : footer()}
  ${scripts.map((src) => html`<script src="${src}" defer></script>`)}
</body>
</html>`;
}

function adminNav(path) {
  const items = [['/admin', 'Resumen'], ['/admin/avisos', 'Avisos'], ['/admin/partidos', 'Partidos'], ['/admin/jugadores', 'Jugadores'], ['/admin/socios', 'Socios']];
  return html`${items.map(([href, label]) => html`<a href="${href}" ${href === path ? html`aria-current="page"` : ''}>${label}</a>`)}
    <a href="/">Ver web</a>
    <form method="post" action="/admin/logout"><button class="nav-exit" type="submit">Salir</button></form>`;
}

function footer() {
  return html`<footer class="foot">
    <div class="wrap">
      <p>Malos · Ciudad Real · Web hecha por y para la afición<br><small style="opacity:.6">No respaldado por Riot Games. League of Legends es una marca de Riot Games, Inc.</small></p>
      <nav aria-label="Legal">
        <a href="/privacidad">Privacidad</a>
        <a href="/aviso-legal">Aviso legal</a>
        ${config.kofiUrl ? html`<a href="${config.kofiUrl}" rel="noopener" target="_blank">Apoya el servidor</a>` : ''}
        ${config.repoUrl ? html`<a href="${config.repoUrl}" rel="noopener" target="_blank">Código abierto</a>` : ''}
      </nav>
    </div>
  </footer>`;
}
