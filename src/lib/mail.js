// Email de confirmación / acceso a la tarjeta. Sin SMTP configurado (desarrollo), el enlace sale por consola.
import nodemailer from 'nodemailer';
import { config } from '../config.js';

const transport = config.mail.enabled
  ? nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.port === 465,
    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
  })
  : null;

export async function sendAccessLink(member) {
  const link = `${config.siteUrl}/socio/${member.access_token}`;
  const first = !member.verified_at;
  const subject = first ? 'Confirma tu email y recibe tu número de socio' : 'Tu tarjeta de socio de Malos';
  const text = [
    `Hola, ${member.nick}:`,
    '',
    first
      ? 'Entra en este enlace para confirmar tu email. Al entrar se te asigna tu número de socio de Malos:'
      : 'Aquí tienes el enlace a tu tarjeta de socio:',
    link,
    '',
    'Guarda este email: el enlace es tu acceso a la tarjeta. No lo compartas.',
    'Si no te has apuntado tú, ignora este mensaje y no pasará nada.',
    '',
    '— Malos',
  ].join('\n');

  if (!transport) {
    console.log(`[mail] (sin SMTP) Para ${member.email}: ${link}`);
    return;
  }
  await transport.sendMail({ from: config.mail.from, to: member.email, subject, text });
}
