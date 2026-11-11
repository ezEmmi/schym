# Schym — Engineering & Security Guidelines (AGENTS.md)

This document defines the architecture, software engineering standards, and security practices for **Schym** — a local-first, full-stack Fitness PWA covering **Gym (2x/wk)**, **Cardio (2x+/wk)**, and **Bouldering & Other Sessions**.

## 1. Core Architecture & Tech Stack

- **Framework**: Next.js (App Router) with React & TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`).
- **Database**: Local-first SQLite using Node.js built-in `node:sqlite` (`DatabaseSync` in WAL mode). Zero external cloud telemetry; full data ownership.
- **Validation**: **Zod** schemas on all inputs (API routes, client forms, and mutations).
- **Security & Quality Tooling**:
  - **ESLint** + `eslint-plugin-security` for static code and security analysis.
  - **Vitest** for unit and integration testing of domain logic and validation schemas.
  - **Strict HTTP Security Headers** configured in `next.config.ts` (CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`).
  - **Parameterized Queries Only**: Never interpolate strings into raw SQL. Always use prepared statements (`sqlite.prepare(...)`) with bound parameters.

## 2. Domain Model (Fitness Modules)

1. **Weekly Split & Dashboard** (`src/components/dashboard/WeeklySplitCards.tsx`):
   - Tracks weekly targets: **2x Gym**, **2x+ Cardio**, plus **Bouldering & Custom Sessions**.
   - Shows weekly adherence progress bars, tonnage, cardio minutes, and climbing tops.
2. **Gym Logger** (`src/components/loggers/GymModule.tsx`):
   - Log exercises, sets, reps, weight (`kg`), RPE (1–10), and rest notes.
   - Automatic Epley e1RM calculation.
3. **Cardio Tracker** (`src/components/loggers/CardioModule.tsx`):
   - Log running, cycling, rowing, HIIT, hiking, or swimming with duration (`min`), distance (`km`), avg heart rate (`bpm`), pace (`min/km`), and perceived effort.
4. **Bouldering & Climbing Logger** (`src/components/loggers/BoulderingModule.tsx`):
   - Log climbing sessions by gym/crag, problems attempted/sent, grade (`4–8A` / `V0–V7+`), style (`Flash`, `Redpoint`, `Onsight`, `Project`), wall angle (`Slab`, `Vertical`, `Overhang`, `Roof`), and finger/skin recovery score (`1–10`).

## 3. Security Rules for Agents

- **Zero Secrets in Code**: Never commit `.env` files, tokens, or credentials.
- **Fail Closed Validation**: Every mutation (`POST`/`DELETE`) must parse its payload through a strict Zod schema with `.strict()` and bounded numeric/string constraints before touching the database.
- **No Unescaped HTML**: Never use `dangerouslySetInnerHTML`.
- **Supply Chain Hygiene**: Keep dependencies minimal, well-maintained, and audited (`npm audit`).
