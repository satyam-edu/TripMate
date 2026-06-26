# TripMate

A travel companion finding app where hosts post trips and travelers request to join. Built as a fullstack project with Google sign in, a Postgres database on Neon, and a React frontend.

🌐 **Live**: https://tripmate-gamma-two.vercel.app · **API**: https://tripmate-api-mnhk.onrender.com

---

## Features

- **Google OAuth** sign-in (no passwords to manage)
- **Post a trip** — destination, dates, budget, tags, cover image, max guests
- **Browse trips** posted by other travelers, filter by tags
- **Request to join** a trip; hosts can approve or reject from their Hub
- **Profile** with bio, location, social handle, and trip history
- Mobile-first responsive UI

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, React Router |
| Backend | Node, Express 5, TypeScript |
| ORM | Prisma 5 |
| Database | PostgreSQL (Neon, pooled + direct connections) |
| Auth | Google OAuth (access token) + app-issued JWT |
| Hosting | Vercel (frontend), Render (backend), Neon (database) |

---

## Project structure

```text
TripMate/
├── backend/             # Express + Prisma API
│   ├── prisma/          # schema, migrations, seed scripts
│   └── src/
│       ├── controllers/ # auth, user, trip, request
│       ├── middlewares/ # JWT verification
│       ├── routes/      # /api/auth, /api/users, /api/trips, /api/requests
│       └── server.ts    # app entry
└── tripmate/            # Vite + React frontend
    └── src/
        ├── pages/       # Home, Login, PostTab, Hub, Profile, Chats
        ├── components/  # TripCard, CreateTripModal, Layout, ui-bits
        ├── context/     # auth context
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
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd tripmate && npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## API overview

Base URL: `/api`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | — | Health check |
| `POST` | `/auth/google` | — | Exchange Google access token for app JWT |
| `GET` | `/users/me` | ✅ | Current user profile |
| `PATCH` | `/users/me` | ✅ | Update profile |
| `GET` | `/trips` | optional | List all trips (richer data if logged in) |
| `POST` | `/trips` | ✅ | Create a trip |
| `GET` | `/trips/hosted` | ✅ | Trips you've hosted |
| `GET` | `/trips/joined` | ✅ | Trips you've joined |
| `POST` | `/trips/:id/join` | ✅ | Request to join a trip |
| `POST` | `/requests` | ✅ | Send a join request |
| `GET` | `/requests/received` | ✅ | Requests for your hosted trips |
| `GET` | `/requests/sent` | ✅ | Requests you've sent |
| `PATCH` | `/requests/:id` | ✅ | Approve / reject a request |

Authenticated routes expect `Authorization: Bearer <jwt>`.

---

## Deployment

The project is built to deploy across three free-tier services.

### Backend → Render

- **Root Directory**: `backend`
- **Build Command**: `npm install --include=dev && npm run build && npx prisma migrate deploy`
- **Start Command**: `npm start`
- **Env vars**: copy from `backend/.env`, plus `NODE_ENV=production` and `FRONTEND_URL=<your Vercel URL>`

### Frontend → Vercel

- **Root Directory**: `tripmate`
- **Framework**: Vite (auto-detected)
- **Env vars**: `VITE_API_URL=<your Render URL>`, `VITE_GOOGLE_CLIENT_ID=<your client id>`

### Database → Neon

Already cloud-hosted. Use the pooled URL for `DATABASE_URL` and the direct URL for `DIRECT_URL` (Prisma uses the latter for migrations).

### Google OAuth

In Google Cloud Console → Credentials, add your Vercel URL to **Authorized JavaScript origins** and **Authorized redirect URIs**.

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

**Frontend**

| Script | What it does |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | ESLint |

---

## License

ISC — personal project, built by Satyam.