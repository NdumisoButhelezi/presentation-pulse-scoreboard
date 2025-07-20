const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const path = require('path');

const serviceAccount = require(path.join(__dirname, 'presentscore-5068b-firebase-adminsdk-fbsvc-36b665d292.json'));

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


