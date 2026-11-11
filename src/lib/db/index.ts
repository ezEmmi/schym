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

  // Safe migration if gym_entries was created before muscle_group column existed
  try {
    sqlite.exec(
      "ALTER TABLE gym_entries ADD COLUMN muscle_group TEXT NOT NULL DEFAULT 'chest';"
    );
  } catch {
    // Column already exists
  }

  return sqlite;
}

const globalForDb = globalThis as unknown as {
  sqliteInstance?: DatabaseSync;
};

export const sqlite = globalForDb.sqliteInstance ?? initializeSqlite();
if (process.env.NODE_ENV !== "production") {
  globalForDb.sqliteInstance = sqlite;
}

export function getAllFitnessData(): FitnessDataset {
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
      parsedEx = JSON.parse(String(r.exercises_json)) as WorkoutTemplateExercise[];
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

  return { gym, cardio, bouldering, templates };
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
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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

export function insertWorkoutTemplate(template: NewWorkoutTemplate): void {
  const nowIso = new Date().toISOString();
  sqlite
    .prepare(
      `INSERT INTO workout_templates (name, exercises_json, created_at)
       VALUES (?, ?, ?)`
    )
    .run(template.name, JSON.stringify(template.exercises), nowIso);
}

export function deleteFitnessEntry(
  category: "gym" | "cardio" | "bouldering" | "template",
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
  }
}
