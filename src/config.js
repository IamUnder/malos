// Toda la configuración sale de variables de entorno (ver .env.example).
// Lo opcional (avisos push, email, Turnstile, Ko-fi) se desactiva solo si falta: la web funciona igual.
const env = process.env;
const isProd = env.NODE_ENV === 'production';

function required(name, devDefault) {
  const value = env[name];
  if (value) return value;
  if (!isProd && devDefault !== undefined) return devDefault;
  throw new Error(`Falta la variable de entorno ${name} (ver .env.example)`);
}

export const config = {
  isProd,
  // Entorno de pruebas (p. ej. test.kaizogroup.es): no se indexa y, sin SMTP, enseña el enlace de confirmación en pantalla.
  testMode: env.TEST_MODE === 'true',
  port: Number(env.PORT || 3000),
  siteUrl: required('SITE_URL', 'http://localhost:3000').replace(/\/$/, ''),
  dbPath: env.DB_PATH || './data/malos.db',
  sessionSecret: required('SESSION_SECRET', 'dev-secret-no-usar-en-produccion'),
  adminPassword: required('ADMIN_PASSWORD', 'admin'),
  kofiUrl: env.KOFI_URL || '',
  repoUrl: env.REPO_URL || '',
  // Días que tiene que esperar un socio para volver a cambiar de jugador favorito.
  favoriteCooldownDays: Number(env.FAVORITE_COOLDOWN_DAYS || 30),
  minAge: 14,
  mail: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT || 587),
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || 'Malos <socios@malos.es>',
  },
  // Avisos push de la web (Web Push). Claves: `npx web-push generate-vapid-keys`.
  push: {
    publicKey: env.VAPID_PUBLIC_KEY || '',
    privateKey: env.VAPID_PRIVATE_KEY || '',
    subject: env.VAPID_SUBJECT || 'mailto:hola@malos.es',
  },
  turnstile: {
    siteKey: env.TURNSTILE_SITE_KEY || '',
    secret: env.TURNSTILE_SECRET || '',
  },
  legal: {
    // Responsable del tratamiento que aparece en la política de privacidad y el aviso legal.
    owner: env.LEGAL_OWNER || '[Nombre del responsable]',
    contactEmail: env.LEGAL_EMAIL || 'hola@malos.es',
  },
};
config.mail.enabled = Boolean(config.mail.host);
config.push.enabled = Boolean(config.push.publicKey && config.push.privateKey);
config.turnstile.enabled = Boolean(config.turnstile.siteKey && config.turnstile.secret);
