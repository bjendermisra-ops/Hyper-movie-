// api/send-push.js (Zero-Dependency Node.js FCM v1 Gateway)
const crypto = require('crypto');

const PROJECT_ID = "radha-krishna-chandra";
const CLIENT_EMAIL = "firebase-adminsdk-fbsvc@radha-krishna-chandra.iam.gserviceaccount.com";

const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDSEGaufyvrNXMz
ZDCkqzStfkDLjBd1UI7iNBxvYDybk/2WioQ4PZ0gMZnnnRGbn8JUkuQOlPrF86gr
+uf7zdz5DdiAX0zYtdjiGB3/HqOWE+7/18zEKtFsNrRkiVArHgaK38ZY/piTT4JX
h9syq5gLz+ZxotRbzfrI9VzjpoYlb72K0BKlTOLoipj2ikBWmvji0h0WE9q1mm5M
HE4L22aqi7vE5Kz7jOENoJSXG/jLq8DjwAxFqfcmpZF5M6eO8Jlg5Mjpduz7EtpQ
WY1lCqWG28gWuQag1SB7MYoZt1tkclElDeo2/qxES2Ap1qm+RhwHwcUFM3wcqcA+
1wMHNh3LAgMBAAECggEABqY7QdnHr53VBDLvMT80HyvIbEkGcxG2PCXPIp1mvbv9
AndnAQq+Pwci6oh3xrfTZG7z5hxEJeD1GVNLZZaaII4WJNYfbhqvf1SpGmrDXdxK
q/GOS0VZtLW0lxwbnAnKxjmYIzgH513Ub+Xeg+eXnAQcNMulMjS+c/8ETjZ2t5eX
tcb5m9XXEKX9UeUDHE7mmf5HYGHE9QZ4f4f/icw1zhWpT5e7/6p9BBP+a70Qoq2n
fI4QHcQKv08shYCd2IHCowiLVjiT14J8D61NUG+6uZlhcmH4rahCnxOjfKoDg1Q5
FKfEpbvRiEge9RFLP9HJUZABfRss+M53iBgOWGYa0QKBgQDvBVBw1WmoNI82eyzD
5t1CUBC7QtUdEVjsYfVK5BSeKZN4G9GwRxFdrzYgcClHd3UkaCoUDeB9zHQVjZEt
9G+eO0M73oWOVyWwSmMed0pvpIRad5GQqZYDotzh5F4j1ZROTsneLdN4xcfKQ+aQ
1G8i/eS4q2tZljnD7gRFx3R02wKBgQDg/H+F0qumAOrKdqKHkKBqghxYrGqxNAeR
F8/hjZ19/loDNm1OmGjrJIncJwLvjkztSTsvdkVuU3pAS4B/BJ4WItUGr4L6TYD+
EmGr++AHUhHyTzLuBXILN++kxwajbpFzVYNgkRoD6O4tKtPcTvbbAiwktYME+ObH
/DgvJ+JV0QKBgQCkVdAHtANv3as1dxzBGEK57BiE15902896vqMKuaQfVlCI/P9/
pm0fL28UgGkxNMW6oU+E+EGH3IFXrDzMDsqLTQ2d5RGIWwyTl6FsefIYrlE9bgYM
Izz8BQa+3OeI1big2nTaqEFEQR9rRqIIo7ZBpbSS73DgaHQQ7N3NKCQ+jwKBgBU+
Qhw0pBhshb7QLNB4C22DE4Ib5YcNzpkYknxNjs1SstUS0odVRLLPJGUxGcncuc69
12TH2g5su2JOvrc/jF2ytEKJV+iiYMecnLRMd/649RDYAYsP4JDGm04HrMzJp9on
/NulV7t+xt5k6NQocI6FSf29Vb2mcsP3QKbTMT/BAoGAKS1m9O9apCH8OGoOTDAz
cbfuFkJ4yBVxt1Vnx/YV/vvS5o6Ql6fyOWWNVU6VvfFS5Jzd7ZsKqj/yFfhzlHZk
p8hPzFj2HNPqAkfwfiovW+RBU0+kv+J/Qki/rU5FGjrwWoiCleJOCQx3KO3PtXZv
cZt3B8KUOXx9IRKiJ9c4CYo=
-----END PRIVATE KEY-----`;

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getGoogleAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: CLIENT_EMAIL,
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
  const signatureB64 = signer.sign(PRIVATE_KEY, 'base64')
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, reason: "Method Not Allowed" });

  const { title, body, imageUrl, actionUrl, topic } = req.body || {};

  if (!title || !title.trim()) return res.status(400).json({ success: false, reason: "Missing Title" });
  if (!body || !body.trim()) return res.status(400).json({ success: false, reason: "Missing Body" });

  const targetTopic = (!topic || topic === 'all' || topic === 'temple_all') ? 'temple_all' : topic;
  const safeImg = (imageUrl && imageUrl.trim().startsWith('http')) ? imageUrl.trim() : "";
  const safeAction = (actionUrl && actionUrl.trim()) ? actionUrl.trim() : "index.html";

  try {
    const accessToken = await getGoogleAccessToken();

    // Data-First Payload (भुवैकुण्ठ की तरह जो 100% ऑन-स्क्रीन पॉपअप लाता है)
    const fcmPayload = {
      message: {
        topic: targetTopic,
        notification: {
          title: title.trim(),
          body: body.trim(),
          ...(safeImg ? { image: safeImg } : {})
        },
        data: {
          title: title.trim(),
          body: body.trim(),
          message: body.trim(),
          image: safeImg,
          imageUrl: safeImg,
          img: safeImg,
          page: safeAction,
          url: safeAction,
          target_page: safeAction,
          targetUrl: safeAction
        },
        android: {
          priority: "HIGH",
          notification: {
            channel_id: "padyatra_loud_v5",
            notification_priority: "PRIORITY_MAX",
            default_sound: true,
            default_vibrate_timings: true,
            ...(safeImg ? { image: safeImg } : {})
          }
        }
      }
    };

    const fcmRes = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fcmPayload)
    });

    const fcmData = await fcmRes.json();
    if (!fcmRes.ok) {
      return res.status(fcmRes.status).json({
        success: false,
        reason: fcmData.error?.status || "FCM_API_ERROR",
        details: fcmData.error?.message || "Google FCM Rejected Message"
      });
    }

    return res.status(200).json({
      success: true,
      messageId: fcmData.name,
      targetTopic: targetTopic,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      reason: "SERVER_EXECUTION_ERROR",
      details: err.message
    });
  }
};
