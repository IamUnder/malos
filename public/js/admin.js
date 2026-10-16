// Confirmación antes de borrar (sin JavaScript en línea, para que la CSP pueda prohibirlo).
document.addEventListener('submit', (event) => {
  const message = event.target.dataset.confirm;
  if (message && !window.confirm(message)) event.preventDefault();
});

// KDA: al escribir en una fila, se marca sola la casilla "Jugó" de ese jugador.
document.addEventListener('input', (event) => {
  const match = /^(?:champion|k|d|a)_(\d+)$/.exec(event.target.name || '');
  if (!match || !event.target.value.trim()) return;
  const played = document.querySelector(`input[name="played_${match[1]}"]`);
  if (played) played.checked = true;
});
