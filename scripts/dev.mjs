/**
 * One command for local development: `npm run dev`
 *  1. starts Cerbos in Docker (skipped with a warning if Docker isn't running)
 *  2. starts the API (http://localhost:5000) and waits until it answers
 *  3. starts the website (http://localhost:5173)
 * Ctrl+C stops the API and the website. Cerbos keeps running: `npm run cerbos:stop --prefix server` stops it.
 */
import { spawn, spawnSync } from 'node:child_process';

const isWin = process.platform === 'win32';
const children = [];

function run(name, args, color) {
  const child = spawn(isWin ? 'npm.cmd' : 'npm', args, { stdio: ['ignore', 'pipe', 'pipe'], shell: isWin });
  const tag = `\x1b[${color}m[${name}]\x1b[0m `;
  const pipe = (stream, out) =>
    stream.on('data', (buf) => out.write(buf.toString().replace(/^(?=.)/gm, tag)));
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    console.log(`${tag}stopped${code ? ` (exit ${code})` : ''}`);
    if (name === 'api' && code) console.log(`${tag}the website needs the API: fix the error above, then run npm run dev again`);
  });
  children.push(child);
  return child;
}

async function waitFor(url, seconds) {
  for (let i = 0; i < seconds; i++) {
    try {
      const res = await fetch(url);
      if (res.status < 500 || res.status === 503) return true; // 503 = API up, Cerbos still starting
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

// 1. Cerbos
const docker = spawnSync(isWin ? 'npm.cmd' : 'npm', ['run', 'cerbos', '--prefix', 'server'], { stdio: 'pipe', shell: isWin });
if (docker.status === 0) console.log('\x1b[35m[cerbos]\x1b[0m running on http://localhost:3592');
else {
  console.warn('\x1b[33m[cerbos] could not start (is Docker Desktop running?). Courses, admin and exams will answer 503 until it runs.\x1b[0m');
}

// 2. API
run('api', ['run', 'dev', '--prefix', 'server'], 36);
if (!(await waitFor('http://localhost:5000/api/health', 90))) {
  console.error('[dev] the API did not start within 90s; see the [api] lines above');
}

// 3. Website
run('web', ['run', 'dev', '--prefix', 'client'], 32);
await waitFor('http://localhost:5173', 60);
console.log('\n\x1b[1mSkillora is running: http://localhost:5173\x1b[0m  (Ctrl+C to stop)\n');

const stop = () => {
  for (const c of children) {
    if (isWin) spawnSync('taskkill', ['/PID', String(c.pid), '/T', '/F'], { stdio: 'ignore' });
    else c.kill('SIGTERM');
  }
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
