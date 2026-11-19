Set up and run my project **Skillora** on this Windows laptop for local testing. Do every step yourself, check each one worked, and stop and tell me if something fails.

**What Skillora is:** React + Vite client (`client/`, http://localhost:5173), Node/Express + MongoDB API (`server/`, http://localhost:5000), and a **Cerbos** authorization server in Docker (http://localhost:3592). Cerbos decides permissions. If it isn't running, protected actions return 503 by design.

## Rules
- Work only inside `%USERPROFILE%\Skillora`.
- Never commit, push, or print `server/.env` contents back to me. It holds secrets.
- Don't edit project code or the Cerbos policies. This is a test setup, not development.

## Step 1: Check the tools
Run `git --version`, `node --version` (must be **22.x or newer**), `npm --version`, `docker --version` and `docker info`.
- If something is missing, tell me what to install and stop:
  - Git: https://git-scm.com/download/win
  - Node 22 LTS: https://nodejs.org
  - Docker Desktop: https://www.docker.com/products/docker-desktop/
- If Docker is installed but `docker info` fails, start `C:\Program Files\Docker\Docker\Docker Desktop.exe` and wait until `docker info` works (up to about 2 minutes).

## Step 2: Get the code
```
cd %USERPROFILE%
git clone --branch cerbos-authz https://github.com/saktheeshkanagaraj149-cell/Skillora.git
cd Skillora
```
If the folder already exists, run `git fetch` and `git switch cerbos-authz` and `git pull` instead.

## Step 3: Install dependencies
```
npm run install:all
```
This installs both `server/` and `client/`. Warnings are fine; errors are not.

## Step 4: Create `server/.env`
Copy `server/.env.example` to `server/.env`, then set these values:
- `JWT_SECRET`: generate a random 64-character hex string with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `CLIENT_ORIGIN=http://localhost:5173`
- `CERBOS_URL=http://localhost:3592`
- `ADMIN_EMAIL=admin@skillora.local`
- `ADMIN_PASSWORD`: generate a random 12-character password. Tell me what it is once, at the end, because I need it to log in.
- `MONGO_URI`: **ask me which database to use:**
  - **A. Local test database (recommended):** leave `MONGO_URI=` empty. The server starts its own MongoDB and keeps the data in `server/.data/`. Nothing touches the real data.
  - **B. The real Atlas database:** I'll paste the connection string myself. Warn me that test changes then affect real data, and that Atlas → Network Access must allow this laptop's IP or the connection will time out.
- `GEMINI_API_KEY`: ask me if I want to paste one. It's optional; without it, "Generate path" makes a simple template.

## Step 5: Start Cerbos and run the tests
```
npm run cerbos --prefix server
npm run test:policies --prefix server
npm test
```
- The policy tests must end with `40 tests executed [40 OK]`.
- `npm test` must show `pass 2`, `fail 0`. It uses its own throwaway database.
- If the first `docker` pull is slow, wait. Don't retry in a loop.

## Step 6: Load starter data (only for option A, the local database)
```
npm run seed
```
This creates 23 domains, the admin account from `.env`, and a sample "Photography Basics" path. Skip this step for Atlas.
The first run downloads a MongoDB binary (a few hundred MB), so it can take several minutes. Wait for it; don't cancel.

## Step 7: Run the app
Start both servers in the **background**, so they keep running:
- `npm run dev:server`: wait until it prints `[db] connected` and `[api] http://localhost:5000`.
- `npm run dev:client`: wait until Vite prints `Local: http://localhost:5173/`.

Then check:
1. http://localhost:5000/api/health returns `{"ok":true,"db":"up","authz":"up"}`.
2. http://localhost:5000/api/domains returns a list of domains.
3. http://localhost:5173 opens in the browser (open it for me).

## Step 8: Report back
Give me a short summary:
- the result of each step (tests, health check),
- the admin login (email + the generated password),
- how to start it next time: start Docker Desktop, then `npm run cerbos --prefix server`, `npm run dev:server`, `npm run dev:client`,
- how to stop it: stop the two dev servers, then `npm run cerbos:stop --prefix server`.
