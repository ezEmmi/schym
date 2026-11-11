import { describe, it, expect } from "vitest";
import {
  gymEntryInputSchema,
  cardioSessionInputSchema,
  boulderingSessionInputSchema,
  workoutTemplateInputSchema,
  deleteEntryInputSchema,
  stravaSyncRequestSchema,
} from "../validation/fitness";
import {
  calculateEstimated1Rm,
  formatPaceMinPerKm,
  getIsoWeekMonday,
  computeWeeklySummary,
  calculateWeeklyStreak,
} from "../metrics";
import {
  SPORTS_CATALOG,
  mapStravaSportToSchym,
} from "../sports-catalog";
import {
  inferMuscleGroupFromExercise,
  computeOverloadSuggestion,
  parseHevyDescriptionFromStrava,
} from "../muscles";
import {
  parseHevyCsv,
  parseStravaActivitiesCsv,
  parseStravaWebTableText,
} from "../importers";

describe("Fitness Input Validation & Security Guards", () => {
  it("validates a well-formed gym entry and rejects prototype/unknown keys (.strict)", () => {
    const valid = gymEntryInputSchema.safeParse({
      sessionDate: "2026-11-11",
      workoutFocus: "Full Body A",
      exerciseName: "Bench Press",
      muscleGroup: "chest",
      sets: 4,
      reps: 8,
      weightKg: 82.5,
      rpe: 8,
      notes: "Felt strong",
    });
    expect(valid.success).toBe(true);

    const maliciousExtraProperty = gymEntryInputSchema.safeParse({
      sessionDate: "2026-11-11",
      workoutFocus: "Full Body A",
      exerciseName: "Bench Press",
      sets: 4,
      reps: 8,
      weightKg: 82.5,
      rpe: 8,
      isAdmin: true,
    });
    expect(maliciousExtraProperty.success).toBe(false);
  });

  it("validates custom workout templates strictly", () => {
    const validTpl = workoutTemplateInputSchema.safeParse({
      name: "Mein Gym Tag A",
      exercises: [
        {
          name: "Brustpresse Maschine",
          muscleGroup: "chest",
          targetSets: 3,
          targetReps: 8,
          defaultWeightKg: 70,
        },
      ],
    });
    expect(validTpl.success).toBe(true);
  });

  it("validates multi-sport sessions across 20+ sports", () => {
    expect(SPORTS_CATALOG.length).toBeGreaterThanOrEqual(20);

    const validPadel = cardioSessionInputSchema.safeParse({
      sessionDate: "2026-11-11",
      modality: "Padel",
      durationMinutes: 90,
      distanceKm: 3.4,
      avgHeartRate: 145,
      rpe: 8,
      notes: "Won 6-4, 6-3",
    });
    expect(validPadel.success).toBe(true);
  });

  it("validates Strava sync requests & maps Strava sport_types accurately", () => {
    expect(mapStravaSportToSchym("GravelRide")).toBe("GravelMtb");
    expect(mapStravaSportToSchym("Soccer")).toBe("Football");

    const validStravaJson = stravaSyncRequestSchema.safeParse({
      mode: "json",
      activities: [
        {
          name: "Evening Gravel Ride",
          sport_type: "GravelRide",
          start_date_local: "2026-11-11T17:00:00Z",
          moving_time: 3600,
          distance: 25000,
          average_heartrate: 155,
        },
      ],
    });
    expect(validStravaJson.success).toBe(true);
  });

  it("validates bouldering session grades and delete requests strictly", () => {
    expect(
      boulderingSessionInputSchema.safeParse({
        sessionDate: "2026-11-11",
        location: "Flashh Boulder",
        grade: "6C+",
        style: "Redpoint",
        wallAngle: "Overhang",
        attempts: 4,
        topped: true,
        durationMinutes: 95,
        skinAndFingerFeel: 8,
      }).success
    ).toBe(true);

    expect(
      deleteEntryInputSchema.safeParse({ category: "template", id: 2 }).success
    ).toBe(true);
  });
});

describe("Smart Progressive Overload, Muscle Inference & Hevy Parser", () => {
  it("infers muscle groups from German and English machine names", () => {
    expect(inferMuscleGroupFromExercise("Brustpresse Maschine")).toBe("chest");
    expect(inferMuscleGroupFromExercise("Lat Pulldown (Cable)")).toBe("back");
    expect(inferMuscleGroupFromExercise("Beinpresse")).toBe("quads");
  });

  it("suggests +2.5kg progressive overload when target reps were hit at RPE <= 8.5", () => {
    const suggestion = computeOverloadSuggestion("Brustpresse", 8, 60, [
      {
        id: 1,
        sessionDate: "2026-11-09",
        workoutFocus: "Tag A",
        exerciseName: "Brustpresse",
        muscleGroup: "chest",
        sets: 3,
        reps: 8,
        weightKg: 70,
        rpe: 8,
        estimated1Rm: 88.7,
        notes: "",
        createdAt: "2026-11-09T10:00:00Z",
      },
    ]);
    expect(suggestion.shouldIncrease).toBe(true);
    expect(suggestion.suggestedWeightKg).toBe(72.5);
  });

  it("parses Hevy workout descriptions from Strava activities", () => {
    const parsed = parseHevyDescriptionFromStrava(
      "Bench Press (Machine)\nSet 1: 75 kg x 8\nSet 2: 75 kg x 8\n\nLat Pulldown\nSet 1: 60 kg x 10"
    );
    expect(parsed.length).toBe(2);
    expect(parsed[0]?.name).toBe("Bench Press (Machine)");
    expect(parsed[0]?.defaultWeightKg).toBe(75);
    expect(parsed[1]?.muscleGroup).toBe("back");
  });

  it("parses free Hevy CSV exports, Strava CSV exports, and Strava Web Copy-Paste tables without Pro subscription", () => {
    const hevyCsv = `"title","start_time","exercise_title","weight_kg","reps","rpe"\n"Push Tag A","2026-11-10 18:00","Bench Press",80,8,8\n"Push Tag A","2026-11-10 18:00","Bench Press",82.5,8,8.5`;
    const hevyRes = parseHevyCsv(hevyCsv);
    expect(hevyRes.gymEntries.length).toBe(1);
    expect(hevyRes.gymEntries[0]?.sets).toBe(2);
    expect(hevyRes.gymEntries[0]?.weightKg).toBe(82.5);
    expect(hevyRes.templates.length).toBe(1);

    const stravaCsv = `Activity Date,Activity Name,Activity Type,Moving Time,Distance,Average Heart Rate\n"2026-11-11","Abendlauf","Run",2400,7500,152`;
    const stravaRes = parseStravaActivitiesCsv(stravaCsv);
    expect(stravaRes.cardioSessions.length).toBe(1);
    expect(stravaRes.cardioSessions[0]?.distanceKm).toBe(7.5);
    expect(stravaRes.cardioSessions[0]?.durationMinutes).toBe(40);

    const copyPaste = `Lauf\t10.11.2026\tFeierabendrunde\t38:15\t7,25 km`;
    const pasteRes = parseStravaWebTableText(copyPaste);
    expect(pasteRes.cardioSessions.length).toBe(1);
    expect(pasteRes.cardioSessions[0]?.sessionDate).toBe("2026-11-10");
    expect(pasteRes.cardioSessions[0]?.distanceKm).toBe(7.25);
  });
});

describe("Fitness Domain Metrics & Weekly Streak", () => {
  it("computes Epley e1RM and pace accurately", () => {
    expect(calculateEstimated1Rm(100, 6)).toBe(120);
    expect(formatPaceMinPerKm(25, 5)).toBe("5:00 /km");
  });

  it("computes consecutive weekly streaks and weekly summary", () => {
    expect(getIsoWeekMonday("2026-11-11")).toBe("2026-11-09");
    const streak = calculateWeeklyStreak("2026-11-11", [
      "2026-10-27",
      "2026-11-03",
      "2026-11-10",
    ]);
    expect(streak).toBe(3);

    const summary = computeWeeklySummary(
      "2026-11-11",
      [{ sessionDate: "2026-11-09", sets: 4, reps: 5, weightKg: 100 }],
      [{ sessionDate: "2026-11-10", durationMinutes: 35 }],
      [{ sessionDate: "2026-11-11", topped: true }]
    );
    expect(summary.activeDaysThisWeek).toBe(3);
    expect(summary.weeklyStreakCount).toBe(1);
  });
});
