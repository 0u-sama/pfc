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

// Function to sync local JSON to Firebase
const syncToFirebase = async (data) => {
  try {
    await currentDataRef.set(data); // Copy the entire local JSON content to Firebase
    console.log('Successfully synced data.json to Firebase');
  } catch (error) {
    console.error('Error syncing to Firebase:', error);
    // Failure to sync doesn’t affect local operation
  }
};

// GET /data.json - Serve the local data.json file
app.get('/data.json', (req, res) => {
  const data = readLocalFile(dataFilePath);
  res.setHeader('Content-Type', 'application/json');
  res.status(200).send(JSON.stringify(data, null, 2));
});

// POST /update - Update sensor data in local JSON first, then sync to Firebase
app.post('/update', (req, res) => {
  const incomingData = req.body;
  const id = incomingData.id;
  if (!id) return res.status(400).send('Missing id in payload');

  // Step 1: Read local JSON first (shift from Firebase-first to local-first)
  let currentLocalData = readLocalFile(dataFilePath);
  const existingData = currentLocalData[id] || {};
  incomingData.new = !existingData.id; // Check local data for 'new' flag
  incomingData.name = existingData.name || '';

  // Remove fireRisk - handled in Local.jsx
  delete incomingData.fireRisk;

  // Step 2: Compare with old data (use local old_data.json instead of Firebase)
  let oldLocalData = readLocalFile(oldDataFilePath);
  const oldClientData = oldLocalData[id] || {};
  const isSame = JSON.stringify(oldClientData) === JSON.stringify(incomingData);

  // Step 3: Update local JSON first
  currentLocalData[id] = incomingData;
  currentLocalData[id].inactive = isSame;
  writeToLocalFile(dataFilePath, currentLocalData);

  // Step 4: Sync the updated local JSON to Firebase
  syncToFirebase(currentLocalData);

  // Step 5: Update Firebase currentData (original behavior) and local old data
  currentDataRef.child(id).set(incomingData, (error) => {
    if (error) {
      console.error('Error updating current data in Firebase:', error);
      // Local update already happened, so no fallback needed here
      console.log(`Updated data for ${id} in local storage (Firebase update failed)`);

      // Update local old data if changed
      if (!isSame) {
        oldLocalData[id] = incomingData;
        writeToLocalFile(oldDataFilePath, oldLocalData);
      }

      res.status(200).send('Data updated (local success, Firebase failed)');
    } else {
      // Firebase update succeeded
      if (!isSame) {
        oldDataRef.child(id).set(incomingData, (error) => {
          if (error) {
            console.error('Error updating old data in Firebase:', error);
          } else {
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

// POST /set-name - Set a name for a sensor (update local JSON first, then sync to Firebase)
app.post('/set-name', (req, res) => {
  const { id, name } = req.body;
  if (!id || !name) return res.status(400).send('Missing id or name');

  let currentLocalData = readLocalFile(dataFilePath);
  if (currentLocalData[id]) {
    currentLocalData[id].name = name;
    currentLocalData[id].new = false;
    writeToLocalFile(dataFilePath, currentLocalData); // Update local JSON first

    // Sync to Firebase
    syncToFirebase(currentLocalData);

    // Original Firebase update
    currentDataRef.child(id).update({ name, new: false }, (error) => {
      if (error) {
        console.error('Error updating name in Firebase:', error);
        console.log(`Set name for ${id} to ${name} (Firebase failed, local success)`);
        res.status(200).send('Name updated (local only due to Firebase failure)');
      } else {
        console.log(`Set name for ${id} to ${name}`);
        res.status(200).send('Name updated');
      }
    });
  } else {
    res.status(404).send('Client ID not found');
  }
});

// DELETE /delete - Delete a sensor (update local JSON first, then sync to Firebase)
app.delete('/delete', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).send('Missing id in payload');

  let currentLocalData = readLocalFile(dataFilePath);
  let oldLocalData = readLocalFile(oldDataFilePath);

  if (currentLocalData[id]) {
    delete currentLocalData[id];
    delete oldLocalData[id];
    writeToLocalFile(dataFilePath, currentLocalData); // Update local JSON first
    writeToLocalFile(oldDataFilePath, oldLocalData);

    // Sync to Firebase
    syncToFirebase(currentLocalData);

    // Original Firebase delete
    const updates = {};
    updates[`currentData/${id}`] = null;
    updates[`oldData/${id}`] = null;

    db.ref().update(updates, (error) => {
      if (error) {
        console.error('Error deleting client in Firebase:', error);
        console.log(`Deleted client ${id} (Firebase failed, local success)`);
        res.status(200).send('Client deleted (local only due to Firebase failure)');
      } else {
        console.log(`Deleted client ${id}`);
        res.status(200).send('Client deleted');
      }
    });
  } else {
    res.status(404).send('Client ID not found');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});