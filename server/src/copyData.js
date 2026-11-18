/**
 * Copies content from one MongoDB to another (e.g. local dev DB -> MongoDB Atlas).
 * Copies domains, paths and admin accounts. Learner accounts and progress are NOT copied
 * (local ones are test data). Existing documents with the same _id are replaced,
 * so it is safe to re-run.
 *
 * Usage: FROM_URI=mongodb://127.0.0.1:27018/skillora TO_URI="mongodb+srv://..." npm run copy-data
 */
import mongoose from 'mongoose';

const { FROM_URI, TO_URI } = process.env;
if (!FROM_URI || !TO_URI) {
  console.error('Set FROM_URI and TO_URI');
  process.exit(1);
}
if (FROM_URI === TO_URI) {
  console.error('FROM_URI and TO_URI are the same');
  process.exit(1);
}

const from = await mongoose.createConnection(FROM_URI).asPromise();
const to = await mongoose.createConnection(TO_URI).asPromise();
console.log(`[copy] ${from.name} -> ${to.name} (${new URL(TO_URI.replace('mongodb+srv', 'http')).hostname})`);

const plan = [
  ['domains', {}],
  ['paths', {}],
  ['users', { role: 'admin' }],
];

for (const [name, filter] of plan) {
  const docs = await from.db.collection(name).find(filter).toArray();
  if (!docs.length) {
    console.log(`[copy] ${name}: nothing to copy`);
    continue;
  }
  const res = await to.db.collection(name).bulkWrite(
    docs.map((d) => ({ replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true } })),
  );
  console.log(`[copy] ${name}: ${docs.length} copied (${res.upsertedCount} new, ${res.modifiedCount} updated)`);
}

// Make sure unique indexes exist on the target (the app also builds them on start)
await to.db.collection('users').createIndex({ email: 1 }, { unique: true });
await to.db.collection('domains').createIndex({ slug: 1 }, { unique: true });
await to.db.collection('domains').createIndex({ name: 1 }, { unique: true });

await from.close();
await to.close();
console.log('[copy] done');
