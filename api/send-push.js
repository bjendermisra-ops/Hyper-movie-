// api/send-push.js (Zero-Dependency Node.js FCM v1 Gateway)
const crypto = require('crypto');
const analytics = require('../lib/notification-analytics');

const project = { id: 'iskcon-hadapsar-645be', secret: 'HADAPSAR_SERVICE_ACCOUNT' };

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getGoogleAccessToken(account) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const headerB64 = base64url(JSON.stringify(header));
  const claimB64 = base64url(JSON.stringify(claim));
  const signInput = `${headerB64}.${claimB64}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signInput);
  const signatureB64 = signer.sign(account.private_key, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${signInput}.${signatureB64}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    throw new Error(tokenData.error_description || tokenData.error || 'OAuth Token Generation Failed');
  }
  return tokenData.access_token;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, reason: "Method Not Allowed" });

  if (req.body?.app !== undefined && req.body.app !== 'hadapsar') return res.status(400).json({ success: false, reason: 'This sender supports ISKCON Hadapsar only' });

  const { title, body, imageUrl, actionUrl, topic, isLoudAlert } = req.body || {};

  if (typeof title !== "string" || !title.trim()) return res.status(400).json({ success: false, reason: "Missing Title" });
  if (typeof body !== "string" || !body.trim()) return res.status(400).json({ success: false, reason: "Missing Body" });

  const deviceToken = req.body.deviceToken;
  if (deviceToken !== undefined && (typeof deviceToken !== 'string' ||
      !deviceToken.trim() || /\s/.test(deviceToken) || deviceToken.length > 4096)) {
    return res.status(400).json({ success: false, reason: 'Invalid test device token' });
  }
  const receipt = deviceToken ? crypto.randomBytes(6).toString('hex').toUpperCase() : null;
  const messageBody = receipt ? body.trim() + '\nTest code: ' + receipt : body.trim();
  const targetTopic = (!topic || topic === 'all' || topic === 'temple_all') ? 'temple_all' : topic;
  const safeImg = (imageUrl && imageUrl.trim().startsWith('http')) ? imageUrl.trim() : "";
  const safeAction = (actionUrl && actionUrl.trim()) ? actionUrl.trim() : "home.html";
  
  // चेक करें कि क्या यह कोई वेब/यूट्यूब/प्लेस्टोर का लिंक है
  const isExternalUrl = /^https?:\/\//i.test(safeAction);

  let campaign = null;
  let analyticsStatus = 'unavailable';
  async function record(status, extra) {
    if (!campaign) return;
    try { await analytics.finish(campaign.id, status, extra); }
    catch (e) { analyticsStatus = 'history_update_failed'; console.error('notification analytics status unavailable'); }
  }
  try {
    let account;
    try {
      account = JSON.parse(process.env[project.secret] || 'null');
    } catch {
      account = null;
    }
    if (account?.project_id !== project.id || !account.client_email || !account.private_key) {
      return res.status(503).json({ success: false, reason: 'Check server setting ' + project.secret });
    }
    const accessToken = await getGoogleAccessToken(account);

    // 🔥 100% CRASH-PROOF DATA PAYLOAD + अलार्म व एक्सटर्नल लिंक सपोर्ट
    const fcmPayload = {
      message: {
        ...(deviceToken ? { token: deviceToken } : { topic: targetTopic }),
        data: {
          title: title.trim(),
          body: messageBody,
          message: messageBody,
          image: safeImg,
          imageUrl: safeImg,
          img: safeImg,
          // किसी भी लिंक या स्क्रीन के लिए कीवर्ड्स
          page: safeAction,
          url: safeAction,
          link: safeAction,
          target_page: safeAction,
          targetUrl: safeAction,
          is_external: isExternalUrl ? "true" : "false",
          // साइलेंट/म्यूट मोड में ज़ोर से बजने के लिए अलार्म फ्लैग्स
          sound_mode: isLoudAlert ? "alarm" : "default",
          is_urgent: isLoudAlert ? "true" : "false",
          channel_id: isLoudAlert ? "alarm_high_channel" : "general_channel"
        },
        android: {
          restricted_package_name: "bhagwat.gita.hindi.and.marathi.dev.santosh",
          priority: "HIGH"
        }
      }
    };

    // Analytics is best effort: database failures do not cancel a manual send.
    try {
      campaign = await analytics.begin({
        title: title.trim().slice(0, 200), body: body.trim().slice(0, 1000),
        audience: deviceToken ? 'Test phone' : targetTopic, actionUrl: safeAction.slice(0, 1000),
        singleDevice: !!deviceToken
      }, fcmPayload.message.data, deviceToken ? 3800 : 1800);
      Object.assign(fcmPayload.message.data, campaign.fields);
      analyticsStatus = campaign.tracking ? 'enabled' : 'payload_too_large';
    } catch (e) {
      console.error('notification analytics storage unavailable; sending without tracking');
    }

    const fcmRes = await fetch(`https://fcm.googleapis.com/v1/projects/${project.id}/messages:send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fcmPayload)
    });

    const fcmData = await fcmRes.json();
    if (!fcmRes.ok) {
      await record('rejected', {error: String(fcmData.error?.status || 'FCM_API_ERROR').slice(0, 100)});
      return res.status(fcmRes.status).json({
        success: false,
        reason: fcmData.error?.details?.find(item => item.errorCode)?.errorCode || fcmData.error?.status || "FCM_API_ERROR",
        details: fcmData.error?.message || "Google FCM Rejected Message"
      });
    }

    if (!fcmData.name) {
      await record('unknown', {error:'FCM response contained no message ID'});
      return res.status(502).json({ success: false, reason: 'Firebase returned no message ID' });
    }
    await record('accepted', {messageId:fcmData.name});
    return res.status(200).json({
      notificationId: campaign?.id || null,
      analyticsStatus,
      deliveryStatus: 'unconfirmed',
      receiptHash: receipt ? crypto.createHash('sha256').update(receipt).digest('hex') : null,
      success: true,
      messageId: fcmData.name,
      projectId: project.id,
      targetTopic: deviceToken ? 'Test phone' : targetTopic,
      targetLink: safeAction,
      isLoud: !!isLoudAlert,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    await record('unknown', {error:'Send outcome not confirmed'});
    return res.status(500).json({
      success: false,
      reason: "SERVER_EXECUTION_ERROR",
      details: err.message
    });
  }
};
