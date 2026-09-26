// Avisos push de la web (Web Push con claves VAPID). Llegan a Android, escritorio y a iPhone
// con iOS 16.4 o superior si el socio ha añadido la web a la pantalla de inicio.
import webpush from 'web-push';
import { config } from '../config.js';
import { allSubscriptions, deleteSubscription } from '../data.js';

if (config.push.enabled) {
  webpush.setVapidDetails(config.push.subject, config.push.publicKey, config.push.privateKey);
}

/**
 * Manda un aviso a todos los socios con avisos activados.
 * Las suscripciones que ya no existen (el usuario desinstaló o quitó el permiso) se borran solas.
 */
export async function broadcast({ title, body, url = '/' }) {
  if (!config.push.enabled) return { sent: 0, failed: 0 };
  const payload = JSON.stringify({ title, body, url });
  const subscriptions = allSubscriptions();
  let sent = 0;
  let failed = 0;

  // Lotes de 50 para no abrir cientos de conexiones a la vez.
  for (let i = 0; i < subscriptions.length; i += 50) {
    await Promise.all(subscriptions.slice(i, i + 50).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 });
        sent++;
      } catch (err) {
        failed++;
        if (err.statusCode === 404 || err.statusCode === 410) deleteSubscription(s.endpoint);
        else console.warn('[push] error', err.statusCode ?? err.message);
      }
    }));
  }
  return { sent, failed };
}
