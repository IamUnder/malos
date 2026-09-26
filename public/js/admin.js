// Confirmación antes de borrar (sin JavaScript en línea, para que la CSP pueda prohibirlo).
document.addEventListener('submit', (event) => {
  const message = event.target.dataset.confirm;
  if (message && !window.confirm(message)) event.preventDefault();
});
