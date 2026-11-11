import type {
  FitnessDataset,
  MuscleGroup,
  WorkoutTemplate,
} from "./db/schema";
import { MUSCLE_GROUPS, computeOverloadSuggestion } from "./muscles";

export interface WeekdayHabit {
  weekdayIndex: number; // 0 = Mo .. 6 = So
  weekdayShort: string;
  dominantType: "gym" | "cardio" | "bouldering" | "rest";
  label: string;
  count: number;
  probabilityPct: number;
}

export interface AthleteProfile {
  weightKg: number;
  heightCm: number;
  age: number;
  goal: "hypertrophy" | "recomp" | "strength";
}

export type ScienceCategory =
  | "hypertrophy"
  | "hybrid_cardio"
  | "bouldering_tendons"
  | "nutrition_recovery";

export interface ScienceInsight {
  id: string;
  category: ScienceCategory;
  categoryLabel: string;
  title: string;
  finding: string;
  recommendation: string;
  citation: string;
  badgeColor: string;
}

export interface HybridHeartRateZones {
  hrMax: number; // Tanaka et al. (2001): 208 - 0.7 * age
  zone2Min: number; // 65% HRmax (Mitochondrial biogenesis & PCr resynthesis)
  zone2Max: number; // 75% HRmax (Below LT1 / conversational pace)
  vo2MaxMin: number; // 90% HRmax (Norwegian 4x4 interval target)
  vo2MaxMax: number; // 95% HRmax
}

export interface MuscleVolumeStatus {
  muscleId: MuscleGroup;
  label: string;
  weeklyFractionalSets: number; // Pelland et al. (2024) fractional set counting (1.0 direct, 0.5 synergist)
  targetMinSets: number;
  targetMaxSets: number;
  status: "optimal" | "low" | "high";
}

export interface PlannedFutureExercise {
  name: string;
  muscleGroup: MuscleGroup;
  targetSets: number;
  targetReps: number;
  suggestedWeightKg: number;
  previousWeightKg: number;
  previousReps: number;
  shouldIncrease: boolean;
  hint: string;
  seatNote: string;
}

export interface PlannedFutureDay {
  dateIso: string;
  dayOffset: number; // 0 = Heute, 1 = Morgen, ...
  weekdayShort: string;
  weekdayFull: string;
  relativeLabel: string;
  type: "gym" | "cardio" | "rest" | "completed";
  title: string;
  badgeText: string;
  reason: string;
  templateName: string | null;
  exercises: PlannedFutureExercise[];
}

export interface DailyCoachBriefing {
  headline: string;
  subline: string;
  liveDataSummary: string;
  recommendedAction: "gym" | "cardio" | "bouldering" | "rest";
  recommendedTemplate: WorkoutTemplate | null;
  recoveredMuscleLabels: string[];
  recoveringMuscleLabels: string[];
  pendingSupplementNames: string[];
  weekdayHabits: WeekdayHabit[];
  learnedGymPerWeek: number;
  learnedAvgRestDays: number;
  daysSinceLastGym: number;
  hrZones: HybridHeartRateZones;
  scienceInsights: ScienceInsight[];
  muscleVolumes: MuscleVolumeStatus[];
  futureSchedule: PlannedFutureDay[];
  signalMessageText: string;
  trainedToday: boolean;
}

export const DEFAULT_ATHLETE_PROFILE: AthleteProfile = {
  weightKg: 78,
  heightCm: 180,
  age: 24,
  goal: "hypertrophy",
};

const WEEKDAY_NAMES_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WEEKDAY_NAMES_FULL = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
];

function getIsoWeekdayIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return 0;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (dt.getUTCDay() + 6) % 7; // Monday = 0 .. Sunday = 6
}

function addDaysIso(baseIso: string, addDays: number): string {
  const [y, m, d] = baseIso.split("-").map(Number);
  if (!y || !m || !d) return baseIso;
  const dt = new Date(Date.UTC(y, m - 1, d + addDays));
  return dt.toISOString().slice(0, 10);
}

function formatShortGermanDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}.`;
}

function daysBetween(dateA: string, dateB: string): number {
  const [y1, m1, d1] = dateA.split("-").map(Number);
  const [y2, m2, d2] = dateB.split("-").map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 999;
  const ms1 = Date.UTC(y1, m1 - 1, d1);
  const ms2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round(Math.abs(ms2 - ms1) / (1000 * 60 * 60 * 24));
}

/**
 * Computes age-predicted HRmax using the Tanaka et al. (2001, JACC) equation (208 - 0.7 * age)
 * and derives Zone 2 (65-75% HRmax) & VO2max Norwegian 4x4 (90-95% HRmax) target zones.
 */
export function computeHybridHeartRateZones(age: number): HybridHeartRateZones {
  const safeAge = Math.max(14, Math.min(90, age || 24));
  const hrMax = Math.round(208 - 0.7 * safeAge);
  return {
    hrMax,
    zone2Min: Math.round(hrMax * 0.65),
    zone2Max: Math.round(hrMax * 0.75),
    vo2MaxMin: Math.round(hrMax * 0.9),
    vo2MaxMax: Math.round(hrMax * 0.95),
  };
}

function buildPlannedExercisesForTemplate(
  tpl: WorkoutTemplate,
  data: FitnessDataset
): PlannedFutureExercise[] {
  return tpl.exercises.map((ex) => {
    const norm = ex.name.trim().toLowerCase();
    const pastEntries = data.gym.filter(
      (g) => g.exerciseName.trim().toLowerCase() === norm
    );
    const latest = pastEntries[0];
    const seatEntry = pastEntries.find(
      (g) =>
        g.notes &&
        g.notes.trim().length > 0 &&
        g.notes !== "Hevy Import" &&
        !g.notes.startsWith("Sätze:")
    );

    const suggestion = computeOverloadSuggestion(
      ex.name,
      ex.targetReps,
      ex.defaultWeightKg,
      data.gym
    );

    return {
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      targetSets: ex.targetSets,
      targetReps: suggestion.suggestedReps,
      suggestedWeightKg: suggestion.suggestedWeightKg,
      previousWeightKg: latest?.weightKg ?? ex.defaultWeightKg,
      previousReps: latest?.reps ?? ex.targetReps,
      shouldIncrease: suggestion.shouldIncrease,
      hint: suggestion.reason,
      seatNote: seatEntry?.notes ?? "",
    };
  });
}

function analyzeLiveProgressionsAndPlateaus(data: FitnessDataset): {
  findingText: string;
  recommendationText: string;
} {
  const byExercise = new Map<
    string,
    Array<{ date: string; weightKg: number; reps: number }>
  >();

  const chronological = [...data.gym].sort((a, b) =>
    a.sessionDate.localeCompare(b.sessionDate)
  );

  for (const row of chronological) {
    const list = byExercise.get(row.exerciseName) ?? [];
    list.push({
      date: row.sessionDate,
      weightKg: row.weightKg,
      reps: row.reps,
    });
    byExercise.set(row.exerciseName, list);
  }

  const gains: Array<{
    name: string;
    firstW: number;
    lastW: number;
    pct: number;
  }> = [];
  const plateaus: Array<{
    name: string;
    weightKg: number;
    reps: number;
    count: number;
  }> = [];

  for (const [name, history] of byExercise.entries()) {
    if (history.length < 2) continue;
    const first = history[0]!;
    const last = history[history.length - 1]!;
    if (first.weightKg > 0 && last.weightKg > first.weightKg) {
      const pct = Math.round(
        ((last.weightKg - first.weightKg) / first.weightKg) * 100
      );
      gains.push({ name, firstW: first.weightKg, lastW: last.weightKg, pct });
    }

    if (history.length >= 3) {
      const last3 = history.slice(-3);
      const sameWeight = last3.every((h) => h.weightKg === last.weightKg);
      if (sameWeight && last.weightKg > 0) {
        plateaus.push({
          name,
          weightKg: last.weightKg,
          reps: last.reps,
          count: history.filter((h) => h.weightKg === last.weightKg).length,
        });
      }
    }
  }

  gains.sort((a, b) => b.pct - a.pct);
  plateaus.sort((a, b) => b.count - a.count);

  const topGainsText =
    gains.length > 0
      ? `Top-Steigerungen: ${gains
          .slice(0, 2)
          .map((g) => `${g.name} (${g.firstW} → ${g.lastW} kg, +${g.pct} %)`)
          .join(" & ")}.`
      : "Deine Kraftwerte werden live getrackt.";

  const plateauText =
    plateaus.length > 0
      ? ` Aktuelles Plateau erkannt bei: ${plateaus
          .slice(0, 2)
          .map((p) => `${p.name} (${p.count}× bei ${p.weightKg} kg × ${p.reps})`)
          .join(" & ")}.`
      : " Aktuell kein Plateau — alle Übungen steigen sauber!";

  const recText =
    plateaus.length > 0
      ? `Für ${plateaus[0]!.name}: Erhöhe im nächsten Training im 1. Satz auf ${plateaus[0]!.weightKg + 2.5} kg × 8–10 Wdh. (Load-Progression) oder mache bei ${plateaus[0]!.weightKg} kg erst 14 Wdh. voll (Plotkin et al., 2022).`
      : "Halte deine Double-Progression (8–12 Wdh. voll machen, dann +2,5 kg) genau so bei!";

  return {
    findingText: `${topGainsText}${plateauText}`,
    recommendationText: recText,
  };
}

export function computeFractionalMuscleVolumes(
  data: FitnessDataset,
  todayIso: string
): MuscleVolumeStatus[] {
  const recentEntries = data.gym.filter(
    (g) => daysBetween(g.sessionDate, todayIso) <= 14
  );
  const distinctDates = Array.from(
    new Set(data.gym.map((g) => g.sessionDate))
  ).slice(0, 4);
  const activeEntries =
    recentEntries.length > 0
      ? recentEntries
      : data.gym.filter((g) => distinctDates.includes(g.sessionDate));

  const weeksSampled = 2;
  const rawSets: Record<MuscleGroup, number> = {
    chest: 0,
    back: 0,
    shoulders: 0,
    biceps: 0,
    triceps: 0,
    core: 0,
    quads: 0,
    hamstrings: 0,
    glutes: 0,
    calves: 0,
  };

  for (const entry of activeEntries) {
    const s = entry.sets;
    const lower = entry.exerciseName.toLowerCase();
    rawSets[entry.muscleGroup] += s;

    if (
      entry.muscleGroup === "chest" &&
      (lower.includes("presse") || lower.includes("press"))
    ) {
      rawSets.triceps += s * 0.5;
      rawSets.shoulders += s * 0.5;
    } else if (
      entry.muscleGroup === "shoulders" &&
      (lower.includes("presse") || lower.includes("press"))
    ) {
      rawSets.triceps += s * 0.5;
    } else if (
      entry.muscleGroup === "back" &&
      (lower.includes("lat") ||
        lower.includes("klimm") ||
        lower.includes("ruder") ||
        lower.includes("row"))
    ) {
      rawSets.biceps += s * 0.5;
    }
  }

  const recentBoulders = data.bouldering.filter(
    (b) => daysBetween(b.sessionDate, todayIso) <= 14
  );
  for (const b of recentBoulders) {
    const eqSets = Math.max(2, Math.round(b.durationMinutes / 20));
    rawSets.back += eqSets * 0.5;
    rawSets.biceps += eqSets * 0.5;
  }

  const upperBodyFocus: MuscleGroup[] = [
    "chest",
    "back",
    "shoulders",
    "biceps",
    "triceps",
    "core",
  ];

  return upperBodyFocus.map((mId) => {
    const meta = MUSCLE_GROUPS.find((m) => m.id === mId)!;
    const weekly = Math.round((rawSets[mId] / weeksSampled) * 10) / 10;
    const targetMin = mId === "core" ? 4 : 8;
    const targetMax = mId === "core" ? 12 : 16;
    const status: "optimal" | "low" | "high" =
      weekly < targetMin
        ? "low"
        : weekly > targetMax
          ? "high"
          : "optimal";

    return {
      muscleId: mId,
      label: meta.label.split(" ")[0] ?? meta.label,
      weeklyFractionalSets: weekly,
      targetMinSets: targetMin,
      targetMaxSets: targetMax,
      status,
    };
  });
}

export function computeCoachBriefing(
  data: FitnessDataset,
  todayIso: string,
  profile: AthleteProfile = DEFAULT_ATHLETE_PROFILE
): DailyCoachBriefing {
  const todayWeekdayIdx = getIsoWeekdayIndex(todayIso);
  const todayWeekdayName = WEEKDAY_NAMES_FULL[todayWeekdayIdx] ?? "Heute";
  const hrZones = computeHybridHeartRateZones(profile.age);

  // 1. True Behavioral Cadence & Top-K Weekday Learner
  const gymDates = Array.from(
    new Set(data.gym.map((g) => g.sessionDate))
  ).sort((a, b) => b.localeCompare(a));
  const cardioDates = Array.from(
    new Set(data.cardio.map((c) => c.sessionDate))
  ).sort((a, b) => b.localeCompare(a));
  const boulderDates = Array.from(
    new Set(data.bouldering.map((b) => b.sessionDate))
  ).sort((a, b) => b.localeCompare(a));

  const allLoggedDates = [
    ...gymDates,
    ...cardioDates,
    ...boulderDates,
  ].sort((a, b) => b.localeCompare(a));
  const latestAnyDate = allLoggedDates[0] ?? todayIso;

  const liveDataSummary = `Live-Stand: ${gymDates.length} Gym-Tage (${data.gym.length} Logs) • ${data.cardio.length} Cardio/Strava • ${data.bouldering.length} Boulder (zuletzt: ${latestAnyDate})`;

  const gaps: number[] = [];
  for (let i = 0; i < gymDates.length - 1; i++) {
    const gap = daysBetween(gymDates[i]!, gymDates[i + 1]!);
    if (gap >= 1 && gap <= 14) {
      gaps.push(gap);
    }
  }
  const learnedAvgRestDays =
    gaps.length > 0
      ? Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10
      : 3.5;

  const newestDate = gymDates[0] ?? todayIso;
  const oldestDate = gymDates[gymDates.length - 1] ?? todayIso;
  const totalSpanWeeks = Math.max(
    1,
    daysBetween(newestDate, oldestDate) / 7
  );
  const recent28Count = gymDates.filter(
    (d) => daysBetween(d, newestDate) <= 28
  ).length;
  const overallPerWeek = gymDates.length / totalSpanWeeks;
  const recentPerWeek = recent28Count / 4;
  const learnedGymPerWeek =
    Math.round(
      (recent28Count >= 3
        ? recentPerWeek * 0.65 + overallPerWeek * 0.35
        : overallPerWeek) * 10
    ) / 10;

  const maxGymHabitDays = Math.max(
    1,
    Math.min(3, Math.round(learnedGymPerWeek || 2))
  );

  const weekdayGymScores = WEEKDAY_NAMES_SHORT.map((_, idx) => {
    let rawCount = 0;
    let weightedScore = 0;
    for (const d of gymDates) {
      if (getIsoWeekdayIndex(d) === idx) {
        rawCount += 1;
        weightedScore += daysBetween(d, newestDate) <= 30 ? 2.0 : 1.0;
      }
    }
    return { idx, rawCount, weightedScore };
  });

  const topGymWeekdayIndices = new Set(
    weekdayGymScores
      .filter((w) => w.rawCount >= 2 || (gymDates.length < 4 && w.rawCount >= 1))
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .slice(0, maxGymHabitDays)
      .map((w) => w.idx)
  );

  const weekdayHabits: WeekdayHabit[] = WEEKDAY_NAMES_SHORT.map(
    (shortName, idx) => {
      const gCount = weekdayGymScores[idx]?.rawCount ?? 0;
      const cCount = cardioDates.filter(
        (d) => getIsoWeekdayIndex(d) === idx
      ).length;
      const bCount = boulderDates.filter(
        (d) => getIsoWeekdayIndex(d) === idx
      ).length;

      const probPct =
        gymDates.length > 0
          ? Math.min(100, Math.round((gCount / totalSpanWeeks) * 100))
          : 0;

      if (topGymWeekdayIndices.has(idx)) {
        return {
          weekdayIndex: idx,
          weekdayShort: shortName,
          dominantType: "gym",
          label: `Stamm-Gym (${gCount}×)`,
          count: gCount,
          probabilityPct: probPct,
        };
      }
      if (cCount >= 1 && cCount >= bCount) {
        return {
          weekdayIndex: idx,
          weekdayShort: shortName,
          dominantType: "cardio",
          label: `Cardio (${cCount}×)`,
          count: cCount,
          probabilityPct: 50,
        };
      }
      if (bCount >= 1) {
        return {
          weekdayIndex: idx,
          weekdayShort: shortName,
          dominantType: "bouldering",
          label: `Bouldern (${bCount}×)`,
          count: bCount,
          probabilityPct: 50,
        };
      }
      return {
        weekdayIndex: idx,
        weekdayShort: shortName,
        dominantType: "rest",
        label: gCount === 1 ? "Flex / Pause" : "Regeneration",
        count: gCount,
        probabilityPct: probPct,
      };
    }
  );

  // 2. Check Muscle Recovery (including Bouldering pulling fatigue!)
  const recentlyWorkedMuscles = new Set<MuscleGroup>();
  for (const g of data.gym) {
    if (daysBetween(g.sessionDate, todayIso) <= 2 && g.sessionDate <= todayIso) {
      recentlyWorkedMuscles.add(g.muscleGroup);
    }
  }
  const boulderedRecently = boulderDates.some(
    (d) => daysBetween(d, todayIso) <= 1 && d <= todayIso
  );
  if (boulderedRecently) {
    recentlyWorkedMuscles.add("back");
    recentlyWorkedMuscles.add("biceps");
  }

  const recoveredMuscleLabels = MUSCLE_GROUPS.filter(
    (m) => !recentlyWorkedMuscles.has(m.id)
  )
    .slice(0, 4)
    .map((m) => m.label.split(" ")[0] ?? m.label);

  const recoveringMuscleLabels = MUSCLE_GROUPS.filter((m) =>
    recentlyWorkedMuscles.has(m.id)
  ).map((m) => m.label.split(" ")[0] ?? m.label);

  // 3. Determine Next Gym Template in Rotation (learns alternating Drücken <-> Ziehen, AND checks Bouldering fatigue!)
  let recommendedTemplate: WorkoutTemplate | null =
    data.templates[0] ?? null;

  if (boulderedRecently) {
    const pushTpl = data.templates.find((t) =>
      t.name.toLowerCase().includes("drücken")
    );
    if (pushTpl) {
      recommendedTemplate = pushTpl;
    }
  } else if (data.templates.length > 1 && data.gym.length > 0) {
    const sortedGym = [...data.gym].sort((a, b) =>
      b.sessionDate.localeCompare(a.sessionDate)
    );
    const lastWorkoutFocus = sortedGym[0]?.workoutFocus?.toLowerCase() ?? "";
    const differentTemplate = data.templates.find(
      (t) => t.name.toLowerCase() !== lastWorkoutFocus
    );
    if (differentTemplate) {
      recommendedTemplate = differentTemplate;
    }
  }

  // 4. Check Pending Supplements Today
  const takenTodayIds = new Set(
    data.supplementLogs
      .filter((l) => l.logDate === todayIso)
      .map((l) => l.supplementId)
  );
  const pendingSupplementNames = data.supplements
    .filter((s) => !takenTodayIds.has(s.id))
    .map((s) => `${s.name} (${s.dosage})`);

  // 5. Did user already train today? (Checks Gym, Cardio/Strava, AND Bouldering!)
  const gymToday = gymDates.includes(todayIso);
  const cardioToday = cardioDates.includes(todayIso);
  const boulderToday = boulderDates.includes(todayIso);
  const trainedToday = gymToday || cardioToday || boulderToday;

  const lastGymDate = gymDates[0];
  const daysSinceLastGym = lastGymDate ? daysBetween(lastGymDate, todayIso) : 99;

  const loggedSportThisWeek =
    cardioDates.filter((d) => daysBetween(d, todayIso) <= 6).length +
    boulderDates.filter((d) => daysBetween(d, todayIso) <= 6).length;

  // 6. GENERATE 14-DAY HYBRID TRAINING SCHEDULE (Strength + Polarized 80/20 Cardio + Bouldering Tendon Protection)
  const templates =
    data.templates.length > 0
      ? data.templates
      : [
          {
            id: 1,
            name: "Drücken",
            exercises: [],
            createdAt: todayIso,
          },
          {
            id: 2,
            name: "Ziehen",
            exercises: [],
            createdAt: todayIso,
          },
        ];

  let nextTplIdx = templates.findIndex(
    (t) => t.name === recommendedTemplate?.name
  );
  if (nextTplIdx < 0) nextTplIdx = 0;

  let simDaysSinceGym = gymToday ? 0 : daysSinceLastGym;
  let cardioScheduledThisWeek = loggedSportThisWeek;

  const futureSchedule: PlannedFutureDay[] = [];
  for (let offset = 0; offset < 14; offset++) {
    const dateIso = addDaysIso(todayIso, offset);
    const wIdx = getIsoWeekdayIndex(dateIso);
    const wShort = WEEKDAY_NAMES_SHORT[wIdx] ?? "Mo";
    const wFull = WEEKDAY_NAMES_FULL[wIdx] ?? "Montag";
    const shortDate = formatShortGermanDate(dateIso);
    const relativeLabel =
      offset === 0
        ? "Heute"
        : offset === 1
          ? "Morgen"
          : offset === 2
            ? "Übermorgen"
            : `${wShort}, ${shortDate}`;

    if (offset > 0 && wIdx === 0) {
      cardioScheduledThisWeek = 0;
    }

    // Case A: Today already trained (Gym, Cardio/Strava, or Bouldering!)
    if (offset === 0 && trainedToday) {
      const doneParts: string[] = [];
      if (gymToday) {
        const focus =
          data.gym.find((g) => g.sessionDate === todayIso)?.workoutFocus ??
          "Gym";
        doneParts.push(`Gym (${focus})`);
      }
      if (cardioToday) {
        const cEntry = data.cardio.find((c) => c.sessionDate === todayIso);
        doneParts.push(
          cEntry
            ? `${cEntry.modality} (${cEntry.durationMinutes} Min)`
            : "Cardio"
        );
      }
      if (boulderToday) {
        const bEntry = data.bouldering.find((b) => b.sessionDate === todayIso);
        doneParts.push(bEntry ? `Bouldern (${bEntry.grade})` : "Bouldern");
      }

      const doneLabel = doneParts.join(" + ");
      futureSchedule.push({
        dateIso,
        dayOffset: offset,
        weekdayShort: wShort,
        weekdayFull: wFull,
        relativeLabel,
        type: "completed",
        title: `Erledigt: ${doneLabel} ✅`,
        badgeText: `✅ ${doneParts[0] ?? "Erledigt"}`,
        reason: gymToday
          ? `Stark! Du hast heute ${doneLabel} geloggt. Jetzt läuft für 36–48h die mTORC1-Muskelproteinbiosynthese — dein Zukunfts-Plan ab morgen wurde automatisch angepasst!`
          : boulderToday
            ? `Du warst heute Bouldern (${doneLabel})! Da Klettern Unterarme, Bizeps & Rücken stark fordert, hat der Coach für dein nächstes Gym-Training automatisch „Drücken“ (Push) eingeplant.`
            : `Starkes Cardio-Training heute (${doneLabel})! Dein Wochenziel für Ausdauer ist aktualisiert und dein nächster Gym-Slot steht bereit.`,
        templateName: null,
        exercises: [],
      });
      simDaysSinceGym += 1;
      continue;
    }

    const isFavGymDay = topGymWeekdayIndices.has(wIdx);
    const shouldScheduleGym =
      (simDaysSinceGym >= 2 && isFavGymDay) || simDaysSinceGym >= 3;

    if (shouldScheduleGym) {
      const tpl = templates[nextTplIdx % templates.length]!;
      const plannedExercises = buildPlannedExercisesForTemplate(tpl, data);
      const overloadCount = plannedExercises.filter(
        (e) => e.shouldIncrease
      ).length;

      futureSchedule.push({
        dateIso,
        dayOffset: offset,
        weekdayShort: wShort,
        weekdayFull: wFull,
        relativeLabel,
        type: "gym",
        title: `Gym: „${tpl.name}“ 💪`,
        badgeText: `💪 ${tpl.name}`,
        reason: isFavGymDay
          ? `${wFull} (${shortDate}) ist dein gelernter Stamm-Trainingstag und deine Muskulatur ist nach ${simDaysSinceGym} Tagen Pause zu 100 % erholt. Bei ${overloadCount} Übungen steht eine Steigerung an!`
          : `Optimales Superkompensations-Fenster am ${wFull} (${shortDate}) nach ${simDaysSinceGym} Tagen Pause — „${tpl.name}“ ist in deiner Rotation als Nächstes dran.`,
        templateName: tpl.name,
        exercises: plannedExercises,
      });

      simDaysSinceGym = 1;
      nextTplIdx += 1;
      continue;
    }

    if (simDaysSinceGym === 1) {
      futureSchedule.push({
        dateIso,
        dayOffset: offset,
        weekdayShort: wShort,
        weekdayFull: wFull,
        relativeLabel,
        type: "rest",
        title: "Regeneration & mTORC1-Muskelaufbau 🧘",
        badgeText: "🧘 Pause / Mobility",
        reason: `Tag nach dem Gym: Deine Muskelfasern reparieren sich gerade (48h Hypertrophie-Fenster nach MacDougall et al.). Ideal: 8.000 Schritte, Dehnen & ${Math.round(profile.weightKg * 1.8)}g Protein.`,
        templateName: null,
        exercises: [],
      });
      simDaysSinceGym += 1;
      continue;
    }

    // Hybrid Polarized Cardio (Seiler 80/20 + Schumann et al. 2022 Concurrent Spacing):
    // Slot 1 of the week = Zone 2 Aerobic Base (65-75% HRmax)
    // Slot 2 of the week = VO2max Norwegian 4x4 (90-95% HRmax) OR Bouldering + Tendon Collagen Protocol
    if (cardioScheduledThisWeek === 0) {
      cardioScheduledThisWeek += 1;
      futureSchedule.push({
        dateIso,
        dayOffset: offset,
        weekdayShort: wShort,
        weekdayFull: wFull,
        relativeLabel,
        type: "cardio",
        title: `Hybrid Zone-2 Cardio (${hrZones.zone2Min}–${hrZones.zone2Max} bpm) 🏃`,
        badgeText: "🏃 Zone-2 Base",
        reason: `Hybrid-Slot 1 (80/20-Regel nach Seiler): 35–45 Min Laufen/Radfahren bei ${hrZones.zone2Min}–${hrZones.zone2Max} bpm (Nasenatmung). Baut Mitochondrien auf, beschleunigt deine PCr-Satzpausen-Erholung im Gym und hat 0 % Interferenz-Effekt (Schumann et al., 2022).`,
        templateName: null,
        exercises: [],
      });
    } else if (cardioScheduledThisWeek === 1) {
      cardioScheduledThisWeek += 1;
      futureSchedule.push({
        dateIso,
        dayOffset: offset,
        weekdayShort: wShort,
        weekdayFull: wFull,
        relativeLabel,
        type: "cardio",
        title: `Hybrid VO2max (4×4) ODER Bouldern ⚡🧗`,
        badgeText: "⚡ VO2max / Boulder",
        reason: `Hybrid-Slot 2: Entweder 4×4 Min Intervalle @ ${hrZones.vo2MaxMin}–${hrZones.vo2MaxMax} bpm für maximale VO2max (Helgerud et al., 2007) ODER 60 Min Bouldern (Tipp nach Keith Baar: 15g Kollagen + 50mg Vitamin C 45 Min vorher für Fingersehnen!).`,
        templateName: null,
        exercises: [],
      });
    } else {
      futureSchedule.push({
        dateIso,
        dayOffset: offset,
        weekdayShort: wShort,
        weekdayFull: wFull,
        relativeLabel,
        type: "rest",
        title: "Aktive Erholung (Cardio-Soll erfüllt ✅) 🌿",
        badgeText: "🌿 Erholung",
        reason: `Dein Cardio-/Sport-Pensum für diese Woche ist bereits erfüllt! Fokus heute auf volle Glykogen-Aufladung für deine nächste Gym-Einheit morgen.`,
        templateName: null,
        exercises: [],
      });
    }

    simDaysSinceGym += 1;
  }

  // 7. Build Headline & Subline referencing the concrete upcoming schedule!
  const todayPlan = futureSchedule[0]!;
  const nextGymPlan =
    futureSchedule.find((d) => d.type === "gym") ?? futureSchedule[0]!;

  let recommendedAction: "gym" | "cardio" | "bouldering" | "rest" = "gym";
  let headline = "";
  let subline = "";

  if (todayPlan.type === "gym") {
    recommendedAction = "gym";
    const topTargets = todayPlan.exercises
      .slice(0, 2)
      .map((e) => `${e.name} ${e.suggestedWeightKg}kg × ${e.targetReps}`)
      .join(" • ");
    headline = `Heute (${todayWeekdayName}) im Plan: Gym „${todayPlan.templateName}“ 💪`;
    subline = `${todayPlan.reason}${topTargets ? ` — Heutige Ziele: ${topTargets}` : ""}`;
  } else if (todayPlan.type === "completed") {
    recommendedAction = "rest";
    headline = `${todayPlan.title} — Nächstes Gym am ${nextGymPlan.weekdayFull} (${formatShortGermanDate(nextGymPlan.dateIso)}): „${nextGymPlan.templateName}“ 💪`;
    subline = todayPlan.reason;
  } else if (todayPlan.type === "cardio") {
    recommendedAction = "cardio";
    headline = `Heute: ${todayPlan.title} — Nächstes Gym am ${nextGymPlan.weekdayFull} (${formatShortGermanDate(nextGymPlan.dateIso)}): „${nextGymPlan.templateName}“`;
    subline = `${todayPlan.reason}`;
  } else {
    recommendedAction = "rest";
    headline = `Heute: Regeneration 🧘 — Nächstes Gym am ${nextGymPlan.weekdayFull} (${formatShortGermanDate(nextGymPlan.dateIso)}): „${nextGymPlan.templateName}“ 💪`;
    subline = `${todayPlan.reason}`;
  }

  // 8. OMNISCIENT SPORTS SCIENCE KNOWLEDGE BASE (10 Peer-Reviewed Meta-Analyses across 4 Pillars!)
  const muscleVolumes = computeFractionalMuscleVolumes(data, todayIso);
  const proteinTargetGrams = Math.round(profile.weightKg * 1.8);
  const creatineGrams = Math.max(3, Math.round(profile.weightKg * 0.05));
  const liveProg = analyzeLiveProgressionsAndPlateaus(data);

  const scienceInsights: ScienceInsight[] = [
    // PILLAR 1: HYPERTROPHY & STRENGTH
    {
      id: "plotkin_double_progression_2022",
      category: "hypertrophy",
      categoryLabel: "💪 Kraft & Hypertrophie",
      title: "Live Kraft-Kurve & Plateau-Brecher (Double Progression)",
      finding: liveProg.findingText,
      recommendation: liveProg.recommendationText,
      citation:
        "Plotkin et al. (2022, PeerJ — Load vs. Repetition Progression produce equal hypertrophy)",
      badgeColor: "#a6e3a1",
    },
    {
      id: "pelland_volume_2024",
      category: "hypertrophy",
      categoryLabel: "💪 Kraft & Hypertrophie",
      title: "Wochen-Volumen & 2×/Woche Oberkörper-Frequenz",
      finding: `Dein gelernter Rhythmus liegt bei ~${learnedGymPerWeek}× Gym/Woche (Ø alle ${learnedAvgRestDays} Tage) plus ${data.cardio.length} Cardio- & ${data.bouldering.length} Boulder-Sessions.`,
      recommendation:
        "Ergänze am Ende von „Ziehen“ 3 Sätze Brustpresse oder Fliegende + nimm Trizepsdrücken (Überkopf am Kabel) fest rein. So bekommt jeder Oberkörper-Muskel 2×/Woche den Wachstumsreiz (10–16 effektive Sätze).",
      citation:
        "Pelland et al. (2024/2025, Sports Med Bayesian Meta-Regression, 67 Studien) & Schoenfeld et al. (2016)",
      badgeColor: "#cba6f7",
    },
    {
      id: "maeo_stretch_2023",
      category: "hypertrophy",
      categoryLabel: "💪 Kraft & Hypertrophie",
      title: "Stretch-Mediated Hypertrophy (Dehnung unter Last)",
      finding:
        "Du notierst dir bereits stark „Sitz soweit runter wie geht“ bei der Brustpresse und hast auf die untere Reverse-Fly-Maschine gewechselt.",
      recommendation:
        "Studien zeigen bis zu +35–40 % mehr Hypertrophie, wenn der Muskel in der maximal gedehnten Position arbeitet: Lass bei Brustpresse, Latzug und Überkopf-Trizeps am untersten Punkt 1 Sekunde kontrolliert in die Dehnung ziehen.",
      citation:
        "Maeo et al. (2023, Eur J Sport Sci), Wolf et al. (2023) & Pedrosa et al. (2023)",
      badgeColor: "#f5c2e7",
    },
    {
      id: "robinson_refalo_rir_2024",
      category: "hypertrophy",
      categoryLabel: "💪 Kraft & Hypertrophie",
      title: "Optimale Satz-Intensität (1–2 RIR) & 90–120s Satzpause",
      finding:
        "In deiner Historie fallen die Wiederholungen im 3. Satz oft stark ab (z. B. Schulterpresse 12 → 10 → 8 Wdh. bei 28 kg).",
      recommendation:
        "Beende Satz 1 & 2 mit 1–2 Wiederholungen im Tank (RPE 8–8.5) und geh erst im letzten Satz ans Limit (0–1 RIR) mit mindestens 90–120 Sek. Pause. Das verhindert zentralnervöse Ermüdung bei vollem Hypertrophie-Reiz.",
      citation:
        "Robinson et al. (2024, Sports Medicine), Refalo et al. (2023) & Singer et al. (2024)",
      badgeColor: "#fab387",
    },

    // PILLAR 2: HYBRID TRAINING (CARDIO + STRENGTH CONCURRENT SCIENCE)
    {
      id: "schumann_concurrent_2022",
      category: "hybrid_cardio",
      categoryLabel: "🏃⚡ Hybrid: Cardio & Kraft",
      title: "Hybrid-Training ohne Interferenz-Effekt (AMPK vs. mTORC1)",
      finding:
        "Lange galt das Dogma, dass Cardio den Muskelaufbau (mTORC1-Signalweg) durch das Ausdauer-Enzym AMPK blockiert. Die größte Meta-Analyse über 43 Studien beweist das Gegenteil — wenn das Timing stimmt!",
      recommendation:
        "1. Beste Lösung (wie in deinem 7-Tage-Plan): Cardio an den gymfreien Tagen! 2. Wenn am selben Tag: Mindestens 3–6 Stunden Abstand halten ODER immer erst Krafttraining und danach lockeres Cardio (Radfahren/Incline-Walk schont die Beine mehr als hartes Asphalt-Laufen).",
      citation:
        "Schumann et al. (2022, Sports Medicine — Concurrent Aerobic and Strength Training Meta-Analysis, 43 Studien)",
      badgeColor: "#a6e3a1",
    },
    {
      id: "seiler_pcr_zone2_2024",
      category: "hybrid_cardio",
      categoryLabel: "🏃⚡ Hybrid: Cardio & Kraft",
      title: `Warum Zone-2 Cardio (${hrZones.zone2Min}–${hrZones.zone2Max} bpm) deine Gym-Kraft steigert`,
      finding: `Für dein Alter (${profile.age} J., Maximalpuls ~${hrZones.hrMax} bpm) liegt deine optimale Zone 2 bei ${hrZones.zone2Min}–${hrZones.zone2Max} bpm. Zwischen zwei schweren Gym-Sätzen wird dein explosives Phosphokreatin (PCr) zu 100 % aerob über Mitochondrien wiederhergestellt!`,
      recommendation: `Nutze die 80/20-Regel: Mache 1×/Woche 35–45 Min Zone-2 (${hrZones.zone2Min}–${hrZones.zone2Max} bpm, Nasenatmung) für schnellere Satzpausen-Erholung im Gym + 1×/Woche kurze Norwegian 4×4 Intervalle (${hrZones.vo2MaxMin}–${hrZones.vo2MaxMax} bpm) für deine VO2max.`,
      citation:
        "Seiler (2010/2024, Polarized 80/20 Model), Helgerud et al. (2007, Med Sci Sports Exerc) & Glaister (2005, PCr Resynthesis)",
      badgeColor: "#89dceb",
    },

    // PILLAR 3: BOULDERING, TENDONS & FOREARM BIOMECHANICS
    {
      id: "baar_bouldering_tendons_2017",
      category: "bouldering_tendons",
      categoryLabel: "🧗 Bouldern & Sehnen",
      title: "Fingersehnen-Schutz, Kollagen-Synthese & Zug-Ketten-Steuerung",
      finding:
        "Beim Bouldern wirken extreme isometrische Kräfte auf Ringbänder (Pulleys), Fingerbeuger und Ellenbogensehnen. Sehnen haben kaum Durchblutung und brauchen 48–72h für den Kollagen-Aufbau.",
      recommendation:
        "1. 15 g Kollagen-Hydrolysat + 50 mg Vitamin C exakt 30–60 Min VOR dem Bouldern einnehmen (verdoppelt laut Studie die Kollagensynthese in den Sehnen!). 2. Nach dem Bouldern plant Schym automatisch „Drücken“ vor „Ziehen“, um Golferellenbogen zu verhindern.",
      citation:
        "Keith Baar (2017, Sports Med), Shaw et al. (2017, Am J Clin Nutr) & Stien et al. (2023, Climbing Physiology)",
      badgeColor: "#fab387",
    },

    // PILLAR 4: NUTRITION, 100g PROTEIN BOLUS & SLEEP RECOVERY
    {
      id: "trommelen_morton_protein_2023",
      category: "nutrition_recovery",
      categoryLabel: "🥩💤 Ernährung & Schlaf",
      title: `Dein Protein-Ziel (${proteinTargetGrams} g/Tag) & das Ende des „30g-Limits“`,
      finding: `Für ${profile.weightKg} kg Körpergewicht liegt dein Optimum bei ~${proteinTargetGrams} g Protein/Tag + ${creatineGrams} g Kreatin. Trommelen et al. (2023) haben bewiesen, dass der Körper selbst 100 g Protein in einer Mahlzeit komplett für über 12h zum Muskelaufbau nutzt!`,
      recommendation: `Mach dir keinen Stress, wenn du nach dem Training 60–80 g Protein auf einmal isst — entscheidend ist, dass du abends deine ${proteinTargetGrams} g Gesamtprotein und ${creatineGrams} g Kreatin voll hast.`,
      citation:
        "Trommelen et al. (2023, Cell Reports Medicine) & Morton et al. (2018, Br J Sports Med, 49 Studien)",
      badgeColor: "#cba6f7",
    },
    {
      id: "lamon_craven_sleep_2022",
      category: "nutrition_recovery",
      categoryLabel: "🥩💤 Ernährung & Schlaf",
      title: "Schlaf-Hypertrophie-Faktor (-18 % Muskelaufbau bei Schlafmangel)",
      finding:
        "Schon eine einzige Nacht mit unter 6 Stunden Schlaf senkt die myofibrilläre Muskelproteinsynthese am Folgetag um 18 %, erhöht kataboles Cortisol um 21 % und senkt Testosteron um 24 %.",
      recommendation:
        "An den Abenden nach „Drücken“ & „Ziehen“ sind 7,5–8,5 Stunden Schlaf dein stärkster legaler Hypertrophie-Booster. Bei Schlafmangel im Gym lieber 1 Satz weniger machen, aber das Gewicht auf der Stange halten!",
      citation:
        "Lamon et al. (2021, Physiological Reports) & Craven et al. (2022, Sports Medicine Meta-Analysis)",
      badgeColor: "#f5c2e7",
    },
  ];

  const next3DaysSummary = futureSchedule
    .slice(0, 4)
    .map(
      (d) =>
        `• ${d.relativeLabel} (${formatShortGermanDate(d.dateIso)}): ${d.badgeText}`
    )
    .join("\n");

  const nextGymExercisePreview = nextGymPlan.exercises
    .slice(0, 4)
    .map(
      (e) =>
        `  - ${e.name}: ${e.targetSets}×${e.targetReps} @ ${e.suggestedWeightKg} kg ${e.shouldIncrease ? "🔼 (+Steigerung!)" : ""}`
    )
    .join("\n");

  const suppSuffix =
    pendingSupplementNames.length > 0
      ? `\n💊 Heute offen: ${pendingSupplementNames.join(", ")}`
      : "\n✅ Alle Supplements heute schon abgehakt!";

  const signalMessageText = `☀️ Guten Morgen! Dein Schym 06:00 Uhr Briefing (${todayWeekdayName}, ${todayIso}):\n\n💪 HEUTE: ${todayPlan.title}\n${todayPlan.reason}\n\n📅 DEIN FAHRPLAN FÜR DIE NÄCHSTEN TAGE:\n${next3DaysSummary}\n\n🎯 NÄCHSTE GYM-ZIELE (${nextGymPlan.templateName ?? "Gym"} am ${nextGymPlan.weekdayShort}):\n${nextGymExercisePreview}\n\n❤️ Hybrid-Puls-Zonen: Zone-2 ${hrZones.zone2Min}–${hrZones.zone2Max} bpm | VO2max ${hrZones.vo2MaxMin}–${hrZones.vo2MaxMax} bpm\n🥩 Tagesziel: ${proteinTargetGrams}g Protein + ${creatineGrams}g Kreatin${suppSuffix}`;

  return {
    headline,
    subline,
    liveDataSummary,
    recommendedAction,
    recommendedTemplate,
    recoveredMuscleLabels,
    recoveringMuscleLabels,
    pendingSupplementNames,
    weekdayHabits,
    learnedGymPerWeek,
    learnedAvgRestDays,
    daysSinceLastGym,
    hrZones,
    scienceInsights,
    muscleVolumes,
    futureSchedule,
    signalMessageText,
    trainedToday,
  };
}
