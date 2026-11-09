const express = require('express');
const apiRoutes = require('./routes');

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use('/api', apiRoutes);

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) {
    console.error(error);
  }
  return res.status(status).json({
    message: status >= 500 ? 'An unexpected server error occurred.' : error.message,
  });
});

module.exports = app;
