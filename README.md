# jacaero-platform

Internal business platform for **J.A. CAERO S.L.** — employee accounts, roles and permissions, time tracking, and company scheduling, with room to grow into client/contract management, invoicing and materials.

Single-company by design: there's no multi-tenant switching, no "create a company" flow. Everything is scoped to one employer and its employees.

## Status

Early development. Auth, roles/permissions, and the app shell (login, home, profile) are working end to end. The feature modules (Time Tracker, Calendar, Notes, Clients, Team, Audit Log) are scaffolded as routes but not built yet — see [Roadmap](#roadmap).

## Stack

| Layer | Choice |
|---|---|
| Frontend | Vite + React 19 + TypeScript, TanStack Query, React Router, Tailwind CSS v4 |
| Backend | Express 5 + TypeScript, Zod validation |
| Database | PostgreSQL via Prisma ORM (driver adapters, `@prisma/adapter-pg`) |
| Auth | JWT access tokens + rotating refresh tokens (hashed, stored in DB) |
| Monorepo | npm workspaces (`apps/*`, `packages/*`) |
| Deploy | Docker Compose (Postgres + backend + frontend, nginx-served static build) |

## Project structure

```
jacaero-platform/
├── apps/
│   ├── backend/            Express API
│   │   ├── prisma/         schema.prisma, migrations, seed script
│   │   └── src/
│   │       ├── modules/    one folder per domain (auth, ...)
│   │       ├── common/     shared middlewares, utils, error handling
│   │       ├── config/     env validation (Zod)
│   │       └── db/         Prisma client singleton
│   └── frontend/           Vite + React app
│       └── src/
│           ├── pages/      route-level components
│           ├── components/ shared UI (layout, avatar, settings menu...)
│           ├── contexts/   auth, theme, language
│           └── lib/        axios client, translations, module registry
├── docker-compose.yml       db + backend + frontend for local/prod
└── package.json             workspace root
```

## What's in the app today

- **Auth**: email/password login, JWT + refresh token rotation, logout, `/auth/me`.
- **Roles & permissions**: `Role`/`Permission` tables, not a hardcoded enum — an admin can create roles and assign permissions without a code change. A single `requirePermission(key)` middleware gates every protected route (no mixed patterns).
- **Home screen**: a permission-filtered module grid — a user only sees tiles for what they're allowed to do.
- **Profile**: view your name, email, role and job title; sign out.
- **Theme**: light / dark / system, persisted, respects `prefers-color-scheme` when set to system.
- **Language**: English / Spanish, with a compile-time check (`satisfies`) that catches a translation missing a key in one language before it ships.

## Roadmap

Modules exist as routes today but render a "coming soon" placeholder. Build order, roughly:

1. **Time Tracker** — the main daily-use feature: log hours, edit/delete own entries, view team hours (coordinator/admin).
2. **Calendar** — company events, holidays, reminders.
3. **Notes** — quick personal notes.
4. **Clients & contracts** — client records, locations, contract rate tables (monthly, per resource).
5. **Team** — employee management, invites, role assignment.
6. **Audit Log** — who changed what, viewable by admins.
7. **Monthly delivery note ("albarán") generation** and **email order intake** — modeled in the schema already, not built.

## Getting started

Prerequisites: Node 22+, Docker Desktop.

```bash
# 1. Install dependencies
npm install

# 2. Copy env files and fill in the values
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env

# 3. Start Postgres
docker compose up -d db

# 4. Run migrations and seed roles/permissions/admin user
cd apps/backend
npx prisma migrate dev
npx tsx prisma/seed.ts
cd ../..

# 5. Run backend and frontend (separate terminals)
npm run dev --workspace=apps/backend    # http://localhost:3000
npm run dev --workspace=apps/frontend   # http://localhost:5173
```

Log in with whatever `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` you set in `apps/backend/.env`.

### Environment variables

Each app has its own `.env.example` documenting what it needs:

- **root `.env`** — Postgres credentials used by `docker-compose.yml` (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`) and `VITE_API_URL` for the frontend's Docker build.
- **`apps/backend/.env`** — `DATABASE_URL`, `JWT_SECRET` (32+ chars), token expiry settings, `CORS_ORIGIN`, and `SEED_ADMIN_*` for the seed script.
- **`apps/frontend/.env`** — `VITE_API_URL`, where the backend lives.

None of the `.env` files are committed — only the `.env.example` templates.

## Running the full stack in Docker

```bash
cp .env.example .env   # fill in real values first
docker compose up -d
```

This builds and runs Postgres, the backend, and the frontend (served via nginx) together, matching how it deploys in production.

## Scripts

Run from the repo root with `--workspace=apps/<name>`, or `cd` into the app first.

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server (backend: `tsx watch`, frontend: Vite) |
| `npm run build` | Type-check and build for production |
| `npm run start` | Run the built backend (`apps/backend` only, after `build`) |
| `npx prisma migrate dev` | Create/apply a migration (`apps/backend`) |
| `npx tsx prisma/seed.ts` | Seed roles, permissions and the admin user (`apps/backend`) |
