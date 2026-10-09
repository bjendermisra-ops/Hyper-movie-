// api/send-push.js
import admin from 'firebase-admin';

const serviceAccount = {
  type: "service_account",
  project_id: "radha-krishna-chandra",
  private_key_id: "b8d7808be5954d7bf836a2713c60b9eb0aa92f46",
  private_key: process.env.FIREBASE_PRIVATE_KEY 
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDSEGaufyvrNXMz\nZDCkqzStfkDLjBd1UI7iNBxvYDybk/2WioQ4PZ0gMZnnnRGbn8JUkuQOlPrF86gr\n+uf7zdz5DdiAX0zYtdjiGB3/HqOWE+7/18zEKtFsNrRkiVArHgaK38ZY/piTT4JX\nh9syq5gLz+ZxotRbzfrI9VzjpoYlb72K0BKlTOLoipj2ikBWmvji0h0WE9q1mm5M\nHE4L22aqi7vE5Kz7jOENoJSXG/jLq8DjwAxFqfcmpZF5M6eO8Jlg5Mjpduz7EtpQ\nWY1lCqWG28gWuQag1SB7MYoZt1tkclElDeo2/qxES2Ap1qm+RhwHwcUFM3wcqcA+\n1wMHNh3LAgMBAAECggEABqY7QdnHr53VBDLvMT80HyvIbEkGcxG2PCXPIp1mvbv9\nAndnAQq+Pwci6oh3xrfTZG7z5hxEJeD1GVNLZZaaII4WJNYfbhqvf1SpGmrDXdxK\nq/GOS0VZtLW0lxwbnAnKxjmYIzgH513Ub+Xeg+eXnAQcNMulMjS+c/8ETjZ2t5eX\ntcb5m9XXEKX9UeUDHE7mmf5HYGHE9QZ4f4f/icw1zhWpT5e7/6p9BBP+a70Qoq2n\nfI4QHcQKv08shYCd2IHCowiLVjiT14J8D61NUG+6uZlhcmH4rahCnxOjfKoDg1Q5\nFKfEpbvRiEge9RFLP9HJUZABfRss+M53iBgOWGYa0QKBgQDvBVBw1WmoNI82eyzD\n5t1CUBC7QtUdEVjsYfVK5BSeKZN4G9GwRxFdrzYgcClHd3UkaCoUDeB9zHQVjZEt\n9G+eO0M73oWOVyWwSmMed0pvpIRad5GQqZYDotzh5F4j1ZROTsneLdN4xcfKQ+aQ\n1G8i/eS4q2tZljnD7gRFx3R02wKBgQDg/H+F0qumAOrKdqKHkKBqghxYrGqxNAeR\nF8/hjZ19/loDNm1OmGjrJIncJwLvjkztSTsvdkVuU3pAS4B/BJ4WItUGr4L6TYD+\nEmGr++AHUhHyTzLuBXILN++kxwajbpFzVYNgkRoD6O4tKtPcTvbbAiwktYME+ObH\n/DgvJ+JV0QKBgQCkVdAHtANv3as1dxzBGEK57BiE15902896vqMKuaQfVlCI/P9/\npm0fL28UgGkxNMW6oU+E+EGH3IFXrDzMDsqLTQ2d5RGIWwyTl6FsefIYrlE9bgYM\nIzz8BQa+3OeI1big2nTaqEFEQR9rRqIIo7ZBpbSS73DgaHQQ7N3NKCQ+jwKBgBU+\nQhw0pBhshb7QLNB4C22DE4Ib5YcNzpkYknxNjs1SstUS0odVRLLPJGUxGcncuc69\n12TH2g5su2JOvrc/jF2ytEKJV+iiYMecnLRMd/649RDYAYsP4JDGm04HrMzJp9on\n/NulV7t+xt5k6NQocI6FSf29Vb2mcsP3QKbTMT/BAoGAKS1m9O9apCH8OGoOTDAz\ncbfuFkJ4yBVxt1Vnx/YV/vvS5o6Ql6fyOWWNVU6VvfFS5Jzd7ZsKqj/yFfhzlHZk\np8hPzFj2HNPqAkfwfiovW+RBU0+kv+J/Qki/rU5FGjrwWoiCleJOCQx3KO3PtXZv\ncZt3B8KUOXx9IRKiJ9c4CYo=\n-----END PRIVATE KEY-----",
  client_email: "firebase-adminsdk-fbsvc@radha-krishna-chandra.iam.gserviceaccount.com"
};

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (initErr) {
    console.error("Firebase Admin Init Error:", initErr);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      reason: "Method Not Allowed", 
      details: "कृपया केवल POST अनुरोध भेजें।" 
    });
  }

  const { title, body, imageUrl, actionUrl, topic } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ 
      success: false, 
      reason: "Missing Title", 
      details: "नोटिफिकेशन का शीर्षक (Title) खाली नहीं हो सकता।" 
    });
  }

  if (!body || !body.trim()) {
    return res.status(400).json({ 
      success: false, 
      reason: "Missing Body", 
      details: "नोटिफिकेशन का संदेश (Body) खाली नहीं हो सकता।" 
    });
  }

  const targetTopic = (!topic || topic === 'all') ? 'all' : topic;

  // पेलोड निर्माण
  const message = {
    topic: targetTopic,
    notification: {
      title: title.trim(),
      body: body.trim(),
      ...(imageUrl && imageUrl.trim().startsWith("http") ? { imageUrl: imageUrl.trim() } : {})
    },
    data: {
      title: title.trim(),
      body: body.trim(),
      message: body.trim(),
      ...(imageUrl && imageUrl.trim().startsWith("http") ? { 
          imageUrl: imageUrl.trim(),
          image: imageUrl.trim(),
          img: imageUrl.trim()
      } : {}),
      ...(actionUrl && actionUrl.trim() ? { 
          targetUrl: actionUrl.trim(),
          link: actionUrl.trim(),
          url: actionUrl.trim()
      } : {})
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'radha_krishna_chandra_channel',
        priority: 'max',
        defaultSound: true,
        defaultVibrateTimings: true,
        ...(imageUrl && imageUrl.trim().startsWith("http") ? { imageUrl: imageUrl.trim() } : {})
      }
    }
  };

  try {
    const fcmResponse = await admin.messaging().send(message);
    return res.status(200).json({ 
      success: true, 
      messageId: fcmResponse,
      targetTopic: targetTopic,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("FCM Send Error:", error);

    // कारण का विस्तृत विश्लेषण
    let diagnosis = "अज्ञात त्रुटि।";
    if (error.code === 'messaging/invalid-payload') {
      diagnosis = "पेलोड अमान्य है। इमेज का लिंक या डेटा फ़ील्ड बहुत बड़ा या गलत फ़ॉर्मेट में है।";
    } else if (error.code === 'messaging/invalid-argument') {
      diagnosis = "विषय (Topic) या पैरामीटर में अमान्य वर्ण (Characters) हैं।";
    } else if (error.code === 'app/network-timeout' || error.code === 'ETIMEDOUT') {
      diagnosis = "गूगल FCM सर्वर से टाइमआउट हो गया। कृपया 10 सेकंड बाद पुनः प्रयास करें।";
    } else if (error.message && error.message.includes("credential")) {
      diagnosis = "Firebase Private Key या Service Account अमान्य अथवा समाप्त (Revoked) हो गया है।";
    }

    return res.status(500).json({ 
      success: false, 
      reason: error.code || "FCM_SEND_FAILED",
      details: error.message,
      diagnosis: diagnosis,
      timestamp: new Date().toISOString()
    });
  }
}
