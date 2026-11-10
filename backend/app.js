const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes');
const { getAllowedOrigins } = require('./config/cors');

const app = express();

app.disable('x-powered-by');
app.use(cors({
  origin(origin, callback) {
    if (!origin || getAllowedOrigins().includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
}));
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
