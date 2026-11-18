import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from './db.js';
import { User, Domain, Path } from './models.js';
import { normalisePath } from './ai.js';

const DOMAINS = [
  { name: 'Web Development', slug: 'web-development', icon: '💻', description: 'Build websites and web apps, from HTML to full-stack.' },
  { name: 'Electronics', slug: 'electronics', icon: '🔌', description: 'Circuits, components, Arduino and embedded basics.' },
  { name: 'Photography', slug: 'photography', icon: '📷', description: 'Camera basics, composition, light and editing.' },
  { name: 'Spoken English', slug: 'spoken-english', icon: '🗣️', description: 'Confident everyday and professional English.' },
];

// One hand-written sample path so the app has real content without an AI key.
const PHOTO_PATH = {
  title: 'Photography Basics',
  description: 'For anyone with a phone or camera who wants sharper, better-lit, better-composed photos.',
  steps: [
    {
      title: 'The exposure triangle',
      summary: 'Aperture, shutter speed and ISO together decide how bright a photo is. Each one also changes the look: depth of field, motion blur and grain.',
      estimatedHours: 2,
      searchQueries: ['exposure triangle explained for beginners'],
      quiz: [
        { question: 'Which setting mainly controls motion blur?', options: ['Aperture', 'Shutter speed', 'ISO', 'White balance'], answer: 1 },
        { question: 'A wider aperture (smaller f-number like f/1.8) gives…', options: ['More background blur', 'Less light', 'More grain', 'Slower shutter'], answer: 0 },
        { question: 'Raising ISO makes the photo brighter but adds…', options: ['Motion blur', 'Noise / grain', 'Background blur', 'Lens distortion'], answer: 1 },
      ],
    },
    {
      title: 'Composition: rule of thirds and leading lines',
      summary: 'Where you place the subject matters as much as the camera. Learn the rule of thirds, leading lines, framing and keeping the background clean.',
      estimatedHours: 2,
      searchQueries: ['photography composition rule of thirds leading lines'],
      quiz: [
        { question: 'The rule of thirds places the subject…', options: ['Exactly in the centre', 'On or near the grid lines/intersections', 'At the very edge', 'Always at the bottom'], answer: 1 },
        { question: 'Leading lines are used to…', options: ['Guide the eye toward the subject', 'Reduce noise', 'Increase shutter speed', 'Fix white balance'], answer: 0 },
        { question: 'A cluttered background usually…', options: ['Strengthens the subject', 'Distracts from the subject', 'Makes photos sharper', 'Has no effect'], answer: 1 },
      ],
    },
    {
      title: 'Understanding light',
      summary: 'Light direction, softness and colour shape the mood. Practise with golden hour, window light and open shade.',
      estimatedHours: 2,
      searchQueries: ['natural light photography tips golden hour window light'],
      quiz: [
        { question: 'Golden hour is…', options: ['Midday sun', 'Shortly after sunrise and before sunset', 'Any cloudy day', 'Night time'], answer: 1 },
        { question: 'Soft light comes from a light source that is…', options: ['Small and far', 'Large relative to the subject', 'Always red', 'Directly overhead at noon'], answer: 1 },
        { question: 'Harsh midday sun often causes…', options: ['Strong shadows under eyes', 'Blurry photos', 'Low contrast', 'Blue colour cast'], answer: 0 },
      ],
    },
    {
      title: 'Basic editing',
      summary: 'Use a free editor (Snapseed, Lightroom Mobile or GIMP) to crop, straighten, adjust exposure and colour without over-editing.',
      estimatedHours: 3,
      searchQueries: ['beginner photo editing snapseed lightroom mobile tutorial'],
      quiz: [
        { question: 'Which edit fixes a tilted horizon?', options: ['Saturation', 'Straighten / rotate', 'Sharpen', 'Vignette'], answer: 1 },
        { question: 'Shooting in RAW instead of JPEG gives…', options: ['Smaller files', 'More editing flexibility', 'Automatic filters', 'Faster shutter'], answer: 1 },
        { question: 'A common beginner editing mistake is…', options: ['Cropping', 'Over-saturating colours', 'Adjusting exposure', 'Straightening'], answer: 1 },
      ],
    },
  ],
};

await connectDB();

for (const d of DOMAINS) {
  await Domain.updateOne({ slug: d.slug }, { $setOnInsert: d }, { upsert: true });
}

const email = (process.env.ADMIN_EMAIL || 'admin@skillora.local').toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!password) throw new Error('Set ADMIN_PASSWORD in server/.env before seeding');
let admin = await User.findOne({ email });
if (!admin) {
  admin = await User.create({ name: 'Skillora Admin', email, role: 'admin', passwordHash: await bcrypt.hash(password, 10) });
  console.log(`[seed] admin created: ${email}`);
}

const photo = await Domain.findOne({ slug: 'photography' });
if (!(await Path.exists({ domain: photo._id, title: PHOTO_PATH.title }))) {
  await Path.create({
    ...normalisePath(PHOTO_PATH, { level: 'beginner' }),
    domain: photo._id,
    status: 'published',
    generatedBy: 'manual',
    createdBy: admin._id,
  });
  console.log('[seed] sample path created: Photography Basics');
}

console.log('[seed] done');
await disconnectDB();
