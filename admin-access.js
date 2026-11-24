(() => {
  const invite = new URLSearchParams(location.hash.slice(1)).get('invite');
  if (invite) history.replaceState(null, '', location.pathname + location.search);
  async function session(body) {
    try {
      const response = await fetch('/api/admin-session', {method:'POST', credentials:'same-origin', cache:'no-store', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
      if (response.ok) return {ok:true};
      const data = await response.json().catch(()=>({}));
      return {ok:false, reason:data.reason || 'Admin session HTTP '+response.status};
    } catch(e) { return {ok:false, reason:'Network error: '+e.message}; }
  }
  const ready = (async()=>{
    if(invite) {
      const result=await session({invite});
      if(!result.ok) return result;
    }
    return session({action:'status'});
  })();
  document.addEventListener('DOMContentLoaded', async () => {
    const form=document.getElementById('pushForm');
    const button=document.getElementById('submitBtn');
    if(!form || !button) return;
    const panel=document.createElement('section');
    panel.style.cssText='padding:12px;margin-bottom:16px;border:1px solid #51645b;border-radius:12px';
    panel.setAttribute('aria-label','Admin access');
    const status=document.createElement('div');
    status.setAttribute('role','status');
    const input=document.createElement('input');
    input.type='password'; input.autocomplete='off'; input.placeholder='Private admin invite'; input.className='custom-input'; input.style.margin='8px 0';
    const unlock=document.createElement('button');
    unlock.type='button'; unlock.className='send-btn'; unlock.textContent='एडमिन एक्सेस सक्रिय करें';
    panel.append(status,input,unlock); form.before(panel);
    let authorized=false;
    function show(result) {
      authorized=result.ok; button.disabled=!authorized;
      status.textContent=authorized?'✓ Admin connected · Ready to send':result.reason+' — अपना निजी एडमिन लिंक या invite इस्तेमाल करें।';
      input.hidden=unlock.hidden=authorized;
    }
    button.disabled=true; status.textContent='Checking admin access…'; input.hidden=unlock.hidden=true;
    show(await ready);
    unlock.onclick=async()=>{
      if(!input.value.trim()) {status.textContent='अपना निजी invite डालें।';return;}
      unlock.disabled=true;
      const result=await session({invite:input.value.trim()});
      input.value='';
      show(result.ok?await session({action:'status'}):result);
      unlock.disabled=false;
    };
    form.addEventListener('submit',async e=>{
      if(!authorized){e.preventDefault();e.stopImmediatePropagation();}
    },true);
    const original=window.handleSendPush;
    if(typeof original==='function') window.handleSendPush=async function(e){
      e.preventDefault();
      if(!authorized)return;
      button.disabled=true;
      const result=await session({action:'status'});
      show(result);
      if(result.ok) await original(e);
    };
  });
})();
