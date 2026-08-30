/**
 * Server entry point — minimal Node/TypeScript HTTP server.
 *
 * Express is the simplest choice for a hackathon MVP.
 * The server is a mock for this phase — production would use
 * a real AI provider.
 */

import express from 'express';
import reasonRouter from './routes/reason';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Parse JSON bodies
app.use(express.json({ limit: '100kb' }));

// CORS for development (allow extension to connect)
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// Routes
app.use('/', reasonRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', provider: 'mock' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`[Server] Mock AI server running on http://localhost:${PORT}`);
  console.log(`[Server] POST /reason — task reasoning endpoint`);
  console.log(`[Server] GET /health — health check`);
});

export { app, server };
