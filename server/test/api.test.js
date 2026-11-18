import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { normalisePath } from '../src/ai.js';
import { User, Domain } from '../src/models.js';

let mongo, server, base;
process.env.JWT_SECRET = 'test-secret';
delete process.env.GEMINI_API_KEY; // force template generator

const call = async (path, { method = 'GET', body, token } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: res.status === 204 ? null : await res.json() };
};

before(async () => {
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

test('normalisePath drops invalid quiz questions and builds search links', () => {
  const p = normalisePath(
    {
      title: 'T',
      steps: [{ title: 'S', searchQueries: ['ohm law'], quiz: [{ question: 'ok', options: ['a', 'b'], answer: 1 }, { question: 'bad', options: ['a'], answer: 5 }] }],
    },
    { level: 'beginner' },
  );
  assert.equal(p.steps[0].quiz.length, 1);
  assert.match(p.steps[0].resources[0].url, /^https:\/\/www\.youtube\.com\/results\?search_query=ohm%20law/);
  assert.throws(() => normalisePath({ steps: [] }, {}));
});

test('full learner + admin flow', async () => {
  await Domain.create({ name: 'Electronics', slug: 'electronics' });
  await User.create({ name: 'Admin', email: 'a@x.io', role: 'admin', passwordHash: await bcrypt.hash('Admin@12345', 4) });

  // register + bad login
  const reg = await call('/auth/register', { method: 'POST', body: { name: 'Lee', email: 'lee@x.io', password: 'password1' } });
  assert.equal(reg.status, 201);
  assert.equal(reg.data.user.role, 'learner');
  assert.equal((await call('/auth/login', { method: 'POST', body: { email: 'lee@x.io', password: 'nope' } })).status, 401);
  const learner = reg.data.token;

  // learner cannot use admin routes
  assert.equal((await call('/admin/paths', { token: learner })).status, 403);

  const admin = (await call('/auth/login', { method: 'POST', body: { email: 'a@x.io', password: 'Admin@12345' } })).data.token;
  const domainId = (await call('/domains')).data[0]._id;

  // generate (template, no AI key) -> draft hidden from learners
  const gen = await call('/admin/paths/generate', { method: 'POST', token: admin, body: { domainId, topic: 'Arduino', steps: 3 } });
  assert.equal(gen.status, 201);
  assert.equal(gen.data.status, 'draft');
  const id = gen.data._id;
  assert.equal((await call(`/paths/${id}`, { token: learner })).status, 404);

  // admin adds a quiz to step 1 and publishes
  const steps = gen.data.steps;
  steps[0].quiz = [{ question: '2+2?', options: ['3', '4'], answer: 1 }];
  const pub = await call(`/admin/paths/${id}`, { method: 'PUT', token: admin, body: { steps, status: 'published' } });
  assert.equal(pub.status, 200);
  assert.equal((await call('/domains')).data[0].pathCount, 1);

  // learner view hides answers
  const view = await call(`/paths/${id}`, { token: learner });
  assert.equal(view.data.path.steps[0].quiz[0].answer, undefined);

  // wrong answer fails, right answer passes
  const s0 = steps[0]._id;
  const fail = await call(`/paths/${id}/steps/${s0}/complete`, { method: 'POST', token: learner, body: { answers: [0] } });
  assert.equal(fail.data.passed, false);
  assert.equal(fail.data.progress.completedSteps.length, 0);
  const pass = await call(`/paths/${id}/steps/${s0}/complete`, { method: 'POST', token: learner, body: { answers: [1] } });
  assert.equal(pass.data.passed, true);
  assert.equal(pass.data.badgeEarned, false);

  // steps without quiz complete directly; finishing all earns the badge
  await call(`/paths/${id}/steps/${steps[1]._id}/complete`, { method: 'POST', token: learner, body: {} });
  const last = await call(`/paths/${id}/steps/${steps[2]._id}/complete`, { method: 'POST', token: learner, body: {} });
  assert.equal(last.data.badgeEarned, true);

  const mine = await call('/me/progress', { token: learner });
  assert.equal(mine.data[0].done, 3);
  assert.ok(mine.data[0].completedAt);
});
