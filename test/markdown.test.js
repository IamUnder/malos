import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, toPlainText, excerpt, firstImage } from '../src/lib/markdown.js';

const IMG = '/uploads/0123456789abcdef01234567.webp';

test('formato básico', () => {
  const html = renderMarkdown('## Título\n\nHola **mundo** y *cursiva*.\nSegunda línea\n\n- uno\n- dos\n\n1. a\n2. b\n\n> cita\n\n---');
  assert.match(html, /<h3>Título<\/h3>/);
  assert.match(html, /<p>Hola <strong>mundo<\/strong> y <em>cursiva<\/em>\.<br>Segunda línea<\/p>/);
  assert.match(html, /<ul><li>uno<\/li><li>dos<\/li><\/ul>/);
  assert.match(html, /<ol><li>a<\/li><li>b<\/li><\/ol>/);
  assert.match(html, /<blockquote>cita<\/blockquote>/);
  assert.match(html, /<hr>/);
});

test('imágenes: solo las subidas a la web; sola en su línea es una figura con pie', () => {
  assert.match(renderMarkdown(`![Foto del equipo](${IMG})`), new RegExp(`<figure><img src="${IMG}" alt="Foto del equipo" loading="lazy"><figcaption>Foto del equipo</figcaption></figure>`));
  assert.doesNotMatch(renderMarkdown('![x](https://evil.example/track.png)'), /<img/);
  assert.doesNotMatch(renderMarkdown('![x](/uploads/../../etc/passwd)'), /<img/);
});

test('enlaces: http(s), mailto y rutas internas; nada de javascript:', () => {
  assert.match(renderMarkdown('[Twitch](https://twitch.tv/malos_es)'), /<a href="https:\/\/twitch.tv\/malos_es" target="_blank" rel="noopener nofollow">Twitch<\/a>/);
  assert.match(renderMarkdown('[ranking](/ranking)'), /<a href="\/ranking">ranking<\/a>/);
  assert.doesNotMatch(renderMarkdown('[x](javascript:alert(1))'), /<a /);
  assert.doesNotMatch(renderMarkdown('[x](//evil.example)'), /<a /);
});

test('no se puede inyectar HTML', () => {
  const html = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[a" onclick="x](https://ok.es)');
  assert.doesNotMatch(html, /<script|<img src=x|onclick="x"/);
  assert.match(html, /&lt;script&gt;/);
});

test('los guiones bajos de una URL no se convierten en cursiva', () => {
  assert.match(renderMarkdown('Mira https://x.es/a_b_c y [esto](https://x.es/d_e_f)'), /href="https:\/\/x.es\/d_e_f"/);
});

test('texto plano, extracto y primera imagen', () => {
  const md = `## Gran victoria\n\n![](${IMG})\n\nHemos ganado **2-0** a [Los Pollos](https://x.es). - Vamos`;
  assert.equal(toPlainText(md), 'Gran victoria Hemos ganado 2-0 a Los Pollos. - Vamos');
  assert.equal(firstImage(md), IMG);
  assert.equal(firstImage('![x](https://evil.example/a.png)'), null);
  assert.equal(excerpt('una dos tres cuatro', 12), 'una dos…');
});

test('las noticias antiguas en texto plano se siguen viendo igual', () => {
  assert.equal(renderMarkdown('Hola\nqué tal\n\nAdiós'), '<p>Hola<br>qué tal</p>\n<p>Adiós</p>');
});
