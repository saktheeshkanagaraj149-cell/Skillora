import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // 'tutor' is reserved for stage 3
    role: { type: String, enum: ['learner', 'tutor', 'admin'], default: 'learner' },
    country: { type: String, default: '' },
  },
  { timestamps: true },
);

const domainSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true },
    icon: { type: String, default: '📚' },
    category: { type: String, default: 'Other', index: true },
    description: { type: String, default: '' },
  },
  { timestamps: true },
);

const resourceSchema = new Schema(
  {
    title: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, enum: ['video', 'article', 'course', 'practice', 'search'], default: 'search' },
  },
  { _id: false },
);

const questionSchema = new Schema(
  {
    question: { type: String, required: true },
    options: { type: [String], validate: (v) => v.length >= 2 && v.length <= 6 },
    answer: { type: Number, required: true }, // index into options; never sent to learners
  },
  { _id: false },
);

// One embedded YouTube video per lesson. Found via the YouTube Data API (never invented by the AI) or pasted by an admin.
const videoSchema = new Schema(
  {
    youtubeId: { type: String, required: true, match: /^[\w-]{11}$/ },
    title: { type: String, default: '' },
    channel: { type: String, default: '' },
  },
  { _id: false },
);

// A step is one lesson. Lessons with the same `module` name form one module of the course, in order.
const stepSchema = new Schema({
  module: { type: String, default: '', trim: true, maxlength: 200 },
  title: { type: String, required: true },
  summary: { type: String, default: '' },
  estimatedHours: { type: Number, default: 1 },
  video: { type: videoSchema, default: null },
  videoQuery: { type: String, default: '' }, // what to search YouTube for when (re)finding the video
  resources: [resourceSchema],
  quiz: [questionSchema],
});

const pathSchema = new Schema(
  {
    domain: { type: Schema.Types.ObjectId, ref: 'Domain', required: true }, // indexed via { domain, status } below
    title: { type: String, required: true, trim: true },
    level: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
    description: { type: String, default: '' },
    steps: [stepSchema],
    finalExam: [questionSchema], // passing it (with every lesson done) earns the certificate
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    generatedBy: { type: String, default: 'manual' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// Domain page lists published paths of one domain
pathSchema.index({ domain: 1, status: 1 });

const progressSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    path: { type: Schema.Types.ObjectId, ref: 'Path', required: true },
    completedSteps: [{ type: Schema.Types.ObjectId }],
    quizScores: { type: Map, of: Number, default: {} }, // stepId -> best score (0-100)
    completedAt: { type: Date, default: null }, // set when every step is done = badge earned
    examScore: { type: Number, default: null }, // best final exam score (0-100)
    examAttempts: { type: Number, default: 0 },
  },
  { timestamps: true },
);
progressSchema.index({ user: 1, path: 1 }, { unique: true }); // one progress doc per learner per path
progressSchema.index({ user: 1, updatedAt: -1 }); // dashboard: my paths, most recent first

// Issued once per learner per course. Fields are copied at issue time so the certificate never changes
// if the course is later renamed or the learner edits their profile. `code` is public: /certificate/<code> verifies it.
const certificateSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    path: { type: Schema.Types.ObjectId, ref: 'Path', required: true },
    learnerName: { type: String, required: true },
    courseTitle: { type: String, required: true },
    domainName: { type: String, default: '' },
    level: { type: String, default: 'beginner' },
    hours: { type: Number, default: 0 },
    lessons: { type: Number, default: 0 },
    score: { type: Number, default: null }, // final exam score; null when the course has no exam
  },
  { timestamps: true },
);
certificateSchema.index({ user: 1, path: 1 }, { unique: true });

export const User = model('User', userSchema);
export const Domain = model('Domain', domainSchema);
export const Path = model('Path', pathSchema);
export const Progress = model('Progress', progressSchema);
export const Certificate = model('Certificate', certificateSchema);
