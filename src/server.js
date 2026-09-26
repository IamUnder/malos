import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { config } from './config.js';
import { purgeUnverified } from './data.js';
import { seedRoster } from './roster.js';
import { publicRoutes } from './routes/public.js';
import { adminRoutes } from './routes/admin.js';
import { notFoundPage } from './views/public.js';

const app = new Hono();

app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", 'https://challenges.cloudflare.com'],
    frameSrc: ['https://challenges.cloudflare.com'],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
  },
  crossOriginEmbedderPolicy: false,
}));

if (config.testMode) app.use('*', async (c, next) => { await next(); c.header('X-Robots-Tag', 'noindex, nofollow'); });

// Estáticos: las fuentes e imágenes no cambian, se cachean mucho; CSS y JS, poco (sin paso de build).
app.use('/fonts/*', async (c, next) => { await next(); c.header('Cache-Control', 'public, max-age=31536000, immutable'); });
app.use('/img/*', async (c, next) => { await next(); c.header('Cache-Control', 'public, max-age=604800'); });
app.use('/sw.js', async (c, next) => { await next(); c.header('Cache-Control', 'no-cache'); });
app.use('/*', serveStatic({ root: './public' }));

app.route('/admin', adminRoutes);
app.route('/', publicRoutes);

app.notFound((c) => c.html(notFoundPage(), 404));
app.onError((err, c) => {
  console.error(err);
  return c.text('Algo ha fallado en el servidor. Prueba en un momento.', 500);
});

seedRoster();

// Limpieza diaria de altas sin confirmar (más de 7 días).
const purge = () => { const n = purgeUnverified(); if (n) console.log(`[db] ${n} altas sin confirmar borradas`); };
purge();
setInterval(purge, 86400e3).unref();

const server = serve({ fetch: app.fetch, port: config.port }, ({ port }) => {
  console.log(`Malos escuchando en http://localhost:${port} (${config.testMode ? 'pruebas' : config.isProd ? 'producción' : 'desarrollo'})`);
  if (!config.push.enabled) console.log('  · avisos push desactivados (faltan claves VAPID)');
  if (!config.mail.enabled) console.log('  · sin SMTP: los enlaces de confirmación salen por esta consola');
});

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));

export { app };
