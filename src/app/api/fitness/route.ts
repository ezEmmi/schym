import { NextRequest, NextResponse } from "next/server";
import {
  getAllFitnessData,
  insertGymEntry,
  insertCardioSession,
  insertBoulderingSession,
  insertWorkoutTemplate,
  insertSupplementItem,
  toggleSupplementLog,
  deleteFitnessEntry,
} from "@/lib/db";
import {
  gymEntryInputSchema,
  cardioSessionInputSchema,
  boulderingSessionInputSchema,
  workoutTemplateInputSchema,
  supplementItemInputSchema,
  supplementToggleInputSchema,
  deleteEntryInputSchema,
} from "@/lib/validation/fitness";
import { calculateEstimated1Rm } from "@/lib/metrics";
import { verifyRequestSecurity } from "@/lib/security";
import { z } from "zod";

const createPayloadSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("gym"),
    payload: gymEntryInputSchema,
  }),
  z.object({
    type: z.literal("cardio"),
    payload: cardioSessionInputSchema,
  }),
  z.object({
    type: z.literal("bouldering"),
    payload: boulderingSessionInputSchema,
  }),
  z.object({
    type: z.literal("template"),
    payload: workoutTemplateInputSchema,
  }),
  z.object({
    type: z.literal("supplement_item"),
    payload: supplementItemInputSchema,
  }),
  z.object({
    type: z.literal("supplement_toggle"),
    payload: supplementToggleInputSchema,
  }),
]);

export async function GET(request: NextRequest) {
  const sec = verifyRequestSecurity(request);
  if (!sec.allowed) {
    return NextResponse.json({ ok: false, error: sec.reason }, { status: 403 });
  }
  try {
    const data = getAllFitnessData();
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (err) {
    console.error("Failed to fetch fitness data:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to read local database." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const sec = verifyRequestSecurity(request);
  if (!sec.allowed) {
    return NextResponse.json({ ok: false, error: sec.reason }, { status: 403 });
  }
  try {
    const rawBody: unknown = await request.json();
    const parsed = createPayloadSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Validation failed",
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const { type, payload } = parsed.data;

    if (type === "gym") {
      const estimated1Rm = calculateEstimated1Rm(payload.weightKg, payload.reps);
      insertGymEntry({
        sessionDate: payload.sessionDate,
        workoutFocus: payload.workoutFocus,
        exerciseName: payload.exerciseName,
        muscleGroup: payload.muscleGroup,
        sets: payload.sets,
        reps: payload.reps,
        weightKg: payload.weightKg,
        rpe: payload.rpe,
        estimated1Rm,
        notes: payload.notes,
      });
    } else if (type === "cardio") {
      insertCardioSession({
        sessionDate: payload.sessionDate,
        modality: payload.modality,
        durationMinutes: payload.durationMinutes,
        distanceKm: payload.distanceKm,
        avgHeartRate: payload.avgHeartRate,
        rpe: payload.rpe,
        notes: payload.notes,
      });
    } else if (type === "bouldering") {
      insertBoulderingSession({
        sessionDate: payload.sessionDate,
        location: payload.location,
        grade: payload.grade,
        style: payload.style,
        wallAngle: payload.wallAngle,
        attempts: payload.attempts,
        topped: payload.topped,
        durationMinutes: payload.durationMinutes,
        skinAndFingerFeel: payload.skinAndFingerFeel,
        notes: payload.notes,
      });
    } else if (type === "template") {
      insertWorkoutTemplate({
        name: payload.name,
        exercises: payload.exercises,
      });
    } else if (type === "supplement_item") {
      insertSupplementItem({
        name: payload.name,
        dosage: payload.dosage,
        timing: payload.timing,
        color: payload.color,
      });
    } else if (type === "supplement_toggle") {
      toggleSupplementLog(payload.supplementId, payload.logDate);
    }

    const updatedData = getAllFitnessData();
    return NextResponse.json({ ok: true, data: updatedData }, { status: 201 });
  } catch (err) {
    console.error("Failed to save fitness entry:", err);
    return NextResponse.json(
      { ok: false, error: "Invalid request payload or database write failure." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const sec = verifyRequestSecurity(request);
  if (!sec.allowed) {
    return NextResponse.json({ ok: false, error: sec.reason }, { status: 403 });
  }
  try {
    const rawBody: unknown = await request.json();
    const parsed = deleteEntryInputSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid delete parameters." },
        { status: 400 }
      );
    }

    const { category, id } = parsed.data;
    deleteFitnessEntry(category, id);

    const updatedData = getAllFitnessData();
    return NextResponse.json({ ok: true, data: updatedData }, { status: 200 });
  } catch (err) {
    console.error("Failed to delete entry:", err);
    return NextResponse.json(
      { ok: false, error: "Could not delete entry." },
      { status: 400 }
    );
  }
}
