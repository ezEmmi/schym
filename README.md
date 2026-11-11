# Schym 2.0 — Local-First Pastel Fitness PWA, Smart Habit Coach, Hevy-Brain-Clone & Signal Bot

**Schym** is a security-hardened, local-first Full-Stack Fitness Progressive Web App (PWA) in a **Soft-Dark Pastel** aesthetic built for your hybrid weekly training split:

- **Smart Habit-Engine & Daily Coach (`src/lib/coach.ts`)**: Analyzes your training history to learn your preferred training weekdays (`Mo–So`), tracks muscle group recovery (`> 48h`), rotates your Gym Workout Splits automatically, checks open daily supplements, and gives you a live daily recommendation banner (*"Yo! Heute ist dein klassischer Gym-Tag..."*).
- **Hevy-Brain-Cloning & Strava Pro-Free Importer (`src/lib/importers.ts`)**: Import your entire **Hevy CSV** (`workouts.csv` with German/English dates like `14. Okt. 2025, 17:34` and multi-line notes) or **Strava `activities.csv` / JSON / OAuth API v3** with zero Strava Pro subscription needed. Schym automatically clones your workout routines into reusable **Gym Templates**, remembers your latest working weight & reps per machine, and lets you delete Hevy afterward.
- **Live "Ich bin im Gym 💪" Mode (`GymSessionModal.tsx`)**: Pops up on demand with your saved workout routines, machine-by-machine load suggestions (`⚡ +2.5 kg` progressive overload), an **auto-starting Rest-Timer** (`60s / 90s / 120s / 180s` with Web Audio chime), and live **Personal Record (`🏆 Neuer PR!`)** detection.
- **1-Click Daily Supplement Tracker (`SupplementTracker.tsx`)**: Toggle daily pastel chips (*Creatine Monohydrate 5g, Omega-3, Vitamin D3 + K2, Magnesium Bisglycinate, Whey Isolate*, plus custom supplements) with timing badges (`Morgens`, `Pre-Gym`, `Post-Gym`, `Abends`).
- **Interactive Body Muscle Heatmap & Machine Progression Chart (`BodyHeatmapCard.tsx`, `ProgressionChartCard.tsx`)**: Visual anterior/posterior SVG body map lighting up trained muscles + interactive SVG progression curve (`kg` & Epley `e1RM`) for every machine.
- **Mobile PWA, Tailscale & Signal Messenger Bot (`src/lib/signal.ts`, `docker-compose.yml`)**: Installable on iOS/Android home screens, reachable from anywhere via **Tailscale VPN** (`100.x.y.z:3000`) or Docker, and sends daily Coach reminders straight to your phone via **Signal Messenger** (`signal-cli-rest-api` or CallMeBot).

---

## 1. Project Folder Structure

```text
schym/
├── AGENTS.md                                   # Architecture & security rules enforced for AI agents
├── README.md                                   # Project documentation, mobile setup & security reference
├── Dockerfile                                  # Hardened non-root Node 24 container image
├── docker-compose.yml                          # 1-Click stack: Schym PWA + signal-cli-rest-api bot
├── package.json                                # Scripts & minimal audited dependencies
├── tsconfig.json                               # Strict TypeScript config (strict + noUncheckedIndexedAccess)
├── next.config.ts                              # HTTP security headers (CSP, HSTS, X-Frame-Options, etc.)
├── eslint.config.mjs                           # ESLint + eslint-plugin-security static analysis
├── vitest.config.ts                            # Vitest unit & security test runner configuration
├── data/                                       # Local SQLite database directory (git-ignored)
│   └── schym.db                                # Auto-created local SQLite database in WAL mode
└── src/
    ├── app/                                    # Next.js App Router layer
    │   ├── api/
    │   │   ├── fitness/route.ts                # REST API (GET, POST, DELETE) guarded by CSRF + strict Zod
    │   │   ├── strava/sync/route.ts            # Hevy/Strava CSV, JSON & OAuth importer in atomic transactions
    │   │   └── notify/signal/route.ts          # Signal Messenger daily coach dispatcher (SSRF-guarded)
    │   ├── manifest.ts                         # Installable Mobile PWA Web App Manifest
    │   ├── globals.css                         # Soft-Dark Pastel design system & responsive layout styles
    │   ├── layout.tsx                          # Root HTML shell, PWA viewport & metadata
    │   └── page.tsx                            # Server Component entry loading initial SQLite state
    ├── components/                             # Modular Pastel UI components
    │   ├── FitnessDashboard.tsx                # Top-level client shell & state coordinator
    │   ├── brand/
    │   │   └── SchymLogo.tsx                   # Custom pastel gradient dumbbell-carabiner-pulse SVG logo
    │   ├── dashboard/
    │   │   ├── SmartCoachBanner.tsx            # Daily Coach banner, weekday habit pills & Signal trigger
    │   │   ├── ActivityCalendar.tsx            # Monthly streak calendar with auto-jump to latest import
    │   │   ├── BodyHeatmapCard.tsx             # Anterior/posterior SVG muscle recovery & volume map
    │   │   ├── SupplementTracker.tsx           # 1-Click daily supplement chips + custom item creator
    │   │   ├── ProgressionChartCard.tsx        # Per-machine SVG working weight & Epley e1RM progression chart
    │   │   ├── MobileAndSignalModal.tsx        # Setup guide & live test for Mobile PWA, Tailscale & Signal
    │   │   └── WeeklySplitCards.tsx            # Weekly adherence progress bars (2x Gym, 2x+ Cardio, Boulder)
    │   └── loggers/
    │       ├── GymSessionModal.tsx             # "Ich bin im Gym 💪" popup with Rest-Timer, PRs & Overload
    │       ├── QuickActivityModal.tsx          # Unified modal for Multi-Sport, Bouldering & CSV/Strava Sync
    │       ├── CardioModule.tsx                # 24+ Multi-Sport session logger
    │       ├── GymModule.tsx                   # Standalone Gym exercise logger
    │       ├── BoulderingModule.tsx            # Bouldering session logger (Fontainebleau / V-Scale)
    │       └── StravaSyncModule.tsx            # Drag & Drop CSV/JSON importer (Hevy & Strava) + OAuth sync
    └── lib/                                    # Core domain, database & security layers
        ├── db/
        │   ├── schema.ts                       # TypeScript interfaces for Gym, Sports, Bouldering & Supplements
        │   └── index.ts                        # Built-in node:sqlite WAL engine, B-Tree indices & transactions
        ├── validation/
        │   └── fitness.ts                      # Strict Zod schemas (.strict()) blocking injection & invalid inputs
        ├── security.ts                         # Same-Origin CSRF protection & optional SCHYM_ACCESS_PIN guard
        ├── coach.ts                            # Smart Habit-Engine (weekday learner, muscle recovery, templates)
        ├── signal.ts                           # Signal Messenger dispatcher with strict SSRF endpoint allowlist
        ├── importers.ts                        # RFC-4180 multi-line CSV parser & DE/EN timezone-safe date parser
        ├── muscles.ts                          # 9-muscle-group catalog, recovery math & progressive overload
        ├── sports-catalog.ts                   # 24+ Sport definitions, categories, colors & Strava type mapper
        ├── metrics.ts                          # Pure domain math (Epley e1RM, min/km pace, ISO week adherence)
        └── __tests__/
            └── fitness.test.ts                 # Automated Vitest unit & security validation test suite
```

---

## 2. Zero-Exfiltration Security & Performance Architecture

1. **100% Local Data Ownership (`node:sqlite` + WAL + B-Tree Indices)**:
   - Uses Node 24's built-in `node:sqlite` (`DatabaseSync`) in **WAL (Write-Ahead Logging)** mode with `synchronous = NORMAL`, `foreign_keys = ON`, and `temp_store = MEMORY`.
   - Indexed across `session_date` and `exercise_name` (`idx_gym_session_date`, `idx_gym_exercise_name`, `idx_cardio_session_date`, `idx_boulder_session_date`, `idx_supp_logs_date`).
   - Bulk CSV imports run inside an atomic `BEGIN IMMEDIATE ... COMMIT` transaction (`runInTransaction`), importing 2,000+ Hevy sets in `< 15ms`.
2. **Same-Origin CSRF Guard & Optional Access PIN (`src/lib/security.ts`)**:
   - Every mutating endpoint (`POST`/`DELETE`) verifies that the request `Origin` matches the `Host` header, blocking cross-site requests from external websites.
   - Optional `SCHYM_ACCESS_PIN` environment variable adds PIN protection (`x-schym-pin` header) when hosting in a shared network.
3. **Parameterized SQL & Fail-Closed Zod Validation**:
   - Zero raw string interpolation in SQL; every query uses `sqlite.prepare(...)` with bound parameters.
   - Every API payload is parsed through `.strict()` Zod schemas in `src/lib/validation/fitness.ts`.
4. **SSRF-Guarded Signal Integration (`src/lib/signal.ts`)**:
   - Signal notifications only allow local Docker/loopback `signal-cli-rest-api` hosts (`localhost`, `127.0.0.1`, `signal-api`) or `https://api.callmebot.com`.

---

## 3. Quick Start, Mobile Access & Signal Bot

### Local Development
```bash
npm.cmd install
npm.cmd run dev
```
Open `http://localhost:3000` (or run `npm.cmd run dev:lan` to expose on your local Wi-Fi / Tailscale interface).

### Reachable from Your Phone (PWA + Tailscale or Docker)
1. **Tailscale (Recommended, Zero Open Router Ports)**:
   - Install [Tailscale](https://tailscale.com) on your PC/Server and phone.
   - Start Schym with `npm.cmd run dev:lan` (or `docker compose up -d`).
   - Open `http://<tailscale-ip>:3000` in Safari (iOS) or Chrome (Android) and tap **"Add to Home Screen"** to install Schym as a fullscreen app.
2. **Signal Daily Coach Reminders**:
   - Start the Signal container via `docker compose up -d` (runs `bbernhard/signal-cli-rest-api` on `127.0.0.1:8080`).
   - Open the **"📱 Handy & Signal"** modal in the top-right header of Schym to enter your phone number and send a live test briefing to your Signal app.
