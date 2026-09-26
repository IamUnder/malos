// Activar y desactivar los avisos push desde la página del carné.
(async () => {
  const box = document.getElementById('avisos');
  if (!box) return;
  const key = box.dataset.pushKey;
  const token = box.dataset.token;
  const $ = (sel) => box.querySelector(sel);
  const status = $('.push-status');
  const onBtn = $('.push-on');
  const offBtn = $('.push-off');

  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  if (!supported) {
    (ios && !standalone ? $('.push-ios') : $('.push-unsupported')).hidden = false;
    return;
  }
  if (!key) return; // el servidor aún no tiene claves VAPID

  let registration;
  try {
    registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
  } catch (err) {
    console.error(err);
    $('.push-unsupported').hidden = false;
    status.textContent = 'Este navegador no deja activar los avisos. Prueba con Chrome, Firefox, Edge o Safari.';
    return;
  }

  const post = (url, data) => fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, ...data }),
  }).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); });

  async function render() {
    const sub = await registration.pushManager.getSubscription();
    onBtn.hidden = Boolean(sub);
    offBtn.hidden = !sub;
    if (Notification.permission === 'denied') {
      status.textContent = 'Has bloqueado las notificaciones de esta web. Actívalas en los ajustes del navegador para recibir avisos.';
      onBtn.hidden = true;
    } else {
      status.textContent = sub ? 'Avisos activados en este dispositivo.' : 'Avisos desactivados en este dispositivo.';
    }
  }

  onBtn.addEventListener('click', async () => {
    onBtn.disabled = true;
    try {
      if ((await Notification.requestPermission()) !== 'granted') return;
      const sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(key) });
      await post('/api/push/subscribe', { subscription: sub.toJSON() });
    } catch (err) {
      status.textContent = 'No se han podido activar los avisos. Inténtalo otra vez en un momento.';
      console.error(err);
      return;
    } finally {
      onBtn.disabled = false;
    }
    await render();
  });

  offBtn.addEventListener('click', async () => {
    const sub = await registration.pushManager.getSubscription();
    if (sub) {
      await post('/api/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe();
    }
    await render();
  });

  await render();

  function base64UrlToBytes(value) {
    const b64 = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
  }
})();
