// Markdown mínimo y seguro para las noticias. Sin dependencias.
//
// Seguridad: TODO el texto se escapa antes de interpretar nada, así que no se puede colar HTML.
// Solo se admiten imágenes subidas a la propia web (/uploads/...) y enlaces http(s), mailto o
// rutas internas. Cualquier otra cosa se queda como texto.
//
// Formato admitido:
//   ## Título · ### Subtítulo · **negrita** · *cursiva* · [texto](https://...) · ![pie](/uploads/...)
//   - lista · 1. lista numerada · > cita · --- (separador) · línea en blanco = párrafo nuevo

const escape = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const UPLOAD_RE = /^\/uploads\/[a-f0-9]{24}\.(?:webp|jpg|png|gif)$/;
const safeImage = (url) => UPLOAD_RE.test(url);
const safeLink = (url) => /^(https?:\/\/|mailto:|\/(?!\/))/i.test(url);

// Las URLs se apartan en "fichas" antes de procesar negritas y cursivas, para que un "_" o un "*"
// dentro de una dirección no se convierta en formato.
function inline(text) {
  const tokens = [];
  const keep = (htmlOut) => `\u0000${tokens.push(htmlOut) - 1}\u0000`;
  let s = escape(text);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) => {
    const raw = url.replace(/&amp;/g, '&');
    return safeImage(raw) ? keep(`<img src="${url}" alt="${alt}" loading="lazy">`) : m;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    const raw = url.replace(/&amp;/g, '&');
    if (!safeLink(raw)) return m;
    const external = /^https?:\/\//i.test(raw) && !/^https?:\/\/(www\.)?malos\.es(\/|$)/i.test(raw);
    return keep(`<a href="${url}"${external ? ' target="_blank" rel="noopener nofollow"' : ''}>${label}</a>`);
  });
  s = s.replace(/\*\*(?=\S)([^*]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(?=\S)([^*\n]+?)\*/g, '<em>$1</em>');
  s = s.replace(/(^|[^\w])_(?=\S)([^_\n]+?)_(?=[^\w]|$)/g, '$1<em>$2</em>');
  // Las fichas pueden contener otras (un enlace con imagen): se restauran hasta que no quede ninguna.
  while (/\u0000\d+\u0000/.test(s)) s = s.replace(/\u0000(\d+)\u0000/g, (m, i) => tokens[Number(i)]);
  return s;
}

/** Markdown → HTML seguro. */
export function renderMarkdown(md) {
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let para = [];
  let list = null; // { tag: 'ul'|'ol', items: [] }
  let quote = [];

  const flushPara = () => { if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; };
  const flushList = () => { if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; };
  const flushQuote = () => { if (quote.length) out.push(`<blockquote>${quote.map(inline).join('<br>')}</blockquote>`); quote = []; };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    let m;
    if (!line.trim()) { flushAll(); continue; }
    if ((m = /^(#{1,3})\s+(.+)$/.exec(line))) {
      flushAll();
      const tag = m[1].length === 3 ? 'h4' : 'h3';
      out.push(`<${tag}>${inline(m[2])}</${tag}>`);
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { flushAll(); out.push('<hr>'); continue; }
    if ((m = /^\s*>\s?(.*)$/.exec(line))) { flushPara(); flushList(); quote.push(m[1]); continue; }
    if ((m = /^\s*[-*]\s+(.+)$/.exec(line))) {
      flushPara(); flushQuote();
      if (list?.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] }; }
      list.items.push(m[1]);
      continue;
    }
    if ((m = /^\s*\d+[.)]\s+(.+)$/.exec(line))) {
      flushPara(); flushQuote();
      if (list?.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] }; }
      list.items.push(m[1]);
      continue;
    }
    // Imagen sola en su línea: figura a lo ancho, con pie si tiene texto alternativo.
    if ((m = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line.trim())) && safeImage(m[2])) {
      flushAll();
      const alt = escape(m[1]);
      out.push(`<figure><img src="${escape(m[2])}" alt="${alt}" loading="lazy">${alt ? `<figcaption>${alt}</figcaption>` : ''}</figure>`);
      continue;
    }
    flushList(); flushQuote();
    para.push(line);
  }
  flushAll();
  return out.join('\n');
}

/** Texto sin formato (para avisos push, Google Wallet y extractos). */
export function toPlainText(md) {
  return String(md || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(#{1,3}|>|[-*]|\d+[.)])\s+/gm, '')
    .replace(/^\s*(-{3,}|\*{3,})\s*$/gm, ' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/(^|[^\w])_([^_\n]+)_/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extracto de N caracteres cortado en una palabra. */
export function excerpt(md, max = 180) {
  const text = toPlainText(md);
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

/** Primera imagen de la noticia (sirve de portada y de imagen del aviso push). */
export function firstImage(md) {
  for (const m of String(md || '').matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) if (safeImage(m[1])) return m[1];
  return null;
}
