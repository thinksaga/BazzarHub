const express = require('express');
const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'vendor-panel' });
});

app.get('/', (req, res) => {
  res.send('<h1>MercurJS Vendor Panel</h1><p>Vendor management interface</p>');
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`Vendor Panel running on port ${PORT}`);
});