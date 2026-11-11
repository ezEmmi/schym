import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type {
  GymEntry,
  NewGymEntry,
  CardioSession,
  NewCardioSession,
  BoulderingSession,
  NewBoulderingSession,
  WorkoutTemplate,
  NewWorkoutTemplate,
  WorkoutTemplateExercise,
  SupplementItem,
  NewSupplementItem,
  SupplementLog,
  SupplementTiming,
  MuscleGroup,
  FitnessDataset,
} from "./schema";
import { inferMuscleGroupFromExercise } from "../muscles";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "schym.db");

function initializeSqlite(): DatabaseSync {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const sqlite = new DatabaseSync(DB_PATH);
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA synchronous = NORMAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS gym_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_date TEXT NOT NULL,
      workout_focus TEXT NOT NULL,
      exercise_name TEXT NOT NULL,
      muscle_group TEXT NOT NULL DEFAULT 'chest',
      sets INTEGER NOT NULL,
      reps INTEGER NOT NULL,
      weight_kg REAL NOT NULL,
      rpe REAL NOT NULL,
      estimated_1rm REAL NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cardio_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_date TEXT NOT NULL,
      modality TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      distance_km REAL NOT NULL,
      avg_heart_rate INTEGER,
      rpe INTEGER NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bouldering_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_date TEXT NOT NULL,
      location TEXT NOT NULL,
      grade TEXT NOT NULL,
      style TEXT NOT NULL,
      wall_angle TEXT NOT NULL,
      attempts INTEGER NOT NULL,
      topped INTEGER NOT NULL,
      duration_minutes INTEGER NOT NULL,
      skin_and_finger_feel INTEGER NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workout_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      exercises_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  return sqlite;
}

const globalForDb = globalThis as unknown as {
  sqliteInstance?: DatabaseSync;
  migrationsChecked?: boolean;
};

function ensureSchemaMigrations(dbInstance: DatabaseSync): DatabaseSync {
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS workout_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      exercises_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS supplement_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      timing TEXT NOT NULL DEFAULT 'Morgens',
      color TEXT NOT NULL DEFAULT '#cba6f7',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS supplement_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplement_id INTEGER NOT NULL,
      log_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(supplement_id, log_date)
    );

    CREATE INDEX IF NOT EXISTS idx_gym_session_date ON gym_entries(session_date DESC);
    CREATE INDEX IF NOT EXISTS idx_gym_exercise_name ON gym_entries(exercise_name);
    CREATE INDEX IF NOT EXISTS idx_cardio_session_date ON cardio_sessions(session_date DESC);
    CREATE INDEX IF NOT EXISTS idx_boulder_session_date ON bouldering_sessions(session_date DESC);
    CREATE INDEX IF NOT EXISTS idx_supp_logs_date ON supplement_logs(log_date);
  `);

  try {
    dbInstance.exec(
      "ALTER TABLE gym_entries ADD COLUMN muscle_group TEXT NOT NULL DEFAULT 'chest';"
    );
  } catch {
    // Column already exists
  }

  // Seed default daily supplements if table is empty
  const suppCount = dbInstance
    .prepare("SELECT COUNT(*) as cnt FROM supplement_items")
    .get() as { cnt: number };

  if (suppCount.cnt === 0) {
    const nowIso = new Date().toISOString();
    const insertSupp = dbInstance.prepare(
      "INSERT INTO supplement_items (name, dosage, timing, color, created_at) VALUES (?, ?, ?, ?, ?)"
    );
    insertSupp.run("Kreatin Monohydrat", "5g", "Morgens", "#cba6f7", nowIso);
    insertSupp.run("Whey Protein", "30g", "Post-Gym", "#a6e3a1", nowIso);
    insertSupp.run("Omega-3 EPA/DHA", "2 Kapseln", "Morgens", "#89dceb", nowIso);
    insertSupp.run("Vitamin D3 + K2", "1 Tropfen", "Morgens", "#fab387", nowIso);
    insertSupp.run("Magnesium Bisglycinat", "300mg", "Abends", "#f5c2e7", nowIso);
  }

  return dbInstance;
}

export const sqlite = ensureSchemaMigrations(
  globalForDb.sqliteInstance ?? initializeSqlite()
);
if (process.env.NODE_ENV !== "production") {
  globalForDb.sqliteInstance = sqlite;
}

/**
 * Executes a batch of SQLite operations inside an atomic IMMEDIATE transaction.
 * Boosts bulk CSV import speed by ~50x and prevents partial writes.
 */
export function runInTransaction<T>(work: () => T): T {
  sqlite.exec("BEGIN IMMEDIATE;");
  try {
    const result = work();
    sqlite.exec("COMMIT;");
    return result;
  } catch (err) {
    try {
      sqlite.exec("ROLLBACK;");
    } catch {
      // Ignore rollback error if transaction already closed
    }
    throw err;
  }
}

export function getAllFitnessData(): FitnessDataset {
  ensureSchemaMigrations(sqlite);

  const gymRows = sqlite
    .prepare(
      `SELECT id, session_date, workout_focus, exercise_name, muscle_group, sets, reps, weight_kg, rpe, estimated_1rm, notes, created_at
       FROM gym_entries
       ORDER BY session_date DESC, id DESC`
    )
    .all() as Array<Record<string, unknown>>;

  const cardioRows = sqlite
    .prepare(
      `SELECT id, session_date, modality, duration_minutes, distance_km, avg_heart_rate, rpe, notes, created_at
       FROM cardio_sessions
       ORDER BY session_date DESC, id DESC`
    )
    .all() as Array<Record<string, unknown>>;

  const boulderRows = sqlite
    .prepare(
      `SELECT id, session_date, location, grade, style, wall_angle, attempts, topped, duration_minutes, skin_and_finger_feel, notes, created_at
       FROM bouldering_sessions
       ORDER BY session_date DESC, id DESC`
    )
    .all() as Array<Record<string, unknown>>;

  const templateRows = sqlite
    .prepare(
      `SELECT id, name, exercises_json, created_at
       FROM workout_templates
       ORDER BY id DESC`
    )
    .all() as Array<Record<string, unknown>>;

  const suppRows = sqlite
    .prepare(
      `SELECT id, name, dosage, timing, color, created_at
       FROM supplement_items
       ORDER BY id ASC`
    )
    .all() as Array<Record<string, unknown>>;

  const suppLogRows = sqlite
    .prepare(
      `SELECT id, supplement_id, log_date, created_at
       FROM supplement_logs
       ORDER BY log_date DESC, id DESC`
    )
    .all() as Array<Record<string, unknown>>;

  const gym: GymEntry[] = gymRows.map((r) => {
    const exName = String(r.exercise_name);
    const rawMuscle = r.muscle_group
      ? (String(r.muscle_group) as MuscleGroup)
      : inferMuscleGroupFromExercise(exName);
    return {
      id: Number(r.id),
      sessionDate: String(r.session_date),
      workoutFocus: String(r.workout_focus),
      exerciseName: exName,
      muscleGroup: rawMuscle,
      sets: Number(r.sets),
      reps: Number(r.reps),
      weightKg: Number(r.weight_kg),
      rpe: Number(r.rpe),
      estimated1Rm: Number(r.estimated_1rm),
      notes: String(r.notes ?? ""),
      createdAt: String(r.created_at),
    };
  });

  const cardio: CardioSession[] = cardioRows.map((r) => ({
    id: Number(r.id),
    sessionDate: String(r.session_date),
    modality: String(r.modality),
    durationMinutes: Number(r.duration_minutes),
    distanceKm: Number(r.distance_km),
    avgHeartRate:
      r.avg_heart_rate === null || r.avg_heart_rate === undefined
        ? null
        : Number(r.avg_heart_rate),
    rpe: Number(r.rpe),
    notes: String(r.notes ?? ""),
    createdAt: String(r.created_at),
  }));

  const bouldering: BoulderingSession[] = boulderRows.map((r) => ({
    id: Number(r.id),
    sessionDate: String(r.session_date),
    location: String(r.location),
    grade: String(r.grade),
    style: String(r.style),
    wallAngle: String(r.wall_angle),
    attempts: Number(r.attempts),
    topped: Number(r.topped) === 1,
    durationMinutes: Number(r.duration_minutes),
    skinAndFingerFeel: Number(r.skin_and_finger_feel),
    notes: String(r.notes ?? ""),
    createdAt: String(r.created_at),
  }));

  const templates: WorkoutTemplate[] = templateRows.map((r) => {
    let parsedEx: WorkoutTemplateExercise[] = [];
    try {
      parsedEx = JSON.parse(
        String(r.exercises_json)
      ) as WorkoutTemplateExercise[];
    } catch {
      parsedEx = [];
    }
    return {
      id: Number(r.id),
      name: String(r.name),
      exercises: parsedEx,
      createdAt: String(r.created_at),
    };
  });

  const supplements: SupplementItem[] = suppRows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    dosage: String(r.dosage),
    timing: String(r.timing) as SupplementTiming,
    color: String(r.color),
    createdAt: String(r.created_at),
  }));

  const supplementLogs: SupplementLog[] = suppLogRows.map((r) => ({
    id: Number(r.id),
    supplementId: Number(r.supplement_id),
    logDate: String(r.log_date),
    createdAt: String(r.created_at),
  }));

  return { gym, cardio, bouldering, templates, supplements, supplementLogs };
}

export function insertGymEntry(entry: NewGymEntry): void {
  const nowIso = new Date().toISOString();
  const muscle =
    entry.muscleGroup ?? inferMuscleGroupFromExercise(entry.exerciseName);
  sqlite
    .prepare(
      `INSERT INTO gym_entries (session_date, workout_focus, exercise_name, muscle_group, sets, reps, weight_kg, rpe, estimated_1rm, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      entry.sessionDate,
      entry.workoutFocus,
      entry.exerciseName,
      muscle,
      entry.sets,
      entry.reps,
      entry.weightKg,
      entry.rpe,
      entry.estimated1Rm,
      entry.notes,
      nowIso
    );
}

export function insertCardioSession(entry: NewCardioSession): void {
  const nowIso = new Date().toISOString();
  sqlite
    .prepare(
      `INSERT INTO cardio_sessions (session_date, modality, duration_minutes, distance_km, avg_heart_rate, rpe, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      entry.sessionDate,
      entry.modality,
      entry.durationMinutes,
      entry.distanceKm,
      entry.avgHeartRate,
      entry.rpe,
      entry.notes,
      nowIso
    );
}

export function insertBoulderingSession(entry: NewBoulderingSession): void {
  const nowIso = new Date().toISOString();
  sqlite
    .prepare(
      `INSERT INTO bouldering_sessions (session_date, location, grade, style, wall_angle, attempts, topped, duration_minutes, skin_and_finger_feel, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      entry.sessionDate,
      entry.location,
      entry.grade,
      entry.style,
      entry.wallAngle,
      entry.attempts,
      entry.topped ? 1 : 0,
      entry.durationMinutes,
      entry.skinAndFingerFeel,
      entry.notes,
      nowIso
    );
}

/**
 * Upserts a WorkoutTemplate by name so re-importing a Hevy CSV updates existing templates cleanly
 * without creating duplicates.
 */
export function insertWorkoutTemplate(template: NewWorkoutTemplate): void {
  const nowIso = new Date().toISOString();
  const existing = sqlite
    .prepare("SELECT id FROM workout_templates WHERE LOWER(name) = LOWER(?)")
    .get(template.name) as { id: number } | undefined;

  if (existing) {
    sqlite
      .prepare(
        "UPDATE workout_templates SET exercises_json = ?, created_at = ? WHERE id = ?"
      )
      .run(JSON.stringify(template.exercises), nowIso, existing.id);
  } else {
    sqlite
      .prepare(
        `INSERT INTO workout_templates (name, exercises_json, created_at)
         VALUES (?, ?, ?)`
      )
      .run(template.name, JSON.stringify(template.exercises), nowIso);
  }
}

export function insertSupplementItem(item: NewSupplementItem): void {
  const nowIso = new Date().toISOString();
  sqlite
    .prepare(
      `INSERT INTO supplement_items (name, dosage, timing, color, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      item.name,
      item.dosage,
      item.timing,
      item.color ?? "#cba6f7",
      nowIso
    );
}

export function toggleSupplementLog(
  supplementId: number,
  logDate: string
): void {
  const existing = sqlite
    .prepare(
      "SELECT id FROM supplement_logs WHERE supplement_id = ? AND log_date = ?"
    )
    .get(supplementId, logDate) as { id: number } | undefined;

  if (existing) {
    sqlite.prepare("DELETE FROM supplement_logs WHERE id = ?").run(existing.id);
  } else {
    const nowIso = new Date().toISOString();
    sqlite
      .prepare(
        "INSERT INTO supplement_logs (supplement_id, log_date, created_at) VALUES (?, ?, ?)"
      )
      .run(supplementId, logDate, nowIso);
  }
}

export function deleteFitnessEntry(
  category: "gym" | "cardio" | "bouldering" | "template" | "supplement",
  id: number
): void {
  if (category === "gym") {
    sqlite.prepare("DELETE FROM gym_entries WHERE id = ?").run(id);
  } else if (category === "cardio") {
    sqlite.prepare("DELETE FROM cardio_sessions WHERE id = ?").run(id);
  } else if (category === "bouldering") {
    sqlite.prepare("DELETE FROM bouldering_sessions WHERE id = ?").run(id);
  } else if (category === "template") {
    sqlite.prepare("DELETE FROM workout_templates WHERE id = ?").run(id);
  } else if (category === "supplement") {
    sqlite.prepare("DELETE FROM supplement_logs WHERE supplement_id = ?").run(id);
    sqlite.prepare("DELETE FROM supplement_items WHERE id = ?").run(id);
  }
}
