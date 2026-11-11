import { NextRequest, NextResponse } from "next/server";
import { signalNotifyRequestSchema } from "@/lib/validation/fitness";
import { dispatchSignalMessage } from "@/lib/signal";
import { verifyRequestSecurity } from "@/lib/security";

export async function GET() {
  const uuid = process.env.SCHYM_SIGNAL_UUID ?? "";
  const apiKey = process.env.SCHYM_SIGNAL_APIKEY ?? "";
  const autoTime = process.env.SCHYM_SIGNAL_AUTO_TIME ?? "06:00";

  return NextResponse.json(
    {
      ok: true,
      configured: Boolean(uuid && apiKey),
      recipientPhone: uuid,
      apiKey,
      autoTime,
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  const sec = verifyRequestSecurity(request);
  if (!sec.allowed) {
    return NextResponse.json({ ok: false, error: sec.reason }, { status: 403 });
  }

  try {
    const rawBody = (await request.json()) as Record<string, unknown>;
    const mergedBody = {
      ...rawBody,
      recipientPhone:
        (typeof rawBody.recipientPhone === "string" &&
        rawBody.recipientPhone.trim()
          ? rawBody.recipientPhone
          : process.env.SCHYM_SIGNAL_UUID) ?? "",
      apiKey:
        (typeof rawBody.apiKey === "string" && rawBody.apiKey.trim()
          ? rawBody.apiKey
          : process.env.SCHYM_SIGNAL_APIKEY) ?? "",
    };

    const parsed = signalNotifyRequestSchema.safeParse(mergedBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error:
            parsed.error.issues.map((i) => i.message).join(", ") ||
            "Ungültige Signal-Konfiguration.",
        },
        { status: 400 }
      );
    }

    const result = await dispatchSignalMessage(parsed.data);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "Signal-Versand fehlgeschlagen." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("Signal dispatch failed:", err);
    return NextResponse.json(
      { ok: false, error: "Signal-Server nicht erreichbar." },
      { status: 500 }
    );
  }
}
