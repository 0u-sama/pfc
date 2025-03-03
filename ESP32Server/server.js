const express = require('express');
const fs = require('fs');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());
const jsonFilePath = './data.json';

if (!fs.existsSync(jsonFilePath)) {
  fs.writeFileSync(jsonFilePath, JSON.stringify({}));
}

app.post('/update', (req, res) => {
  const data = req.body;
  const id = data.id;
  if (!id) return res.status(400).send('Missing id in payload');

  let currentData = {};
  try {
    const fileContent = fs.readFileSync(jsonFilePath, 'utf8');
    currentData = JSON.parse(fileContent);
  } catch (err) {
    console.error('Error reading data.json:', err);
  }

  if (!currentData[id]) {
    data.new = true; // Flag new clients
  } else {
    data.new = false;
    data.name = currentData[id].name || ''; // Preserve existing name
  }
  currentData[id] = data;

  try {
    fs.writeFileSync(jsonFilePath, JSON.stringify(currentData, null, 2));
    console.log(`Updated data for ${id}`);
    res.status(200).send('Data updated');
  } catch (err) {
    console.error('Error writing data.json:', err);
    res.status(500).send('Failed to update data');
  }
});

app.get('/data', (req, res) => {
  try {
    const fileContent = fs.readFileSync(jsonFilePath, 'utf8');
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
    const fileContent = fs.readFileSync(jsonFilePath, 'utf8');
    currentData = JSON.parse(fileContent);
  } catch (err) {
    console.error('Error reading data.json:', err);
    return res.status(500).send('Failed to read data');
  }

  if (currentData[id]) {
    currentData[id].name = name;
    currentData[id].new = false; // Clear new flag after naming
    try {
      fs.writeFileSync(jsonFilePath, JSON.stringify(currentData, null, 2));
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

app.listen(port, () => {
  console.log(`Server running at http://localhostyoure localhost:${port}`);
});