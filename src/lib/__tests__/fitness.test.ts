import { describe, it, expect } from "vitest";
import {
  gymEntryInputSchema,
  cardioSessionInputSchema,
  boulderingSessionInputSchema,
  deleteEntryInputSchema,
  stravaSyncRequestSchema,
} from "../validation/fitness";
import {
  calculateEstimated1Rm,
  formatPaceMinPerKm,
  getIsoWeekMonday,
  computeWeeklySummary,
} from "../metrics";
import {
  SPORTS_CATALOG,
  mapStravaSportToSchym,
} from "../sports-catalog";

describe("Fitness Input Validation & Security Guards", () => {
  it("validates a well-formed gym entry and rejects prototype/unknown keys (.strict)", () => {
    const valid = gymEntryInputSchema.safeParse({
      sessionDate: "2026-11-11",
      workoutFocus: "Full Body A",
      exerciseName: "Bench Press",
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

  it("rejects out-of-bounds RPE or impossible weights", () => {
    const invalidWeight = gymEntryInputSchema.safeParse({
      sessionDate: "2026-11-11",
      workoutFocus: "Pull",
      exerciseName: "Deadlift",
      sets: 3,
      reps: 5,
      weightKg: 9999,
      rpe: 12,
    });
    expect(invalidWeight.success).toBe(false);
  });

  it("validates multi-sport sessions across 20+ sports (Run, Padel, Boxing, Ski, etc.)", () => {
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

    const validBoxing = cardioSessionInputSchema.safeParse({
      sessionDate: "2026-11-11",
      modality: "Boxing",
      durationMinutes: 60,
      distanceKm: 0,
      avgHeartRate: "",
      rpe: 9,
    });
    expect(validBoxing.success).toBe(true);
    if (validBoxing.success) {
      expect(validBoxing.data.avgHeartRate).toBeNull();
    }
  });

  it("validates Strava sync requests & maps Strava sport_types accurately", () => {
    expect(mapStravaSportToSchym("GravelRide")).toBe("GravelMtb");
    expect(mapStravaSportToSchym("Soccer")).toBe("Football");
    expect(mapStravaSportToSchym("AlpineSki")).toBe("SkiSnowboard");
    expect(mapStravaSportToSchym("Padel")).toBe("Padel");

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

  it("validates bouldering session grades and styles strictly", () => {
    const validBoulder = boulderingSessionInputSchema.safeParse({
      sessionDate: "2026-11-11",
      location: "Flashh Boulder",
      grade: "6C+",
      style: "Redpoint",
      wallAngle: "Overhang",
      attempts: 4,
      topped: true,
      durationMinutes: 95,
      skinAndFingerFeel: 8,
    });
    expect(validBoulder.success).toBe(true);

    const invalidGrade = boulderingSessionInputSchema.safeParse({
      sessionDate: "2026-11-11",
      location: "Flashh Boulder",
      grade: "DROP TABLE",
      style: "Redpoint",
      wallAngle: "Overhang",
      attempts: 4,
      topped: true,
      durationMinutes: 95,
      skinAndFingerFeel: 8,
    });
    expect(invalidGrade.success).toBe(false);
  });

  it("validates delete requests strictly", () => {
    expect(
      deleteEntryInputSchema.safeParse({ category: "bouldering", id: 5 }).success
    ).toBe(true);
    expect(
      deleteEntryInputSchema.safeParse({ category: "users", id: 1 }).success
    ).toBe(false);
  });
});

describe("Fitness Domain Metrics", () => {
  it("computes Epley e1RM accurately", () => {
    expect(calculateEstimated1Rm(100, 1)).toBe(100);
    expect(calculateEstimated1Rm(100, 6)).toBe(120);
    expect(calculateEstimated1Rm(0, 5)).toBe(0);
  });

  it("formats running/cardio pace in min/km", () => {
    expect(formatPaceMinPerKm(25, 5)).toBe("5:00 /km");
    expect(formatPaceMinPerKm(30, 0)).toBe("—");
  });

  it("computes weekly split adherence for 2x Gym, 2x+ Cardio, and Bouldering", () => {
    const monday = getIsoWeekMonday("2026-11-11"); // Wednesday -> 2026-11-09
    expect(monday).toBe("2026-11-09");

    const summary = computeWeeklySummary(
      "2026-11-11",
      [
        { sessionDate: "2026-11-09", sets: 4, reps: 5, weightKg: 100 },
        { sessionDate: "2026-11-09", sets: 3, reps: 8, weightKg: 60 },
        { sessionDate: "2026-11-11", sets: 4, reps: 6, weightKg: 90 },
      ],
      [
        { sessionDate: "2026-11-10", durationMinutes: 35 },
        { sessionDate: "2026-11-11", durationMinutes: 45 },
      ],
      [
        { sessionDate: "2026-11-11", topped: true },
        { sessionDate: "2026-11-11", topped: false },
      ]
    );

    expect(summary.gymDaysCount).toBe(2); // 2 distinct days
    expect(summary.cardioSessionsCount).toBe(2);
    expect(summary.boulderingSessionsCount).toBe(1);
    expect(summary.boulderingSendsCount).toBe(1);
    expect(summary.totalCardioMinutes).toBe(80);
  });
});
