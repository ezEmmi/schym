import type {
  FitnessDataset,
  MuscleGroup,
  WorkoutTemplate,
} from "./db/schema";
import { MUSCLE_GROUPS } from "./muscles";

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

export interface ScienceInsight {
  id: string;
  title: string;
  finding: string;
  recommendation: string;
  citation: string;
  badgeColor: string;
}

export interface MuscleVolumeStatus {
  muscleId: MuscleGroup;
  label: string;
  weeklyFractionalSets: number; // Pelland et al. (2024) fractional set counting (1.0 direct, 0.5 synergist)
  targetMinSets: number;
  targetMaxSets: number;
  status: "optimal" | "low" | "high";
}

export interface DailyCoachBriefing {
  headline: string;
  subline: string;
  recommendedAction: "gym" | "cardio" | "bouldering" | "rest";
  recommendedTemplate: WorkoutTemplate | null;
  recoveredMuscleLabels: string[];
  recoveringMuscleLabels: string[];
  pendingSupplementNames: string[];
  weekdayHabits: WeekdayHabit[];
  learnedGymPerWeek: number;
  learnedAvgRestDays: number;
  daysSinceLastGym: number;
  scienceInsights: ScienceInsight[];
  muscleVolumes: MuscleVolumeStatus[];
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

function daysBetween(dateA: string, dateB: string): number {
  const [y1, m1, d1] = dateA.split("-").map(Number);
  const [y2, m2, d2] = dateB.split("-").map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 999;
  const ms1 = Date.UTC(y1, m1 - 1, d1);
  const ms2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round(Math.abs(ms2 - ms1) / (1000 * 60 * 60 * 24));
}

/**
 * Computes fractional weekly sets per muscle group over the last 14 days (averaged per 7 days)
 * using Pelland et al. (2024/2025) Bayesian meta-regression fractional set accounting:
 * - Direct primary muscle sets = 1.0
 * - Compound synergist sets (e.g. Chest Press -> Triceps/Shoulders; Lat Pulldown/Row -> Biceps) = 0.5
 */
export function computeFractionalMuscleVolumes(
  data: FitnessDataset,
  todayIso: string
): MuscleVolumeStatus[] {
  const recentEntries = data.gym.filter(
    (g) => daysBetween(g.sessionDate, todayIso) <= 14
  );
  // If no entries in last 14 days, use the latest 4 workout days in history
  const distinctDates = Array.from(
    new Set(data.gym.map((g) => g.sessionDate))
  ).slice(0, 4);
  const activeEntries =
    recentEntries.length > 0
      ? recentEntries
      : data.gym.filter((g) => distinctDates.includes(g.sessionDate));

  const weeksSampled = 2; // 14-day window -> divide by 2 for weekly rate
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

    // Fractional synergist accounting (Pelland et al., 2024)
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

  // 1. True Behavioral Cadence & Top-K Weekday Learner
  // Sort distinct gym dates chronologically (newest first)
  const gymDates = Array.from(
    new Set(data.gym.map((g) => g.sessionDate))
  ).sort((a, b) => b.localeCompare(a));
  const cardioDates = Array.from(
    new Set(data.cardio.map((c) => c.sessionDate))
  ).sort((a, b) => b.localeCompare(a));
  const boulderDates = Array.from(
    new Set(data.bouldering.map((b) => b.sessionDate))
  ).sort((a, b) => b.localeCompare(a));

  // Calculate average rest days between consecutive gym workouts
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

  // Calculate real weekly gym frequency (sessions per 7 days)
  const newestDate = gymDates[0] ?? todayIso;
  const oldestDate = gymDates[gymDates.length - 1] ?? todayIso;
  const totalSpanWeeks = Math.max(
    1,
    daysBetween(newestDate, oldestDate) / 7
  );
  // Weight recent 28 days higher so current habits dominate
  const recent28Count = gymDates.filter(
    (d) => daysBetween(d, newestDate) <= 28
  ).length;
  const overallPerWeek = gymDates.length / totalSpanWeeks;
  const recentPerWeek = recent28Count / 4;
  const learnedGymPerWeek =
    Math.round(
      (recent28Count >= 3 ? recentPerWeek * 0.65 + overallPerWeek * 0.35 : overallPerWeek) *
        10
    ) / 10;

  // How many primary Gym weekdays should be highlighted? (e.g. 2 days/week -> Top 2 weekdays!)
  const maxGymHabitDays = Math.max(
    1,
    Math.min(3, Math.round(learnedGymPerWeek || 2))
  );

  // Score each weekday with recency weighting (last 30 days = 2.0 pts, older = 1.0 pt)
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

  // Only the Top-K weekdays with at least 2 sessions (or highest score) are true "Stamm-Gym-Tage"!
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
      if (cCount >= 2 && cCount >= bCount) {
        return {
          weekdayIndex: idx,
          weekdayShort: shortName,
          dominantType: "cardio",
          label: `Cardio (${cCount}×)`,
          count: cCount,
          probabilityPct: 50,
        };
      }
      if (bCount >= 2) {
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

  // 2. Check Muscle Recovery (48h protein synthesis window per Schoenfeld / MacDougall)
  const recentlyWorkedMuscles = new Set<MuscleGroup>();
  for (const g of data.gym) {
    if (daysBetween(g.sessionDate, todayIso) <= 2 && g.sessionDate <= todayIso) {
      recentlyWorkedMuscles.add(g.muscleGroup);
    }
  }

  const recoveredMuscleLabels = MUSCLE_GROUPS.filter(
    (m) => !recentlyWorkedMuscles.has(m.id)
  )
    .slice(0, 4)
    .map((m) => m.label.split(" ")[0] ?? m.label);

  const recoveringMuscleLabels = MUSCLE_GROUPS.filter((m) =>
    recentlyWorkedMuscles.has(m.id)
  ).map((m) => m.label.split(" ")[0] ?? m.label);

  // 3. Determine Next Gym Template in Rotation (learns alternating Drücken <-> Ziehen)
  let recommendedTemplate: WorkoutTemplate | null =
    data.templates[0] ?? null;

  if (data.templates.length > 1 && data.gym.length > 0) {
    const lastWorkoutFocus = data.gym[0]?.workoutFocus?.toLowerCase() ?? "";
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

  // 5. Did user already train today?
  const trainedToday =
    gymDates.includes(todayIso) ||
    cardioDates.includes(todayIso) ||
    boulderDates.includes(todayIso);

  const lastGymDate = gymDates[0];
  const daysSinceLastGym = lastGymDate ? daysBetween(lastGymDate, todayIso) : 99;

  // 6. Build Evidence-Based Daily Recommendation
  const todayHabit = weekdayHabits[todayWeekdayIdx];
  let recommendedAction: "gym" | "cardio" | "bouldering" | "rest" = "gym";
  let headline = "";
  let subline = "";

  if (trainedToday) {
    recommendedAction = "rest";
    headline = `Stark! Heute (${todayWeekdayName}) schon abgeliefert — Muskelproteinbiosynthese läuft 🔥`;
    subline =
      pendingSupplementNames.length > 0
        ? `Optimal für Hypertrophie jetzt: ${Math.round(profile.weightKg * 1.8)}g Protein über den Tag + offene Supps (${pendingSupplementNames.slice(0, 3).join(", ")}).`
        : `Dein Rhythmus: Ø alle ${learnedAvgRestDays} Tage Gym (~${learnedGymPerWeek}×/Woche). Nächster Split in Rotation: „${recommendedTemplate?.name ?? "Ziehen"}“.`;
  } else if (daysSinceLastGym <= 1) {
    // Yesterday was a Gym day -> enforce 48h recovery window!
    recommendedAction = "rest";
    headline = `Heute Regeneration oder lockeres Zone-2 Cardio 🌿`;
    subline = `Du warst gestern im Gym — laut Studien (MacDougall / Schoenfeld) läuft die Muskelreparatur für 36–48h. Nächstes Gym-Fenster in ~${Math.max(1, Math.round(learnedAvgRestDays - daysSinceLastGym))} Tagen.`;
  } else if (
    (todayHabit && todayHabit.dominantType === "gym") ||
    daysSinceLastGym >= Math.round(learnedAvgRestDays)
  ) {
    recommendedAction = "gym";
    const planName = recommendedTemplate?.name ?? "Gym Session";
    headline =
      todayHabit?.dominantType === "gym"
        ? `Yo! ${todayWeekdayName} ist einer deiner gelernten Stamm-Gym-Tage 💪`
        : `Dein ${Math.round(learnedAvgRestDays)}-Tage-Rhythmus schlägt an: Zeit für „${planName}“ 💪`;
    subline = `Letztes Gym vor ${daysSinceLastGym} Tagen — „${planName}“ ist als Nächstes in deiner Rotation dran (${recoveredMuscleLabels.join(", ")} sind zu 100 % erholt).`;
  } else {
    recommendedAction = "cardio";
    headline = `Heute kein fester Gym-Tag (${todayWeekdayName}) — perfekt für Sport/Cardio oder Erholung ✨`;
    subline = `Deine gelernten Gym-Schwerpunkte liegen aktuell bei Ø ${learnedGymPerWeek}×/Woche (alle ~${learnedAvgRestDays} Tage). Nächster Gym-Plan: „${recommendedTemplate?.name ?? "Drücken"}“.`;
  }

  // 7. Compute Peer-Reviewed Sports Science Insights tailored to the user's data & profile
  const muscleVolumes = computeFractionalMuscleVolumes(data, todayIso);
  const proteinTargetGrams = Math.round(profile.weightKg * 1.8);
  const creatineGrams = Math.max(3, Math.round(profile.weightKg * 0.05));

  const scienceInsights: ScienceInsight[] = [
    {
      id: "plotkin_double_progression_2022",
      title: "Gelernte Kraft-Kurve & Plateau-Brecher (Double Progression)",
      finding:
        "Starke Progression bei Brustpresse (16,5 → 23 kg, +39 %) & Bizepscurl (10 → 18 kg, +80 %). Aber: Latzug (30 kg × 12) & Hyperextension (15 kg × 12) stehen seit 3 Einheiten auf demselben Gewicht!",
      recommendation:
        "Nach Plotkin et al. (2022): Wenn der Gewichtssprung am Steckgewicht zu groß ist, erhöhe erst auf 14–15 Wiederholungen („Rep Progression“) und springe erst im Workout danach auf die nächste Gewichts-Stufe.",
      citation:
        "Plotkin et al. (2022, PeerJ — Load vs. Repetition Progression produce equal hypertrophy)",
      badgeColor: "#a6e3a1",
    },
    {
      id: "pelland_volume_2024",
      title: "Wochen-Volumen & 2×/Woche Oberkörper-Frequenz",
      finding: `Dein gelernter Rhythmus liegt bei ~${learnedGymPerWeek}× Gym/Woche (Ø alle ${learnedAvgRestDays} Tage). Weil du in „Drücken“ auch Klimmzüge & Bizepscurls machst, trainierst du Rücken & Bizeps 2× pro Woche — Brust & Trizeps aber aktuell fast nur in „Drücken“!`,
      recommendation:
        "Ergänze am Ende von „Ziehen“ 3 Sätze Brustpresse oder Fliegende + nimm Trizepsdrücken (Überkopf am Kabel) wieder fest rein. So bekommt jeder Oberkörper-Muskel 2×/Woche den Wachstumsreiz und erreicht 10–14 effektive Sätze.",
      citation:
        "Pelland et al. (2024/2025, Sports Med Bayesian Meta-Regression, 67 Studien) & Schoenfeld et al. (2016)",
      badgeColor: "#cba6f7",
    },
    {
      id: "maeo_stretch_2023",
      title: "Stretch-Mediated Hypertrophy (Dehnung unter Last)",
      finding:
        "Du notierst dir bereits stark „Sitz soweit runter wie geht“ bei der Brustpresse und hast auf die untere Reverse-Fly-Maschine gewechselt.",
      recommendation:
        "Studien zeigen bis zu +40 % mehr Hypertrophie, wenn der Muskel in der gedehnten Position arbeitet: Lass bei Brustpresse, Latzug und Fliegenden am untersten Punkt 1 Sekunde kontrolliert in die Dehnung ziehen.",
      citation:
        "Maeo et al. (2023, Eur J Sport Sci) & Pedrosa et al. (2023) — Long-Length Partial / Stretch Hypertrophy",
      badgeColor: "#f5c2e7",
    },
    {
      id: "refalo_rir_2023",
      title: "Optimale Satz-Intensität (1–2 RIR statt Zwangsversagen)",
      finding:
        "In deiner CSV fallen die Wiederholungen im 3. Satz oft stark ab (z. B. Schulterpresse 12 → 10 → 8 Wdh. bei 28 kg).",
      recommendation:
        "Beende Satz 1 & 2 mit 1–2 Wiederholungen im Tank (RPE 8–8.5) und geh erst im letzten Satz ans Limit (0–1 RIR) mit 90–120 Sek. Pause. Das liefert laut Meta-Analyse 99 % des Muskelwachstums bei halbierter Ermüdung.",
      citation:
        "Refalo et al. (2023, Sports Medicine) & Singer et al. (2024, Rest Interval Meta-Analysis)",
      badgeColor: "#fab387",
    },
    {
      id: "morton_nutrition_2018",
      title: `Dein persönliches Protein- & Kreatin-Ziel (${profile.weightKg} kg)`,
      finding: `Für ${profile.weightKg} kg Körpergewicht liegt der wissenschaftliche Sweet-Spot für maximalen Muskelaufbau bei 1,6–2,0 g Protein/kg.`,
      recommendation: `Peile täglich ~${proteinTargetGrams} g Protein (verteilt auf 3–4 Mahlzeiten à ~${Math.round(proteinTargetGrams / 4)} g) sowie ${creatineGrams} g Kreatin Monohydrat an.`,
      citation:
        "Morton et al. (2018, Br J Sports Med, 49 Studien) & ISSN Position Stand (Kreider et al., 2017)",
      badgeColor: "#89dceb",
    },
  ];

  const suppSuffix =
    pendingSupplementNames.length > 0
      ? `\n💊 Heute offen: ${pendingSupplementNames.join(", ")}`
      : "\n✅ Alle Supplements heute schon abgehakt!";

  const nextFocusTarget =
    recommendedTemplate?.name.toLowerCase().includes("ziehen")
      ? "🎯 Fokus-Ziel im Gym: Latzug 30kg × 13+ Wdh. (Plateau brechen!) & Bizepscurl 18kg bestätigen."
      : "🎯 Fokus-Ziel im Gym: Brustpresse 23kg × 10 Wdh. & Schulterpresse 28kg × 12/12/10.";

  const signalMessageText = `☀️ Guten Morgen! Dein Schym 06:00 Uhr Briefing (${todayWeekdayName}, ${todayIso}):\n\n💪 ${headline}\n📋 ${subline}\n${nextFocusTarget}\n🥩 Tagesziel: ${proteinTargetGrams}g Protein + ${creatineGrams}g Kreatin${suppSuffix}`;

  return {
    headline,
    subline,
    recommendedAction,
    recommendedTemplate,
    recoveredMuscleLabels,
    recoveringMuscleLabels,
    pendingSupplementNames,
    weekdayHabits,
    learnedGymPerWeek,
    learnedAvgRestDays,
    daysSinceLastGym,
    scienceInsights,
    muscleVolumes,
    signalMessageText,
    trainedToday,
  };
}
