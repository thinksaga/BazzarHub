const express = require('express');
const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'mercurjs-backend' });
});

app.get('/', (req, res) => {
  res.json({ message: 'MercurJS Backend API' });
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`MercurJS Backend running on port ${PORT}`);
});