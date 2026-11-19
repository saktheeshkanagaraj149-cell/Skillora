/**
 * Container entrypoint for the production image.
 *
 * Starts Cerbos first, waits until it answers its health endpoint, then starts
 * the API. If either process exits, the other is stopped and the container
 * exits so Docker/Render can restart the whole unit. This avoids running an API
 * that fails closed while Cerbos is still booting, and avoids leaving an orphan
 * Cerbos process behind.
 */
import { spawn } from 'node:child_process';

const CERBOS_CONFIG = process.env.CERBOS_CONFIG || '/app/cerbos/config.yaml';
const CERBOS_POLICIES = process.env.CERBOS_POLICIES || '/app/cerbos/policies';
const CERBOS_HEALTH_URL = process.env.CERBOS_HEALTH_URL || 'http://127.0.0.1:3592/_cerbos/health';

let stopping = false;
let api;

const cerbos = spawn('cerbos', [
  'server',
  `--config=${CERBOS_CONFIG}`,
  `--set=storage.disk.directory=${CERBOS_POLICIES}`,
  '--set=storage.disk.watchForChanges=false',
], { stdio: 'inherit', env: process.env });

function stop(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  try { api?.kill(signal); } catch { /* already gone */ }
  try { cerbos.kill(signal); } catch { /* already gone */ }
  setTimeout(() => process.exit(process.exitCode || 0), 1500);
}

process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));

cerbos.on('error', (err) => {
  console.error(`[docker] could not start Cerbos: ${err.message}`);
  process.exitCode = 1;
  stop();
});
cerbos.on('exit', (code, signal) => {
  if (stopping) return;
  console.error(`[docker] Cerbos exited (code=${code ?? 'none'} signal=${signal ?? 'none'}); stopping API.`);
  process.exitCode = code || 1;
  stop(signal || 'SIGTERM');
});

async function waitForCerbos() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (stopping) throw new Error('Cerbos stopped while starting');
    try {
      const res = await fetch(CERBOS_HEALTH_URL);
      if (res.ok) return;
    } catch { /* not listening yet */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Cerbos did not become ready within 30 seconds');
}

try {
  await waitForCerbos();
  console.log('[docker] Cerbos ready; starting API');
  api = spawn(process.execPath, ['src/index.js'], { stdio: 'inherit', env: process.env });
  api.on('error', (err) => {
    console.error(`[docker] could not start API: ${err.message}`);
    process.exitCode = 1;
    stop();
  });
  api.on('exit', (code, signal) => {
    if (stopping) return;
    console.error(`[docker] API exited (code=${code ?? 'none'} signal=${signal ?? 'none'}); stopping Cerbos.`);
    process.exitCode = code || 1;
    stop(signal || 'SIGTERM');
  });
} catch (err) {
  console.error(`[docker] ${err.message}`);
  process.exitCode = 1;
  stop();
}
