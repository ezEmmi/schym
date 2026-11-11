/**
 * Domain types & SQLite table definitions for Schym
 */

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "core"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves";

export type SupplementTiming = "Morgens" | "Pre-Gym" | "Post-Gym" | "Abends";

export interface SupplementItem {
  id: number;
  name: string;
  dosage: string;
  timing: SupplementTiming;
  color: string;
  createdAt: string;
}

export interface NewSupplementItem {
  name: string;
  dosage: string;
  timing: SupplementTiming;
  color?: string;
}

export interface SupplementLog {
  id: number;
  supplementId: number;
  logDate: string; // YYYY-MM-DD
  createdAt: string;
}

export interface WorkoutTemplateExercise {
  name: string;
  muscleGroup: MuscleGroup;
  targetSets: number;
  targetReps: number;
  defaultWeightKg: number;
}

export interface WorkoutTemplate {
  id: number;
  name: string;
  exercises: WorkoutTemplateExercise[];
  createdAt: string;
}

export interface NewWorkoutTemplate {
  name: string;
  exercises: WorkoutTemplateExercise[];
}

export interface GymEntry {
  id: number;
  sessionDate: string; // YYYY-MM-DD
  workoutFocus: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  sets: number;
  reps: number;
  weightKg: number;
  rpe: number; // 1 - 10
  estimated1Rm: number;
  notes: string;
  createdAt: string;
}

export type NewGymEntry = Omit<GymEntry, "id" | "createdAt" | "muscleGroup"> & {
  muscleGroup?: MuscleGroup;
};

export interface CardioSession {
  id: number;
  sessionDate: string; // YYYY-MM-DD
  modality: string;
  durationMinutes: number;
  distanceKm: number;
  avgHeartRate: number | null;
  rpe: number; // 1 - 10
  notes: string;
  createdAt: string;
}

export type NewCardioSession = Omit<CardioSession, "id" | "createdAt">;

export interface BoulderingSession {
  id: number;
  sessionDate: string; // YYYY-MM-DD
  location: string;
  grade: string;
  style: string;
  wallAngle: string;
  attempts: number;
  topped: boolean;
  durationMinutes: number;
  skinAndFingerFeel: number;
  notes: string;
  createdAt: string;
}

export type NewBoulderingSession = Omit<BoulderingSession, "id" | "createdAt">;

export interface FitnessDataset {
  gym: GymEntry[];
  cardio: CardioSession[];
  bouldering: BoulderingSession[];
  templates: WorkoutTemplate[];
  supplements: SupplementItem[];
  supplementLogs: SupplementLog[];
}
