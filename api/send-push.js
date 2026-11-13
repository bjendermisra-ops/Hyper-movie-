// api/send-push.js  (Vercel Serverless Function)
// Env vars: FIREBASE_SERVICE_ACCOUNT (poora service-account JSON), ADMIN_KEY
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

module.exports = async (req, res) => {
  if ((req.headers['x-admin-key'] || '') !== (process.env.ADMIN_KEY || '__unset__')) {
    return res.status(401).json({ success: false, reason: 'Unauthorized', details: 'Admin key galat hai.' });
  }
  if (req.method === 'GET') return res.status(200).json({ success: true, status: 'active' });
  if (req.method !== 'POST') return res.status(405).json({ success: false, reason: 'Method not allowed' });

  try {
    const { title, body, imageUrl, actionUrl, actionType, openIn, topic, isLoudAlert, priority } = req.body || {};
    if (!title || !body || !actionUrl || !topic) {
      return res.status(400).json({ success: false, reason: 'Missing fields', details: 'title, body, actionUrl, topic zaroori hain.' });
    }
    if (!/^[a-zA-Z0-9-_.~%]+$/.test(topic)) {
      return res.status(400).json({ success: false, reason: 'Invalid topic' });
    }

    const data = {
      title, body,
      imageUrl: imageUrl || '',
      actionUrl,                      // "dono.html" ya "https://youtube.com/..."
      actionType: actionType || 'web',// page | youtube | web | playstore | whatsapp | phone ...
      openIn: openIn || 'webview',    // webview | external
      isLoud: isLoudAlert ? '1' : '0'
    };
    const high = priority !== 'normal';

    const message = {
      topic,
      data,
      android: { priority: high ? 'high' : 'normal', ttl: 6 * 3600 * 1000 }
    };

    // Loud mode = data-only (app khud alarm-stream me bajata hai).
    // Normal mode = system notification + data.
    if (!isLoudAlert) {
      message.notification = { title, body, ...(imageUrl ? { imageUrl } : {}) };
      message.android.notification = { channelId: 'default_channel', ...(imageUrl ? { imageUrl } : {}) };
    }

    const messageId = await admin.messaging().send(message);
    return res.status(200).json({
      success: true, messageId,
      targetLink: actionUrl, targetTopic: topic, isLoud: !!isLoudAlert
    });
  } catch (err) {
    return res.status(500).json({ success: false, reason: 'FCM error', details: err.message });
  }
};
