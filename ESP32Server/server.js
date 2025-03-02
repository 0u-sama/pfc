const express = require('express');
const fs = require('fs');
const cors = require('cors'); // Add this
const app = express();
const port = 3000;

app.use(express.json());
app.use(cors()); // Enable CORS for all routes
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
    data.new = true;
  } else {
    data.new = false;
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

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});