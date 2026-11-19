/**
 * Course features on top of paths: final exam, certificates, and admin tools to add
 * module structure / videos / exams to existing paths.
 */
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import { Certificate, Domain, Path, Progress } from './models.js';
import { requireAuth } from './auth.js';
import { authorize, can, FORBIDDEN, pathResource } from './authz.js';
import { enrichPath } from './ai.js';
import { fillVideos, hasYouTubeKey, QuotaError } from './youtube.js';

export const EXAM_PASS_MARK = 70; // % needed on the final exam to earn the certificate

const isId = (id) => mongoose.isValidObjectId(id);
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const allLessonsDone = (path, progress) =>
  Boolean(progress) && path.steps.every((s) => progress.completedSteps.some((c) => c.equals(s._id)));

export const certificateEligible = (path, progress) =>
  allLessonsDone(path, progress) && (path.finalExam.length === 0 || (progress.examScore ?? 0) >= EXAM_PASS_MARK);

// Unambiguous alphabet (no 0/O, 1/I/L): codes get read out and typed in by recruiters.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newCertificateCode() {
  const bytes = crypto.randomBytes(10);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `SK-${chars.slice(0, 5)}-${chars.slice(5)}`;
}

/** Public shape: everything a verifier needs, nothing private (no email, no user id). */
export const publicCertificate = (c) => ({
  code: c.code,
  learnerName: c.learnerName,
  courseTitle: c.courseTitle,
  domainName: c.domainName,
  level: c.level,
  hours: c.hours,
  lessons: c.lessons,
  score: c.score,
  issuedAt: c.createdAt,
  pathId: c.path,
});

/** Returns the learner's certificate for a path, creating it if they are eligible; null if not eligible. */
export async function issueCertificate(user, path, progress) {
  const existing = await Certificate.findOne({ user: user._id, path: path._id });
  if (existing) return existing;
  if (!certificateEligible(path, progress)) return null;
  const domain = path.domain?.name ? path.domain : await Domain.findById(path.domain).lean();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await Certificate.create({
        code: newCertificateCode(),
        user: user._id,
        path: path._id,
        learnerName: user.name,
        courseTitle: path.title,
        domainName: domain?.name || '',
        level: path.level,
        hours: path.steps.reduce((h, s) => h + (s.estimatedHours || 0), 0),
        lessons: path.steps.length,
        score: path.finalExam.length ? progress.examScore : null,
      });
    } catch (e) {
      if (e.code !== 11000) throw e;
      // duplicate key: either a code collision (retry) or a parallel request already issued it
      const raced = await Certificate.findOne({ user: user._id, path: path._id });
      if (raced) return raced;
    }
  }
  throw new Error('Could not issue certificate, please try again');
}

/** Applies AI enrichment to a path document (mutates; caller saves). Keeps admin-written exams and modules. */
export function applyEnrichment(path, e, { overwrite = false } = {}) {
  const hasModules = path.steps.some((s) => s.module);
  path.steps.forEach((s, i) => {
    if (e.modules && (overwrite || !hasModules)) s.module = e.modules[i];
    if (overwrite || !s.videoQuery) s.videoQuery = e.videoQueries[i];
  });
  if (e.finalExam.length && (overwrite || path.finalExam.length === 0)) path.finalExam = e.finalExam;
}

// Per-learner cap on exam submissions, so the answer key can't be found by brute force.
const examLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `exam:${req.user._id}:${req.params.id}`,
  message: { error: 'Too many exam attempts. Review the lessons and try again in an hour.' },
  skip: () => process.env.NODE_ENV === 'test',
});

export function registerCourseRoutes(app) {
  // ---------- Final exam ----------
  app.post('/api/paths/:id/exam', requireAuth, examLimiter, ah(async (req, res) => {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Course not found' });
    const path = await Path.findOne({ _id: req.params.id, status: 'published' }).populate('domain', 'name');
    if (!path) return res.status(404).json({ error: 'Course not found' });
    if (!(await can(req.user, pathResource(path), 'take_exam'))) return res.status(403).json(FORBIDDEN);
    if (!path.finalExam.length) return res.status(400).json({ error: 'This course has no final exam' });
    const progress = await Progress.findOne({ user: req.user._id, path: path._id });
    if (!allLessonsDone(path, progress)) return res.status(400).json({ error: 'Finish every lesson before the final exam' });

    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    const correct = path.finalExam.map((q, i) => answers[i] === q.answer);
    const score = Math.round((100 * correct.filter(Boolean).length) / path.finalExam.length);
    const passed = score >= EXAM_PASS_MARK;

    progress.examAttempts += 1;
    if (score > (progress.examScore ?? -1)) progress.examScore = score;
    await progress.save();

    const certificate = passed ? await issueCertificate(req.user, path, progress) : null;
    // After a fail, only the score is returned: per-question right/wrong would leak the answer key in a few attempts.
    const results = passed ? correct.map((ok, i) => ({ correct: ok, answer: path.finalExam[i].answer })) : null;
    res.json({
      passed,
      score,
      correctCount: correct.filter(Boolean).length,
      total: path.finalExam.length,
      passMark: EXAM_PASS_MARK,
      results,
      progress,
      certificate: certificate && publicCertificate(certificate),
    });
  }));

  // ---------- Certificates ----------
  // Claim / fetch my certificate for a course (issued automatically when eligible).
  app.post('/api/paths/:id/certificate', requireAuth, ah(async (req, res) => {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Course not found' });
    const path = await Path.findById(req.params.id).populate('domain', 'name');
    if (!path) return res.status(404).json({ error: 'Course not found' });
    if (!(await can(req.user, pathResource(path), 'claim_certificate'))) return res.status(403).json(FORBIDDEN);
    const progress = await Progress.findOne({ user: req.user._id, path: path._id });
    const cert = await issueCertificate(req.user, path, progress);
    if (!cert) {
      return res.status(400).json({
        error: path.finalExam.length ? `Finish every lesson and pass the final exam (${EXAM_PASS_MARK}%) first` : 'Finish every lesson first',
      });
    }
    res.json(publicCertificate(cert));
  }));

  // Own certificates only (the query is filtered by req.user).
  app.get('/api/me/certificates', requireAuth, authorize('certificate', 'list_mine'), ah(async (req, res) => {
    const certs = await Certificate.find({ user: req.user._id }).sort('-createdAt').lean();
    res.json(certs.map(publicCertificate));
  }));

  // Public verification by design: anyone with the code can check it is genuine. Only public fields are returned.
  // Deliberately not behind Cerbos, so certificates stay verifiable even if the permission service is down.
  app.get('/api/certificates/:code', ah(async (req, res) => {
    const code = String(req.params.code).toUpperCase();
    if (!/^SK-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(code)) return res.status(404).json({ error: 'Certificate not found' });
    const cert = await Certificate.findOne({ code }).lean();
    if (!cert) return res.status(404).json({ error: 'Certificate not found' });
    res.json(publicCertificate(cert));
  }));

  // ---------- Admin: turn a path into a full course ----------
  // body: { structure?: true, videos?: true, overwrite?: false }
  app.post('/api/admin/paths/:id/enrich', requireAuth, ah(async (req, res) => {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Path not found' });
    const path = await Path.findById(req.params.id).populate('domain', 'name');
    if (!path) return res.status(404).json({ error: 'Path not found' });
    if (!(await can(req.user, pathResource(path), 'enrich'))) return res.status(403).json(FORBIDDEN);
    const { structure = true, videos = true, overwrite = false } = req.body || {};
    const notes = [];

    if (structure) {
      const e = await enrichPath({ domain: path.domain?.name || '', path });
      if (e) {
        applyEnrichment(path, e, { overwrite });
        notes.push('modules, video searches and final exam drafted');
      } else notes.push('no GEMINI_API_KEY: structure and exam skipped');
    }
    if (videos) {
      if (!hasYouTubeKey()) notes.push('no YOUTUBE_API_KEY: videos skipped');
      else {
        if (overwrite) path.steps.forEach((s) => { s.video = null; });
        try {
          notes.push(`${await fillVideos(path, path.domain?.name)} video(s) added`);
        } catch (err) {
          if (!(err instanceof QuotaError)) throw err;
          notes.push(err.message);
        }
      }
    }
    await path.save();
    res.json({ path, notes });
  }));
}
