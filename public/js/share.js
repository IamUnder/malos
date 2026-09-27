// "Compartir mi carné": genera en el navegador una imagen de 1080×1920 (story de Instagram/WhatsApp)
// y la comparte con el menú del móvil o, si no se puede, la descarga. No pasa nada por el servidor.
(() => {
  const box = document.getElementById('compartir');
  if (!box) return;
  const btn = box.querySelector('.share-btn');
  const hint = box.querySelector('.share-hint');
  const d = box.dataset;

  const C = { mostaza: '#e3b93c', tinta: '#14120c', hueso: '#fff8e7', azul: '#1d4fb8', hondo: '#c99a1e' };
  const W = 1080;
  const H = 1920;

  const loadImage = (src) => new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

  /** Escribe `text` centrado, reduciendo la letra hasta que quepa en `maxWidth`. */
  function fitText(ctx, text, y, { font, size, maxWidth = W - 160, color = C.tinta }) {
    let px = size;
    do { ctx.font = font.replace('{px}', px); px -= 4; } while (ctx.measureText(text).width > maxWidth && px > 20);
    ctx.fillStyle = color;
    ctx.fillText(text, W / 2, y);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  async function draw() {
    await Promise.all([
      document.fonts.load('900 120px "Big Shoulders"'),
      document.fonts.load('700 120px "JetBrains Mono"'),
      document.fonts.load('600 40px "Onest"'),
    ]).catch(() => {});
    const [crest, champ] = await Promise.all([loadImage('/img/crest-outline.png'), loadImage(d.champ)]);

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    // Fondo mostaza con franjas diagonales muy suaves
    ctx.fillStyle = C.mostaza;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = C.tinta;
    for (let x = -H; x < W; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x + 40, 0); ctx.lineTo(x + 40 + H, H); ctx.lineTo(x + H, H);
      ctx.fill();
    }
    ctx.restore();

    // Escudo
    if (crest) {
      const h = 520;
      const w = (crest.width / crest.height) * h;
      ctx.save();
      ctx.shadowColor = 'rgba(20,18,12,.25)';
      ctx.shadowOffsetX = 10; ctx.shadowOffsetY = 14;
      ctx.drawImage(crest, (W - w) / 2, 120, w, h);
      ctx.restore();
    }

    // Titular
    fitText(ctx, 'SOY EL SOCIO', 800, { font: '900 {px}px "Big Shoulders", Impact, sans-serif', size: 150 });
    fitText(ctx, `#${d.number}`, 1070, { font: '700 {px}px "JetBrains Mono", monospace', size: 300 });
    fitText(ctx, 'DE MALOS', 1210, { font: '900 {px}px "Big Shoulders", Impact, sans-serif', size: 150 });

    // Ficha en negro con nick, favorito y antigüedad
    const cardX = 90; const cardY = 1300; const cardW = W - 180; const cardH = 330;
    ctx.fillStyle = C.hondo;
    roundRect(ctx, cardX + 14, cardY + 14, cardW, cardH, 28); ctx.fill();
    ctx.fillStyle = C.tinta;
    roundRect(ctx, cardX, cardY, cardW, cardH, 28); ctx.fill();

    ctx.textAlign = 'left';
    const label = (text, x, y) => { ctx.font = '700 30px "JetBrains Mono", monospace'; ctx.fillStyle = C.mostaza; ctx.fillText(text, x, y); };
    const value = (text, x, y, max) => {
      let px = 74;
      do { ctx.font = `900 ${px}px "Big Shoulders", Impact, sans-serif`; px -= 2; } while (ctx.measureText(text).width > max && px > 30);
      ctx.fillStyle = C.hueso; ctx.fillText(text, x, y);
    };
    label('NOMBRE', cardX + 50, cardY + 80);
    value(d.nick.toUpperCase(), cardX + 50, cardY + 155, cardW - 100);
    label('FAVORITO', cardX + 50, cardY + 225);
    let favX = cardX + 50;
    if (champ && d.favorite) {
      ctx.save();
      ctx.beginPath(); ctx.arc(favX + 34, cardY + 272, 34, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(champ, favX, cardY + 238, 68, 68);
      ctx.restore();
      favX += 88;
    }
    // El icono ocupa sitio: el nombre tiene que caber antes de la columna "DESDE".
    value((d.favorite || '—').toUpperCase(), favX, cardY + 298, cardX + cardW / 2 + 30 - favX);
    label('DESDE', cardX + cardW / 2 + 60, cardY + 225);
    value(d.since.toUpperCase(), cardX + cardW / 2 + 60, cardY + 298, cardW / 2 - 110);

    // La "L" de prácticas, como en el escudo
    ctx.save();
    ctx.translate(W - 190, 150);
    ctx.rotate(0.12);
    ctx.fillStyle = '#fff'; roundRect(ctx, -8, -8, 136, 166, 14); ctx.fill();
    ctx.fillStyle = C.azul; roundRect(ctx, 0, 0, 120, 150, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '700 120px "Onest", sans-serif'; ctx.fillText('L', 60, 120);
    ctx.restore();

    // Llamada a la acción
    ctx.fillStyle = C.tinta;
    ctx.fillRect(0, H - 200, W, 200);
    ctx.textAlign = 'center';
    fitText(ctx, 'HAZTE SOCIO GRATIS', H - 110, { font: '900 {px}px "Big Shoulders", Impact, sans-serif', size: 76, color: C.mostaza });
    fitText(ctx, `${d.site}/hazte-socio`, H - 50, { font: '700 {px}px "JetBrains Mono", monospace', size: 40, color: C.hueso });

    return canvas;
  }

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'Generando…';
    try {
      const canvas = await draw();
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      const filename = `malos-socio-${d.number}.png`;
      const file = new File([blob], filename, { type: 'image/png' });
      const text = `Soy el socio #${d.number} de Malos 🦁 Hazte socio gratis: https://${d.site}/hazte-socio`;

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text }).catch(() => {}); // cancelar el menú no es un error
      } else {
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = filename;
        document.body.append(a);
        a.click();
        a.remove();
        hint.textContent = 'Imagen descargada. Súbela a tus stories y menciona al club.';
      }
    } catch (err) {
      console.error(err);
      hint.textContent = 'No se ha podido generar la imagen en este navegador.';
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });
})();
