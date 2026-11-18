# Deploying Skillora

| Part | Host | Cost |
|---|---|---|
| Database | MongoDB Atlas M0 (already set up) | Free |
| API (`server/`) | Render web service, Singapore | Free |
| Website (`client/`) | Vercel | Free |

> Render's free plan **sleeps after 15 minutes without traffic**. The first request after that takes about 50 seconds while it wakes up. Upgrade to the Starter plan ($7/month) to keep it always on.

## 1. Atlas (done)
- Network Access must include `0.0.0.0/0`, because Render has no fixed outgoing IP on the free plan.
- Use a strong, auto-generated password for the database user.
- Data was copied in with `npm run copy-data`.

## 2. API on Render
1. Log in at https://render.com **with GitHub**.
2. **New → Blueprint** → choose the `Skillora` repo. Render reads `render.yaml`.
3. Fill in the secret values when asked:
   - `MONGO_URI`: Atlas connection string, with the database name `/skillora` before the `?`. Write `@` in the password as `%40`.
   - `GEMINI_API_KEY`: your Gemini key.
   - `CLIENT_ORIGIN`: put `http://localhost:5173` for now; you'll change it after step 3.
   - `JWT_SECRET` is generated automatically.
4. **Apply**. When it shows **Live**, open `https://<your-service>.onrender.com/api/health`. It should show `{"ok":true,"db":"up"}`.

## 3. Website on Vercel
1. https://vercel.com → **Add New → Project** → import `Skillora`.
2. **Root Directory: `client`** (the framework is detected as Vite from `vercel.json`).
3. Environment variable: `VITE_API_URL` = `https://<your-service>.onrender.com/api`
4. **Deploy**, then copy the site URL, e.g. `https://skillora.vercel.app`.

## 4. Connect them
Back in Render → `skillora-api` → **Environment**, set `CLIENT_ORIGIN` to your Vercel URL (no trailing slash) and save. Render redeploys automatically.

## 5. Check
- Open the Vercel URL: you should see 23 domains grouped by category.
- Register, open **Photography Basics**, pass a quiz, and check **My learning**.
- Log in as admin, open **/admin**, and check that the drafts are listed.

## After launch
- Every `git push` to `main` redeploys both Render and Vercel automatically.
- To add a domain to the catalogue: edit `server/src/domains.js`, then run `npm run seed` and `npm run generate:starters` against production (`MONGO_URI` set to Atlas).

## What protects production
- **helmet** sets secure HTTP headers.
- **CORS** only allows the origins listed in `CLIENT_ORIGIN`.
- **Rate limits:** 600 requests per 15 minutes per IP overall; 20 login or register attempts per 15 minutes; 30 AI generations per hour.
- The server **refuses to start** in production if `MONGO_URI`, `JWT_SECRET` or `CLIENT_ORIGIN` is missing.
- The health check (`/api/health`) reports the database status, so Render restarts the service if the DB connection drops.
