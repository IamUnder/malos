// Editor de noticias del panel: barra de formato, imágenes (botón, arrastrar o pegar) y vista previa.
// Escribe Markdown en el <textarea>; el servidor lo convierte a HTML seguro.
(() => {
  const root = document.querySelector('[data-editor]');
  if (!root) return;
  const area = root.querySelector('textarea');
  const preview = root.querySelector('.editor-preview');
  const status = root.querySelector('.editor-status');
  const fileInput = root.querySelector('input[type="file"]');
  const MAX_SIDE = 1600;

  // ---------- Barra de formato ----------
  function wrap(before, after = before, placeholder = 'texto') {
    const { selectionStart: s, selectionEnd: e, value } = area;
    const selected = value.slice(s, e) || placeholder;
    area.setRangeText(before + selected + after, s, e, 'end');
    if (s === e) area.setSelectionRange(s + before.length, s + before.length + selected.length);
    area.focus();
    changed();
  }

  /** Añade un prefijo a cada línea seleccionada (títulos, listas, citas). */
  function prefixLines(prefix) {
    const { selectionStart: s, selectionEnd: e, value } = area;
    const start = value.lastIndexOf('\n', s - 1) + 1;
    const end = value.indexOf('\n', e) === -1 ? value.length : value.indexOf('\n', e);
    const lines = value.slice(start, end).split('\n');
    const text = lines.map((l, i) => (typeof prefix === 'function' ? prefix(i) : prefix) + l.replace(/^(#{1,3}|>|[-*]|\d+[.)])\s+/, '')).join('\n');
    area.setRangeText(text, start, end, 'end');
    area.focus();
    changed();
  }

  function insertBlock(text) {
    const { selectionStart: s, value } = area;
    const before = s > 0 && value[s - 1] !== '\n' ? '\n\n' : (s > 1 && value[s - 2] !== '\n' ? '\n' : '');
    area.setRangeText(`${before}${text}\n\n`, s, area.selectionEnd, 'end');
    area.focus();
    changed();
  }

  const actions = {
    bold: () => wrap('**'),
    italic: () => wrap('*'),
    h2: () => prefixLines('## '),
    h3: () => prefixLines('### '),
    ul: () => prefixLines('- '),
    ol: () => prefixLines((i) => `${i + 1}. `),
    quote: () => prefixLines('> '),
    link: () => {
      const url = window.prompt('Dirección del enlace (https://…)', 'https://');
      if (url && /^(https?:\/\/|mailto:|\/)/.test(url)) wrap('[', `](${url})`, 'texto del enlace');
    },
    image: () => fileInput.click(),
    hr: () => insertBlock('---'),
  };
  root.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => actions[btn.dataset.action]?.());
  });
  area.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key === 'b') { e.preventDefault(); actions.bold(); }
    if (e.key === 'i') { e.preventDefault(); actions.italic(); }
    if (e.key === 'k') { e.preventDefault(); actions.link(); }
  });

  // ---------- Imágenes ----------
  /** Reduce la imagen en el navegador (máx. 1600 px) y la pasa a WebP; los GIF se suben tal cual. */
  async function shrink(file) {
    if (file.type === 'image/gif') return file;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.85));
    // Safari antiguo no genera WebP: si devuelve PNG o nada, se usa JPEG.
    if (blob && blob.type === 'image/webp') return blob;
    return new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
  }

  async function upload(file) {
    if (!file.type.startsWith('image/')) { setStatus('Solo se pueden subir imágenes.', true); return; }
    setStatus(`Subiendo ${file.name || 'imagen'}…`);
    try {
      const small = await shrink(file);
      const body = new FormData();
      body.append('image', small, 'imagen');
      const res = await fetch('/admin/subidas', { method: 'POST', body });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || `Error ${res.status}`);
      const alt = window.prompt('Pie de foto (opcional, también sirve para accesibilidad):', '') || '';
      insertBlock(`![${alt.replace(/[[\]]/g, '')}](${out.url})`);
      setStatus(`Imagen añadida (${Math.round(small.size / 1024)} KB).`);
    } catch (err) {
      setStatus(`No se ha podido subir la imagen: ${err.message}`, true);
    }
  }

  fileInput.addEventListener('change', async () => {
    for (const f of fileInput.files) await upload(f);
    fileInput.value = '';
  });
  area.addEventListener('paste', async (e) => {
    const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    e.preventDefault();
    for (const f of files) await upload(f);
  });
  area.addEventListener('dragover', (e) => { e.preventDefault(); root.classList.add('dragging'); });
  area.addEventListener('dragleave', () => root.classList.remove('dragging'));
  area.addEventListener('drop', async (e) => {
    e.preventDefault();
    root.classList.remove('dragging');
    for (const f of e.dataTransfer.files) await upload(f);
  });

  // ---------- Vista previa ----------
  let timer;
  function changed() {
    clearTimeout(timer);
    timer = setTimeout(refreshPreview, 350);
  }
  async function refreshPreview() {
    if (!area.value.trim()) { preview.innerHTML = '<p class="muted">La vista previa aparecerá aquí.</p>'; return; }
    const res = await fetch('/admin/avisos/vista-previa', { method: 'POST', body: new URLSearchParams({ body: area.value }) });
    if (res.ok) preview.innerHTML = await res.text(); // HTML ya saneado por el servidor
  }
  function setStatus(text, error = false) {
    status.textContent = text;
    status.classList.toggle('error', error);
  }
  area.addEventListener('input', changed);
  refreshPreview();
})();
