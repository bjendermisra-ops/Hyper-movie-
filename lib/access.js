const crypto = require('node:crypto');

const cookieName = '__Host-mandir-admin';
const lifetime = 90 * 24 * 3600;

function equal(a, b) {
  if (!a || !b || typeof a !== 'string' || typeof b !== 'string') return false;
  const digest = value => crypto.createHash('sha256').update(value).digest();
  return crypto.timingSafeEqual(digest(a), digest(b));
}

function signature(expiry) {
  return crypto.createHmac('sha256', process.env.ADMIN_KEY).update('mandir-session:' + expiry).digest('hex');
}

function sameOrigin(req) {
  return req.headers.origin === 'https://' + req.headers.host;
}

function authorized(req) {
  if (!process.env.ADMIN_KEY) return false;
  if (equal(req.headers['x-admin-key'], process.env.ADMIN_KEY)) return true;
  if (!sameOrigin(req)) return false;
  const match = (req.headers.cookie || '').match(/(?:^|;\s*)__Host-mandir-admin=(\d{10})\.([a-f0-9]{64})(?:;|$)/);
  return !!match && Number(match[1]) > Date.now() / 1000 && equal(match[2], signature(match[1]));
}

function startSession(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  if (!sameOrigin(req)) return res.status(403).json({reason:'Origin mismatch: open the panel on its own HTTPS domain.'});
  if (!process.env.ADMIN_KEY || !process.env.ADMIN_INVITE) return res.status(503).json({reason:'Server admin configuration missing (ADMIN_KEY or ADMIN_INVITE).'});
  if (req.body?.action === 'status') return authorized(req) ? res.status(204).end() : res.status(401).json({reason:'Admin session required'});
  if (!equal(req.body?.invite, process.env.ADMIN_INVITE)) return res.status(403).json({reason:'Invalid private admin link or invite.'});
  const expiry = Math.floor(Date.now() / 1000) + lifetime;
  res.setHeader('Set-Cookie', cookieName + '=' + expiry + '.' + signature(expiry) + '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=' + lifetime);
  return res.status(204).end();
}

module.exports = { authorized, startSession };
