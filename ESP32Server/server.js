const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

// Initialize Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json'); // Path to your downloaded service account key

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://anti-poaching-a00de-default-rtdb.europe-west1.firebasedatabase.app/',
});

const db = admin.database();
const currentDataRef = db.ref('currentData');
const oldDataRef = db.ref('oldData');

// Local JSON file paths
const dataFilePath = path.join(__dirname, 'data.json');
const oldDataFilePath = path.join(__dirname, 'old_data.json');

// Initialize local JSON files if they don’t exist
if (!fs.existsSync(dataFilePath)) {
  fs.writeFileSync(dataFilePath, JSON.stringify({}));
}
if (!fs.existsSync(oldDataFilePath)) {
  fs.writeFileSync(oldDataFilePath, JSON.stringify({}));
}

// Helper function to read local JSON file with error handling
const readLocalFile = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return {};
  }
};

// Helper function to write to local JSON file
const writeToLocalFile = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error writing to ${filePath}:`, err);
  }
};

// GET /data.json - Serve the local data.json file
app.get('/data.json', (req, res) => {
  const data = readLocalFile(dataFilePath);
  res.setHeader('Content-Type', 'application/json');
  res.status(200).send(JSON.stringify(data, null, 2));
});

// POST /update - Update sensor data in both Firebase and local JSON
app.post('/update', (req, res) => {
  const incomingData = req.body;
  const id = incomingData.id;
  if (!id) return res.status(400).send('Missing id in payload');

  // Add new flag and preserve name if first time (check Firebase first)
  currentDataRef.child(id).once('value', (snapshot) => {
    const existingData = snapshot.val() || {};
    incomingData.new = !existingData.id;
    incomingData.name = existingData.name || '';

    // Remove fireRisk - handled in Local.jsx
    delete incomingData.fireRisk;

    // Compare with old data to set inactivity (check Firebase oldData)
    oldDataRef.child(id).once('value', (oldSnapshot) => {
      const oldClientData = oldSnapshot.val() || {};
      const isSame = JSON.stringify(oldClientData) === JSON.stringify(incomingData);

      // Update Firebase current data
      currentDataRef.child(id).set(incomingData, (error) => {
        if (error) {
          console.error('Error updating current data in Firebase:', error);
          // Fallback to local update if Firebase fails
          let currentLocalData = readLocalFile(dataFilePath);
          currentLocalData[id] = incomingData;
          currentLocalData[id].inactive = isSame;
          writeToLocalFile(dataFilePath, currentLocalData);

          // Update local old data if changed
          let oldLocalData = readLocalFile(oldDataFilePath);
          if (!isSame) {
            oldLocalData[id] = incomingData;
            writeToLocalFile(oldDataFilePath, oldLocalData);
          }

          console.log(`Updated data for ${id} (Firebase failed, using local storage)`);
          res.status(200).send('Data updated (local only due to Firebase failure)');
        } else {
          // Firebase update succeeded, now update local JSON
          let currentLocalData = readLocalFile(dataFilePath);
          currentLocalData[id] = incomingData;
          currentLocalData[id].inactive = isSame;
          writeToLocalFile(dataFilePath, currentLocalData);

          // Update old data in Firebase and local JSON if changed
          if (!isSame) {
            oldDataRef.child(id).set(incomingData, (error) => {
              if (error) {
                console.error('Error updating old data in Firebase:', error);
              } else {
                let oldLocalData = readLocalFile(oldDataFilePath);
                oldLocalData[id] = incomingData;
                writeToLocalFile(oldDataFilePath, oldLocalData);
                console.log(`Updated old data for ${id} in Firebase and local storage`);
              }
            });
          } else {
            console.log(`Updated data for ${id} (no change in old data)`);
          }

          res.status(200).send('Data updated');
        }
      });
    });
  });
});

// GET /data - Retrieve current sensor data (Firebase first, fallback to local JSON)
app.get('/data', (req, res) => {
  currentDataRef.once('value', (snapshot) => {
    const data = snapshot.val() || {};
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(data, null, 2));
  }, (error) => {
    console.error('Error reading data from Firebase:', error);
    // Fallback to local JSON
    const data = readLocalFile(dataFilePath);
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(data, null, 2));
  });
});

// POST /set-name - Set a name for a sensor (update both Firebase and local JSON)
app.post('/set-name', (req, res) => {
  const { id, name } = req.body;
  if (!id || !name) return res.status(400).send('Missing id or name');

  currentDataRef.child(id).once('value', (snapshot) => {
    if (snapshot.exists()) {
      currentDataRef.child(id).update({ name, new: false }, (error) => {
        if (error) {
          console.error('Error updating name in Firebase:', error);
          // Fallback to local update
          let currentLocalData = readLocalFile(dataFilePath);
          if (currentLocalData[id]) {
            currentLocalData[id].name = name;
            currentLocalData[id].new = false;
            writeToLocalFile(dataFilePath, currentLocalData);
            console.log(`Set name for ${id} to ${name} (Firebase failed, using local storage)`);
            res.status(200).send('Name updated (local only due to Firebase failure)');
          } else {
            res.status(404).send('Client ID not found');
          }
        } else {
          // Firebase update succeeded, now update local JSON
          let currentLocalData = readLocalFile(dataFilePath);
          if (currentLocalData[id]) {
            currentLocalData[id].name = name;
            currentLocalData[id].new = false;
            writeToLocalFile(dataFilePath, currentLocalData);
            console.log(`Set name for ${id} to ${name}`);
            res.status(200).send('Name updated');
          } else {
            res.status(404).send('Client ID not found');
          }
        }
      });
    } else {
      // Check local JSON as a fallback
      let currentLocalData = readLocalFile(dataFilePath);
      if (currentLocalData[id]) {
        currentLocalData[id].name = name;
        currentLocalData[id].new = false;
        writeToLocalFile(dataFilePath, currentLocalData);
        console.log(`Set name for ${id} to ${name} (Firebase not accessible, using local storage)`);
        res.status(200).send('Name updated (local only)');
      } else {
        res.status(404).send('Client ID not found');
      }
    }
  });
});

// DELETE /delete - Delete a sensor (update both Firebase and local JSON)
app.delete('/delete', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).send('Missing id in payload');

  const updates = {};
  updates[`currentData/${id}`] = null;
  updates[`oldData/${id}`] = null;

  db.ref().update(updates, (error) => {
    if (error) {
      console.error('Error deleting client in Firebase:', error);
      // Fallback to local delete
      let currentLocalData = readLocalFile(dataFilePath);
      let oldLocalData = readLocalFile(oldDataFilePath);
      if (currentLocalData[id]) {
        delete currentLocalData[id];
        delete oldLocalData[id];
        writeToLocalFile(dataFilePath, currentLocalData);
        writeToLocalFile(oldDataFilePath, oldLocalData);
        console.log(`Deleted client ${id} (Firebase failed, using local storage)`);
        res.status(200).send('Client deleted (local only due to Firebase failure)');
      } else {
        res.status(404).send('Client ID not found');
      }
    } else {
      // Firebase delete succeeded, now update local JSON
      let currentLocalData = readLocalFile(dataFilePath);
      let oldLocalData = readLocalFile(oldDataFilePath);
      if (currentLocalData[id]) {
        delete currentLocalData[id];
        delete oldLocalData[id];
        writeToLocalFile(dataFilePath, currentLocalData);
        writeToLocalFile(oldDataFilePath, oldLocalData);
        console.log(`Deleted client ${id}`);
        res.status(200).send('Client deleted');
      } else {
        res.status(404).send('Client ID not found');
      }
    }
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});