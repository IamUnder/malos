# Contribuir

¡Gracias por echar una mano! Algunas normas para que el proyecto siga siendo fácil de mantener.

## Cómo proponer un cambio

1. Abre un *issue* contando qué quieres cambiar, salvo que sea un arreglo pequeño.
2. Haz un fork y crea una rama: `git checkout -b arreglo/lo-que-sea`.
3. Comprueba que `npm test` pasa y que la web funciona en local (`npm run dev`).
4. Abre un *pull request* explicando qué cambia y cómo lo has probado. Si toca algo visual, añade una captura.

## Principios del proyecto

- **Ligero ante todo.** Corre en un servidor casero junto a otros servicios. Antes de añadir una dependencia, pregúntate si se puede hacer con Node o con el navegador. Nada de frameworks de frontend ni pasos de build.
- **Datos mínimos.** No se piden más datos personales de los necesarios. Cualquier dato nuevo de los socios tiene que actualizar también la política de privacidad (`src/views/legal.js`).
- **Todo en español**, tanto los textos de la web como los comentarios del código.
- **Los cambios de base de datos van como migración nueva** al final del array de `src/db.js`. Nunca se edita una migración que ya está publicada.
- **Todo lo opcional tiene que poder desactivarse.** Si falta una variable de entorno, la web sigue funcionando sin esa parte.

## Estilo de código

- JavaScript moderno con módulos ES (`import`/`export`), sin TypeScript.
- 2 espacios, comillas simples, punto y coma.
- Las consultas SQL viven en `src/data.js`; las rutas no tocan la base de datos directamente.
- Las plantillas usan `html` de `hono/html`, que escapa las variables solo. No uses `raw()` con datos que vengan de usuarios.
- En el HTML no hay JavaScript en línea (`onclick`, `<script>` sin `src`): la CSP lo prohíbe.

## Identidad visual

Los colores y tipografías están definidos como variables al principio de `public/css/site.css`. Mostaza, tinta y blanco son la base; el azul y el rojo de la "L" de prácticas son acentos y se usan con moderación.
