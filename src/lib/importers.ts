import type {
  NewGymEntry,
  NewCardioSession,
  NewWorkoutTemplate,
  WorkoutTemplateExercise,
} from "./db/schema";
import { inferMuscleGroupFromExercise } from "./muscles";
import { calculateEstimated1Rm } from "./metrics";
import { mapStravaSportToSchym } from "./sports-catalog";

export interface UniversalImportResult {
  gymEntries: NewGymEntry[];
  cardioSessions: NewCardioSession[];
  templates: NewWorkoutTemplate[];
}

/**
 * Splits a single CSV row respecting quoted fields.
 */
function splitCsvLine(line: string, delimiter = ","): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Converts various date formats ("2026-11-11", "11 Nov 2026, 17:30", "10.11.2026", "Nov 10, 2026")
 * into strict YYYY-MM-DD format.
 */
export function normalizeToIsoDate(raw: string): string {
  const trimmed = raw.replace(/^"|"$/g, "").trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // German DD.MM.YYYY
  const deMatch = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(trimmed);
  if (deMatch) {
    const d = (deMatch[1] ?? "01").padStart(2, "0");
    const m = (deMatch[2] ?? "01").padStart(2, "0");
    const y = deMatch[3] ?? "2026";
    return `${y}-${m}-${d}`;
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

/**
 * 1. FREE HEVY CSV IMPORTER
 * Parses Hevy's free CSV export (`Profile -> Settings -> Export Data` in the free Hevy app).
 * Automatically creates reusable Workout Templates + logs historical Gym sets + lights up the Muscle Map!
 */
export function parseHevyCsv(csvContent: string): UniversalImportResult {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { gymEntries: [], cardioSessions: [], templates: [] };
  }

  const headerLine = lines[0] ?? "";
  const delimiter =
    headerLine.includes(";") && !headerLine.includes(",") ? ";" : ",";
  const headers = splitCsvLine(headerLine, delimiter).map((h) =>
    h.replace(/^"|"$/g, "").toLowerCase().trim()
  );

  const idxTitle = headers.findIndex(
    (h) => h === "title" || h === "workout_title" || h === "name"
  );
  const idxStart = headers.findIndex(
    (h) => h === "start_time" || h === "date" || h === "session_date"
  );
  const idxExercise = headers.findIndex(
    (h) => h === "exercise_title" || h === "exercise" || h === "exercise_name"
  );
  const idxWeight = headers.findIndex(
    (h) => h === "weight_kg" || h === "weight" || h === "weight_lbs"
  );
  const idxReps = headers.findIndex((h) => h === "reps");
  const idxRpe = headers.findIndex((h) => h === "rpe");

  if (idxExercise === -1) {
    return { gymEntries: [], cardioSessions: [], templates: [] };
  }

  // Group sets by (date + workoutTitle + exerciseName)
  const groupedSets = new Map<
    string,
    {
      sessionDate: string;
      workoutFocus: string;
      exerciseName: string;
      sets: number;
      maxWeightKg: number;
      reps: number;
      rpe: number;
    }
  >();

  // Also track latest exercises per workout title to create WorkoutTemplates automatically
  const templatesMap = new Map<string, Map<string, WorkoutTemplateExercise>>();

  for (let i = 1; i < lines.length; i++) {
    const row = splitCsvLine(lines[i] ?? "", delimiter);
    const exerciseName = (row[idxExercise] ?? "").replace(/^"|"$/g, "").trim();
    if (!exerciseName) continue;

    const workoutFocus =
      (idxTitle >= 0 ? row[idxTitle] : "Hevy Workout")
        ?.replace(/^"|"$/g, "")
        .trim() || "Hevy Workout";
    const rawDate =
      (idxStart >= 0 ? row[idxStart] : "")?.replace(/^"|"$/g, "").trim() || "";
    const sessionDate = normalizeToIsoDate(rawDate);

    const weightRaw = (idxWeight >= 0 ? row[idxWeight] : "0") ?? "0";
    const repsRaw = (idxReps >= 0 ? row[idxReps] : "8") ?? "8";
    const rpeRaw = (idxRpe >= 0 ? row[idxRpe] : "8") ?? "8";

    const weightKg = Math.max(
      0,
      Math.min(600, Number(weightRaw.replace(",", ".")) || 0)
    );
    const reps = Math.max(
      1,
      Math.min(100, Math.round(Number(repsRaw.replace(",", ".")) || 8))
    );
    const rpe = Math.max(
      1,
      Math.min(10, Number(rpeRaw.replace(",", ".")) || 8)
    );

    const key = `${sessionDate}__${workoutFocus}__${exerciseName}`;
    const existing = groupedSets.get(key);
    if (!existing) {
      groupedSets.set(key, {
        sessionDate,
        workoutFocus,
        exerciseName,
        sets: 1,
        maxWeightKg: weightKg,
        reps,
        rpe,
      });
    } else {
      existing.sets += 1;
      if (weightKg >= existing.maxWeightKg) {
        existing.maxWeightKg = weightKg;
        existing.reps = reps;
      }
    }

    // Update template map
    if (!templatesMap.has(workoutFocus)) {
      templatesMap.set(workoutFocus, new Map());
    }
    const workoutExercises = templatesMap.get(workoutFocus)!;
    const prevEx = workoutExercises.get(exerciseName);
    workoutExercises.set(exerciseName, {
      name: exerciseName,
      muscleGroup: inferMuscleGroupFromExercise(exerciseName),
      targetSets: prevEx ? Math.max(prevEx.targetSets, existing ? existing.sets : 1) : 3,
      targetReps: reps,
      defaultWeightKg: weightKg,
    });
  }

  const gymEntries: NewGymEntry[] = Array.from(groupedSets.values()).map(
    (g) => ({
      sessionDate: g.sessionDate,
      workoutFocus: g.workoutFocus,
      exerciseName: g.exerciseName,
      muscleGroup: inferMuscleGroupFromExercise(g.exerciseName),
      sets: Math.min(30, g.sets),
      reps: g.reps,
      weightKg: g.maxWeightKg,
      rpe: g.rpe,
      estimated1Rm: calculateEstimated1Rm(g.maxWeightKg, g.reps),
      notes: "Hevy CSV Import",
    })
  );

  const templates: NewWorkoutTemplate[] = Array.from(
    templatesMap.entries()
  ).map(([name, exMap]) => ({
    name,
    exercises: Array.from(exMap.values()).slice(0, 25),
  }));

  return { gymEntries, cardioSessions: [], templates };
}

/**
 * 2. FREE STRAVA CSV IMPORTER (`activities.csv` from free Strava archive)
 */
export function parseStravaActivitiesCsv(
  csvContent: string
): UniversalImportResult {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { gymEntries: [], cardioSessions: [], templates: [] };
  }

  const headerLine = lines[0] ?? "";
  const headers = splitCsvLine(headerLine, ",").map((h) =>
    h.replace(/^"|"$/g, "").toLowerCase().trim()
  );

  const idxDate = headers.findIndex(
    (h) =>
      h === "activity date" ||
      h === "aktivitätsdatum" ||
      h === "start_date_local" ||
      h === "date"
  );
  const idxName = headers.findIndex(
    (h) =>
      h === "activity name" ||
      h === "name der aktivität" ||
      h === "name" ||
      h === "title"
  );
  const idxType = headers.findIndex(
    (h) =>
      h === "activity type" ||
      h === "aktivitätsart" ||
      h === "sport_type" ||
      h === "type"
  );
  const idxMovingTime = headers.findIndex(
    (h) =>
      h === "moving time" ||
      h === "bewegungszeit" ||
      h === "elapsed time" ||
      h === "verstrichene zeit" ||
      h === "duration_minutes"
  );
  const idxDistance = headers.findIndex(
    (h) => h === "distance" || h === "distanz" || h === "distance_km"
  );
  const idxHr = headers.findIndex(
    (h) =>
      h === "average heart rate" ||
      h === "durchschnittliche herzfrequenz" ||
      h === "avg_heart_rate"
  );

  if (idxType === -1 && idxName === -1) {
    return { gymEntries: [], cardioSessions: [], templates: [] };
  }

  const cardioSessions: NewCardioSession[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = splitCsvLine(lines[i] ?? ",", ",");
    if (row.length < 3) continue;

    const rawDate = idxDate >= 0 ? row[idxDate] ?? "" : "";
    const sessionDate = normalizeToIsoDate(rawDate);
    const name = (idxName >= 0 ? row[idxName] : "Strava Training") ?? "Strava Training";
    const rawType = (idxType >= 0 ? row[idxType] : "Run") ?? "Run";
    const rawTime = Number((idxMovingTime >= 0 ? row[idxMovingTime] : "0")?.replace(",", ".")) || 0;
    const rawDist = Number((idxDistance >= 0 ? row[idxDistance] : "0")?.replace(",", ".")) || 0;
    const rawHr = idxHr >= 0 ? Number(row[idxHr]?.replace(",", ".")) : null;

    // Strava CSV moving time is typically in seconds (if > 180, convert seconds -> minutes)
    const durationMinutes = Math.max(
      1,
      Math.min(1440, rawTime > 240 ? Math.round(rawTime / 60) : Math.round(rawTime || 30))
    );

    // Distance in Strava CSV can be meters (e.g. 7500) or km (e.g. 7.5)
    const distanceKm =
      rawDist > 250
        ? Math.round((rawDist / 1000) * 100) / 100
        : Math.round(rawDist * 100) / 100;

    const avgHeartRate =
      rawHr && !Number.isNaN(rawHr) && rawHr >= 35 && rawHr <= 230
        ? Math.round(rawHr)
        : null;

    cardioSessions.push({
      sessionDate,
      modality: mapStravaSportToSchym(rawType),
      durationMinutes,
      distanceKm,
      avgHeartRate,
      rpe: 7,
      notes: `${name} (Strava CSV)`.slice(0, 280),
    });
  }

  return { gymEntries: [], cardioSessions, templates: [] };
}

/**
 * 3. FREE STRAVA WEB COPY-PASTE PARSER
 * Lets the user go to `https://www.strava.com/athlete/training` ("Meine Aktivitäten"),
 * press Ctrl+A / Ctrl+C on the table, and paste the text directly!
 */
export function parseStravaWebTableText(rawText: string): UniversalImportResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const cardioSessions: NewCardioSession[] = [];

  const sportMapDeEn: Record<string, string> = {
    lauf: "Run",
    laufen: "Run",
    run: "Run",
    "trail-lauf": "TrailRun",
    radfahrt: "Cycle",
    ride: "Cycle",
    "virtuelle radfahrt": "Cycle",
    schwimmen: "Swim",
    swim: "Swim",
    wanderung: "Hike",
    wandern: "Hike",
    hike: "Hike",
    spaziergang: "Hike",
    walk: "Hike",
    gewichtstraining: "Calisthenics",
    krafttraining: "Calisthenics",
    "weight training": "Calisthenics",
    workout: "HIIT",
    training: "HIIT",
    bouldern: "Bouldering",
    klettern: "RockClimbing",
    rudern: "Row",
    yoga: "MobilityYoga",
    fußball: "Football",
    tennis: "Tennis",
    padel: "Padel",
  };

  for (const line of lines) {
    // Look for a date inside the line (e.g. "10.11.2026" or "2026-11-10" or "11/10/2026")
    const dateMatch =
      /(\d{1,2}\.\d{1,2}\.\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/.exec(
        line
      );
    if (!dateMatch) continue;

    const sessionDate = normalizeToIsoDate(dateMatch[1] ?? "");

    // Look for duration like "1:05:23" or "38:15" or "45 Min"
    let durationMinutes = 35;
    const hmsMatch = /(\d{1,2}):(\d{2}):(\d{2})/.exec(line);
    const msMatch = /\b(\d{1,3}):(\d{2})\b/.exec(line);
    const minTextMatch = /(\d{1,3})\s*(?:min|m\b)/i.exec(line);

    if (hmsMatch) {
      durationMinutes =
        Number(hmsMatch[1]) * 60 +
        Number(hmsMatch[2]) +
        Math.round(Number(hmsMatch[3]) / 60);
    } else if (msMatch) {
      durationMinutes = Number(msMatch[1]) + Math.round(Number(msMatch[2]) / 60);
    } else if (minTextMatch) {
      durationMinutes = Number(minTextMatch[1]);
    }

    // Look for distance like "7,50 km" or "12.4 km" without backtracking regex
    let distanceKm = 0;
    const kmIdx = line.toLowerCase().indexOf("km");
    if (kmIdx > 0) {
      const beforeKm = line.slice(Math.max(0, kmIdx - 12), kmIdx).trim();
      const lastToken = beforeKm.split(/\s+/).pop() ?? "0";
      const parsedDist = Number(lastToken.replace(",", "."));
      if (!Number.isNaN(parsedDist) && parsedDist > 0) {
        distanceKm = parsedDist;
      }
    }

    // Detect sport keyword
    let modality = "Run";
    const lowerLine = line.toLowerCase();
    for (const [key, mapped] of Object.entries(sportMapDeEn)) {
      if (lowerLine.includes(key)) {
        modality = mapped;
        break;
      }
    }

    // Clean title from tabs
    const cols = line.split(/\t+/).map((c) => c.trim()).filter(Boolean);
    const title = cols.length >= 3 ? cols[2] : cols[0] ?? "Strava Aktivität";

    cardioSessions.push({
      sessionDate,
      modality,
      durationMinutes: Math.max(1, Math.min(1440, durationMinutes)),
      distanceKm: Math.max(0, Math.min(1000, distanceKm)),
      avgHeartRate: null,
      rpe: 7,
      notes: `${title} (Strava Copy-Paste)`.slice(0, 280),
    });
  }

  return { gymEntries: [], cardioSessions, templates: [] };
}
