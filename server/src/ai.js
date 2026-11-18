/**
 * Turns a domain + topic into a learning path draft.
 *
 * The AI never invents URLs (models make up links that 404). It returns *search
 * queries*, which we turn into YouTube / web search links. An admin can then swap
 * them for hand-picked resources before publishing.
 */

const LEVELS = ['beginner', 'intermediate', 'advanced'];

const searchLinks = (query) => [
  { title: `Videos: ${query}`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, type: 'search' },
  { title: `Articles: ${query}`, url: `https://www.google.com/search?q=${encodeURIComponent(query + ' tutorial')}`, type: 'search' },
];

function buildPrompt({ domain, topic, level, steps }) {
  return `You are designing a free self-study learning path.
Domain: ${domain}
Topic: ${topic}
Learner level: ${level}
Number of steps: ${steps}

Return ONLY JSON with this exact shape:
{
  "title": string,                 // short path title
  "description": string,           // 1-2 sentences, who it is for and the outcome
  "steps": [
    {
      "title": string,
      "summary": string,           // 2-3 sentences: what to learn and why
      "estimatedHours": number,
      "searchQueries": [string],   // 1-2 precise queries to find free videos/articles for this step
      "quiz": [                    // exactly 3 multiple-choice questions testing this step
        { "question": string, "options": [string, string, string, string], "answer": number }  // answer = index 0-3
      ]
    }
  ]
}
Order steps from fundamentals to practical skill. Do not include URLs.`;
}

/** Validates and normalises model output into our Path shape. Throws on unusable output. */
export function normalisePath(raw, { level }) {
  if (!raw || !Array.isArray(raw.steps) || raw.steps.length === 0) {
    throw new Error('AI response had no steps');
  }
  const steps = raw.steps.slice(0, 20).map((s, i) => {
    const queries = (Array.isArray(s.searchQueries) ? s.searchQueries : [s.title]).filter(Boolean).slice(0, 2);
    const quiz = (Array.isArray(s.quiz) ? s.quiz : [])
      .filter(
        (q) =>
          q &&
          typeof q.question === 'string' &&
          Array.isArray(q.options) &&
          q.options.length >= 2 &&
          Number.isInteger(q.answer) &&
          q.answer >= 0 &&
          q.answer < q.options.length,
      )
      .slice(0, 5)
      .map((q) => ({ question: q.question, options: q.options.map(String).slice(0, 6), answer: q.answer }));
    return {
      title: String(s.title || `Step ${i + 1}`).slice(0, 200),
      summary: String(s.summary || '').slice(0, 1000),
      estimatedHours: Number(s.estimatedHours) > 0 ? Math.min(Number(s.estimatedHours), 100) : 1,
      resources: queries.flatMap((q) => searchLinks(String(q).slice(0, 150))),
      quiz,
    };
  });
  return {
    title: String(raw.title || 'Untitled path').slice(0, 200),
    description: String(raw.description || '').slice(0, 1000),
    level: LEVELS.includes(level) ? level : 'beginner',
    steps,
  };
}

/** Offline fallback so the app works without an API key. */
function templatePath({ domain, topic, level, steps }) {
  const names = ['Fundamentals', 'Core concepts', 'Tools and setup', 'Hands-on practice', 'Common mistakes', 'Mini project', 'Next steps'];
  return {
    title: `${topic} (${level})`,
    description: `A ${level} path for learning ${topic} in ${domain}. Template draft: add an AI key or edit the steps by hand.`,
    steps: Array.from({ length: steps }, (_, i) => {
      const t = `${topic}: ${names[i % names.length]}`;
      return {
        title: t,
        summary: `Learn the ${names[i % names.length].toLowerCase()} of ${topic}.`,
        estimatedHours: 2,
        searchQueries: [`${topic} ${names[i % names.length]} for ${level}`],
        quiz: [],
      };
    }),
  };
}

export async function generatePath({ domain, topic, level = 'beginner', steps = 6 }) {
  const count = Math.max(3, Math.min(Number(steps) || 6, 12));
  const input = { domain, topic, level, steps: count };
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    return { ...normalisePath(templatePath(input), input), generatedBy: 'template' };
  }

  // Primary model first, then fallbacks when Google reports overload / rate limit.
  const models = [
    process.env.GEMINI_MODEL || 'gemini-flash-latest',
    ...(process.env.GEMINI_FALLBACK_MODELS || 'gemini-flash-lite-latest,gemini-2.5-flash-lite').split(','),
  ]
    .map((m) => m.trim())
    .filter((m, i, a) => m && a.indexOf(m) === i);

  let lastError;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const parsed = await callGemini(model, key, buildPrompt(input));
        return { ...normalisePath(parsed, input), generatedBy: model };
      } catch (err) {
        lastError = err;
        if (!err.retryable) break; // e.g. 400/401/404: try the next model, don't retry this one
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
  }
  throw new Error(`AI is busy right now, please try again in a minute (${lastError?.message?.slice(0, 120)})`);
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
      signal: AbortSignal.timeout(45_000),
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
