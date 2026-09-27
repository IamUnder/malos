# Malos · Web de socios

Web del club de fans de **Malos** (Ciudad Real): [malos.es](https://malos.es).

- **Hazte socio gratis** y recibe tu número de socio (se asigna al confirmar el email, en orden de llegada).
- **Carné digital** en la web, instalable en el móvil como app.
- **Avisos push** de partidos y noticias, que se mandan desde el panel.
- **Plantilla** con sus campeones favoritos, que hacen de foto mientras no haya oficiales.
- **Ranking de fans**: cada socio vota a su jugador favorito.
- **MVP y fraude de cada partido**: los socios votan una predicción antes del partido y el veredicto final después.
- **El Oráculo**: porra con puntos por acertar MVP, fraude y resultado, con clasificación de socios.
- **Compartir el carné** como imagen para stories, generada en el propio móvil.
- **Estadísticas**: KDA de cada jugador por partido y acumulado de la temporada, en la portada.
- **Panel de administración** para noticias y avisos, partidos, plantilla y socios.
- Enlace de **donaciones** para cubrir el dominio y el servidor.

Está pensada para gastar lo mínimo: un proceso de Node con SQLite integrado, sin base de datos aparte ni paso de build. En producción usa unos 35 MB de RAM.

## Stack

| Parte | Qué se usa |
|---|---|
| Servidor | Node 24 + [Hono](https://hono.dev) |
| Base de datos | SQLite integrado en Node (`node:sqlite`), un único archivo |
| Vistas | HTML renderizado en el servidor (`hono/html`), CSS plano y un poco de JS |
| Avisos | Web Push con claves VAPID ([`web-push`](https://github.com/web-push-libs/web-push)) |
| Email | SMTP con [`nodemailer`](https://nodemailer.com) |

Solo hay 4 dependencias de producción y ningún paso de compilación: lo que ves en `src/` es lo que se ejecuta.

## Arrancar en local

Necesitas **Node 24** o superior.

```bash
npm install
npm run seed:demo   # opcional: jugadores, partidos y socios de ejemplo
npm run dev         # http://localhost:3000
```

- **Panel:** http://localhost:3000/admin, con la contraseña `admin` en desarrollo.
- **Sin SMTP**, el enlace de confirmación sale en la consola y en la propia página tras apuntarte.
- **Para probar los avisos push**, copia `.env.example` a `.env` y genera las claves con `npx web-push generate-vapid-keys`. `localhost` cuenta como origen seguro, así que funcionan sin HTTPS.

```bash
npm test            # tests de la capa de datos
npm run champions   # descarga los iconos de campeones que falten
```

Los iconos de campeones vienen de Data Dragon, el CDN público de Riot Games. Se guardan en `public/img/champions/` y se sirven desde el propio servidor. Malos no está respaldado por Riot Games.

## Estructura

```
src/
  server.js          arranque, cabeceras de seguridad, estáticos
  config.js          variables de entorno (todo lo opcional se desactiva solo)
  db.js              SQLite + migraciones automáticas al arrancar
  data.js            todas las consultas
  roster.js          plantilla inicial (se carga una vez con la base de datos vacía)
  champions.json     nombres de los campeones de LoL (Data Dragon)
  lib/               avisos push, email, sesión del panel, anti-bots, fechas
  routes/            rutas públicas y del panel
  views/             plantillas HTML
public/              CSS, JS del navegador, service worker, fuentes e imágenes
scripts/             datos de ejemplo (seed-demo) e iconos de campeones (fetch-champions)
test/                tests (node:test)
logos/               logos originales del equipo
```

## Cómo funcionan los avisos

1. El socio abre su carné (`/socio/<enlace-personal>`) y pulsa **Activar avisos**.
2. El navegador da una suscripción push, que se guarda asociada al socio.
3. Desde **/admin/avisos**, al publicar una noticia con «Mandar también como aviso», llega una notificación a todos los dispositivos suscritos.

**En iPhone** (iOS 16.4 o superior) los avisos solo funcionan si el socio añade la web a la pantalla de inicio. La página del carné lo explica, y el icono instalado abre directamente su carné.

## Seguridad y privacidad

- Los socios no tienen contraseña: su acceso es un enlace personal que se manda por email.
- Solo cuentan en el ranking los socios con el email confirmado. Las altas sin confirmar se borran a los 7 días.
- El favorito solo se puede cambiar cada 30 días (configurable), para que el ranking no se pueda inflar con cambios constantes.
- Hay límite de intentos por IP, un campo trampa para bots y, opcionalmente, Cloudflare Turnstile.
- Cada socio puede darse de baja desde su carné, y se borra todo lo suyo.
- Las fuentes se sirven desde el propio servidor: la web no llama a Google ni a ningún tercero.

## Contribuir

Ver [CONTRIBUTING.md](CONTRIBUTING.md). Para desplegar, ver [DEPLOY.md](DEPLOY.md).

## Licencia

El código es [MIT](LICENSE). **Los logos, el escudo y la identidad visual de Malos no forman parte de la licencia**: son del equipo.
