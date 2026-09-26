// Service worker: solo muestra los avisos push y abre la web al tocarlos. No cachea nada.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Malos', {
    body: data.body || '',
    icon: '/img/icon-192.png',
    badge: '/img/badge-96.png',
    data: { url: data.url || '/' },
    lang: 'es',
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.find((w) => w.url === url);
    if (open) return open.focus();
    return self.clients.openWindow(url);
  })());
});
