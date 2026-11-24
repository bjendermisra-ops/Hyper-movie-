(() => {
  const invite = new URLSearchParams(location.hash.slice(1)).get('invite');
  if (invite) history.replaceState(null, '', location.pathname + location.search);
  const ready = invite ? fetch('/api/admin-session', {
    method:'POST', credentials:'same-origin', cache:'no-store',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({invite})
  }).then(r=>r.ok).catch(()=>false) : Promise.resolve(true);

  document.addEventListener('DOMContentLoaded', () => {
    const original = window.handleSendPush;
    if(typeof original !== 'function') return;
    let busy = false;
    window.handleSendPush = async function(event) {
      event.preventDefault();
      if(busy) return;
      busy = true;
      const button = document.getElementById('submitBtn');
      if(button) button.disabled = true;
      try {
        await ready;
        await original(event);
      } finally {
        busy = false;
        if(button) button.disabled = false;
      }
    };
  });
})();
