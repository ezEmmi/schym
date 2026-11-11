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
 * RFC-4180 compliant multi-line CSV state-machine parser.
 * Safely handles newlines (\n / \r\n), commas, and escaped quotes ("") inside quoted fields
 * (such as Hevy's multi-line "description" or "exercise_notes" columns).
 */
export function parseCsvTable(
  csvContent: string,
  delimiter = ","
): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  const clean = csvContent.replace(/^\uFEFF/, ""); // Strip UTF-8 BOM if present

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const nextCh = clean[i + 1];

    if (ch === '"') {
      if (inQuotes && nextCh === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && nextCh === "\n") {
        i++;
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
    } else {
      currentCell += ch;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

const MONTH_NAME_MAP: Record<string, string> = {
  jan: "01",
  januar: "01",
  january: "01",
  feb: "02",
  februar: "02",
  february: "02",
  mär: "03",
  maerz: "03",
  märz: "03",
  mrz: "03",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  mai: "05",
  may: "05",
  jun: "06",
  juni: "06",
  june: "06",
  jul: "07",
  juli: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  okt: "10",
  oktober: "10",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dez: "12",
  dezember: "12",
  dec: "12",
  december: "12",
};

/**
 * Converts German and English date formats from Hevy & Strava into strict YYYY-MM-DD
 * without any UTC timezone off-by-one shift:
 * - "2025-10-14 17:30:00" -> "2025-10-14"
 * - "14. Okt. 2025, 17:34" / "15 Mai 2025, 18:00" -> "2025-10-14" / "2025-05-15"
 * - "Oct 14, 2025, 5:34 PM" -> "2025-10-14"
 * - "14.10.2025" / "14.10.25" -> "2025-10-14"
 */
export function normalizeToIsoDate(raw: string): string {
  const trimmed = raw.replace(/^"|"$/g, "").trim();
  if (!trimmed) {
    return new Date().toISOString().slice(0, 10);
  }

  // 1. ISO YYYY-MM-DD (or YYYY/MM/DD)
  const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(trimmed);
  if (isoMatch) {
    const y = isoMatch[1]!;
    const m = isoMatch[2]!.padStart(2, "0");
    const d = isoMatch[3]!.padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // 2. German DD.MM.YYYY or DD.MM.YY
  const deNumericMatch = /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/.exec(trimmed);
  if (deNumericMatch) {
    const d = deNumericMatch[1]!.padStart(2, "0");
    const m = deNumericMatch[2]!.padStart(2, "0");
    let y = deNumericMatch[3]!;
    if (y.length === 2) {
      y = `20${y}`;
    }
    return `${y}-${m}-${d}`;
  }

  // 3. Day + MonthName + Year (e.g. "14. Okt. 2025, 17:30", "15 Mai 2025 18:00", "10 Nov 2025")
  const dmyWordsMatch =
    /(\d{1,2})\.?\s+([A-Za-zÄÖÜäöüß]+)\.?\s+(\d{4})/.exec(trimmed);
  if (dmyWordsMatch) {
    const d = dmyWordsMatch[1]!.padStart(2, "0");
    const monthKey = dmyWordsMatch[2]!.toLowerCase();
    const y = dmyWordsMatch[3]!;
    const m =
      MONTH_NAME_MAP[monthKey] ?? MONTH_NAME_MAP[monthKey.slice(0, 3)];
    if (m) {
      return `${y}-${m}-${d}`;
    }
  }

  // 4. MonthName + Day + Year (e.g. "Oct 14, 2025, 5:34 PM", "May 15 2025")
  const mdyWordsMatch =
    /([A-Za-zÄÖÜäöüß]+)\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(trimmed);
  if (mdyWordsMatch) {
    const monthKey = mdyWordsMatch[1]!.toLowerCase();
    const d = mdyWordsMatch[2]!.padStart(2, "0");
    const y = mdyWordsMatch[3]!;
    const m =
      MONTH_NAME_MAP[monthKey] ?? MONTH_NAME_MAP[monthKey.slice(0, 3)];
    if (m) {
      return `${y}-${m}-${d}`;
    }
  }

  // 5. Fallback Date.parse using local year/month/day (avoids UTC -1 day shift!)
  const parsedMs = Date.parse(trimmed);
  if (!Number.isNaN(parsedMs)) {
    const dt = new Date(parsedMs);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return new Date().toISOString().slice(0, 10);
}

/**
 * 1. FREE HEVY CSV IMPORTER ("Hevy-Brain-Cloning")
 * Parses Hevy's free CSV export (`Profile -> Settings -> Export Data` in the free Hevy app).
 * Automatically creates reusable Workout Templates + logs historical Gym sets + lights up the Muscle Map!
 */
export function parseHevyCsv(csvContent: string): UniversalImportResult {
  const firstNewline = csvContent.indexOf("\n");
  const firstLine =
    firstNewline >= 0 ? csvContent.slice(0, firstNewline) : csvContent;
  const delimiter =
    firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";

  const rows = parseCsvTable(csvContent, delimiter);
  if (rows.length < 2) {
    return { gymEntries: [], cardioSessions: [], templates: [] };
  }

  const headers = (rows[0] ?? []).map((h) =>
    h.replace(/^"|"$/g, "").toLowerCase().trim()
  );

  const idxTitle = headers.findIndex(
    (h) =>
      h === "title" ||
      h === "workout_title" ||
      h === "name" ||
      h === "workout"
  );
  const idxStart = headers.findIndex(
    (h) =>
      h === "start_time" ||
      h === "date" ||
      h === "session_date" ||
      h === "datum" ||
      h === "startzeit"
  );
  const idxExercise = headers.findIndex(
    (h) =>
      h === "exercise_title" ||
      h === "exercise" ||
      h === "exercise_name" ||
      h === "übung"
  );
  const idxWeight = headers.findIndex(
    (h) =>
      h === "weight_kg" ||
      h === "weight" ||
      h === "weight_lbs" ||
      h === "gewicht_kg" ||
      h === "gewicht"
  );
  const idxReps = headers.findIndex(
    (h) => h === "reps" || h === "wiederholungen"
  );
  const idxRpe = headers.findIndex((h) => h === "rpe");
  const idxNotes = headers.findIndex(
    (h) => h === "exercise_notes" || h === "notes" || h === "description"
  );
  const idxSetType = headers.findIndex((h) => h === "set_type");

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
      notes: string;
    }
  >();

  // Track latest exercises per workout title (sorted chronologically so latest working weights win!)
  const templatesMap = new Map<
    string,
    Map<
      string,
      WorkoutTemplateExercise & { latestDate: string }
    >
  >();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const exerciseName = (row[idxExercise] ?? "").replace(/^"|"$/g, "").trim();
    if (!exerciseName) continue;

    const setType =
      (idxSetType >= 0 ? row[idxSetType] : "normal")
        ?.replace(/^"|"$/g, "")
        .toLowerCase()
        .trim() || "normal";

    // Skip pure warmup sets when counting working sets
    if (setType === "warmup") {
      continue;
    }

    const workoutFocus =
      (idxTitle >= 0 ? row[idxTitle] : "Hevy Workout")
        ?.replace(/^"|"$/g, "")
        .trim() || "Hevy Workout";
    const rawDate =
      (idxStart >= 0 ? row[idxStart] : "")?.replace(/^"|"$/g, "").trim() || "";
    const sessionDate = normalizeToIsoDate(rawDate);

    const exerciseNote =
      (idxNotes >= 0 ? row[idxNotes] : "")?.replace(/^"|"$/g, "").trim() || "";

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
    let currentSetCount = 1;

    if (!existing) {
      groupedSets.set(key, {
        sessionDate,
        workoutFocus,
        exerciseName,
        sets: 1,
        maxWeightKg: weightKg,
        reps,
        rpe,
        notes: exerciseNote,
      });
    } else {
      existing.sets += 1;
      currentSetCount = existing.sets;
      if (exerciseNote && !existing.notes) {
        existing.notes = exerciseNote;
      }
      if (weightKg > existing.maxWeightKg) {
        existing.maxWeightKg = weightKg;
        existing.reps = reps;
      } else if (weightKg === existing.maxWeightKg && reps > existing.reps) {
        existing.reps = reps;
      }
    }

    if (!templatesMap.has(workoutFocus)) {
      templatesMap.set(workoutFocus, new Map());
    }
    const workoutExercises = templatesMap.get(workoutFocus)!;
    const prevEx = workoutExercises.get(exerciseName);
    const groupEntry = groupedSets.get(key)!;

    // Always prefer the most recent session's weight & best working reps for the reusable template
    if (!prevEx || sessionDate >= prevEx.latestDate) {
      workoutExercises.set(exerciseName, {
        name: exerciseName,
        muscleGroup: inferMuscleGroupFromExercise(exerciseName),
        targetSets: prevEx
          ? Math.max(prevEx.targetSets, currentSetCount)
          : Math.max(3, currentSetCount),
        targetReps: groupEntry.reps,
        defaultWeightKg: groupEntry.maxWeightKg,
        latestDate: sessionDate,
      });
    }
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
      notes: g.notes || "Hevy Import",
    })
  );

  const templates: NewWorkoutTemplate[] = Array.from(
    templatesMap.entries()
  ).map(([name, exMap]) => ({
    name,
    exercises: Array.from(exMap.values())
      .slice(0, 25)
      .map(({ latestDate: _unused, ...rest }) => rest),
  }));

  return { gymEntries, cardioSessions: [], templates };
}

/**
 * 2. FREE STRAVA CSV IMPORTER (`activities.csv` from free Strava archive)
 */
export function parseStravaActivitiesCsv(
  csvContent: string
): UniversalImportResult {
  const rows = parseCsvTable(csvContent, ",");
  if (rows.length < 2) {
    return { gymEntries: [], cardioSessions: [], templates: [] };
  }

  const headers = (rows[0] ?? []).map((h) =>
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

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;

    const rawDate = idxDate >= 0 ? row[idxDate] ?? "" : "";
    const sessionDate = normalizeToIsoDate(rawDate);
    const name =
      (idxName >= 0 ? row[idxName] : "Strava Training") ?? "Strava Training";
    const rawType = (idxType >= 0 ? row[idxType] : "Run") ?? "Run";
    const rawTime =
      Number(
        (idxMovingTime >= 0 ? row[idxMovingTime] : "0")?.replace(",", ".")
      ) || 0;
    const rawDist =
      Number((idxDistance >= 0 ? row[idxDistance] : "0")?.replace(",", ".")) ||
      0;
    const rawHr = idxHr >= 0 ? Number(row[idxHr]?.replace(",", ".")) : null;

    const durationMinutes = Math.max(
      1,
      Math.min(
        1440,
        rawTime > 240 ? Math.round(rawTime / 60) : Math.round(rawTime || 30)
      )
    );

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
    const dateMatch =
      /(\d{1,2}\.\d{1,2}\.\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\.?\s+[A-Za-zÄÖÜäöüß]+\.?\s+\d{4})/.exec(
        line
      );
    if (!dateMatch) continue;

    const sessionDate = normalizeToIsoDate(dateMatch[1] ?? "");

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
      durationMinutes =
        Number(msMatch[1]) + Math.round(Number(msMatch[2]) / 60);
    } else if (minTextMatch) {
      durationMinutes = Number(minTextMatch[1]);
    }

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

    let modality = "Run";
    const lowerLine = line.toLowerCase();
    for (const [key, mapped] of Object.entries(sportMapDeEn)) {
      if (lowerLine.includes(key)) {
        modality = mapped;
        break;
      }
    }

    const cols = line
      .split(/\t+/)
      .map((c) => c.trim())
      .filter(Boolean);
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
