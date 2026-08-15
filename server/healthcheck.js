const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Health check server running on port ${PORT}`);
});

module.exports = app;
