// Textos legales. Son una base razonable para una web de fans sin ánimo de lucro: revísalos
// (y rellena LEGAL_OWNER / LEGAL_EMAIL) antes de abrir la web al público.
import { config } from '../config.js';

const { owner, contactEmail } = config.legal;
const domain = config.siteUrl.replace(/^https?:\/\//, '');

export const privacy = `
<p class="eyebrow">Última actualización: 27 de septiembre de 2026</p>
<h2>Política de privacidad</h2>
<p>Esta web es un club de fans gratuito de Malos. Recogemos lo mínimo para darte tu carné de socio y avisarte de los partidos.</p>

<h2>Quién es el responsable</h2>
<p>${owner}. Contacto: <a href="mailto:${contactEmail}">${contactEmail}</a>.</p>

<h2>Qué datos guardamos y para qué</h2>
<ul>
  <li><b>Nick</b>: sale en tu carné y en la comprobación de carné.</li>
  <li><b>Email</b>: para confirmar que eres tú y mandarte el enlace a tu carné. No enviamos publicidad por email.</li>
  <li><b>Jugador favorito</b>: para el ranking de fans. En el ranking solo se publican totales, nunca quién ha votado a quién.</li>
  <li><b>Votos de MVP y fraude</b> de cada partido: se publican solo los totales, nunca quién ha votado a quién.</li>
  <li><b>Suscripción a avisos</b> (solo si los activas): la dirección técnica que da tu navegador para recibir notificaciones.</li>
</ul>
<p>No pedimos DNI, teléfono, dirección ni fecha de nacimiento.</p>

<h2>Base legal</h2>
<p>Tu consentimiento, que das al apuntarte y al activar los avisos. Puedes retirarlo cuando quieras.</p>

<h2>Edad mínima</h2>
<p>Para hacerte socio necesitas tener ${config.minAge} años o más (art. 7 de la Ley Orgánica 3/2018).</p>

<h2>Cuánto tiempo los guardamos</h2>
<p>Mientras seas socio. Si te das de baja, se borran al momento. Las altas que no se confirman se borran a los 7 días.</p>

<h2>Con quién se comparten</h2>
<p>Con nadie para fines propios. Para funcionar, la web usa estos proveedores:</p>
<ul>
  <li>Cloudflare, que hace llegar el tráfico a la web.</li>
  <li>El servicio de email que envía los mensajes de confirmación.</li>
  <li>El servicio de notificaciones de tu navegador (Google, Apple o Mozilla), solo si activas los avisos. Solo recibe el texto del aviso.</li>
</ul>

<h2>Tus derechos</h2>
<p>Puedes ver tus datos en tu carné, cambiar tu favorito y darte de baja desde la misma página. Para cualquier otra cosa (acceso, rectificación, supresión, oposición o portabilidad) escribe a <a href="mailto:${contactEmail}">${contactEmail}</a>. Si crees que no hemos tratado bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).</p>

<h2>Cookies</h2>
<p>No usamos cookies de publicidad ni de analítica. Solo hay dos cookies técnicas, necesarias para que la web funcione y que por eso no requieren consentimiento: <b>malos_socio</b>, que recuerda tu carné en ese dispositivo durante un año para no pedirte el email cada vez (se borra con «Olvidar este dispositivo» o al darte de baja), y <b>malos_admin</b>, la sesión del panel de administración.</p>
`;

export const legalNotice = `
<h2>Aviso legal</h2>
<p>En cumplimiento de la Ley 34/2002 de Servicios de la Sociedad de la Información (LSSI):</p>
<ul>
  <li>Titular del sitio web ${domain}: ${owner}.</li>
  <li>Contacto: <a href="mailto:${contactEmail}">${contactEmail}</a>.</li>
</ul>
<p>Es una web de fans sin ánimo de lucro. Hacerse socio es gratis. Las aportaciones voluntarias se usan solo para pagar el dominio y el servidor.</p>
<p>Los nombres, imágenes y logotipos de los jugadores y del equipo se usan con su permiso. Las marcas de terceros que puedan aparecer pertenecen a sus dueños.</p>
<p>Malos no está respaldado por Riot Games y no refleja las opiniones de Riot Games ni de nadie implicado oficialmente en la producción o gestión de League of Legends. League of Legends y Riot Games son marcas comerciales o marcas registradas de Riot Games, Inc. Los iconos de campeones son © Riot Games, Inc.</p>
<p>El código de la web es abierto. Los logotipos y la identidad visual de Malos no forman parte de esa licencia.</p>
`;
