# Courses, videos, exams and certificates

Every skill (domain) has at least one **course**:

```
Course (a Path)
 ├─ Module 1  ─ Lesson ─ Lesson ─ Lesson      each lesson: embedded YouTube video, summary,
 ├─ Module 2  ─ Lesson ─ Lesson               free resources, 3-question quiz (pass 60%)
 ├─ Module 3  ─ …
 └─ Final exam (10 questions, pass 70%)  →  Certificate (unique ID, public verify page, PDF, LinkedIn)
```

- A lesson's `module` field groups lessons: consecutive lessons with the same module name form one module.
- The final exam unlocks once every lesson is done. Correct answers are only shown after a pass.
- A course with no exam questions gives its certificate when every lesson is done.
- Certificates are issued once per learner per course, with the name, course and score fixed at issue time.
  Anyone can check one at `/certificate/SK-XXXXX-XXXXX`.

## Keys (server/.env)

| Key | What for | Where |
|---|---|---|
| `GEMINI_API_KEY` | writes the modules, lessons, quizzes and final exam | https://aistudio.google.com/apikey |
| `YOUTUBE_API_KEY` | finds one real, embeddable video per lesson | Google Cloud console → enable **YouTube Data API v3** → Credentials → API key |

The AI never writes video links. It writes a search (`videoQuery`) for each lesson, and the YouTube API
returns a real embeddable video with safe search on, 4 to 20 minutes long. The free YouTube quota covers
**about 100 lessons a day**, so building every skill takes a few runs. Each run continues where the last one stopped.

## Build every skill

```bash
npm run build:courses                       # new 12-lesson course for each domain without one;
                                            # adds modules, final exam and videos to existing ones
npm run build:courses -- --fresh            # also replace the old 6-step AI drafts with full new courses
npm run build:courses -- --publish          # publish every course that has videos and an exam
npm run build:courses -- --only=music,photography
npm run build:courses -- --lessons=15
```

Published and hand-made courses are never replaced. Only `--fresh` replaces anything, and then only
unpublished AI drafts that have no exam yet.

Recommended first run on the laptop that has the real `.env`:

```bash
npm run build:courses -- --fresh            # write all courses (Gemini) and as many videos as today's quota allows
npm run build:courses                       # the next day(s): finish the videos
# then review in /admin and Publish, or: npm run build:courses -- --publish
```

## Admin page

- **Build full course with AI** (in the editor): adds modules, a video search for each lesson, a 10-question
  exam, and videos. Your lessons, quizzes and resources are kept.
- Each lesson has **Module** and **Video** fields. Paste any YouTube link to replace the video.
- The **Final exam** section lists the questions and answers; remove any you don't like.
- The course table shows lessons, modules, videos found and exam size for each course.
