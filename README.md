# 🌱 Skillora

**Learn any skill. Free. In the right order.**

Free content for any skill is already online, but it is scattered, unordered and unverified, and paid platforms are expensive in most of the world. Skillora turns the best free videos and articles into a **clear step-by-step learning path** for any domain (web development, electronics, photography, spoken English and more). Each course is split into modules and lessons. Every lesson has an embedded video and a quick quiz, and a final exam awards a **verifiable certificate**.

> Core learning stays **free forever**. Later, affordable help from verified tutors, priced by country.

---

## Roadmap

| Stage | What learners get | Status |
|---|---|---|
| **1. Courses (MVP)** | Domains → AI-drafted, admin-curated courses → modules → lessons (YouTube video + free resources + quiz) → final exam → certificate | ✅ Built |
| **2. Community** | Upvote/report resources, doubts per step, study buddies | Planned |
| **3. Tutors** | Verified tutors (often top learners) offer paid live sessions and reviews. Prices adjust by country (purchasing power parity); Skillora takes a small commission | Planned |

### Portals
- **Learner:** browse domains, follow paths, watch lesson videos, take quizzes and the final exam, track progress, earn badges and certificates *(stage 3: book tutors)*
- **Admin:** add domains, generate paths with AI, edit and curate, publish *(stage 3: approve tutors)*
- **Tutor** *(stage 3)*: apply, prove the skill (domain quiz, portfolio, admin approval), set price and availability, get rated

---

📘 **Docs:** [Database structure](docs/DATABASE.md) · [Deployment guide](docs/DEPLOY.md)

## Tech stack
- **Client:** React 18 + Vite + React Router
- **Server:** Node.js + Express + MongoDB Atlas (Mongoose), JWT auth, bcrypt, helmet, rate limiting
- **Authorization:** [Cerbos](https://github.com/cerbos/cerbos) policies decide who can view, complete, create, edit and delete paths and domains
- **Hosting:** Render (API + Cerbos in one Docker container) + Vercel (web) + MongoDB Atlas (DB)
- **AI:** Google Gemini (free tier) drafts paths and quizzes. It returns *search queries*, not URLs, so we never ship made-up links. Admins swap in hand-picked resources before publishing.

## Run it locally

```bash
npm run install:all                     # install server + client
cp server/.env.example server/.env      # then set JWT_SECRET and ADMIN_PASSWORD
npm run cerbos --prefix server          # start the Cerbos authorization server (needs Docker Desktop)
npm run seed                            # 23 domains in 7 categories, admin account, sample "Photography Basics" path
npm run generate:starters               # AI drafts a beginner path for every domain without one (re-run to retry failures)
npm run build:courses                   # full course (modules, videos, exam) for every skill, see docs/COURSES.md
npm run dev:server                      # API → http://localhost:5000
npm run dev:client                      # app → http://localhost:5173  (second terminal)
npm test                                # API tests (Cerbos must be running)
npm run test:policies --prefix server   # Cerbos policy tests
```

- **No MongoDB install needed for development:** if `MONGO_URI` is empty, the server starts a local MongoDB automatically and keeps the data in `server/.data/`. Use MongoDB Atlas in production.
- **AI is optional:** without `GEMINI_API_KEY`, "Generate" makes a template draft you can edit. Get a free key at https://aistudio.google.com/apikey.
- **Permissions live in Cerbos policies**, not in route code: `server/cerbos/policies/*.yaml`, with tests in `policies/tests/`. Roles are `guest` (not logged in), `learner`, `tutor` and `admin`. If Cerbos is unreachable the API refuses protected actions with 503 (fails closed) and `/api/health` reports `authz: down`.
- Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `server/.env` to open **/admin**.

## Project structure
```
client/src/
  pages/        Home, DomainPage, PathPage (steps + quiz), Dashboard, Admin, AuthPages
  api.js        fetch wrapper with JWT
  auth.jsx      auth context + protected routes
server/src/
  models.js     User, Domain, Path (steps, resources, quiz), Progress
  app.js        all API routes
  auth.js       login (JWT): who you are
  authz.js      Cerbos checks: what you may do
  ai.js         Gemini path generator + output validation
  seed.js       starter data
server/test/    API tests (node:test)
server/cerbos/  Cerbos config, policies and policy tests
```

## API
| Method | Route | Who |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` · GET `/api/auth/me` | anyone / logged in |
| GET | `/api/domains`, `/api/domains/:slug` | anyone |
| GET | `/api/paths/:id` (quiz answers hidden from learners) | anyone |
| POST | `/api/paths/:id/steps/:stepId/complete` `{ answers: [i…] }` (60% to pass) | learner |
| GET | `/api/me/progress` | learner |
| POST | `/api/paths/:id/exam` `{ answers: [i…] }` (70% to pass, all lessons done first) | learner |
| POST | `/api/paths/:id/certificate` (issue/fetch mine) · GET `/api/me/certificates` | learner |
| GET | `/api/certificates/:code` (public verification) | anyone |
| POST | `/api/admin/paths/:id/enrich` (AI modules + exam, YouTube videos) | admin |
| POST | `/api/domains` | admin |
| GET / POST / PUT / DELETE | `/api/admin/paths`, `/api/admin/paths/generate`, `/api/admin/paths/:id` | admin |
