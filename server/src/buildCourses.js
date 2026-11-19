/**
 * Makes sure every domain has a full course: modules -> lessons (video + quiz) -> final exam -> certificate.
 *
 *   npm run build:courses                  domains without a path get a new 12-lesson course;
 *                                          existing paths get modules, video searches and a final exam added
 *                                          (lessons, quizzes and resources are kept); then videos are filled in
 *   npm run build:courses -- --fresh       also REPLACES AI-generated drafts with brand-new full courses
 *                                          (published and hand-made paths are never replaced)
 *   npm run build:courses -- --publish     publishes every course that ends up with videos + a final exam
 *   npm run build:courses -- --only=photography,music     limit to some domain slugs
 *   npm run build:courses -- --lessons=10  lessons per new course (default 12)
 *
 * Safe to re-run: finished work is skipped. YouTube's free quota covers ~100 lessons a day, so a full
 * catalogue takes a few runs; each run continues where the last stopped.
 */
import 'dotenv/config';
import { connectDB, disconnectDB } from './db.js';
import { Domain, Path, Progress, User } from './models.js';
import { generatePath, enrichPath } from './ai.js';
import { applyEnrichment } from './courses.js';
import { fillVideos, hasYouTubeKey, QuotaError } from './youtube.js';
import { DOMAINS } from './domains.js';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const FRESH = flag('fresh');
const PUBLISH = flag('publish');
const ONLY = opt('only')?.split(',').map((s) => s.trim()).filter(Boolean);
const LESSONS = Number(opt('lessons')) || 12;

const log = (...a) => console.log('[courses]', ...a);

await connectDB();
if (!process.env.GEMINI_API_KEY) log('no GEMINI_API_KEY: new courses will be plain templates and no exams can be written');
if (!hasYouTubeKey()) log('no YOUTUBE_API_KEY: lessons keep search links instead of embedded videos');

const admin = await User.findOne({ role: 'admin' });
const starterBySlug = Object.fromEntries(DOMAINS.map((d) => [d.slug, d.starter]));
const domains = (await Domain.find().sort('name')).filter((d) => !ONLY || ONLY.includes(d.slug));
const summary = { created: 0, replaced: 0, enriched: 0, videos: 0, published: 0, failed: [] };
let quotaHit = false;

for (const d of domains) {
  try {
    let paths = await Path.find({ domain: d._id });

    // 1. New / replacement courses
    const replaceable = FRESH ? paths.filter((p) => p.status === 'draft' && p.generatedBy && !['manual', 'template'].includes(p.generatedBy) && !p.finalExam.length) : [];
    if (paths.length === 0 || replaceable.length) {
      const topic = starterBySlug[d.slug] || `${d.name} for beginners`;
      const draft = await generatePath({ domain: d.name, topic, level: 'beginner', steps: LESSONS });
      const created = await Path.create({ ...draft, domain: d._id, status: 'draft', createdBy: admin?._id });
      for (const old of replaceable) {
        await Progress.deleteMany({ path: old._id }); // drafts are hidden from learners, so this is normally empty
        await old.deleteOne();
      }
      replaceable.length ? summary.replaced++ : summary.created++;
      log(`+ ${d.name}: ${draft.title} (${draft.steps.length} lessons, ${draft.finalExam.length} exam questions, ${draft.generatedBy})`);
      paths = await Path.find({ domain: d._id });
    }

    for (const path of paths) {
      // 2. Structure + exam for paths made before courses existed
      const needsStructure = !path.steps.some((s) => s.module) || !path.finalExam.length || path.steps.some((s) => !s.videoQuery);
      if (needsStructure && process.env.GEMINI_API_KEY) {
        const e = await enrichPath({ domain: d.name, path });
        applyEnrichment(path, e);
        summary.enriched++;
        log(`~ ${d.name} / ${path.title}: modules + ${path.finalExam.length}-question exam`);
      }

      // 3. Videos
      if (hasYouTubeKey() && !quotaHit) {
        try {
          const n = await fillVideos(path, d.name);
          summary.videos += n;
          if (n) log(`▶ ${d.name} / ${path.title}: ${n} video(s)`);
        } catch (err) {
          if (!(err instanceof QuotaError)) throw err;
          quotaHit = true;
          log(`! ${err.message}`);
        }
      }

      // 4. Publish when complete
      const complete = path.finalExam.length > 0 && path.steps.every((s) => s.video?.youtubeId || !hasYouTubeKey());
      if (PUBLISH && path.status === 'draft' && complete) {
        path.status = 'published';
        summary.published++;
        log(`✓ published ${d.name} / ${path.title}`);
      }
      await path.save();
    }
  } catch (err) {
    summary.failed.push(d.name);
    log(`✗ ${d.name}: ${err.message}`);
  }
}

log(
  `done: ${summary.created} new, ${summary.replaced} replaced, ${summary.enriched} upgraded, ${summary.videos} videos, ${summary.published} published` +
    (summary.failed.length ? `; failed: ${summary.failed.join(', ')} (re-run to retry)` : '') +
    (quotaHit ? '; YouTube quota reached, run again tomorrow to finish videos' : ''),
);
await disconnectDB();
