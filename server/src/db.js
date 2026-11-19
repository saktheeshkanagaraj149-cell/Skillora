import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

const here = path.dirname(fileURLToPath(import.meta.url));
let memoryServer = null;

/**
 * Connects to MONGO_URI, or in development (no URI set) starts a local
 * MongoDB that keeps its data in server/.data so nothing is lost on restart.
 */
export async function connectDB() {
  let uri = process.env.MONGO_URI;

  if (!uri) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MONGO_URI is required in production');
    }
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const dbPath = path.resolve(here, '..', '.data');
    fs.mkdirSync(dbPath, { recursive: true });
    memoryServer = await MongoMemoryServer.create({
      instance: { dbPath, storageEngine: 'wiredTiger', port: 27018 },
    });
    uri = memoryServer.getUri('skillora');
    console.log(`[db] using local MongoDB at ${uri} (data in server/.data)`);
  }

  await mongoose.connect(uri);
  console.log('[db] connected');
}

export async function disconnectDB() {
  // The local dev mongod is killed on stop (hard on Windows): flush to disk first or recent writes are lost.
  if (memoryServer) await mongoose.connection.db.admin().command({ fsync: 1 }).catch(() => {});
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop({ doCleanup: false });
}
