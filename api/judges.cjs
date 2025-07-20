require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

// Build service account from env vars
const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const app = express();
app.use(cors());

async function getJudgeProfile(uid) {
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) return {};
  const data = userDoc.data();
  return {
    name: data.name || '',
    assignedRooms: data.assignedRooms || [],
  };
}

app.get('/api/judges', async (req, res) => {
  try {
    const judges = [];
    let nextPageToken;
    do {
      const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);
      for (const userRecord of listUsersResult.users) {
        if (userRecord.email) {
          const userDoc = await db.collection('users').doc(userRecord.uid).get();
          if (userDoc.exists && userDoc.data().role === 'judge') {
            const { name, assignedRooms } = await getJudgeProfile(userRecord.uid);
            judges.push({
              id: userRecord.uid,
              email: userRecord.email,
              name,
              assignedRooms,
            });
          }
        }
      }
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);

    res.json(judges);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch judges' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Judge API running on port ${PORT}`);
});
module.exports = app;


