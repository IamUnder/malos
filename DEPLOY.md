# Despliegue — malos.es

Guía para quien despliega (Jorge o la sesión de PortLedger). Sigue el mismo patrón que el resto de proyectos del servidor: checkout del repo, `docker compose up -d --build` y tráfico público por Cloudflare Tunnel.

## Entornos

| Entorno | Carpeta | Hostname | `COMPOSE_PROJECT_NAME` = `WEB_ALIAS` | `TUNNEL_NETWORK` | `TEST_MODE` |
|---|---|---|---|---|---|
| Pruebas (actual) | `/home/under/malos-web-test` | `malos.es` y `test.kaizogroup.es` | `malos-web-test` | `malos-web-test-net` | `true` |
| Producción (en el lanzamiento) | `/home/under/malos-web` | `malos.es` | `malos-web` | `malos-web-net` | `false` |

De momento `malos.es` apunta al entorno de pruebas (con `SITE_URL=https://malos.es` y `TEST_MODE=true`), hasta la presentación oficial.
El túnel que sirve estos dominios es `kaizenfit-tunnel`; `kaizogroup-tunnel` no se usa.

**Lanzamiento:** basta con poner `TEST_MODE=false` y recrear el contenedor. Antes, borra los socios de prueba y reinicia la numeración (jugadores, partidos y noticias se conservan):
```bash
docker compose exec web node scripts/reset-members.js            # dice cuántos borraría
docker compose exec web node scripts/reset-members.js --confirmo  # los borra; el siguiente socio es el #0001
```

Con `TEST_MODE=true` la web no se indexa, enseña una franja roja de "entorno de pruebas" y, mientras no haya SMTP, muestra el enlace de confirmación en pantalla. Así se puede probar el alta sin email. **Nunca en producción.**
Pruebas y producción tienen que usar **claves VAPID y `SESSION_SECRET` distintos**.

La plantilla inicial (los 5 de LoL, en `src/roster.js`) se carga sola la primera vez que arranca con la base de datos vacía.

## Qué se despliega

| Servicio | Imagen | Notas |
|---|---|---|
| `web` | Build local (`Dockerfile`, unos 180 MB) | Node 24 + SQLite integrado. Puerto interno 3000. Sin puertos publicados. |

- **Límite de memoria:** 192 MB. En reposo usa unos 35 MB.
- **Volumen:** `data`, que contiene `/app/data/malos.db` (socios, jugadores, partidos, noticias y suscripciones push). **Tiene que ir en las copias.**
- **No hay base de datos aparte:** SQLite es un archivo dentro del volumen.

## Primer despliegue

1. **Código**
   ```bash
   git clone <repo> /home/under/malos-web
   cd /home/under/malos-web
   ```

2. **`.env`**, a partir de `.env.example`:
   ```dotenv
   SITE_URL=https://malos.es
   SESSION_SECRET=<openssl rand -hex 32>
   ADMIN_PASSWORD=<contraseña larga>

   VAPID_PUBLIC_KEY=<npx web-push generate-vapid-keys>
   VAPID_PRIVATE_KEY=<ídem>
   VAPID_SUBJECT=mailto:hola@malos.es

   SMTP_HOST=...        # p. ej. Resend: smtp.resend.com, puerto 465, usuario "resend", la API key como contraseña
   SMTP_PORT=465
   SMTP_USER=...
   SMTP_PASS=...
   MAIL_FROM=Malos <socios@malos.es>

   TEST_MODE=false      # true mientras sea el entorno de pruebas
   KOFI_URL=https://ko-fi.com/<usuario>
   REPO_URL=https://github.com/<usuario>/malos
   LEGAL_OWNER=<nombre del responsable>
   LEGAL_EMAIL=hola@malos.es

   COMPOSE_PROJECT_NAME=malos-web
   TUNNEL_NETWORK=malos-web-net
   WEB_ALIAS=malos-web
   ```
   ⚠️ **Guarda las claves VAPID en un sitio seguro.** Si se pierden o se cambian, todas las suscripciones a avisos dejan de funcionar y cada socio tendría que volver a activarlos.

   Para generar las claves sin instalar nada en el servidor:
   ```bash
   docker run --rm node:24-alpine npx -y web-push generate-vapid-keys
   ```

3. **Arrancar**
   ```bash
   docker compose up -d --build
   docker compose ps          # web en "healthy"
   ```
   Las migraciones de base de datos se aplican solas al arrancar.

4. **Túnel de Cloudflare.** Conecta cloudflared a la red del proyecto (la crea el compose) y añade la regla:
   ```bash
   docker network connect malos-web-net <contenedor-cloudflared-de-malos.es>
   ```
   ```
   malos.es      ->  http://malos-web:3000
   www.malos.es  ->  redirección a malos.es
   ```

5. **DNS del email.** Si se usa Resend u otro proveedor, añade en Cloudflare los registros SPF, DKIM y DMARC que indique para `malos.es`. Sin ellos, los correos de confirmación acaban en spam.

6. **Revisar el contenido.** La plantilla se carga sola. Entra en `https://malos.es/admin` para añadir los partidos y retocar jugadores si hace falta.
   No ejecutes `seed:demo` en producción: se niega a hacerlo con `NODE_ENV=production`.

7. **Comprobar**
   - `https://malos.es/api/health` devuelve `{"status":"ok"}`.
   - Apuntarse con un email real: llega el correo, el enlace da el número de socio `#0001` y el socio sale en el ranking.
   - En el carné, **Activar avisos**. Después, publicar una noticia de prueba con aviso desde el panel: tiene que llegar la notificación.

8. **Copias (PortLedger / restic)**, diarias. Tipo `CONTAINER_PATH`, contenedor `malos-web-web-1`, ruta `/app/data`.
   Para una copia consistente de SQLite en caliente:
   ```bash
   docker compose exec web node -e "new (require('node:sqlite').DatabaseSync)('/app/data/malos.db').exec(\"VACUUM INTO '/app/data/backup.db'\")"
   ```

## Publicar una versión nueva

```bash
cd /home/under/malos-web
git pull
docker compose up -d --build
```

Las migraciones nuevas se aplican solas al arrancar. Para volver atrás: `git checkout <commit-anterior> && docker compose up -d --build`. Las migraciones no se deshacen solas, así que avisa antes de revertir una versión que las incluya.

Como el compose está en la raíz del repo, el botón **Deploy** de PortLedger debería funcionar directamente.

## Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `SITE_URL` | Sí | URL pública sin barra final. |
| `SESSION_SECRET` | Sí | Firma la sesión del panel y los códigos de comprobación de carné. **No cambiarla**: los enlaces `/s/...` ya repartidos dejarían de funcionar. |
| `ADMIN_PASSWORD` | Sí | Contraseña del panel. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | No | Claves de los avisos push. Sin ellas no se mandan avisos. |
| `VAPID_SUBJECT` | No | Contacto que se envía a los servicios push (`mailto:`). |
| `SMTP_*`, `MAIL_FROM` | No | Envío de emails. Sin SMTP, los enlaces solo salen en el log. |
| `TEST_MODE` | No | `true` en el entorno de pruebas (ver arriba). |
| `KOFI_URL` | No | Enlace de donaciones. |
| `REPO_URL` | No | Enlace al código, sale en el pie. |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET` | No | Anti-bots de Cloudflare en el alta. |
| `FAVORITE_COOLDOWN_DAYS` | No | Días entre cambios de favorito (30 por defecto). |
| `LEGAL_OWNER` / `LEGAL_EMAIL` | Recomendada | Responsable que aparece en privacidad y aviso legal. |
| `COMPOSE_PROJECT_NAME`, `TUNNEL_NETWORK`, `WEB_ALIAS` | Sí (servidor) | Nombre del proyecto Docker, red del túnel y alias del servicio. |

## Antes de abrirlo al público

- [ ] Permiso del club para usar el nombre y los logos de Malos.
- [ ] Permiso de los jugadores para salir en la web y en el ranking.
- [ ] `LEGAL_OWNER` y `LEGAL_EMAIL` rellenados, y los textos de `/privacidad` y `/aviso-legal` revisados.
- [ ] SMTP configurado y probado (con SPF y DKIM).
- [ ] Claves VAPID generadas y guardadas fuera del servidor.
