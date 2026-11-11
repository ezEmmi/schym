# Schym — Local-First Multi-Sport, Gym, Bouldering & Strava Tracker

**Schym** is a security-hardened, local-first Full-Stack Fitness Web Application built for your hybrid weekly training split:

- **24+ Sports & Conditioning (`2+ / week`)**: Interactive **Multi-Sport Selector** across 7 categories (*Endurance, Climbing & Outdoor, Team & Ball, Racket, Combat & Martial Arts, Water & Winter, Mind/Mobility*) — including Running, Trail Running, Road Cycling, Gravel/MTB, Swimming, Rowing, HIIT, Football, Basketball, Volleyball, Handball, Tennis, Padel/Squash, Badminton, Boxing/Muay Thai, BJJ/MMA, Skiing/Snowboarding, Kayaking/SUP, Skating, Yoga/Mobility, and Calisthenics.
- **Strava API v3 & JSON Sync**: Sync your workouts directly from Strava via OAuth Access Token (kept strictly in-memory, never stored on disk) or JSON import, with automatic mapping from Strava `sport_type` to Schym sports.
- **Gym Strength (`2x / week`)**: Track exercises, sets, reps, load (`kg`), RPE (`1–10`), weekly tonnage, and auto-calculated **Epley estimated 1-Rep Max (e1RM)**.
- **Bouldering & Climbing**: Log climbing sessions by gym/crag, Fontainebleau (`4–8A`) or V-Scale (`V0–V7+`) grades, style (`Flash`, `Redpoint`, `Onsight`, `Project`), wall angle (`Slab`, `Vertical`, `Overhang`, `Roof`), attempts, and a `1–10` finger/skin recovery score.

---

## 1. Project Folder Structure

```text
schym/
├── AGENTS.md                           # Architecture & security rules enforced for AI agents
├── README.md                           # Project documentation, folder guide & security reference
├── package.json                        # Scripts & minimal audited dependencies
├── tsconfig.json                       # Strict TypeScript config (strict + noUncheckedIndexedAccess)
├── next.config.ts                      # HTTP security headers (CSP, HSTS, X-Frame-Options, etc.)
├── eslint.config.mjs                   # ESLint + eslint-plugin-security static analysis
├── vitest.config.ts                    # Vitest unit & security test runner configuration
├── data/                               # Local SQLite database directory (git-ignored)
│   └── schym.db                        # Auto-created local SQLite database in WAL mode
└── src/
    ├── app/                            # Next.js App Router layer
    │   ├── api/
    │   │   ├── fitness/
    │   │   │   └── route.ts            # REST API (GET, POST, DELETE) guarded by strict Zod schemas
    │   │   └── strava/
    │   │       └── sync/
    │   │           └── route.ts        # Strava API v3 & JSON activity importer with Zod validation
    │   ├── globals.css                 # Dark-mode design system & responsive layout styles
    │   ├── layout.tsx                  # Root HTML shell & metadata
    │   └── page.tsx                    # Server Component entry loading initial SQLite state
    ├── components/                     # Modular UI components
    │   ├── FitnessDashboard.tsx        # Top-level client shell & state coordinator
    │   ├── dashboard/
    │   │   └── WeeklySplitCards.tsx    # Weekly adherence progress bars (2x Gym, 2x+ Cardio, Boulder)
    │   └── loggers/
    │       ├── CardioModule.tsx        # 24+ Multi-Sport selector pills, filter & session logger
    │       ├── GymModule.tsx           # Gym exercise form + strength feed with e1RM badges
    │       ├── BoulderingModule.tsx    # Bouldering problem/session form + sends/projects feed
    │       └── StravaSyncModule.tsx    # Direct Strava OAuth token sync + 1-click demo & JSON importer
    └── lib/                            # Core domain, database & security layers
        ├── db/
        │   ├── schema.ts               # Domain TypeScript interfaces for Gym, Multi-Sport & Bouldering
        │   └── index.ts                # Built-in node:sqlite (DatabaseSync) WAL engine & parameterized queries
        ├── validation/
        │   └── fitness.ts              # Strict Zod schemas (.strict()) blocking injection & invalid inputs
        ├── sports-catalog.ts           # 24+ Sport definitions, categories, colors & Strava type mapper
        ├── metrics.ts                  # Pure domain math (Epley e1RM, min/km pace, ISO week adherence)
        └── __tests__/
            └── fitness.test.ts         # Automated Vitest unit & security validation test suite
```

---

## 2. Security & Software Engineering Architecture

1. **Zero Native Compilation / Supply-Chain Simplicity (`node:sqlite`)**:
   - Uses Node's built-in `node:sqlite` (`DatabaseSync`) in **WAL (Write-Ahead Logging)** mode.
   - Zero third-party C++ addons required, minimizing supply-chain attack surface while keeping 100% of your fitness data local in `data/schym.db`.
2. **Parameterized SQL Queries Only**:
   - Every database read, insert, and delete in `src/lib/db/index.ts` uses prepared statements (`sqlite.prepare(...)`) with bound `?` parameters—completely preventing SQL injection.
3. **Fail-Closed Input Validation (`Zod`)**:
   - Every mutation hitting `POST /api/fitness`, `DELETE /api/fitness`, or `POST /api/strava/sync` is validated through `.strict()` Zod schemas in `src/lib/validation/fitness.ts`.
4. **In-Memory Strava Token Handling**:
   - When syncing via Strava API v3 (`POST /api/strava/sync`), your OAuth access token is used solely in memory for the `https://www.strava.com/api/v3/athlete/activities` request and immediately cleared—never written to disk or git.
5. **Hardened HTTP Security Headers (`next.config.ts`)**:
   - Configures `Content-Security-Policy` (CSP), `Strict-Transport-Security` (HSTS), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`.

---

## 3. Quick Start & Commands

```bash
npm.cmd install
npm.cmd run dev
```
Then open `http://localhost:3000` in your browser.
