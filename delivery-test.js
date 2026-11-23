function testToken() {
  return document.getElementById('testDevice').value.trim() || undefined;
}

function offerReceipt(host, data, confirmed) {
  if (!data.receiptHash || !host) return;
  const label = document.createElement('label');
  label.textContent = 'टेस्ट फोन की सूचना में दिखा कोड डालें ';
  const input = document.createElement('input');
  input.maxLength = 12;
  input.autocomplete = 'off';
  label.append(input);
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'कोड जाँचें';
  const feedback = document.createElement('span');
  feedback.setAttribute('role', 'status');
  button.onclick = async () => {
    const code = input.value.trim().toUpperCase();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
    const actual = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    if (actual !== data.receiptHash) {
      feedback.textContent = 'कोड मेल नहीं खाता।';
      return;
    }
    label.remove(); button.remove(); feedback.remove();
    host.textContent = 'एक टेस्ट फोन पर कोड सत्यापित हुआ।';
    confirmed();
  };
  host.append(document.createElement('br'), label, button, feedback);
}
