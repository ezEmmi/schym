import { z } from "zod";
import { SPORT_IDS } from "../sports-catalog";
import { MUSCLE_GROUP_IDS } from "../muscles";

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
    muscleGroup: z.enum(MUSCLE_GROUP_IDS).optional(),
    sets: z.coerce.number().int().min(1).max(30),
    reps: z.coerce.number().int().min(1).max(100),
    weightKg: z.coerce.number().min(0).max(600),
    rpe: z.coerce.number().min(1).max(10),
    notes: z.string().trim().max(280).optional().default(""),
  })
  .strict();

export const workoutTemplateExerciseSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    muscleGroup: z.enum(MUSCLE_GROUP_IDS),
    targetSets: z.coerce.number().int().min(1).max(20),
    targetReps: z.coerce.number().int().min(1).max(100),
    defaultWeightKg: z.coerce.number().min(0).max(600),
  })
  .strict();

export const workoutTemplateInputSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    exercises: z.array(workoutTemplateExerciseSchema).min(1).max(30),
  })
  .strict();

export const supplementTimings = [
  "Morgens",
  "Pre-Gym",
  "Post-Gym",
  "Abends",
] as const;

export const supplementItemInputSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    dosage: z.string().trim().min(1).max(30),
    timing: z.enum(supplementTimings),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional()
      .default("#cba6f7"),
  })
  .strict();

export const supplementToggleInputSchema = z
  .object({
    supplementId: z.coerce.number().int().positive(),
    logDate: dateStringSchema,
  })
  .strict();

export const cardioModalities = SPORT_IDS;

export const cardioSessionInputSchema = z
  .object({
    sessionDate: dateStringSchema,
    modality: z.enum(SPORT_IDS),
    durationMinutes: z.coerce.number().int().min(1).max(1440),
    distanceKm: z.coerce.number().min(0).max(1000),
    avgHeartRate: z.preprocess(
      (val) =>
        val === "" || val === null || val === undefined ? null : Number(val),
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
    category: z.enum(["gym", "cardio", "bouldering", "template", "supplement"]),
    id: z.coerce.number().int().positive(),
  })
  .strict();

export const signalNotifyRequestSchema = z
  .object({
    mode: z.enum(["signal_cli", "callmebot"]),
    recipientPhone: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{7,16}$/, "Bitte gültige Telefonnummer im Format +49... angeben"),
    senderPhone: z.string().trim().max(20).optional(),
    endpointUrl: z.string().trim().max(200).optional(),
    apiKey: z.string().trim().max(64).optional(),
    message: z.string().trim().min(2).max(1000),
  })
  .strict();

export const stravaActivityItemSchema = z.object({
  id: z.number().optional(),
  name: z.string().trim().max(160).default("Strava Activity"),
  type: z.string().trim().max(60).optional(),
  sport_type: z.string().trim().max(60).optional(),
  start_date_local: z.string().min(10),
  moving_time: z.number().min(0).max(864000),
  distance: z.number().min(0).max(10000000).optional().default(0),
  average_heartrate: z.number().min(30).max(240).nullable().optional(),
  total_elevation_gain: z.number().min(0).optional(),
  suffer_score: z.number().min(0).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
});

export const stravaSyncRequestSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("token"),
      accessToken: z
        .string()
        .trim()
        .min(10, "Valid Strava OAuth Access Token required")
        .max(512),
      perPage: z.coerce.number().int().min(1).max(100).optional().default(30),
    })
    .strict(),
  z
    .object({
      mode: z.literal("refresh"),
      clientId: z.string().trim().min(2).max(64),
      clientSecret: z.string().trim().min(10).max(256),
      refreshToken: z.string().trim().min(10).max(512),
      perPage: z.coerce.number().int().min(1).max(100).optional().default(30),
    })
    .strict(),
  z
    .object({
      mode: z.literal("oauth_code"),
      clientId: z.string().trim().min(2).max(64),
      clientSecret: z.string().trim().min(10).max(256),
      code: z.string().trim().min(5).max(512),
      perPage: z.coerce.number().int().min(1).max(100).optional().default(50),
    })
    .strict(),
  z
    .object({
      mode: z.literal("free_import"),
      format: z.enum([
        "hevy_csv",
        "strava_csv",
        "strava_copy_paste",
        "hevy_text",
      ]),
      rawContent: z.string().trim().min(5).max(1000000),
    })
    .strict(),
  z
    .object({
      mode: z.literal("json"),
      activities: z.array(stravaActivityItemSchema).min(1).max(200),
    })
    .strict(),
]);

export type GymEntryInput = z.infer<typeof gymEntryInputSchema>;
export type WorkoutTemplateInput = z.infer<typeof workoutTemplateInputSchema>;
export type SupplementItemInput = z.infer<typeof supplementItemInputSchema>;
export type SupplementToggleInput = z.infer<typeof supplementToggleInputSchema>;
export type CardioSessionInput = z.infer<typeof cardioSessionInputSchema>;
export type BoulderingSessionInput = z.infer<
  typeof boulderingSessionInputSchema
>;
export type DeleteEntryInput = z.infer<typeof deleteEntryInputSchema>;
export type StravaActivityItem = z.infer<typeof stravaActivityItemSchema>;
