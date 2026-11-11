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
  signalMessageText: string;
  trainedToday: boolean;
}

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

export function computeCoachBriefing(
  data: FitnessDataset,
  todayIso: string
): DailyCoachBriefing {
  const todayWeekdayIdx = getIsoWeekdayIndex(todayIso);
  const todayWeekdayName = WEEKDAY_NAMES_FULL[todayWeekdayIdx] ?? "Heute";

  // 1. Learn Weekday Habits from distinct training dates
  const gymDates = Array.from(new Set(data.gym.map((g) => g.sessionDate)));
  const cardioDates = Array.from(
    new Set(data.cardio.map((c) => c.sessionDate))
  );
  const boulderDates = Array.from(
    new Set(data.bouldering.map((b) => b.sessionDate))
  );

  const weekdayHabits: WeekdayHabit[] = WEEKDAY_NAMES_SHORT.map(
    (shortName, idx) => {
      const gCount = gymDates.filter(
        (d) => getIsoWeekdayIndex(d) === idx
      ).length;
      const cCount = cardioDates.filter(
        (d) => getIsoWeekdayIndex(d) === idx
      ).length;
      const bCount = boulderDates.filter(
        (d) => getIsoWeekdayIndex(d) === idx
      ).length;

      const maxCount = Math.max(gCount, cCount, bCount);
      if (maxCount === 0) {
        return {
          weekdayIndex: idx,
          weekdayShort: shortName,
          dominantType: "rest",
          label: "Rest / Flex",
          count: 0,
        };
      }
      if (gCount === maxCount) {
        return {
          weekdayIndex: idx,
          weekdayShort: shortName,
          dominantType: "gym",
          label: "Gym-Tag",
          count: gCount,
        };
      }
      if (cCount === maxCount) {
        return {
          weekdayIndex: idx,
          weekdayShort: shortName,
          dominantType: "cardio",
          label: "Cardio-Tag",
          count: cCount,
        };
      }
      return {
        weekdayIndex: idx,
        weekdayShort: shortName,
        dominantType: "bouldering",
        label: "Boulder-Tag",
        count: bCount,
      };
    }
  );

  // 2. Check Muscle Recovery (muscles worked within the last 2 days are recovering)
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

  // 3. Determine Next Gym Template in Rotation
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

  // 6. Build Smart Recommendation
  const todayHabit = weekdayHabits[todayWeekdayIdx];
  let recommendedAction: "gym" | "cardio" | "bouldering" | "rest" = "gym";
  let headline = "";
  let subline = "";

  if (trainedToday) {
    recommendedAction = "rest";
    headline = `Stark! Du hast heute (${todayWeekdayName}) schon abgeliefert 🔥`;
    subline =
      pendingSupplementNames.length > 0
        ? `Gönn dir Regeneration — denk heute noch an: ${pendingSupplementNames.join(", ")}.`
        : "Alle Trainings & Supplements für heute erledigt. Perfekte Disziplin!";
  } else if (todayHabit && todayHabit.dominantType === "gym") {
    recommendedAction = "gym";
    const planLabel = recommendedTemplate
      ? `Dein Plan „${recommendedTemplate.name}“ steht bereit`
      : "Zeit für deine Gym-Session";
    headline = `Yo! ${todayWeekdayName} ist dein gelernter Gym-Tag 💪`;
    subline = `${planLabel} — ${recoveredMuscleLabels.join(", ")} sind zu 100 % erholt!`;
  } else if (todayHabit && todayHabit.dominantType === "cardio") {
    recommendedAction = "cardio";
    headline = `Yo! ${todayWeekdayName} ist dein typischer Cardio- & Sport-Tag 🏃`;
    subline =
      recoveringMuscleLabels.length > 0
        ? `Optimal, während ${recoveringMuscleLabels.join(", ")} vom Gym regenerieren.`
        : "Perfekter Tag für eine Lauf-, Bike- oder Padel-Runde!";
  } else if (todayHabit && todayHabit.dominantType === "bouldering") {
    recommendedAction = "bouldering";
    headline = `Yo! ${todayWeekdayName} gehst du am liebsten Bouldern 🧗`;
    subline = "Deine Finger & Unterarme sind frisch für neue Projekte!";
  } else {
    // Fallback based on last gym day distance
    const lastGymDate = gymDates[0];
    const daysSinceGym = lastGymDate ? daysBetween(lastGymDate, todayIso) : 99;

    if (daysSinceGym >= 3) {
      recommendedAction = "gym";
      headline = `Yo! Letztes Gym-Workout ist ${
        lastGymDate ? `${daysSinceGym} Tage her` : "noch offen"
      } — heute Gym? 💪`;
      subline = recommendedTemplate
        ? `Ich schlage dir heute „${recommendedTemplate.name}“ vor (${recoveredMuscleLabels.join(", ")} sind komplett frisch).`
        : "Starte dein Workout oder importiere deine Hevy-CSV, damit ich deine Pläne lerne!";
    } else {
      recommendedAction = "cardio";
      headline = `Heute steht Lockerung oder Cardio auf dem Plan ✨`;
      subline = `Deine Muskeln (${
        recoveringMuscleLabels.join(", ") || "Oberkörper"
      }) erholen sich noch — wie wär's mit einer Cardio-Session?`;
    }
  }

  const suppSuffix =
    pendingSupplementNames.length > 0
      ? ` 💊 Offene Supps heute: ${pendingSupplementNames.join(", ")}.`
      : " ✅ Alle Supplements heute schon genommen!";

  const signalMessageText = `⚡ Schym Daily Coach (${todayWeekdayName}, ${todayIso}):\n${headline}\n${subline}${suppSuffix}`;

  return {
    headline,
    subline,
    recommendedAction,
    recommendedTemplate,
    recoveredMuscleLabels,
    recoveringMuscleLabels,
    pendingSupplementNames,
    weekdayHabits,
    signalMessageText,
    trainedToday,
  };
}
