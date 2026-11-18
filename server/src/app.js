import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User, Domain, Path, Progress } from './models.js';
import { signToken, publicUser, optionalAuth, requireAuth, requireAdmin } from './auth.js';
import { generatePath } from './ai.js';

export const PASS_MARK = 60; // % needed on a step quiz to complete the step

const isId = (id) => mongoose.isValidObjectId(id);
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Removes quiz answers so learners can't read them from the API. */
function learnerView(path) {
  const p = path.toObject();
  p.steps = p.steps.map((s) => ({ ...s, quiz: s.quiz.map(({ question, options }) => ({ question, options })) }));
  return p;
}

// Wrap async handlers so thrown errors reach the error middleware
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(optionalAuth);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // ---------- Auth ----------
  app.post('/api/auth/register', ah(async (req, res) => {
    const { name, email, password, country = '' } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (await User.exists({ email: email.toLowerCase() })) return res.status(409).json({ error: 'Email already registered' });
    const user = await User.create({ name, email, country, passwordHash: await bcrypt.hash(password, 10) });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  }));

  app.post('/api/auth/login', ah(async (req, res) => {
    const { email = '', password = '' } = req.body || {};
    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user || !(await bcrypt.compare(String(password), user.passwordHash))) {
      return res.status(401).json({ error: 'Wrong email or password' });
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  }));

  app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

  // ---------- Domains ----------
  app.get('/api/domains', ah(async (_req, res) => {
    const [domains, counts] = await Promise.all([
      Domain.find().sort('name').lean(),
      Path.aggregate([{ $match: { status: 'published' } }, { $group: { _id: '$domain', n: { $sum: 1 } } }]),
    ]);
    const byId = Object.fromEntries(counts.map((c) => [c._id.toString(), c.n]));
    res.json(domains.map((d) => ({ ...d, pathCount: byId[d._id.toString()] || 0 })));
  }));

  app.post('/api/domains', requireAdmin, ah(async (req, res) => {
    const { name, icon, description } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const slug = slugify(name);
    if (await Domain.exists({ slug })) return res.status(409).json({ error: 'Domain already exists' });
    res.status(201).json(await Domain.create({ name, slug, icon, description }));
  }));

  app.get('/api/domains/:slug', ah(async (req, res) => {
    const domain = await Domain.findOne({ slug: req.params.slug }).lean();
    if (!domain) return res.status(404).json({ error: 'Domain not found' });
    const paths = await Path.find({ domain: domain._id, status: 'published' })
      .select('title level description steps.estimatedHours steps.title')
      .sort('level title')
      .lean();
    res.json({
      domain,
      paths: paths.map((p) => ({
        _id: p._id,
        title: p.title,
        level: p.level,
        description: p.description,
        stepCount: p.steps.length,
        hours: p.steps.reduce((h, s) => h + (s.estimatedHours || 0), 0),
      })),
    });
  }));

  // ---------- Paths (learner) ----------
  app.get('/api/paths/:id', ah(async (req, res) => {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Path not found' });
    const path = await Path.findById(req.params.id).populate('domain', 'name slug icon');
    const isAdmin = req.user?.role === 'admin';
    if (!path || (path.status !== 'published' && !isAdmin)) return res.status(404).json({ error: 'Path not found' });
    const progress = req.user ? await Progress.findOne({ user: req.user._id, path: path._id }).lean() : null;
    res.json({ path: isAdmin ? path.toObject() : learnerView(path), progress });
  }));

  app.post('/api/paths/:id/steps/:stepId/complete', requireAuth, ah(async (req, res) => {
    const { id, stepId } = req.params;
    if (!isId(id) || !isId(stepId)) return res.status(404).json({ error: 'Not found' });
    const path = await Path.findOne({ _id: id, status: 'published' });
    const step = path?.steps.id(stepId);
    if (!step) return res.status(404).json({ error: 'Step not found' });

    let score = 100;
    let results = [];
    if (step.quiz.length) {
      const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
      results = step.quiz.map((q, i) => ({ correct: answers[i] === q.answer, answer: q.answer }));
      score = Math.round((100 * results.filter((r) => r.correct).length) / step.quiz.length);
    }
    const passed = score >= PASS_MARK;

    const progress = await Progress.findOneAndUpdate(
      { user: req.user._id, path: path._id },
      { $setOnInsert: { user: req.user._id, path: path._id } },
      { upsert: true, new: true },
    );
    const best = progress.quizScores.get(stepId) ?? 0;
    if (score > best) progress.quizScores.set(stepId, score);
    if (passed && !progress.completedSteps.some((s) => s.equals(step._id))) progress.completedSteps.push(step._id);
    const allDone = path.steps.every((s) => progress.completedSteps.some((c) => c.equals(s._id)));
    if (allDone && !progress.completedAt) progress.completedAt = new Date();
    await progress.save();

    res.json({ passed, score, passMark: PASS_MARK, results, progress, badgeEarned: allDone });
  }));

  app.get('/api/me/progress', requireAuth, ah(async (req, res) => {
    const items = await Progress.find({ user: req.user._id })
      .populate({ path: 'path', select: 'title level steps._id domain', populate: { path: 'domain', select: 'name icon slug' } })
      .sort('-updatedAt')
      .lean();
    res.json(
      items
        .filter((p) => p.path)
        .map((p) => ({
          pathId: p.path._id,
          title: p.path.title,
          level: p.path.level,
          domain: p.path.domain,
          done: p.completedSteps.length,
          total: p.path.steps.length,
          completedAt: p.completedAt,
        })),
    );
  }));

  // ---------- Admin ----------
  app.get('/api/admin/paths', requireAdmin, ah(async (_req, res) => {
    res.json(await Path.find().select('title level status domain generatedBy updatedAt steps._id').populate('domain', 'name icon').sort('-updatedAt').lean());
  }));

  app.post('/api/admin/paths/generate', requireAdmin, ah(async (req, res) => {
    const { domainId, topic, level, steps } = req.body || {};
    if (!isId(domainId) || !topic) return res.status(400).json({ error: 'Domain and topic are required' });
    const domain = await Domain.findById(domainId);
    if (!domain) return res.status(404).json({ error: 'Domain not found' });
    const draft = await generatePath({ domain: domain.name, topic: String(topic).slice(0, 150), level, steps });
    const path = await Path.create({ ...draft, domain: domain._id, status: 'draft', createdBy: req.user._id });
    res.status(201).json(path);
  }));

  app.put('/api/admin/paths/:id', requireAdmin, ah(async (req, res) => {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Path not found' });
    const allowed = ['title', 'description', 'level', 'steps', 'status'];
    const update = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => allowed.includes(k)));
    const path = await Path.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!path) return res.status(404).json({ error: 'Path not found' });
    res.json(path);
  }));

  app.delete('/api/admin/paths/:id', requireAdmin, ah(async (req, res) => {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Path not found' });
    await Path.findByIdAndDelete(req.params.id);
    await Progress.deleteMany({ path: req.params.id });
    res.status(204).end();
  }));

  // ---------- Errors ----------
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: err.message?.startsWith('AI') ? err.message : 'Something went wrong' });
  });

  return app;
}
