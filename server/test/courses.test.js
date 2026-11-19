import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { normalisePath, normaliseEnrichment } from '../src/ai.js';
import { parseYouTubeId } from '../src/youtube.js';
import { newCertificateCode } from '../src/courses.js';
import { User, Domain, Path } from '../src/models.js';
import { cerbosHealthy } from '../src/authz.js';

let mongo, server, base;
process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
delete process.env.GEMINI_API_KEY;
delete process.env.YOUTUBE_API_KEY;

const call = async (path, { method = 'GET', body, token } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: res.status === 204 ? null : await res.json() };
};

before(async () => {
  if (!(await cerbosHealthy())) {
    throw new Error('Cerbos is not running. Start it with: npm run cerbos   (needs Docker Desktop)');
  }
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  server = createApp().listen(0);
  base = `http://localhost:${server.address().port}/api`;
});

after(async () => {
  server.close();
  await mongoose.disconnect();
  await mongo.stop();
});

const q = (n, answer = 1) => ({ question: `Q${n}?`, options: ['a', 'b', 'c', 'd'], answer });

test('normalisePath flattens modules into lessons and keeps the final exam', () => {
  const p = normalisePath(
    {
      title: 'Course',
      modules: [
        { title: 'Basics', lessons: [{ title: 'L1', videoQuery: 'ohm law explained', quiz: [q(1)] }, { title: 'L2' }] },
        { title: 'Practice', lessons: [{ title: 'L3', searchQueries: ['x'] }] },
      ],
      finalExam: [q(1), q(2), { question: 'bad', options: ['a'], answer: 3 }],
    },
    { level: 'beginner' },
  );
  assert.deepEqual(p.steps.map((s) => s.module), ['Basics', 'Basics', 'Practice']);
  assert.equal(p.steps[0].videoQuery, 'ohm law explained');
  assert.equal(p.steps[2].videoQuery, 'x'); // falls back to first search query
  assert.equal(p.finalExam.length, 2);
});

test('normaliseEnrichment ignores module lists of the wrong length', () => {
  const path = { steps: [{ title: 'A' }, { title: 'B' }] };
  const e = normaliseEnrichment({ modules: ['only one'], videoQueries: ['qa'], finalExam: [q(1)] }, path);
  assert.equal(e.modules, null);
  assert.deepEqual(e.videoQueries, ['qa', 'B']);
  assert.equal(e.finalExam.length, 1);
});

test('parseYouTubeId handles common URL shapes', () => {
  for (const u of ['dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1', 'https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'https://youtube.com/shorts/dQw4w9WgXcQ']) {
    assert.equal(parseYouTubeId(u), 'dQw4w9WgXcQ', u);
  }
  assert.equal(parseYouTubeId('https://example.com/watch?v=dQw4w9WgXcQ'), null);
  assert.match(newCertificateCode(), /^SK-[A-Z2-9]{5}-[A-Z2-9]{5}$/);
});

test('final exam unlocks the certificate, which anyone can verify', async () => {
  const domain = await Domain.create({ name: 'Electronics', slug: 'electronics' });
  const path = await Path.create({
    domain: domain._id,
    title: 'Arduino basics',
    status: 'published',
    steps: [
      { module: 'Start', title: 'L1', estimatedHours: 2, video: { youtubeId: 'dQw4w9WgXcQ', title: 'v', channel: 'c' } },
      { module: 'Start', title: 'L2', estimatedHours: 3 },
    ],
    finalExam: [q(1, 0), q(2, 1), q(3, 2), q(4, 3)],
  });
  const id = path._id.toString();
  const learner = (await call('/auth/register', { method: 'POST', body: { name: 'Priya S', email: 'p@x.io', password: 'password1' } })).data.token;

  // learners never see exam answers; domain listing advertises structure
  const view = await call(`/paths/${id}`, { token: learner });
  assert.equal(view.data.path.finalExam.length, 4);
  assert.equal(view.data.path.finalExam[0].answer, undefined);
  assert.equal(view.data.path.steps[0].video.youtubeId, 'dQw4w9WgXcQ');
  const listing = (await call('/domains/electronics')).data.paths[0];
  assert.equal(listing.moduleCount, 1);
  assert.equal(listing.videoCount, 1);
  assert.equal(listing.examQuestions, 4);

  // exam locked until every lesson is done; no certificate yet
  assert.equal((await call(`/paths/${id}/exam`, { method: 'POST', token: learner, body: { answers: [0, 1, 2, 3] } })).status, 400);
  assert.equal((await call(`/paths/${id}/certificate`, { method: 'POST', token: learner })).status, 400);
  for (const s of path.steps) await call(`/paths/${id}/steps/${s._id}/complete`, { method: 'POST', token: learner, body: {} });

  // 2/4 = 50%: fail, and correct answers stay hidden
  const fail = await call(`/paths/${id}/exam`, { method: 'POST', token: learner, body: { answers: [0, 1, 0, 0] } });
  assert.equal(fail.data.passed, false);
  assert.equal(fail.data.score, 50);
  assert.equal(fail.data.results, null); // no per-question right/wrong after a fail: it would leak the key
  assert.equal(fail.data.correctCount, 2);
  assert.equal(fail.data.total, 4);
  assert.equal(fail.data.certificate, null);

  // 3/4 = 75%: pass -> certificate
  const pass = await call(`/paths/${id}/exam`, { method: 'POST', token: learner, body: { answers: [0, 1, 2, 0] } });
  assert.equal(pass.data.passed, true);
  assert.equal(pass.data.results[3].answer, 3);
  const cert = pass.data.certificate;
  assert.match(cert.code, /^SK-/);
  assert.equal(cert.learnerName, 'Priya S');
  assert.equal(cert.courseTitle, 'Arduino basics');
  assert.equal(cert.domainName, 'Electronics');
  assert.equal(cert.hours, 5);
  assert.equal(cert.score, 75);
  assert.equal(pass.data.progress.examAttempts, 2);

  // idempotent: retaking or claiming returns the same certificate
  const again = await call(`/paths/${id}/exam`, { method: 'POST', token: learner, body: { answers: [0, 1, 2, 3] } });
  assert.equal(again.data.certificate.code, cert.code);
  assert.equal((await call(`/paths/${id}/certificate`, { method: 'POST', token: learner })).data.code, cert.code);

  // public verify (no login, case-insensitive) exposes no email
  const verify = await call(`/certificates/${cert.code.toLowerCase()}`);
  assert.equal(verify.status, 200);
  assert.equal(verify.data.learnerName, 'Priya S');
  assert.equal(JSON.stringify(verify.data).includes('p@x.io'), false);
  assert.equal((await call('/certificates/SK-AAAAA-AAAAA')).status, 404);
  assert.equal((await call('/certificates/garbage')).status, 404);

  const mine = await call('/me/certificates', { token: learner });
  assert.equal(mine.data.length, 1);
});

test('malformed auth/domain input is rejected cleanly, not a 500', async () => {
  assert.equal((await call('/auth/register', { method: 'POST', body: { name: 'X', email: ['a@b.co'], password: 'password1' } })).status, 400);
  assert.equal((await call('/auth/register', { method: 'POST', body: { name: { $gt: '' }, email: 'n@b.co', password: 'password1' } })).status, 400);
  assert.equal((await call('/auth/login', { method: 'POST', body: { email: { $ne: null }, password: 'x' } })).status, 401);
  const ok = await call('/auth/register', { method: 'POST', body: { name: '  Spacey  ', email: ' Spacey@B.co ', password: 'password1' } });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.user.name, 'Spacey');
  assert.equal(ok.data.user.email, 'spacey@b.co');
  assert.equal((await call('/auth/login', { method: 'POST', body: { email: 'SPACEY@b.co ', password: 'password1' } })).status, 200);
});

test('courses without an exam award the certificate on completion; admin enrich degrades without keys', async () => {
  const domain = await Domain.create({ name: 'Music', slug: 'music' });
  await User.create({ name: 'Admin', email: 'admin@x.io', role: 'admin', passwordHash: await bcrypt.hash('Admin@12345', 4) });
  const admin = (await call('/auth/login', { method: 'POST', body: { email: 'admin@x.io', password: 'Admin@12345' } })).data.token;
  const learner = (await call('/auth/register', { method: 'POST', body: { name: 'Ravi', email: 'r@x.io', password: 'password1' } })).data.token;

  // generator (template mode) now produces modules + video queries
  const gen = await call('/admin/paths/generate', { method: 'POST', token: admin, body: { domainId: domain._id, topic: 'Keyboard', steps: 3 } });
  assert.equal(gen.status, 201);
  assert.ok(gen.data.steps.every((s) => s.module && s.videoQuery));

  // admin pastes a video and publishes; enrich without keys is a no-op with notes
  const steps = gen.data.steps;
  steps[0].video = { youtubeId: 'dQw4w9WgXcQ', title: 'Intro', channel: '' };
  assert.equal((await call(`/admin/paths/${gen.data._id}`, { method: 'PUT', token: admin, body: { steps, status: 'published' } })).status, 200);
  const enrich = await call(`/admin/paths/${gen.data._id}/enrich`, { method: 'POST', token: admin, body: {} });
  assert.equal(enrich.status, 200);
  assert.equal(enrich.data.notes.length, 2);
  assert.equal((await call(`/admin/paths/${gen.data._id}/enrich`, { method: 'POST', token: learner, body: {} })).status, 403);

  for (const s of steps) await call(`/paths/${gen.data._id}/steps/${s._id}/complete`, { method: 'POST', token: learner, body: {} });
  const claim = await call(`/paths/${gen.data._id}/certificate`, { method: 'POST', token: learner });
  assert.equal(claim.status, 200);
  assert.equal(claim.data.score, null);
  assert.equal(claim.data.lessons, 3);
});
