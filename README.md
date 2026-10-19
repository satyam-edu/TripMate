# TripMate

A travel companion finding app where hosts post trips and travelers request to join. Built as a fullstack project with Google sign in, a Postgres database on Neon, and a React frontend.

🌐 **Live**: https://www.tripmateapp.tech · **API**: https://tripmate-api-mnhk.onrender.com

---

## Features

**Trips**
- **Post a trip**: destination, dates, budget, category, vibes, cover image, max guests, optional women-only
- **Browse and filter**: server-side search, category pills, budget and date range, "Load more" paging
- **Trip page** (`/trips/:id`): details, who's going, host card, share link, and an action panel that adapts to your status
- **Edit and delete** your hosted trips; a "people waiting" badge shows pending requests

**Joining**
- **Request to join** with a note; hosts approve or decline from Requests. Full or started trips can't be joined
- **Cancel** a pending request or **leave** a trip you joined
- **Women-only trips** limited to travellers who set their gender to Woman

**Chat and alerts**
- **Real-time chat** (Socket.IO): a group chat per trip and one-on-one inquiries with the host, with replies, unread badges and pop-up alerts
- **Notifications**: live in-app bell, plus email alerts for requests and decisions (Resend)

**People and trust**
- **Google sign-in** (no passwords) and **phone verification** with Firebase OTP
- **Profiles**: bio, location, vibes, social link, photo and cover upload, trip history
- **Public profiles** (`/users/:id`) with hosted trips and reviews
- **Reviews**: 1-5 stars between people who were on the same trip, after it ends
- **Safety**: block and report users

**Platform**
- Mobile-first responsive UI, server wake-up banner for the free-tier cold start, rate limiting and input limits

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, React Router |
| Backend | Node, Express 5, TypeScript |
| ORM | Prisma 5 |
| Database | PostgreSQL (Neon, pooled + direct connections) |
| Auth | Google OAuth (access token) + app-issued JWT |
| Real-time chat | Socket.IO |
| Hosting | Vercel (frontend), Render (backend), Neon (database) |

---

## Project structure

```text
TripMate/
├── backend/             # Express + Prisma API
│   ├── prisma/          # schema, migrations, seed scripts
│   └── src/
│       ├── controllers/ # auth, user, trip, request, chat, notification, review, safety, image
│       ├── services/    # email (Resend)
│       ├── middlewares/ # JWT verification
│       ├── routes/      # /api/auth, /api/users, /api/trips, /api/requests, /api/chats, /api/notifications, /api/images
│       └── server.ts    # app entry
└── tripmate/            # Vite + React frontend
    └── src/
        ├── pages/       # Home, Login, PostTab, Requests, Chats, Profile, PublicProfile, TripDetail
        ├── components/  # TripCard, Layout, ui-bits
        ├── context/     # auth and chat-alert contexts
        └── services/    # axios API client
```

---

## Getting started locally

### Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) Postgres database (free tier is fine)
- A Google OAuth client ID + secret ([Google Cloud Console](https://console.cloud.google.com))

### 1. Clone and install

```bash
git clone https://github.com/satyam-edu/TripMate.git
cd "TripMate"

cd backend && npm install       # install backend dependencies
cd ../tripmate && npm install   # install frontend dependencies
```

### 2. Configure environment variables

Create `.env` files in both directories:

**`backend/.env`**

```env
PORT=5001
DATABASE_URL=postgresql://<user>:<pass>@<host>-pooler.<region>.aws.neon.tech/<db>?sslmode=require
DIRECT_URL=postgresql://<user>:<pass>@<host>.<region>.aws.neon.tech/<db>?sslmode=require
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
JWT_SECRET=any-long-random-string
FRONTEND_URL=http://localhost:5173

# Phone verification (Firebase service account)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Optional: email alerts
RESEND_API_KEY=
EMAIL_FROM=
```

**`tripmate/.env`**

```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_API_URL=http://localhost:5001
```

### 3. Set up the database

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

### 4. Run both apps

```bash
# Terminal 1: backend
cd backend && npm run dev

# Terminal 2: frontend
cd tripmate && npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## API overview

Base URL: `/api`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | None | Health check |
| `POST` | `/auth/google` | None | Exchange Google access token for app JWT |
| `GET` | `/users/me` | ✅ | Current user profile |
| `GET` | `/users/:id` | — | Public profile: bio, location, social link, hosted trips |
| `PATCH` | `/users/me` | ✅ | Update profile |
| `POST` | `/users/me/phone/verify` | ✅ | Verify phone with a Firebase ID token |
| `PUT` | `/users/me/photo/:kind` | ✅ | Upload profile photo or cover (`kind` = `avatar` / `cover`, raw image body) |
| `DELETE` | `/users/me/photo/:kind` | ✅ | Remove profile photo or cover |
| `GET` | `/images/:id` | — | Serve an uploaded photo |
| `POST` | `/users/:id/block` | ✅ | Block a user (mutual: hides each other, blocks contact) |
| `DELETE` | `/users/:id/block` | ✅ | Unblock |
| `POST` | `/users/:id/report` | ✅ | Report a user (reason + optional details) |
| `GET` | `/trips` | optional | List all trips (richer data if logged in) |
| `POST` | `/trips` | ✅ | Create a trip |
| `GET` | `/trips/hosted` | ✅ | Trips you've hosted |
| `GET` | `/trips/joined` | ✅ | Trips you've joined |
| `GET` | `/trips/:id` | ✅ | One trip by slug (`/trips/goa-coastline`) or id: host, who's going, and your request status |
| `GET` | `/trips/:id/reviews` | ✅ | Who you can still review on this trip |
| `POST` | `/trips/:id/reviews` | ✅ | Leave a 1-5 star review (host ↔ traveller, once the trip has ended) |
| `PATCH` | `/trips/:id` | ✅ | Edit a trip (host only) |
| `DELETE` | `/trips/:id` | ✅ | Delete a trip (host only) |
| `PATCH` | `/trips/:id/reviews/:reviewId` | ✅ | Edit your review |
| `DELETE` | `/trips/:id/reviews/:reviewId` | ✅ | Delete your review |
| `POST` | `/requests` | ✅ | Send a join request |
| `GET` | `/requests/received` | ✅ | Requests for your hosted trips |
| `GET` | `/requests/sent` | ✅ | Requests you've sent |
| `PATCH` | `/requests/:id` | ✅ | Approve / reject a request (host only) |
| `DELETE` | `/requests/:id` | ✅ | Cancel a pending request or leave a trip |
| `GET` | `/chats` | ✅ | Your group and inquiry chats (with latest message and unread count) |
| `GET` | `/chats/unread-count` | ✅ | Total unread messages across all chats |
| `GET` | `/chats/:kind/:id/messages` | ✅ | Messages of one chat (`kind` = `groups` + tripId, or `inquiries` + requestId) |
| `POST` | `/chats/:kind/:id/messages` | ✅ | Send a message (pushed live over Socket.IO) |
| `POST` | `/chats/:kind/:id/read` | ✅ | Mark a chat as read |
| `GET` | `/notifications` | ✅ | Latest 30 notifications + unread count |
| `POST` | `/notifications/read-all` | ✅ | Mark all notifications as read |

Authenticated routes expect `Authorization: Bearer <jwt>`.

---

## Deployment

The project is built to deploy across three free-tier services.

### Backend → Render

- **Root Directory**: `backend`
- **Build Command**: `npm install --include=dev && npm run build && npx prisma migrate deploy`
- **Start Command**: `npm start`
- **Env vars**: copy from `backend/.env`, plus `NODE_ENV=production` and `FRONTEND_URL=<your site URL>` (comma-separate to allow several origins; use one URL in production, as email links use it), plus the three `FIREBASE_*` vars for phone verification

### Frontend → Vercel

- **Root Directory**: `tripmate`
- **Framework**: Vite (auto-detected)
- **Env vars**: `VITE_API_URL=<your Render URL>`, `VITE_GOOGLE_CLIENT_ID=<your client id>`

### Custom domain

Bought on get.tech and added in Vercel → Settings → Domains. DNS at get.tech: `A @ 216.198.79.1` and `CNAME www <value Vercel shows>`. Also add the domain to Firebase → Authentication → Authorized domains.

### Database → Neon

Already cloud-hosted. Use the pooled URL for `DATABASE_URL` and the direct URL for `DIRECT_URL` (Prisma uses the latter for migrations).

### Google OAuth

In Google Cloud Console → Credentials, add your site URL (e.g. `https://www.tripmateapp.tech`) to **Authorized JavaScript origins** and **Authorized redirect URIs**.

---

## Scripts

**Backend**

| Script | What it does |
|---|---|
| `npm run dev` | Start API with nodemon |
| `npm run build` | Generate Prisma client + compile TypeScript |
| `npm start` | Run compiled server (production) |
| `npm run seed` | Seed sample users & trips |
| `npm run seed:demo` | Seed demo join requests |
| `npm test` | Run backend tests |

**Frontend**

| Script | What it does |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | ESLint |

---

## License

ISC, personal project, built by Satyam.