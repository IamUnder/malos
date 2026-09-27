// Borra TODOS los socios (y sus avisos) y reinicia la numeración para que el siguiente sea el #0001.
// Pensado para el día del lanzamiento: jugadores, partidos y noticias se conservan.
// Uso en el servidor:  docker compose exec web node scripts/reset-members.js --confirmo
import { db } from '../src/db.js';

if (!process.argv.includes('--confirmo')) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM members').get();
  console.log(`Esto borraría ${n} socios y sus suscripciones a avisos. Para hacerlo de verdad, añade --confirmo.`);
  process.exit(0);
}

db.exec('BEGIN');
const { changes } = db.prepare('DELETE FROM members').run(); // las suscripciones se borran en cascada
db.prepare("DELETE FROM settings WHERE key = 'last_member_number'").run();
db.exec('COMMIT');
console.log(`${changes} socios borrados. El próximo socio será el #0001.`);
