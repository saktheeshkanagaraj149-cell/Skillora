/**
 * Drafts one beginner path for every domain that has no path yet.
 * Usage: npm run generate:starters        (drafts only; admin reviews + publishes)
 * Safe to re-run: domains that already have a path are skipped.
 */
import 'dotenv/config';
import { connectDB, disconnectDB } from './db.js';
import { Domain, Path, User } from './models.js';
import { generatePath } from './ai.js';
import { DOMAINS } from './domains.js';

const CONCURRENCY = 3;

await connectDB();
if (!process.env.GEMINI_API_KEY) console.warn('[starters] no GEMINI_API_KEY: drafts will be plain templates');

const admin = await User.findOne({ role: 'admin' });
const starterBySlug = Object.fromEntries(DOMAINS.map((d) => [d.slug, d.starter]));
const domains = await Domain.find();
const todo = [];
for (const d of domains) {
  if (!(await Path.exists({ domain: d._id }))) todo.push(d);
}
console.log(`[starters] ${todo.length} domain(s) need a starter path`);

let ok = 0;
const failed = [];
const queue = [...todo];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const d = queue.shift();
      const topic = starterBySlug[d.slug] || `${d.name} for beginners`;
      const t = Date.now();
      try {
        const draft = await generatePath({ domain: d.name, topic, level: 'beginner', steps: 6 });
        await Path.create({ ...draft, domain: d._id, status: 'draft', createdBy: admin?._id });
        ok++;
        console.log(`[starters] ✓ ${d.icon} ${d.name}: ${draft.title} (${draft.steps.length} steps, ${draft.generatedBy}, ${Math.round((Date.now() - t) / 1000)}s)`);
      } catch (e) {
        failed.push(d.name);
        console.log(`[starters] ✗ ${d.name}: ${e.message}`);
      }
    }
  }),
);

console.log(`[starters] done: ${ok} created, ${failed.length} failed${failed.length ? ' (' + failed.join(', ') + '). Re-run to retry.' : ''}`);
await disconnectDB();
