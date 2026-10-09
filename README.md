# Front Row — Real-Time Concurrent Seat Booking

A cinema booking app where **two people can never book the same seat**, and everyone looking at a screening sees seats being taken **live**.

**Stack:** Vite + React + Tailwind CSS · Express · MongoDB (Mongoose) · Upstash Redis · Socket.io · JWT auth

**Deploying for free?** See [DEPLOYMENT.md](DEPLOYMENT.md).

---

## Contents

1. [What the site does](#1-what-the-site-does)
2. [Pages and what you can do on each](#2-pages-and-what-you-can-do-on-each)
3. [How booking works, step by step](#3-how-booking-works-step-by-step)
4. [How double booking is prevented](#4-how-double-booking-is-prevented)
5. [Real-time updates](#5-real-time-updates)
6. [Pricing](#6-pricing)
7. [Accounts, roles and admin](#7-accounts-roles-and-admin)
8. [Architecture](#8-architecture)
9. [Project structure](#9-project-structure)
10. [Data models](#10-data-models)
11. [API reference](#11-api-reference)
12. [Setup and running](#12-setup-and-running)
13. [Environment variables](#13-environment-variables)
14. [Testing concurrency yourself](#14-testing-concurrency-yourself)
15. [Troubleshooting](#15-troubleshooting)
16. [Security notes](#16-security-notes)
17. [Known limitations and ideas](#17-known-limitations-and-ideas)

---

## 1. What the site does

| For visitors | For signed-in users | For admins |
|---|---|---|
| Home page with a **playable demo** (no account needed) | Pick seats and hold them for 5 minutes | Add movies (with poster upload) |
| Browse movies and screenings | Pay and receive a ticket | Schedule screenings with seat tiers and prices |
| Look at any seat map, live | **My tickets** with every booking | View all scheduled screenings |

Seat states are always visible and update in real time:

| State | Looks like | Meaning |
|---|---|---|
| Available | Cream seat | Anyone can take it |
| Yours | Brass, glowing | You hold it (for up to 5 minutes) |
| Held by others | Hatched, with a 🔒 | Someone else is checking out |
| Booked | Dark, with × | Sold |

State is shown by fill **and** pattern/icon, so it doesn't rely on colour alone.

---

## 2. Pages and what you can do on each

| Route | Who | What it is |
|---|---|---|
| `/` | Everyone | **Home.** Headline, a local playable demo of the seat map and ticket (with simulated "other visitors"), a 4-step "How booking works", and the latest screenings. |
| `/movies` | Everyone | **Now showing.** List of screenings with poster, time, genre, duration and starting price. |
| `/showtime/:id` | View: everyone. Pick seats: signed-in | **Seat selection.** Curved seat map, tier prices, live connection badge, and your ticket panel with countdown. |
| `/login`, `/signup` | Guests | Account forms. After signing in you return to where you were headed (or `/movies`). |
| `/bookings` | Signed-in | **My tickets.** Your confirmed bookings as tickets. |
| `/admin` | Admins only | **Admin panel.** Add movies, schedule screenings, see what's scheduled. |

Navbar: **Movies**, **My tickets** (signed in), **Admin panel** (admins), an account badge, and **Sign out**. Guests see **Sign in / Sign up**; the button for the page you're on is the filled one.

### The home-page demo
`LiveDemo` runs entirely in the browser (no server calls). It reuses the real `SeatGrid` and `TicketPanel`, and a small simulation makes "other visitors" grab seats every few seconds — they flash, turn hatched, then are either booked or released — so people can *see* the live behaviour without an account. Pressing **Pay** in the demo explains it was a demo and offers sign up / sign in.

---

## 3. How booking works, step by step

1. **Sign in.** Clicking a seat while signed out sends you to `/login` and brings you back afterwards.
2. **Click a seat → lock.** The client calls `POST /api/checkout/lock`. The server tries to take a Redis lock for that seat. If you win, the seat becomes yours and everyone else sees it turn hatched instantly. If someone beat you to it, you get a `409` and a toast: *"Seat B5 was just taken by someone else."*
3. **Hold for 5 minutes.** The ticket panel shows each seat with its tier price, the subtotal, fees, GST, the total, and a countdown that mirrors the Redis lock lifetime. You can click a seat (or its × on the ticket) to release it. Up to **6 seats** at a time.
4. **Pay.** **Pay ₹…** opens the confirm sheet with the full breakdown. Confirming calls `POST /api/checkout/confirm`.
5. **Confirm (server).** The server re-checks you still own every lock, then inside a **MongoDB transaction** marks the seats `booked` and creates the `Booking`. Prices come from the seats in the database, never from the client. On success the Redis locks are removed and `seat-booked` is broadcast.
6. **Ticket.** You see a ticket with a barcode and the booking reference. It's saved under **My tickets**.
7. **If you do nothing.** At 0:00 your seats are released, an in-app message tells you, and others see them free up. If you close the tab, the Redis TTL (and a background sweeper) frees them anyway.

**Signing out** releases any seats you're holding first (with a 3-second cap so it can't hang), clears your token and sends you to `/login`.

---

## 4. How double booking is prevented

Several layers, each covering a different failure:

| Layer | Mechanism | Stops |
|---|---|---|
| **1. Atomic lock** | Redis `SET lock:seat:<showtimeId>:<seatId> <sessionId> NX EX 300` | Two people grabbing the same seat. `NX` means "only if the key doesn't exist", and Redis runs commands one at a time, so exactly one `SET` returns `OK`. There's no read-then-write gap to race through. |
| **2. Self-expiring** | `EX 300` (5-minute TTL) | Abandoned holds: closed tabs, crashes, dead connections. The lock disappears on its own. |
| **3. Safe release** | A Lua script does *compare-and-delete* in one atomic step | A slow client deleting a lock that expired and was re-acquired by someone else. |
| **4. All-or-nothing multi-seat** | `lockSeats` rolls back seats it already took if one fails | Half-locked selections. |
| **5. Ownership check at checkout** | `confirm` reads each Redis lock and compares to your `sessionId` | Paying after your hold expired. |
| **6. Transactional write** | `updateMany({ status: { $ne: 'booked' } })` inside a Mongo transaction; the modified count must equal the seat count | Booking a seat that was somehow already sold; leaving a booking half-written. |
| **7. Unique index** | `{ showtime, seatNumber }` is unique on `Seat` | Duplicate seat documents. |
| **8. Server-side pricing** | Totals computed from seat prices in the DB | A tampered client sending a cheaper total. |

**Source of truth:** Redis decides who holds a seat *right now*; MongoDB is the durable record of what's *booked*. The `locked` status in Mongo is only a mirror for display, kept honest by the lock sweeper and by reconciliation when seats are fetched.

---

## 5. Real-time updates

Socket.io rooms are scoped per screening: `showtime:<id>`. Sockets only **announce** results; they never decide who wins a seat (Redis already did).

| Event | Direction | Payload | Meaning |
|---|---|---|---|
| `join-showtime` | client → server | `showtimeId` | Join the room for a screening |
| `leave-showtime` | client → server | `showtimeId` | Leave it |
| `seat-locked` | server → clients | `{ seatIds, sessionId }` | Someone took a hold |
| `seat-released` | server → clients | `{ seatIds }` | Holds were given up or expired |
| `seat-booked` | server → clients | `{ seatIds }` | Seats were sold |

Behaviours worth knowing:
- The client patches its local seat list directly from events — no refetch — and flashes the seat that changed.
- On **every reconnect** the client rejoins the room and **refetches** the seat list, because events sent while offline are lost.
- The badge on the seat page shows **Live / Connecting / Reconnecting / Offline**.
- **Lock sweeper** (`utils/lockSweeper.js`, every 10 s): Redis expiry is silent, so the sweeper finds seats Mongo calls `locked` whose Redis key is gone, resets them to `available`, and broadcasts `seat-released`. That's what makes expired holds disappear from other people's screens.
- The socket `disconnect` handler intentionally does **not** release locks; the TTL handles it and tolerates brief reconnects.

---

## 6. Pricing

Seats have their own prices, like a real multiplex.

Default seed (`npm run seed`): 8 rows × 10 seats.

| Rows | Tier | Price |
|---|---|---|
| A–B (front) | Classic | ₹180 |
| C–F (middle) | Prime | ₹260 |
| G–H (back) | Recliner | ₹420 (wider seats with a brass top edge) |

Admins define their own tiers per screening (name, price, number of rows, seats per row 4–20, up to 26 rows).

**Totals** (`server/src/utils/pricing.js` is the single source of truth):

```
subtotal       = sum of each seat's own price
convenienceFee = ₹30 × number of tickets
GST            = 18% of the convenience fee
total          = subtotal + convenienceFee + GST
```

The client only mirrors this maths for display (using the rates the API returns); the **server recomputes it at confirm time**. Change `PRICING` in that one file to adjust the fee or GST.

Seats created before tiers existed have no price and fall back to the screening's base price.

---

## 7. Accounts, roles and admin

- **Sign up** creates a normal user. A role is **never** accepted from a request; the only way to make an admin is `npm run create-admin`.
- **Passwords** are hashed with bcrypt (cost 12). **Sessions** are JWTs valid for 7 days, sent as `Authorization: Bearer <token>`.
- **Login errors** are deliberately identical for "no such email" and "wrong password", so the API can't be used to discover accounts.
- **Who can do what** (enforced on the server, not just hidden in the UI):

| Action | Guest | User | Admin |
|---|---|---|---|
| View movies, screenings, seat maps | ✅ | ✅ | ✅ |
| Lock / release / confirm seats | ❌ | ✅ | ✅ |
| View own tickets | ❌ | ✅ | ✅ |
| Create movies, screenings, upload posters | ❌ | ❌ | ✅ |

- `requireAdmin` reads the role from the **database** on every admin request, so demoting someone takes effect immediately instead of waiting for their token to expire.
- The buyer on a booking is taken from the verified token, so nobody can book on someone else's behalf.
- **Lock owner vs. user:** seat locks are owned by a per-**tab** `sessionId` (kept in `sessionStorage`), not by the user. That lets you test contention with two tabs, and it means a user can't accidentally fight themselves across devices.

### Admin panel
- **Add a movie:** title, genre, language, duration, description, and a poster (file upload, or paste an image URL).
- **Poster upload:** JPG/PNG/WebP up to 3 MB, saved to `server/uploads` under a random filename (the extension comes from the verified file type, never the user's filename) and served from `/uploads`.
- **Google Images links are handled:** if someone pastes a Google Images result link (a web page, not an image), the real image address in its `imgurl` parameter is extracted, on both the client and server.
- **Schedule a screening:** pick a movie, venue, screen, start time (must be in the future), seats per row, and tiers front-to-back. Seats are generated automatically (rows A, B, C… assigned in tier order).

---

## 8. Architecture

```
   Browser (React)                         Server (Express + Socket.io)
 ┌──────────────────┐   REST (JWT)    ┌──────────────────────────────┐
 │ Pages / Components│ ─────────────▶ │ routes → middleware → controllers │
 │ AuthContext       │                 │   requireAuth / requireAdmin   │
 │ SocketContext     │ ◀───────────── │                                │
 └───────┬──────────┘   JSON          └───────┬───────────┬──────────┘
         │                                    │           │
         │  WebSocket (rooms per screening)   │           │
         └─────────────◀──── seat-* events ───┤           │
                                              ▼           ▼
                                   ┌────────────────┐  ┌──────────────┐
                                   │ Upstash Redis   │  │ MongoDB      │
                                   │ 5-min seat locks│  │ users, movies│
                                   │ (SET NX EX)     │  │ showtimes,   │
                                   └────────────────┘  │ seats, bookings
                                                       └──────────────┘
```

**Request path for a lock:** `POST /api/checkout/lock` → `requireAuth` → controller checks no seat is already booked → `lockSeats` (Redis `SET NX EX`) → mirror `locked` into Mongo → emit `seat-locked` to the room → respond with the expiry.

---

## 9. Project structure

```
seat-booking-system/
├── package.json                  # root scripts: install:all, seed, dev (runs both apps)
├── README.md
├── client/                       # Vite + React + Tailwind
│   ├── index.html                # loads fonts (Big Shoulders Display, Hanken Grotesk)
│   ├── tailwind.config.js        # palette: ink, velvet, wine, brass, paper, stub, mist
│   └── src/
│       ├── main.jsx              # Router → Auth → Socket providers
│       ├── App.jsx               # routes
│       ├── index.css             # seat/ticket/barcode styles, reduced-motion handling
│       ├── api/axiosClient.js    # axios instance, JWT interceptor, per-tab sessionId
│       ├── context/
│       │   ├── AuthContext.jsx   # user, login/signup/logout, pre-logout hooks
│       │   └── SocketContext.jsx # one socket per tab + connection status
│       ├── hooks/useSocket.js    # join room, subscribe to seat events, resync on reconnect
│       ├── pages/
│       │   ├── HomePage.jsx      # landing + live demo
│       │   ├── ShowtimePage.jsx  # /movies list and /showtime/:id seat selection
│       │   ├── AuthPage.jsx      # login + signup
│       │   ├── BookingsPage.jsx  # My tickets
│       │   └── AdminPage.jsx     # movies, screenings
│       ├── components/
│       │   ├── Header.jsx  PageShell.jsx  RouteGuards.jsx
│       │   ├── SeatGrid.jsx      # curved auditorium, seat states
│       │   ├── TicketPanel.jsx   # per-seat prices, fees, total, Pay
│       │   ├── CheckoutTimer.jsx # countdown strip
│       │   ├── CheckoutModal.jsx # confirm sheet + final ticket
│       │   ├── LiveDemo.jsx      # local demo with simulated visitors
│       │   ├── Poster.jsx        # image with a fallback tile
│       │   └── Toasts.jsx
│       └── utils/ format.js  pricing.js  poster.js  ui.js
└── server/
    ├── .env.example
    ├── uploads/                  # uploaded posters (git-ignored)
    └── src/
        ├── server.js             # HTTP + Socket.io bootstrap, starts the sweeper
        ├── app.js                # middleware and route mounting
        ├── seed.js               # sample movie, screening and 80 tiered seats
        ├── createAdmin.js        # create / promote an admin from env vars
        ├── config/ db.js  redis.js
        ├── models/ User  Movie  Showtime  Seat  Booking
        ├── controllers/ auth  movie  showtime  checkout  booking
        ├── routes/ auth  movie  showtime  checkout  booking  upload
        ├── middleware/ auth.js (requireAuth, requireAdmin)  errorHandler.js
        ├── sockets/index.js      # rooms and events
        └── utils/ seatLock.js  lockSweeper.js  pricing.js  asyncHandler.js
```

---

## 10. Data models

**User** — `name`, `email` (unique, lowercase), `passwordHash` (never returned by default), `role` (`user` | `admin`).

**Movie** — `title`, `description`, `genre`, `language`, `durationMins`, `posterUrl`, `createdBy`.

**Showtime** — `movie` (ref), `movieTitle` (denormalised), `venue`, `screen`, `startTime`, `totalSeats`, `price` (cheapest tier, shown as "from"), `tiers[]` (`{ name, price }`, used for the legend).

**Seat** — `showtime` (ref), `seatNumber` (e.g. `A1`), `row`, `tier`, `price`, `status` (`available` | `locked` | `booked`), `lockedBy`, `version`. Unique index on `(showtime, seatNumber)`.

**Booking** — `showtime`, `seats[]`, `userId`, `subtotal`, `convenienceFee`, `tax`, `totalAmount`, `status`, `paymentRef`.

**Redis key** — `lock:seat:<showtimeId>:<seatId>` → value is the holder's `sessionId`, TTL 300 s.

---

## 11. API reference

Base URL: `http://localhost:5001/api`. 🔒 = needs `Authorization: Bearer <token>`. 👑 = admin only.

| Method & path | Auth | Body | Returns / notes |
|---|---|---|---|
| `POST /auth/signup` | — | `name, email, password` (8+ chars) | `{ token, user }`. `409` if the email exists. |
| `POST /auth/login` | — | `email, password` | `{ token, user }`. `401` on bad credentials. |
| `GET /auth/me` | 🔒 | — | `{ user }` |
| `GET /movies` | — | — | All movies, newest first |
| `POST /movies` | 👑 | `title, durationMins, genre?, language?, description?, posterUrl?` | `{ movie }` |
| `GET /showtimes` | — | — | Screenings with movie details, soonest first |
| `GET /showtimes/:id/seats` | — | — | `{ showtime, seats, pricing }`. Seats are in natural order (A1…A10) and expired locks are reconciled. |
| `POST /showtimes` | 👑 | `movieId, venue, screen, startTime, seatsPerRow, tiers[{name, price, rows}]` | Creates the screening **and its seats** |
| `POST /checkout/lock` | 🔒 | `showtimeId, seatIds[], sessionId` | `{ lockedSeatIds, expiresIn }`. `409` if any seat is taken or booked. |
| `POST /checkout/release` | 🔒 | `showtimeId, seatIds[], sessionId` | `{ released[] }` (only seats you own) |
| `POST /checkout/confirm` | 🔒 | `showtimeId, seatIds[], sessionId` | `201 { booking }`. `409` if the hold expired or a seat was already booked. |
| `GET /bookings/mine` | 🔒 | — | Your confirmed bookings, newest first |
| `POST /uploads/poster` | 👑 | multipart field `poster` | `{ url }` |
| `GET /health` (no `/api`) | — | — | `{ status: 'ok' }` |

Errors use `{ success: false, message }` with a plain-language message. Auth failures: `401` (missing/expired token), `403` (not an admin).

---

## 12. Setup and running

**Prerequisites:** Node.js 18+, a MongoDB **replica set** (MongoDB Atlas works out of the box), a free Upstash Redis database.

```bash
# 1. Environment files
cp server/.env.example server/.env      # then fill it in (see section 13)
cp client/.env.example client/.env

# 2. Install everything
npm run install:all

# 3. Create your admin account (set ADMIN_EMAIL / ADMIN_PASSWORD in server/.env first)
npm run create-admin --prefix server

# 4. Optional: seed a sample movie + screening with 80 tiered seats
npm run seed

# 5. Run server and client together
npm run dev
```

- API + sockets: http://localhost:5001
- Web app: http://localhost:5173

**Scripts**

| Where | Command | Does |
|---|---|---|
| root | `npm run install:all` | Installs root, server and client dependencies |
| root | `npm run dev` | Runs server and client together |
| root | `npm run seed` | Same as `npm run seed` in `server` |
| server | `npm run dev` / `npm start` | Nodemon / plain start |
| server | `npm run seed` | **Wipes** movies, showtimes and seats, then creates the sample screening (users are kept) |
| server | `npm run create-admin` | Creates the admin from env vars, or promotes an existing account |

**Getting Upstash credentials:** console.upstash.com → create a Redis database → copy the **REST URL** and **REST Token**.

---

## 13. Environment variables

**`server/.env`**

| Variable | Required | Notes |
|---|---|---|
| `PORT` | no (5000) | **Use 5001 on macOS** (see Troubleshooting) |
| `CLIENT_URL` | yes | `http://localhost:5173` — used for CORS and Socket.io |
| `MONGO_URI` | yes | Must be a replica set (transactions) |
| `UPSTASH_REDIS_REST_URL` | yes | From the Upstash console |
| `UPSTASH_REDIS_REST_TOKEN` | yes | From the Upstash console |
| `JWT_SECRET` | yes | Long random string. The server refuses to start without it. Generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | for `create-admin` | Password 8+ characters |
| `PUBLIC_URL` | no | Base URL used in uploaded poster links when behind a proxy |

**`client/.env`**

| Variable | Notes |
|---|---|
| `VITE_API_URL` | `http://localhost:5001/api` — must match the server port |
| `VITE_SOCKET_URL` | `http://localhost:5001` |

Vite reads `.env` only at startup: **restart the client dev server after changing it.**

---

## 14. Testing concurrency yourself

Each browser **tab** has its own lock owner, so two tabs behave as two competing buyers. For a realistic test, sign in as two different accounts: one in a normal window, one in an incognito window.

**A. Real-time sync**
1. Open the same screening in both windows. Both badges should say **● Live**.
2. In window A click **A1**. It turns brass ("yours") and the ticket panel starts a countdown.
3. In window B, A1 flips to hatched with a 🔒 **instantly**, and can't be clicked.
4. In A click A1 again to release it. It turns available in both.

**B. The race**
1. Hover the same available seat in both windows.
2. Click in both at the same moment (or double-click rapidly in one).
3. Exactly one window holds it. The other gets *"Seat … was just taken by someone else"* (HTTP `409`).

**Hard test:** fire 20 parallel lock requests as different sessions. Expect one `200` and nineteen `409`. Replace the placeholders with a real showtime id, seat id and a valid token:

```bash
TOKEN=<your JWT>; SID=<showtimeId>; SEAT=<seat _id>
for i in $(seq 1 20); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:5001/api/checkout/lock \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d "{\"showtimeId\":\"$SID\",\"seatIds\":[\"$SEAT\"],\"sessionId\":\"user-$i\"}" &
done; wait
```

**C. Booking and expiry**
1. Hold seats in window A → **Pay** → confirm. Seats turn dark (booked) in both windows, and the ticket appears under **My tickets**.
2. Hold a seat and wait. To test quickly, set `LOCK_TTL_SECONDS` to `30` in `server/src/utils/seatLock.js`. The countdown reaches 0:00, you get a message, and the seat frees up for others within ~10 seconds.
3. Stop the server for a few seconds: the badge shows **Reconnecting**, then **Live**, and seats resync.

**D. Sign out with holds**
Hold a seat, click **Sign out**. You land on `/login`, and the seat is available again for other windows right away.

---

## 15. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Every API call and socket request returns **403** (macOS) | Port 5000 is taken by **AirPlay Receiver**, which answers everything with 403. Set `PORT=5001` in `server/.env` and use 5001 in `client/.env`, then restart both. |
| "No showtimes" even though MongoDB has data | The client is calling the wrong port, or the server isn't running. Check `VITE_API_URL`, and restart the client. |
| Server exits with *JWT_SECRET is missing* | Add a `JWT_SECRET` to `server/.env`. |
| Admin login says "Incorrect email or password" | The `.env` admin values are only used by `npm run create-admin`. Run it. If an account with that email already exists, the script only promotes it (it doesn't change the password). |
| `confirm` fails with a transaction error | MongoDB isn't a replica set. Use Atlas, or start local `mongod` with `--replSet`. |
| Seats show `₹NaN` / all one price | The seats were created before tiers existed. Re-run `npm run seed`. |
| Tailwind error like "the `bg-ink` class does not exist" | The dev server has a stale config. Stop and restart `npm run dev` in `client`. |
| Poster doesn't show | The URL must point to an image file, not a web page (Google result links are unwrapped automatically). Some sites block hotlinking; upload the file instead. |
| Held seats stay hatched after the timer ends | Expired locks are cleaned by the sweeper every 10 s. If it never clears, check the server logs for `lock sweeper error`. |
| Typing a new password after `create-admin` does nothing | The script doesn't overwrite an existing account's password. Change it in MongoDB or delete the user and re-run. |

---

## 16. Security notes

- Passwords: bcrypt, cost 12. Never stored or logged in plain text.
- Role checks happen on the server; the UI only hides links for convenience.
- The buyer identity comes from the verified JWT; totals come from server-side prices.
- Uploads: admin-only, 3 MB cap, JPG/PNG/WebP only, random filenames, extension from the verified MIME type.
- `.env` is git-ignored. Keep real secrets there and out of chat, commits and screenshots; rotate anything that has been shared.
- The JWT is kept in `localStorage`, which is simple for local development but readable by any script on the page. For production, prefer an **httpOnly, SameSite cookie**.

---

## 17. Known limitations and ideas

**Not built yet**
- Real payment gateway (the "Pay" step confirms the booking directly; a gateway call belongs just before `confirm`).
- Editing or deleting movies and screenings; cancelling or refunding bookings.
- Password reset, email verification and login rate limiting.
- Automated tests.

**Scaling notes**
- With more than one server instance, add the Socket.io Redis adapter so events reach every instance, and run the lock sweeper on one instance only.
- Sockets are unauthenticated; they only carry public seat state.

**Ideas**
- Dynamic pricing (weekends, peak hours, filling-up surcharge).
- Seat-selection helpers ("best available", group seating).
- Email or PDF tickets with a scannable QR code.
- Time-boxed hold extension while a payment is in progress.
