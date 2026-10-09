# Deploying Front Row for free

| Part | Host | Why |
|---|---|---|
| Frontend (React/Vite) | **Vercel** (or Netlify / Cloudflare Pages) | Free static hosting, auto-deploys from GitHub |
| Backend (Express + Socket.io) | **Render** (free web service) | Runs a long-lived Node process, so **WebSockets work** (serverless hosts can't do this) |
| Database | **MongoDB Atlas** M0 | Free, and it's a replica set, which our transactions need |
| Locks | **Upstash Redis** | Free tier |

> Free-tier limits change. Check each provider's current plan before relying on it.

## 0. Before you start: replace your secrets
Some of your current secrets have appeared in screenshots and tool logs during development. Treat them as exposed and use **new** ones in production:
- **Upstash:** create a new database (or reset the token) and copy the REST URL and token.
- **MongoDB:** create a new database user and password for production.
- **`JWT_SECRET`:** generate a fresh one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

Make sure the latest code is pushed to GitHub (`git add -A && git commit -m "Prepare for deployment" && git push`). Confirm `.env` files are **not** in the commit.

## 1. MongoDB Atlas
1. Use a separate database name for production by changing the path in the URI: `…mongodb.net/seat-booking-prod?retryWrites=true&w=majority`.
2. **Network Access → Add IP Address → Allow access from anywhere (0.0.0.0/0).** Render's free tier has no fixed IP, so you can't allow-list one. Your database user's password is what protects the data.

## 2. Backend on Render
1. render.com → **New → Web Service** → connect the GitHub repo.
2. Settings:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
   - **Health Check Path:** `/health`
3. **Environment variables:**

| Key | Value |
|---|---|
| `MONGO_URI` | your production Atlas URI |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | from Upstash |
| `JWT_SECRET` | the new random string |
| `CLIENT_URL` | your Vercel URL (add after step 3; no trailing slash). Several allowed, comma-separated |
| `PUBLIC_URL` | your Render URL, e.g. `https://front-row-api.onrender.com` |

   Don't set `PORT`; Render provides it. You don't need the `ADMIN_*` variables on Render.
4. Deploy, then open `https://<your-service>.onrender.com/health`. You should see `{"status":"ok"}`.

## 3. Frontend on Vercel
1. vercel.com → **Add New → Project** → import the same repo.
2. **Root Directory:** `client` (Vercel detects Vite).
3. **Environment variables** (they're baked in at build time, so set them *before* deploying):
   - `VITE_API_URL` = `https://<your-service>.onrender.com/api`
   - `VITE_SOCKET_URL` = `https://<your-service>.onrender.com`
4. Deploy. `client/vercel.json` already rewrites all routes to `index.html`, so refreshing `/movies` or `/admin` doesn't 404.

## 4. Connect them
Go back to Render → set `CLIENT_URL` to your Vercel production URL (e.g. `https://front-row.vercel.app`, no trailing slash) → it redeploys. Without this, the browser blocks API calls (CORS) and sockets.

## 5. Create the production admin
Render's free plan has no shell, so run this on your own machine, pointing at the production database. Variables set on the command line override `.env`:

```bash
cd server
MONGO_URI="<production uri>" ADMIN_EMAIL="you@example.com" ADMIN_PASSWORD="<8+ chars>" node src/createAdmin.js
```

Then sign in on the live site and add movies from **Admin panel**. Don't run `npm run seed` against production unless you want the sample data (it deletes existing movies, screenings and seats).

## 6. Check it works
- Home page demo plays; `/movies` loads (the first request after idle may take up to a minute).
- Sign up, hold a seat; open the site in a second browser and watch it lock live (badge says **Live**).
- Admin: upload a poster and schedule a screening.
- Refresh on `/admin` and `/movies`: no 404.

## Free-tier behaviour to expect
- **Render sleeps after ~15 minutes without traffic.** The next visit takes about 30–60 seconds to wake it, and open sockets disconnect and then reconnect on their own. A free uptime monitor (e.g. UptimeRobot) pinging `/health` every 5 minutes keeps it awake.
- **While the server sleeps** the seat sweeper isn't running. Holds still expire (the Redis TTL does that), and the sweeper catches up when it wakes.
- **Posters** are stored in MongoDB, not on disk, so they survive restarts. Atlas M0 storage is limited, so keep images small.
- **Upstash** free plan has a cap on daily commands. Locks, releases, confirms and sweeper checks all use some.
- **Preview deployments** on Vercel get different URLs that aren't in `CLIENT_URL`, so the API will reject them. Test on the production URL, or add the preview URL to `CLIENT_URL`.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Browser console: CORS error | `CLIENT_URL` on Render doesn't exactly match your site URL (check `https`, spelling, no trailing slash) |
| Everything works locally but the live site calls `localhost` | `VITE_*` variables weren't set in Vercel before the build. Set them and **redeploy** |
| Render logs: *JWT_SECRET is missing* | Add `JWT_SECRET` in Render's environment |
| Render logs: Mongo connection or timeout error | Atlas Network Access doesn't allow 0.0.0.0/0, or the URI/password is wrong |
| Live badge stuck on Reconnecting | The server is waking up, or `VITE_SOCKET_URL` is wrong |
| Booking fails with a transaction error | The database isn't a replica set (Atlas M0 is; a standalone local Mongo isn't) |
