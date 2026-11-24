(() => {
  const invite = new URLSearchParams(location.hash.slice(1)).get('invite');
  if (!invite) return;
  history.replaceState(null, '', location.pathname + location.search);
  const ready = fetch('/api/admin-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invite })
  }).then(result => result.ok).catch(() => false);
  document.addEventListener('DOMContentLoaded', async () => {
    const button = document.querySelector('button[type="submit"]');
    button.disabled = true;
    if (!await ready) {
      const message = document.createElement('p');
      message.setAttribute('role', 'alert');
      message.textContent = 'एडमिन लिंक खुल नहीं पाया। अपना निजी लिंक दोबारा खोलें।';
      button.before(message);
    }
    button.disabled = false;
  });
})();
