import { z } from "zod";

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const dateStringSchema = z
  .string()
  .regex(isoDateRegex, "Date must be in YYYY-MM-DD format")
  .refine((val) => !Number.isNaN(Date.parse(val)), "Invalid calendar date");

export const gymEntryInputSchema = z
  .object({
    sessionDate: dateStringSchema,
    workoutFocus: z
      .string()
      .trim()
      .min(2, "Workout focus is required")
      .max(60, "Workout focus must be <= 60 chars"),
    exerciseName: z
      .string()
      .trim()
      .min(2, "Exercise name is required")
      .max(80, "Exercise name must be <= 80 chars"),
    sets: z.coerce.number().int().min(1).max(30),
    reps: z.coerce.number().int().min(1).max(100),
    weightKg: z.coerce.number().min(0).max(600),
    rpe: z.coerce.number().min(1).max(10),
    notes: z.string().trim().max(280).optional().default(""),
  })
  .strict();

export const cardioModalities = [
  "Run",
  "Cycle",
  "Row",
  "Swim",
  "HIIT",
  "Hike",
] as const;

export const cardioSessionInputSchema = z
  .object({
    sessionDate: dateStringSchema,
    modality: z.enum(cardioModalities),
    durationMinutes: z.coerce.number().int().min(1).max(720),
    distanceKm: z.coerce.number().min(0).max(500),
    avgHeartRate: z.preprocess(
      (val) => (val === "" || val === null || val === undefined ? null : Number(val)),
      z.number().int().min(35).max(230).nullable()
    ),
    rpe: z.coerce.number().int().min(1).max(10),
    notes: z.string().trim().max(280).optional().default(""),
  })
  .strict();

export const climbingGrades = [
  "4",
  "5A",
  "5B",
  "5C",
  "6A",
  "6A+",
  "6B",
  "6B+",
  "6C",
  "6C+",
  "7A",
  "7A+",
  "7B",
  "7B+",
  "7C",
  "7C+",
  "8A",
  "V0-V2",
  "V3-V4",
  "V5-V6",
  "V7+",
] as const;

export const climbingStyles = [
  "Flash",
  "Redpoint",
  "Onsight",
  "Project",
] as const;

export const wallAngles = [
  "Slab",
  "Vertical",
  "Overhang",
  "Roof",
] as const;

export const boulderingSessionInputSchema = z
  .object({
    sessionDate: dateStringSchema,
    location: z
      .string()
      .trim()
      .min(2, "Gym or crag name is required")
      .max(80, "Location must be <= 80 chars"),
    grade: z.enum(climbingGrades),
    style: z.enum(climbingStyles),
    wallAngle: z.enum(wallAngles),
    attempts: z.coerce.number().int().min(1).max(100),
    topped: z.coerce.boolean(),
    durationMinutes: z.coerce.number().int().min(5).max(480),
    skinAndFingerFeel: z.coerce.number().int().min(1).max(10),
    notes: z.string().trim().max(280).optional().default(""),
  })
  .strict();

export const deleteEntryInputSchema = z
  .object({
    category: z.enum(["gym", "cardio", "bouldering"]),
    id: z.coerce.number().int().positive(),
  })
  .strict();

export type GymEntryInput = z.infer<typeof gymEntryInputSchema>;
export type CardioSessionInput = z.infer<typeof cardioSessionInputSchema>;
export type BoulderingSessionInput = z.infer<typeof boulderingSessionInputSchema>;
export type DeleteEntryInput = z.infer<typeof deleteEntryInputSchema>;
