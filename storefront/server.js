const express = require('express');
const app = express();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'storefront' });
});

app.get('/', (req, res) => {
  res.send('<h1>MercurJS Storefront</h1><p>Welcome to the marketplace!</p>');
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Storefront running on port ${PORT}`);
});