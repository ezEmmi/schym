# Schym — Local-First Gym, Cardio & Bouldering Tracker

**Schym** is a security-hardened, local-first Full-Stack Fitness Web Application built for your hybrid weekly training split:

- **Gym Strength (`2x / week`)**: Track exercises, sets, reps, load (`kg`), RPE (`1–10`), weekly tonnage, and auto-calculated **Epley estimated 1-Rep Max (e1RM)**.
- **Cardio Conditioning (`2+ / week`)**: Track runs, cycling, rowing, swimming, HIIT, or hikes with duration (`min`), distance (`km`), auto-formatted pace (`min/km`), and average heart rate (`bpm`).
- **Bouldering & Climbing**: Log climbing sessions by gym/crag, Fontainebleau (`4–8A`) or V-Scale (`V0–V7+`) grades, style (`Flash`, `Redpoint`, `Onsight`, `Project`), wall angle (`Slab`, `Vertical`, `Overhang`, `Roof`), attempts, and a `1–10` finger/skin recovery score.

---

## 1. Project Folder Structure

The codebase is organized with clear separation of concerns between **UI components**, **API routes**, **strict input validation**, **database persistence**, and **automated tests**:

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
    │   │   └── fitness/
    │   │       └── route.ts            # REST API (GET, POST, DELETE) guarded by strict Zod schemas
    │   ├── globals.css                 # Dark-mode design system & responsive layout styles
    │   ├── layout.tsx                  # Root HTML shell & metadata
    │   └── page.tsx                    # Server Component entry loading initial SQLite state
    ├── components/                     # Modular UI components
    │   ├── FitnessDashboard.tsx        # Top-level client shell & state coordinator
    │   ├── dashboard/
    │   │   └── WeeklySplitCards.tsx    # Weekly adherence progress bars (2x Gym, 2x+ Cardio, Boulder)
    │   └── loggers/
    │       ├── GymModule.tsx           # Gym exercise form + strength feed with e1RM badges
    │       ├── CardioModule.tsx        # Cardio session form + pace & heart-rate feed
    │       └── BoulderingModule.tsx    # Bouldering problem/session form + sends/projects feed
    └── lib/                            # Core domain, database & security layers
        ├── db/
        │   ├── schema.ts               # Domain TypeScript interfaces for Gym, Cardio & Bouldering
        │   └── index.ts                # Built-in node:sqlite (DatabaseSync) WAL engine & parameterized queries
        ├── validation/
        │   └── fitness.ts              # Strict Zod schemas (.strict()) blocking injection & invalid inputs
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
   - Every mutation hitting `POST /api/fitness` or `DELETE /api/fitness` is validated through `.strict()` Zod schemas in `src/lib/validation/fitness.ts`.
   - Unknown keys (prototype pollution / mass assignment), invalid dates, or out-of-bounds numbers are rejected with `400 Bad Request` before touching the database.
4. **Hardened HTTP Security Headers (`next.config.ts`)**:
   - Configures `Content-Security-Policy` (CSP), `Strict-Transport-Security` (HSTS), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`.
5. **Static Security Analysis & Automated Testing**:
   - `eslint-plugin-security` scans for unsafe regexes, eval calls, and common Node/JS vulnerabilities.
   - `Vitest` verifies domain math and tests that malicious payloads are rejected by the validation layer.

---

## 3. What is an MCP (Model Context Protocol)?

**MCP (Model Context Protocol)** is an open standard that acts like a **universal USB-C port for AI agents**.

- Without MCP, an AI assistant only knows about files in your workspace.
- With MCP, you can connect **MCP Servers** that give the agent safe, structured tools to interact with external systems (like querying your local SQLite database, inspecting browser DevTools, managing GitHub PRs, or syncing Garmin/Strava workouts).

---

## 4. Quick Start & Commands

### Install dependencies
```bash
npm.cmd install
```

### Start the development server
```bash
npm.cmd run dev
```
Then open `http://localhost:3000` in your browser.

### Run Engineering & Security Checks
```bash
# 1. Run unit & security validation tests (Vitest)
npm.cmd run test

# 2. Run strict TypeScript compiler check
npm.cmd run typecheck

# 3. Run ESLint + eslint-plugin-security
npm.cmd run lint

# 4. Audit npm dependency tree for vulnerabilities
npm.cmd run audit:security
```
