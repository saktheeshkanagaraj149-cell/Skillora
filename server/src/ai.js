/**
 * Turns a domain + topic into a course draft: modules -> lessons, each lesson with a quiz,
 * plus a final exam that unlocks the certificate.
 *
 * The AI never invents URLs (models make up links that 404). It returns *search queries*:
 * `videoQuery` is used by youtube.js to find a real embeddable video, the others become
 * YouTube / web search links. An admin can swap anything before publishing.
 */

const LEVELS = ['beginner', 'intermediate', 'advanced'];
export const MAX_LESSONS = 24;

const searchLinks = (query) => [
  { title: `Videos: ${query}`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, type: 'search' },
  { title: `Articles: ${query}`, url: `https://www.google.com/search?q=${encodeURIComponent(query + ' tutorial')}`, type: 'search' },
];

const QUESTION_SHAPE = '{ "question": string, "options": [string, string, string, string], "answer": number }  // answer = index 0-3';

function buildPrompt({ domain, topic, level, steps }) {
  return `You are designing a free self-study online course.
Domain: ${domain}
Topic: ${topic}
Learner level: ${level}
Total number of lessons: ${steps}

Return ONLY JSON with this exact shape:
{
  "title": string,                 // short course title
  "description": string,           // 1-2 sentences, who it is for and the outcome
  "modules": [                     // 3-5 modules, ordered from fundamentals to practical skill
    {
      "title": string,             // module name, e.g. "Getting started"
      "lessons": [
        {
          "title": string,
          "summary": string,       // 2-3 sentences: what to learn and why
          "estimatedHours": number,
          "videoQuery": string,    // a precise YouTube search that finds ONE good free tutorial video for this exact lesson
          "searchQueries": [string], // 1-2 queries to find free articles/practice for this lesson
          "quiz": [ ${QUESTION_SHAPE} ]  // exactly 3 questions testing this lesson
        }
      ]
    }
  ],
  "finalExam": [ ${QUESTION_SHAPE} ]  // exactly 10 questions covering the whole course, harder than lesson quizzes
}
The modules together must contain exactly ${steps} lessons. Do not include URLs.`;
}

function buildEnrichPrompt({ domain, path }) {
  const lessons = path.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.summary}`).join('\n');
  return `You are turning an existing free self-study learning path into a structured online course.
Domain: ${domain}
Course: ${path.title} (${path.level})
Lessons, in order:
${lessons}

Return ONLY JSON with this exact shape:
{
  "modules": [string],       // one module name per lesson, same order and same count (${path.steps.length}). Consecutive lessons that belong together share the exact same module name; use 2-5 distinct modules.
  "videoQueries": [string],  // one precise YouTube search per lesson, same order, that finds ONE good free tutorial video for that lesson
  "finalExam": [ ${QUESTION_SHAPE} ]  // exactly 10 questions covering the whole course
}
Do not include URLs.`;
}

/** Keeps only well-formed multiple-choice questions. */
export function normaliseQuestions(list, max = 5) {
  return (Array.isArray(list) ? list : [])
    .filter(
      (q) =>
        q &&
        typeof q.question === 'string' &&
        q.question.trim() &&
        Array.isArray(q.options) &&
        q.options.length >= 2 &&
        q.options.length <= 6 &&
        Number.isInteger(q.answer) &&
        q.answer >= 0 &&
        q.answer < q.options.length,
    )
    .slice(0, max)
    .map((q) => ({ question: q.question.slice(0, 500), options: q.options.map((o) => String(o).slice(0, 300)), answer: q.answer }));
}

/** Validates and normalises model output into our Path shape. Accepts `modules` (new) or flat `steps` (old). Throws on unusable output. */
export function normalisePath(raw, { level }) {
  let lessons = [];
  if (Array.isArray(raw?.modules)) {
    lessons = raw.modules.flatMap((m, mi) =>
      (Array.isArray(m?.lessons) ? m.lessons : []).map((l) => ({ ...l, module: String(m.title || `Module ${mi + 1}`) })),
    );
  } else if (Array.isArray(raw?.steps)) {
    lessons = raw.steps;
  }
  if (lessons.length === 0) throw new Error('AI response had no steps');

  const steps = lessons.slice(0, MAX_LESSONS).map((s, i) => {
    const title = String(s.title || `Lesson ${i + 1}`).slice(0, 200);
    const queries = (Array.isArray(s.searchQueries) ? s.searchQueries : [s.title]).filter(Boolean).slice(0, 2);
    return {
      module: String(s.module || '').slice(0, 200),
      title,
      summary: String(s.summary || '').slice(0, 1000),
      estimatedHours: Number(s.estimatedHours) > 0 ? Math.min(Number(s.estimatedHours), 100) : 1,
      videoQuery: String(s.videoQuery || queries[0] || title).slice(0, 150),
      video: null,
      resources: queries.flatMap((q) => searchLinks(String(q).slice(0, 150))),
      quiz: normaliseQuestions(s.quiz, 5),
    };
  });
  return {
    title: String(raw.title || 'Untitled path').slice(0, 200),
    description: String(raw.description || '').slice(0, 1000),
    level: LEVELS.includes(level) ? level : 'beginner',
    steps,
    finalExam: normaliseQuestions(raw.finalExam, 20),
  };
}

/** Normalises enrich output against the existing lessons. Missing/short arrays fall back to sensible defaults. */
export function normaliseEnrichment(raw, path) {
  const n = path.steps.length;
  const modules = Array.isArray(raw?.modules) && raw.modules.length === n ? raw.modules.map((m) => String(m || '').slice(0, 200)) : null;
  const queries = Array.isArray(raw?.videoQueries) ? raw.videoQueries : [];
  return {
    modules, // null = keep existing grouping
    videoQueries: path.steps.map((s, i) => String(queries[i] || s.videoQuery || s.title).slice(0, 150)),
    finalExam: normaliseQuestions(raw?.finalExam, 20),
  };
}

const TEMPLATE_MODULES = ['Getting started', 'Core skills', 'Putting it into practice'];

/** Offline fallback so the app works without an API key. */
function templatePath({ domain, topic, level, steps }) {
  const names = ['Fundamentals', 'Core concepts', 'Tools and setup', 'Hands-on practice', 'Common mistakes', 'Mini project', 'Next steps'];
  return {
    title: `${topic} (${level})`,
    description: `A ${level} course for learning ${topic} in ${domain}. Template draft: add an AI key or edit the lessons by hand.`,
    steps: Array.from({ length: steps }, (_, i) => {
      const name = names[i % names.length];
      return {
        module: TEMPLATE_MODULES[Math.min(TEMPLATE_MODULES.length - 1, Math.floor((i * TEMPLATE_MODULES.length) / steps))],
        title: `${topic}: ${name}`,
        summary: `Learn the ${name.toLowerCase()} of ${topic}.`,
        estimatedHours: 2,
        videoQuery: `${topic} ${name} tutorial for ${level}`,
        searchQueries: [`${topic} ${name} for ${level}`],
        quiz: [],
      };
    }),
    finalExam: [],
  };
}

function modelList() {
  return [
    process.env.GEMINI_MODEL || 'gemini-flash-latest',
    ...(process.env.GEMINI_FALLBACK_MODELS || 'gemini-flash-lite-latest,gemini-2.5-flash-lite').split(','),
  ]
    .map((m) => m.trim())
    .filter((m, i, a) => m && a.indexOf(m) === i);
}

/** Calls Gemini with fallbacks when Google reports overload / rate limit; `parse` validates the JSON. */
async function askAI(prompt, parse) {
  const key = process.env.GEMINI_API_KEY;
  let lastError;
  for (const model of modelList()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return { result: parse(await callGemini(model, key, prompt)), model };
      } catch (err) {
        lastError = err;
        if (!err.retryable) break; // e.g. 400/401/404 or bad shape: try the next model, don't retry this one
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
  }
  throw new Error(`AI is busy right now, please try again in a minute (${lastError?.message?.slice(0, 120)})`);
}

export async function generatePath({ domain, topic, level = 'beginner', steps = 12 }) {
  const count = Math.max(3, Math.min(Number(steps) || 12, MAX_LESSONS));
  const input = { domain, topic, level, steps: count };

  if (!process.env.GEMINI_API_KEY) {
    return { ...normalisePath(templatePath(input), input), generatedBy: 'template' };
  }
  const { result, model } = await askAI(buildPrompt(input), (raw) => normalisePath(raw, input));
  return { ...result, generatedBy: model };
}

/**
 * For an existing path: suggests module grouping, a YouTube query per lesson and a final exam,
 * keeping the admin's lessons, quizzes and resources as they are. Returns null without an AI key.
 */
export async function enrichPath({ domain, path }) {
  if (!process.env.GEMINI_API_KEY) return null;
  const { result } = await askAI(buildEnrichPrompt({ domain, path }), (raw) => {
    const e = normaliseEnrichment(raw, path);
    if (!e.finalExam.length) throw Object.assign(new Error('AI returned no exam questions'), { retryable: true });
    return e;
  });
  return result;
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

async function callGemini(model, key, prompt) {
  let res;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
      }),
      signal: AbortSignal.timeout(90_000), // full courses are long answers
    });
  } catch (e) {
    throw Object.assign(new Error(`${model}: ${e.name === 'TimeoutError' ? 'timed out' : e.message}`), { retryable: e.name !== 'TimeoutError' }); // slow model: skip to fallback
  }
  if (!res.ok) {
    const body = await res.text();
    throw Object.assign(new Error(`${model} ${res.status}: ${body.slice(0, 200)}`), { retryable: RETRYABLE.has(res.status) });
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error(`${model}: invalid JSON`), { retryable: true });
  }
}
