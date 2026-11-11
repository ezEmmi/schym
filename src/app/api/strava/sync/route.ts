import { NextRequest, NextResponse } from "next/server";
import {
  getAllFitnessData,
  insertCardioSession,
  upsertImportedGymEntry,
  insertWorkoutTemplate,
  runInTransaction,
} from "@/lib/db";
import {
  stravaActivityItemSchema,
  stravaSyncRequestSchema,
  type StravaActivityItem,
} from "@/lib/validation/fitness";
import { mapStravaSportToSchym } from "@/lib/sports-catalog";
import { parseHevyDescriptionFromStrava } from "@/lib/muscles";
import {
  parseHevyCsv,
  parseStravaActivitiesCsv,
  parseStravaWebTableText,
  normalizeToIsoDate,
} from "@/lib/importers";
import { calculateEstimated1Rm } from "@/lib/metrics";
import { verifyRequestSecurity } from "@/lib/security";
import { z } from "zod";

function importValidatedStravaActivities(
  activities: StravaActivityItem[]
): number {
  return runInTransaction(() => {
    let importedCount = 0;

    for (const act of activities) {
      const rawSport = act.sport_type ?? act.type ?? "Run";
      const sessionDate = normalizeToIsoDate(act.start_date_local);

      const hevyExercises = act.description
        ? parseHevyDescriptionFromStrava(act.description)
        : [];

      if (
        hevyExercises.length > 0 ||
        rawSport.toLowerCase() === "weighttraining"
      ) {
        if (hevyExercises.length > 0) {
          insertWorkoutTemplate({
            name: `${act.name} (Hevy/Strava)`,
            exercises: hevyExercises,
          });

          for (const ex of hevyExercises) {
            upsertImportedGymEntry({
              sessionDate,
              workoutFocus: act.name,
              exerciseName: ex.name,
              muscleGroup: ex.muscleGroup,
              sets: ex.targetSets,
              reps: ex.targetReps,
              weightKg: ex.defaultWeightKg,
              rpe: 8,
              estimated1Rm: calculateEstimated1Rm(
                ex.defaultWeightKg,
                ex.targetReps
              ),
              notes: "Synced from Strava / Hevy",
            });
          }
          importedCount += 1;
          continue;
        }
      }

      const mappedSport = mapStravaSportToSchym(rawSport);
      const durationMinutes = Math.max(1, Math.round(act.moving_time / 60));
      const distanceKm =
        Math.round(((act.distance ?? 0) / 1000) * 100) / 100;
      const avgHeartRate = act.average_heartrate
        ? Math.round(act.average_heartrate)
        : null;

      let estimatedRpe = 7;
      if (avgHeartRate) {
        if (avgHeartRate >= 175) estimatedRpe = 9;
        else if (avgHeartRate >= 160) estimatedRpe = 8;
        else if (avgHeartRate >= 145) estimatedRpe = 7;
        else if (avgHeartRate >= 130) estimatedRpe = 6;
        else estimatedRpe = 5;
      }

      const elevNote =
        act.total_elevation_gain && act.total_elevation_gain > 0
          ? ` • +${Math.round(act.total_elevation_gain)}m elev`
          : "";

      insertCardioSession({
        sessionDate,
        modality: mappedSport,
        durationMinutes,
        distanceKm,
        avgHeartRate,
        rpe: estimatedRpe,
        notes: `${act.name} (${rawSport}${elevNote})`.slice(0, 280),
      });

      importedCount += 1;
    }

    return importedCount;
  });
}

export async function POST(request: NextRequest) {
  const sec = verifyRequestSecurity(request);
  if (!sec.allowed) {
    return NextResponse.json({ ok: false, error: sec.reason }, { status: 403 });
  }

  try {
    const rawBody: unknown = await request.json();
    const parsed = stravaSyncRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Ungültige Import-Daten",
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    // 1. 100% Free CSV / Copy-Paste Importers inside an atomic SQLite Transaction!
    if (parsed.data.mode === "free_import") {
      const { format, rawContent } = parsed.data;

      const importedCount = runInTransaction(() => {
        let count = 0;

        if (format === "hevy_csv") {
          const res = parseHevyCsv(rawContent);
          for (const tpl of res.templates) {
            insertWorkoutTemplate(tpl);
          }
          for (const entry of res.gymEntries) {
            upsertImportedGymEntry(entry);
            count += 1;
          }
        } else if (format === "strava_csv") {
          const res = parseStravaActivitiesCsv(rawContent);
          for (const c of res.cardioSessions) {
            insertCardioSession(c);
            count += 1;
          }
        } else if (format === "strava_copy_paste") {
          const res = parseStravaWebTableText(rawContent);
          for (const c of res.cardioSessions) {
            insertCardioSession(c);
            count += 1;
          }
        } else if (format === "hevy_text") {
          const exercises = parseHevyDescriptionFromStrava(rawContent);
          if (exercises.length > 0) {
            const detectedDate = normalizeToIsoDate(
              rawContent.split(/\r?\n/)[0] ?? ""
            );
            insertWorkoutTemplate({
              name: "Hevy Text-Import Plan",
              exercises,
            });
            for (const ex of exercises) {
              upsertImportedGymEntry({
                sessionDate: detectedDate,
                workoutFocus: "Hevy Share-Text",
                exerciseName: ex.name,
                muscleGroup: ex.muscleGroup,
                sets: ex.targetSets,
                reps: ex.targetReps,
                weightKg: ex.defaultWeightKg,
                rpe: 8,
                estimated1Rm: calculateEstimated1Rm(
                  ex.defaultWeightKg,
                  ex.targetReps
                ),
                notes: "Aus Hevy Share-Text importiert",
              });
              count += 1;
            }
          }
        }

        return count;
      });

      if (importedCount === 0) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Keine passenden Aktivitäten im Text/CSV erkannt. Prüfe, ob du das richtige Format ausgewählt hast.",
          },
          { status: 400 }
        );
      }

      const data = getAllFitnessData();
      return NextResponse.json(
        { ok: true, importedCount, data },
        { status: 200 }
      );
    }

    // 2. JSON Mode
    if (parsed.data.mode === "json") {
      const importedCount = importValidatedStravaActivities(
        parsed.data.activities
      );
      const data = getAllFitnessData();
      return NextResponse.json(
        { ok: true, importedCount, data },
        { status: 200 }
      );
    }

    // 3. Free Strava OAuth Code / Refresh / Token Modes
    let activeToken = "";
    const perPage = parsed.data.perPage;

    if (parsed.data.mode === "oauth_code") {
      const tokenRes = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: parsed.data.clientId,
          client_secret: parsed.data.clientSecret,
          code: parsed.data.code,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: `Strava Code-Austausch fehlgeschlagen (HTTP ${tokenRes.status}).`,
          },
          { status: 400 }
        );
      }
      const tokenJson = (await tokenRes.json()) as { access_token?: string };
      activeToken = tokenJson.access_token ?? "";
    } else if (parsed.data.mode === "refresh") {
      const tokenRes = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: parsed.data.clientId,
          client_secret: parsed.data.clientSecret,
          refresh_token: parsed.data.refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (!tokenRes.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: `Strava OAuth Refresh fehlgeschlagen (HTTP ${tokenRes.status}).`,
          },
          { status: 400 }
        );
      }

      const tokenJson = (await tokenRes.json()) as { access_token?: string };
      activeToken = tokenJson.access_token ?? "";
    } else {
      activeToken = parsed.data.accessToken;
    }

    const stravaUrl = new URL("https://www.strava.com/api/v3/athlete/activities");
    stravaUrl.searchParams.set("per_page", String(perPage));

    const response = await fetch(stravaUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${activeToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Strava API HTTP ${response.status}. Tipp: Nutze den kostenlosen CSV- oder Copy-Paste-Import!`,
        },
        { status: 400 }
      );
    }

    const rawActivities: unknown = await response.json();
    const validatedList = z
      .array(stravaActivityItemSchema)
      .safeParse(rawActivities);

    if (!validatedList.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Strava API Antwort konnte nicht validiert werden.",
        },
        { status: 400 }
      );
    }

    const importedCount = importValidatedStravaActivities(validatedList.data);
    const data = getAllFitnessData();

    return NextResponse.json(
      { ok: true, importedCount, data },
      { status: 200 }
    );
  } catch (err) {
    console.error("Strava sync failed:", err);
    return NextResponse.json(
      { ok: false, error: "Import fehlgeschlagen." },
      { status: 500 }
    );
  }
}
