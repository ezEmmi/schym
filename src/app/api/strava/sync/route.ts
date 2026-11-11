import { NextRequest, NextResponse } from "next/server";
import {
  getAllFitnessData,
  insertCardioSession,
} from "@/lib/db";
import {
  stravaActivityItemSchema,
  stravaSyncRequestSchema,
  type StravaActivityItem,
} from "@/lib/validation/fitness";
import { mapStravaSportToSchym } from "@/lib/sports-catalog";
import { z } from "zod";

function importValidatedStravaActivities(
  activities: StravaActivityItem[]
): number {
  let importedCount = 0;

  for (const act of activities) {
    const rawSport = act.sport_type ?? act.type ?? "Run";
    const mappedSport = mapStravaSportToSchym(rawSport);
    const sessionDate = act.start_date_local.slice(0, 10);
    const durationMinutes = Math.max(1, Math.round(act.moving_time / 60));
    const distanceKm = Math.round(((act.distance ?? 0) / 1000) * 100) / 100;
    const avgHeartRate = act.average_heartrate
      ? Math.round(act.average_heartrate)
      : null;

    // Estimate RPE (1-10) from heartrate or suffer_score if available, default 7
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
      notes: `[Strava Sync] ${act.name} (${rawSport}${elevNote})`.slice(0, 280),
    });

    importedCount += 1;
  }

  return importedCount;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody: unknown = await request.json();
    const parsed = stravaSyncRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid Strava sync request",
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

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

    // Mode === "token": Fetch directly from Strava v3 API using Bearer token in memory (never persisted to disk)
    const { accessToken, perPage } = parsed.data;
    const stravaUrl = new URL("https://www.strava.com/api/v3/athlete/activities");
    stravaUrl.searchParams.set("per_page", String(perPage));

    const response = await fetch(stravaUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Strava API returned HTTP ${response.status}. Verify your Access Token has 'activity:read' or 'activity:read_all' scope.`,
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
          error: "Strava API payload did not match expected activity schema.",
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
      { ok: false, error: "Failed to sync Strava activities." },
      { status: 500 }
    );
  }
}
