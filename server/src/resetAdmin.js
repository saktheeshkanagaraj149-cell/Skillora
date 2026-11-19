/**
 * Sets the admin account's password to ADMIN_PASSWORD from server/.env.
 * Use when /admin login fails because the stored password and .env disagree.
 *
 *   npm run reset-admin
 *
 * Only touches the user whose email is ADMIN_EMAIL, and only if that user is an admin.
 * Refuses the example password on a real database. Never prints the password.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from './db.js';
import { User } from './models.js';

const email = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
const password = process.env.ADMIN_PASSWORD || '';

if (!email || !password) {
  console.error('[reset-admin] set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env first');
  process.exit(1);
}
if (process.env.MONGO_URI && (password === 'Admin@12345' || password.length < 12)) {
  console.error('[reset-admin] refusing a weak/example password on a real database: use at least 12 characters');
  process.exit(1);
}

await connectDB();
const user = await User.findOne({ email });
if (!user) {
  console.error(`[reset-admin] no user with email ${email}`);
} else if (user.role !== 'admin') {
  console.error(`[reset-admin] ${email} is not an admin; not changing it`);
} else if (await bcrypt.compare(password, user.passwordHash)) {
  console.log(`[reset-admin] ${email}: password already matches ADMIN_PASSWORD, nothing to do`);
} else {
  user.passwordHash = await bcrypt.hash(password, 10);
  await user.save();
  console.log(`[reset-admin] ${email}: password updated to ADMIN_PASSWORD`);
}
await disconnectDB();
