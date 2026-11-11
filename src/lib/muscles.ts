import type { MuscleGroup, GymEntry, WorkoutTemplateExercise } from "./db/schema";

export const MUSCLE_GROUPS: readonly {
  id: MuscleGroup;
  label: string;
  pastelColor: string;
}[] = [
  { id: "chest", label: "Brust (Chest)", pastelColor: "#f9a8d4" },
  { id: "back", label: "Rücken / Lat (Back)", pastelColor: "#93c5fd" },
  { id: "shoulders", label: "Schultern (Shoulders)", pastelColor: "#c4b5fd" },
  { id: "biceps", label: "Bizeps", pastelColor: "#6ee7b7" },
  { id: "triceps", label: "Trizeps", pastelColor: "#fcd34d" },
  { id: "core", label: "Bauch / Core", pastelColor: "#fda4af" },
  { id: "quads", label: "Quads / Vorderseite Beine", pastelColor: "#a7f3d0" },
  { id: "hamstrings", label: "Beinbeuger (Hamstrings)", pastelColor: "#fde68a" },
  { id: "glutes", label: "Glutes / Po", pastelColor: "#f5d0fe" },
  { id: "calves", label: "Waden (Calves)", pastelColor: "#bae6fd" },
] as const;

export const MUSCLE_GROUP_IDS = MUSCLE_GROUPS.map((m) => m.id) as [
  MuscleGroup,
  ...MuscleGroup[],
];

/**
 * Infers the primary muscle group from an exercise name (English or German, e.g. from Hevy/Strava)
 */
export function inferMuscleGroupFromExercise(name: string): MuscleGroup {
  const lower = name.toLowerCase();
  // Check "reverse fliegende" / "reverse fly" / "rear delt" BEFORE generic "fliegende"/"fly"
  if (
    lower.includes("reverse flieg") ||
    lower.includes("reverse fly") ||
    lower.includes("rear delt") ||
    lower.includes("shoulder") ||
    lower.includes("schulter") ||
    lower.includes("lateral") ||
    lower.includes("seitheben") ||
    lower.includes("overhead") ||
    lower.includes("military") ||
    lower.includes("face pull")
  ) {
    return "shoulders";
  }
  if (
    lower.includes("bench") ||
    lower.includes("brust") ||
    lower.includes("chest") ||
    lower.includes("fliegende") ||
    lower.includes("fly") ||
    lower.includes("butterfly") ||
    lower.includes("incline press") ||
    lower.includes("push up") ||
    lower.includes("push-up")
  ) {
    return "chest";
  }
  if (
    lower.includes("pull") ||
    lower.includes("lat") ||
    lower.includes("row") ||
    lower.includes("ruder") ||
    lower.includes("klimm") ||
    lower.includes("hyperextension") ||
    lower.includes("rücken") ||
    lower.includes("back") ||
    lower.includes("chin") ||
    lower.includes("deadlift")
  ) {
    return "back";
  }
  if (
    lower.includes("bicep") ||
    lower.includes("bizeps") ||
    lower.includes("curl")
  ) {
    return "biceps";
  }
  if (
    lower.includes("tricep") ||
    lower.includes("trizeps") ||
    lower.includes("pushdown") ||
    lower.includes("skull") ||
    lower.includes("dip")
  ) {
    return "triceps";
  }
  if (
    lower.includes("crunch") ||
    lower.includes("plank") ||
    lower.includes("side bend") ||
    lower.includes("heel tap") ||
    lower.includes("knieheben") ||
    lower.includes("leg raise") ||
    lower.includes("sit-up") ||
    lower.includes("situp") ||
    lower.includes("ab ") ||
    lower.includes("abs") ||
    lower.includes("bauch") ||
    lower.includes("core")
  ) {
    return "core";
  }
  if (
    lower.includes("hamstring") ||
    lower.includes("leg curl") ||
    lower.includes("beinbeuger") ||
    lower.includes("rdl") ||
    lower.includes("romanian")
  ) {
    return "hamstrings";
  }
  if (
    lower.includes("glute") ||
    lower.includes("hip thrust") ||
    lower.includes("abductor")
  ) {
    return "glutes";
  }
  if (lower.includes("calf") || lower.includes("wade")) {
    return "calves";
  }
  if (
    lower.includes("squat") ||
    lower.includes("kniebeuge") ||
    lower.includes("leg press") ||
    lower.includes("beinpresse") ||
    lower.includes("leg extension") ||
    lower.includes("beinstrecker") ||
    lower.includes("lunge")
  ) {
    return "quads";
  }
  return "chest";
}

export interface OverloadSuggestion {
  lastWeightKg: number | null;
  lastReps: number | null;
  lastRpe: number | null;
  suggestedWeightKg: number;
  suggestedReps: number;
  reason: string;
  shouldIncrease: boolean;
}

/**
 * Progressive Overload Coach:
 * Inspects the latest logged entry for a machine/exercise and suggests weight increase (+2.5kg)
 * when the user hit their target reps at RPE <= 8.5.
 */
export function computeOverloadSuggestion(
  exerciseName: string,
  targetReps: number,
  defaultWeightKg: number,
  history: GymEntry[]
): OverloadSuggestion {
  const norm = exerciseName.trim().toLowerCase();
  const previous = history.find(
    (h) => h.exerciseName.trim().toLowerCase() === norm
  );

  if (!previous) {
    return {
      lastWeightKg: null,
      lastReps: null,
      lastRpe: null,
      suggestedWeightKg: defaultWeightKg,
      suggestedReps: targetReps,
      reason: "Erstes Mal geloggt — starte mit deinem Basisgewicht",
      shouldIncrease: false,
    };
  }

  if (previous.reps >= targetReps && previous.rpe <= 8.5) {
    const nextWeight = Math.round((previous.weightKg + 2.5) * 10) / 10;
    return {
      lastWeightKg: previous.weightKg,
      lastReps: previous.reps,
      lastRpe: previous.rpe,
      suggestedWeightKg: nextWeight,
      suggestedReps: targetReps,
      reason: `Letztes Mal ${previous.weightKg}kg × ${previous.reps} (RPE ${previous.rpe}) sauber geschafft → +2.5 kg erhöhen!`,
      shouldIncrease: true,
    };
  }

  return {
    lastWeightKg: previous.weightKg,
    lastReps: previous.reps,
    lastRpe: previous.rpe,
    suggestedWeightKg: previous.weightKg,
    suggestedReps: Math.max(targetReps, previous.reps),
    reason: `Letztes Mal ${previous.weightKg}kg × ${previous.reps} (RPE ${previous.rpe}) → Gewicht bestätigen & Reps voll machen`,
    shouldIncrease: false,
  };
}

/**
 * Parses a Hevy workout description (often attached to Strava `description` field)
 * Example Hevy format in Strava:
 * "Bench Press (Barbell)\nSet 1: 80 kg x 8\nSet 2: 80 kg x 8\n\nLat Pulldown (Cable)\nSet 1: 65 kg x 10"
 */
export function parseHevyDescriptionFromStrava(
  description: string
): WorkoutTemplateExercise[] {
  if (!description || !description.trim()) return [];
  const lines = description
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const exercises: WorkoutTemplateExercise[] = [];
  let currentExercise: {
    name: string;
    sets: number;
    maxWeight: number;
    reps: number;
  } | null = null;

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    const lowerLine = line.toLowerCase();
    const isSetLine =
      colonIdx > 0 &&
      (lowerLine.startsWith("set ") || lowerLine.startsWith("satz "));

    if (isSetLine && currentExercise) {
      const afterColon = line
        .slice(colonIdx + 1)
        .replace(/kg|lbs/gi, "")
        .trim();
      const parts = afterColon.split(/[x×]/i).map((p) => p.trim());
      const weight = Number((parts[0] ?? "0").replace(",", "."));
      const reps = Number(parts[1] ?? "8");
      if (!Number.isNaN(weight) && !Number.isNaN(reps)) {
        currentExercise.sets += 1;
        if (weight > currentExercise.maxWeight) {
          currentExercise.maxWeight = weight;
        }
        if (reps > 0) {
          currentExercise.reps = reps;
        }
      }
    } else if (
      !line.toLowerCase().startsWith("logged with hevy") &&
      !line.toLowerCase().startsWith("workout") &&
      !line.startsWith("http") &&
      line.length >= 3 &&
      line.length <= 75
    ) {
      if (currentExercise && currentExercise.sets > 0) {
        exercises.push({
          name: currentExercise.name,
          muscleGroup: inferMuscleGroupFromExercise(currentExercise.name),
          targetSets: currentExercise.sets,
          targetReps: currentExercise.reps,
          defaultWeightKg: currentExercise.maxWeight,
        });
      }
      currentExercise = {
        name: line,
        sets: 0,
        maxWeight: 0,
        reps: 8,
      };
    }
  }

  if (currentExercise && currentExercise.sets > 0) {
    exercises.push({
      name: currentExercise.name,
      muscleGroup: inferMuscleGroupFromExercise(currentExercise.name),
      targetSets: currentExercise.sets,
      targetReps: currentExercise.reps,
      defaultWeightKg: currentExercise.maxWeight,
    });
  }

  return exercises;
}
