import { NextRequest, NextResponse } from "next/server";
import { signalNotifyRequestSchema } from "@/lib/validation/fitness";
import { dispatchSignalMessage } from "@/lib/signal";
import { verifyRequestSecurity } from "@/lib/security";

export async function POST(request: NextRequest) {
  const sec = verifyRequestSecurity(request);
  if (!sec.allowed) {
    return NextResponse.json({ ok: false, error: sec.reason }, { status: 403 });
  }

  try {
    const rawBody: unknown = await request.json();
    const parsed = signalNotifyRequestSchema.safeParse(rawBody);

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
