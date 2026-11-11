/**
 * Domain types & SQLite table definitions for Schym
 */

export interface GymEntry {
  id: number;
  sessionDate: string; // YYYY-MM-DD
  workoutFocus: string; // e.g., "Full Body Strength A", "Upper Body"
  exerciseName: string;
  sets: number;
  reps: number;
  weightKg: number;
  rpe: number; // 1 - 10
  estimated1Rm: number;
  notes: string;
  createdAt: string;
}

export type NewGymEntry = Omit<GymEntry, "id" | "createdAt">;

export interface CardioSession {
  id: number;
  sessionDate: string; // YYYY-MM-DD
  modality: string; // "Run" | "Cycle" | "Row" | "Swim" | "HIIT" | "Hike"
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
  grade: string; // e.g., "6B+", "7A", "V5-V6"
  style: string; // "Flash" | "Redpoint" | "Onsight" | "Project"
  wallAngle: string; // "Slab" | "Vertical" | "Overhang" | "Roof"
  attempts: number;
  topped: boolean;
  durationMinutes: number;
  skinAndFingerFeel: number; // 1 - 10 recovery score
  notes: string;
  createdAt: string;
}

export type NewBoulderingSession = Omit<BoulderingSession, "id" | "createdAt">;

export interface FitnessDataset {
  gym: GymEntry[];
  cardio: CardioSession[];
  bouldering: BoulderingSession[];
}
