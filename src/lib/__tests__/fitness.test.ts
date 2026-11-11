import { describe, it, expect } from "vitest";
import {
  gymEntryInputSchema,
  cardioSessionInputSchema,
  boulderingSessionInputSchema,
  workoutTemplateInputSchema,
  supplementItemInputSchema,
  supplementToggleInputSchema,
  signalNotifyRequestSchema,
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
  normalizeToIsoDate,
  parseHevyCsv,
  parseStravaActivitiesCsv,
  parseStravaWebTableText,
} from "../importers";
import { computeCoachBriefing } from "../coach";
import { isAllowedSignalCliEndpoint } from "../signal";

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

  it("validates custom workout templates and daily supplements strictly", () => {
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

    const validSupp = supplementItemInputSchema.safeParse({
      name: "Kreatin Monohydrat",
      dosage: "5g",
      timing: "Morgens",
      color: "#cba6f7",
    });
    expect(validSupp.success).toBe(true);

    const validToggle = supplementToggleInputSchema.safeParse({
      supplementId: 1,
      logDate: "2026-11-11",
    });
    expect(validToggle.success).toBe(true);
  });

  it("validates Signal notification payloads and blocks SSRF to external hosts", () => {
    expect(
      signalNotifyRequestSchema.safeParse({
        mode: "signal_cli",
        recipientPhone: "+491701234567",
        message: "Yo! Heute steht Gym an.",
      }).success
    ).toBe(true);

    expect(
      isAllowedSignalCliEndpoint("http://127.0.0.1:8080/v2/send")
    ).toBe(true);
    expect(
      isAllowedSignalCliEndpoint("http://signal-cli:8080/v2/send")
    ).toBe(true);
    expect(
      isAllowedSignalCliEndpoint("https://evil-attacker.example.com/steal")
    ).toBe(false);
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
      deleteEntryInputSchema.safeParse({ category: "supplement", id: 2 }).success
    ).toBe(true);
  });
});

describe("German & English Date Normalization & Multi-Line CSV Engine", () => {
  it("normalizes German and English Hevy/Strava dates without UTC timezone shift", () => {
    expect(normalizeToIsoDate("14. Okt. 2025, 17:34")).toBe("2025-10-14");
    expect(normalizeToIsoDate("15 Mai 2025, 18:00")).toBe("2025-05-15");
    expect(normalizeToIsoDate("3. Dez 2025")).toBe("2025-12-03");
    expect(normalizeToIsoDate("22. März 2025 19:15")).toBe("2025-03-22");
    expect(normalizeToIsoDate("10 Nov 2025, 17:30")).toBe("2025-11-10");
    expect(normalizeToIsoDate("Oct 14, 2025, 5:34 PM")).toBe("2025-10-14");
    expect(normalizeToIsoDate("14.10.2025")).toBe("2025-10-14");
    expect(normalizeToIsoDate("2025-10-14 17:30:00")).toBe("2025-10-14");
  });

  it("parses multi-line Hevy CSV exports, Strava CSV exports, and Strava Web Copy-Paste tables", () => {
    const hevyCsvWithMultilineNote = `"title","start_time","description","exercise_title","weight_kg","reps","rpe"\n"Push Tag A","14. Okt. 2025, 18:00","Super Session\nmit gutem Pump","Bench Press",80,8,8\n"Push Tag A","14. Okt. 2025, 18:00","Super Session\nmit gutem Pump","Bench Press",82.5,8,8.5`;
    const hevyRes = parseHevyCsv(hevyCsvWithMultilineNote);
    expect(hevyRes.gymEntries.length).toBe(1);
    expect(hevyRes.gymEntries[0]?.sessionDate).toBe("2025-10-14");
    expect(hevyRes.gymEntries[0]?.sets).toBe(2);
    expect(hevyRes.gymEntries[0]?.weightKg).toBe(82.5);
    expect(hevyRes.templates.length).toBe(1);

    const stravaCsv = `Activity Date,Activity Name,Activity Type,Moving Time,Distance,Average Heart Rate\n"15. Mai 2025","Abendlauf","Run",2400,7500,152`;
    const stravaRes = parseStravaActivitiesCsv(stravaCsv);
    expect(stravaRes.cardioSessions.length).toBe(1);
    expect(stravaRes.cardioSessions[0]?.sessionDate).toBe("2025-05-15");
    expect(stravaRes.cardioSessions[0]?.distanceKm).toBe(7.5);
    expect(stravaRes.cardioSessions[0]?.durationMinutes).toBe(40);

    const copyPaste = `Lauf\t10.11.2026\tFeierabendrunde\t38:15\t7,25 km`;
    const pasteRes = parseStravaWebTableText(copyPaste);
    expect(pasteRes.cardioSessions.length).toBe(1);
    expect(pasteRes.cardioSessions[0]?.sessionDate).toBe("2026-11-10");
    expect(pasteRes.cardioSessions[0]?.distanceKm).toBe(7.25);
  });
});

describe("Smart Habit-Engine, Overload Coach & Hevy Parser", () => {
  it("infers muscle groups and suggests +2.5kg progressive overload", () => {
    expect(inferMuscleGroupFromExercise("Brustpresse Maschine")).toBe("chest");
    expect(inferMuscleGroupFromExercise("Lat Pulldown (Cable)")).toBe("back");

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

  it("learns weekday habits, muscle recovery, and pending supplements in computeCoachBriefing", () => {
    const briefing = computeCoachBriefing(
      {
        gym: [
          {
            id: 1,
            sessionDate: "2026-11-04", // Wednesday
            workoutFocus: "Push Plan A",
            exerciseName: "Bench Press",
            muscleGroup: "chest",
            sets: 3,
            reps: 8,
            weightKg: 80,
            rpe: 8,
            estimated1Rm: 101.3,
            notes: "",
            createdAt: "2026-11-04T18:00:00Z",
          },
        ],
        cardio: [],
        bouldering: [],
        templates: [
          {
            id: 1,
            name: "Push Plan A",
            exercises: [
              {
                name: "Bench Press",
                muscleGroup: "chest",
                targetSets: 3,
                targetReps: 8,
                defaultWeightKg: 80,
              },
            ],
            createdAt: "2026-11-04T18:00:00Z",
          },
        ],
        supplements: [
          {
            id: 1,
            name: "Kreatin",
            dosage: "5g",
            timing: "Morgens",
            color: "#cba6f7",
            createdAt: "2026-11-01T00:00:00Z",
          },
        ],
        supplementLogs: [],
      },
      "2026-11-11" // Next Wednesday!
    );

    expect(briefing.recommendedAction).toBe("gym");
    expect(briefing.pendingSupplementNames).toContain("Kreatin (5g)");
    expect(briefing.signalMessageText).toContain("Kreatin (5g)");
    expect(briefing.futureSchedule.length).toBe(14);
  });

  it("dynamically updates the 14-day future schedule when new Bouldering or Cardio sessions are logged", () => {
    const afterBoulderBriefing = computeCoachBriefing(
      {
        gym: [
          {
            id: 1,
            sessionDate: "2026-11-08",
            workoutFocus: "Drücken",
            exerciseName: "Brustpresse",
            muscleGroup: "chest",
            sets: 3,
            reps: 10,
            weightKg: 23,
            rpe: 8,
            estimated1Rm: 30.7,
            notes: "",
            createdAt: "2026-11-08T18:00:00Z",
          },
        ],
        cardio: [],
        bouldering: [
          {
            id: 10,
            sessionDate: "2026-11-11",
            location: "Boulderwelt",
            grade: "6B",
            style: "Flash",
            wallAngle: "Overhang",
            attempts: 1,
            topped: true,
            durationMinutes: 60,
            skinAndFingerFeel: 8,
            notes: "",
            createdAt: "2026-11-11T19:00:00Z",
          },
        ],
        templates: [
          {
            id: 1,
            name: "Drücken",
            exercises: [],
            createdAt: "2026-11-01T00:00:00Z",
          },
          {
            id: 2,
            name: "Ziehen",
            exercises: [],
            createdAt: "2026-11-01T00:00:00Z",
          },
        ],
        supplements: [],
        supplementLogs: [],
      },
      "2026-11-11"
    );

    expect(afterBoulderBriefing.trainedToday).toBe(true);
    expect(afterBoulderBriefing.futureSchedule[0]?.type).toBe("completed");
    // Because Bouldering fatigued pulling muscles today, the Coach prioritizes "Drücken" (Push) for the next Gym session!
    expect(afterBoulderBriefing.recommendedTemplate?.name).toBe("Drücken");
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
});

describe("Fitness Domain Metrics & Weekly Streak", () => {
  it("computes Epley e1RM, pace, and consecutive weekly streaks accurately", () => {
    expect(calculateEstimated1Rm(100, 6)).toBe(120);
    expect(formatPaceMinPerKm(25, 5)).toBe("5:00 /km");
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
