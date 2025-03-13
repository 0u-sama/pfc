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
const historyRef = db.ref('history'); // New reference for historical data

// Local JSON file paths
const dataFilePath = path.join(__dirname, 'data.json');
const oldDataFilePath = path.join(__dirname, 'old_data.json');
const historyFilePath = path.join(__dirname, 'history.json'); // New file for historical data

// Initialize local JSON files if they don't exist
if (!fs.existsSync(dataFilePath)) {
  fs.writeFileSync(dataFilePath, JSON.stringify({}));
}
if (!fs.existsSync(oldDataFilePath)) {
  fs.writeFileSync(oldDataFilePath, JSON.stringify({}));
}
if (!fs.existsSync(historyFilePath)) {
  fs.writeFileSync(historyFilePath, JSON.stringify({}));
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
const syncToFirebase = async (data, reference) => {
  try {
    await reference.set(data); // Copy the entire local JSON content to Firebase
    console.log(`Successfully synced to Firebase reference: ${reference.toString()}`);
  } catch (error) {
    console.error('Error syncing to Firebase:', error);
    // Failure to sync doesn't affect local operation
  }
};

// Store a reading in the history
const storeInHistory = (id, data) => {
  const timestamp = Date.now();
  const readingData = { ...data, timestamp };
  delete readingData.new; // We don't need to track 'new' status in history

  // Update local history
  let historyData = readLocalFile(historyFilePath);
  if (!historyData[id]) {
    historyData[id] = [];
  }

  // Add new reading to history array (keeping most recent readings at the beginning)
  historyData[id].unshift(readingData);

  // Optionally limit history length (e.g., keep last 100 readings per sensor)
  const maxHistoryLength = 100; // Adjust as needed
  if (historyData[id].length > maxHistoryLength) {
    historyData[id] = historyData[id].slice(0, maxHistoryLength);
  }

  writeToLocalFile(historyFilePath, historyData);

  // Update Firebase history
  historyRef.child(id).set(historyData[id], (error) => {
    if (error) {
      console.error(`Error storing history for ${id} in Firebase:`, error);
    } else {
      console.log(`Added reading to history for ${id}`);
    }
  });
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
  syncToFirebase(currentLocalData, currentDataRef);

  // Step 5: Store in history if data is different
  if (!isSame) {
    storeInHistory(id, incomingData);
  }

  // Step 6: Update Firebase currentData (original behavior) and local old data
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

// GET /history/:id - Retrieve historical data for a specific sensor
app.get('/history/:id', (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).send('Missing sensor ID');

  const limit = parseInt(req.query.limit) || 100; // Optional limit parameter

  historyRef.child(id).limitToFirst(limit).once('value', (snapshot) => {
    const data = snapshot.val() || [];
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(data, null, 2));
  }, (error) => {
    console.error(`Error reading history for ${id} from Firebase:`, error);
    // Fallback to local JSON
    const historyData = readLocalFile(historyFilePath);
    const sensorHistory = historyData[id] || [];
    const limitedHistory = sensorHistory.slice(0, limit);

    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(limitedHistory, null, 2));
  });
});

// GET /history - Retrieve all historical data (with optional filtering)
app.get('/history', (req, res) => {
  const { startDate, endDate, limit } = req.query;
  const startTimestamp = startDate ? new Date(startDate).getTime() : 0;
  const endTimestamp = endDate ? new Date(endDate).getTime() : Date.now();
  const maxResults = parseInt(limit) || 1000; // Default to 1000 entries max

  historyRef.once('value', (snapshot) => {
    const allHistory = snapshot.val() || {};
    let filteredHistory = {};

    // Apply date filtering for each sensor
    Object.keys(allHistory).forEach(id => {
      filteredHistory[id] = allHistory[id].filter(entry =>
        entry.timestamp >= startTimestamp && entry.timestamp <= endTimestamp
      ).slice(0, maxResults);
    });

    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(filteredHistory, null, 2));
  }, (error) => {
    console.error('Error reading history from Firebase:', error);
    // Fallback to local JSON with filtering
    const historyData = readLocalFile(historyFilePath);
    let filteredHistory = {};

    Object.keys(historyData).forEach(id => {
      if (Array.isArray(historyData[id])) {
        filteredHistory[id] = historyData[id].filter(entry =>
          entry.timestamp >= startTimestamp && entry.timestamp <= endTimestamp
        ).slice(0, maxResults);
      }
    });

    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(filteredHistory, null, 2));
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
    syncToFirebase(currentLocalData, currentDataRef);

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
  let historyData = readLocalFile(historyFilePath);

  if (currentLocalData[id]) {
    delete currentLocalData[id];
    delete oldLocalData[id];
    delete historyData[id];  // Also remove history for this sensor

    writeToLocalFile(dataFilePath, currentLocalData); // Update local JSON first
    writeToLocalFile(oldDataFilePath, oldLocalData);
    writeToLocalFile(historyFilePath, historyData);

    // Sync to Firebase
    syncToFirebase(currentLocalData, currentDataRef);

    // Original Firebase delete with history
    const updates = {};
    updates[`currentData/${id}`] = null;
    updates[`oldData/${id}`] = null;
    updates[`history/${id}`] = null;  // Also remove history data

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