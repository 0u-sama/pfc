const express = require('express');
const fs = require('fs');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

const dataFilePath = './data.json';
const oldDataFilePath = './old_data.json';

// Initialize files if they don’t exist
if (!fs.existsSync(dataFilePath)) {
  fs.writeFileSync(dataFilePath, JSON.stringify({}));
}
if (!fs.existsSync(oldDataFilePath)) {
  fs.writeFileSync(oldDataFilePath, JSON.stringify({}));
}

app.post('/update', (req, res) => {
  const incomingData = req.body;
  const id = incomingData.id;
  if (!id) return res.status(400).send('Missing id in payload');

  let currentData = {};
  let oldData = {};
  try {
    currentData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
    oldData = JSON.parse(fs.readFileSync(oldDataFilePath, 'utf8'));
  } catch (err) {
    console.error('Error reading JSON files:', err);
  }

  // Add new flag and preserve name if first time
  if (!currentData[id]) {
    incomingData.new = true;
  } else {
    incomingData.new = false;
    incomingData.name = currentData[id].name || '';
  }

  // Remove fireRisk - handled in Local.jsx
  delete incomingData.fireRisk; // Ensure no fireRisk in incoming data

  // Update current data
  currentData[id] = incomingData;

  // Compare with old data to set inactivity
  const oldClientData = oldData[id] || {};
  const isSame = JSON.stringify(oldClientData) === JSON.stringify(incomingData);
  currentData[id].inactive = isSame;

  // Write current data
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(currentData, null, 2));
    // Update old data only if changed
    if (!isSame) {
      oldData[id] = incomingData;
      fs.writeFileSync(oldDataFilePath, JSON.stringify(oldData, null, 2));
    }
    console.log(`Updated data for ${id}`);
    res.status(200).send('Data updated');
  } catch (err) {
    console.error('Error writing JSON files:', err);
    res.status(500).send('Failed to update data');
  }
});

app.get('/data', (req, res) => {
  try {
    const fileContent = fs.readFileSync(dataFilePath, 'utf8');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(fileContent);
  } catch (err) {
    console.error('Error reading data.json:', err);
    res.status(404).send('Data not found');
  }
});

app.post('/set-name', (req, res) => {
  const { id, name } = req.body;
  if (!id || !name) return res.status(400).send('Missing id or name');

  let currentData = {};
  try {
    const fileContent = fs.readFileSync(dataFilePath, 'utf8');
    currentData = JSON.parse(fileContent);
  } catch (err) {
    console.error('Error reading data.json:', err);
    return res.status(500).send('Failed to read data');
  }

  if (currentData[id]) {
    currentData[id].name = name;
    currentData[id].new = false;

    // Remove fireRisk - handled in Local.jsx
    delete currentData[id].fireRisk; // Ensure no fireRisk in data.json

    try {
      fs.writeFileSync(dataFilePath, JSON.stringify(currentData, null, 2));
      console.log(`Set name for ${id} to ${name}`);
      res.status(200).send('Name updated');
    } catch (err) {
      console.error('Error writing data.json:', err);
      res.status(500).send('Failed to update name');
    }
  } else {
    res.status(404).send('Client ID not found');
  }
});

app.delete('/delete', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).send('Missing id in payload');

  let currentData = {};
  let oldData = {};
  try {
    currentData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
    oldData = JSON.parse(fs.readFileSync(oldDataFilePath, 'utf8'));
  } catch (err) {
    console.error('Error reading JSON files:', err);
    return res.status(500).send('Failed to read data');
  }

  if (currentData[id]) {
    delete currentData[id]; // Remove from data.json
    delete oldData[id];    // Remove from old_data.json
    try {
      fs.writeFileSync(dataFilePath, JSON.stringify(currentData, null, 2));
      fs.writeFileSync(oldDataFilePath, JSON.stringify(oldData, null, 2));
      console.log(`Deleted client ${id}`);
      res.status(200).send('Client deleted');
    } catch (err) {
      console.error('Error writing JSON files:', err);
      res.status(500).send('Failed to delete client');
    }
  } else {
    res.status(404).send('Client ID not found');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});