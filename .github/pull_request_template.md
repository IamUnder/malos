## Qué cambia

<!-- Una o dos frases. Si cierra un issue: "Cierra #123". -->

## Cómo lo has probado

- [ ] `npm test` pasa
- [ ] Lo he probado en local con `npm run dev` (y `npm run seed:demo` si hacía falta)
- [ ] Si toca algo visual: captura en móvil y en escritorio

## Antes de pedir revisión

- [ ] Textos en español y comentarios en español
- [ ] Si cambia la base de datos: migración nueva al final de `src/db.js` (sin editar las anteriores)
- [ ] Si guarda datos nuevos de socios: actualizada la política de privacidad (`src/views/legal.js`)
- [ ] Sin dependencias nuevas, o explicado por qué hacen falta

> Lo que se fusiona en `main` se despliega en malos.es: no hay entorno de pruebas intermedio.
