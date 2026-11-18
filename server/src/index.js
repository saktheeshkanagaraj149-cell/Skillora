import 'dotenv/config';
import { connectDB, disconnectDB } from './db.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT) || 5000;

if (process.env.NODE_ENV === 'production') {
  const missing = ['MONGO_URI', 'JWT_SECRET', 'CLIENT_ORIGIN'].filter((k) => !process.env[k]);
  if (missing.length) {
    console.error('[config] missing required env vars: ' + missing.join(', '));
    process.exit(1);
  }
}

await connectDB();
const server = createApp().listen(port, () => console.log(`[api] http://localhost:${port}`));

const shutdown = async () => {
  server.close();
  await disconnectDB();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
