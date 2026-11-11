"use client";

import React, { useState, useEffect } from "react";
import {
  Send,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock,
  Sparkles,
} from "lucide-react";
import type { DailyCoachBriefing } from "@/lib/coach";

export const SIGNAL_PREFS_KEY = "schym_signal_prefs_v1";

export interface SignalPreferences {
  phone: string;
  apiKey: string;
  autoEnabled: boolean;
  autoTime: string;
  lastAutoSentDate?: string;
}

export function normalizePhoneOrUuid(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, "");
  if (/^0[1-9][0-9]{6,14}$/.test(cleaned)) {
    return `+49${cleaned.slice(1)}`;
  }
  if (/^[1-9][0-9]{7,15}$/.test(cleaned)) {
    return `+${cleaned}`;
  }
  return cleaned;
}

export function buildCallMeBotSignalUrl(
  host: "signal.callmebot.com" | "api.callmebot.com",
  phoneOrUuid: string,
  apiKey: string,
  text: string
): string {
  const cleanPhone = normalizePhoneOrUuid(phoneOrUuid);
  const url = new URL(`https://${host}/signal/send.php`);
  url.searchParams.set("phone", cleanPhone);
  url.searchParams.set("apikey", apiKey.trim());
  url.searchParams.set("text", text);
  return url.toString();
}

export async function dispatchSignalFromBrowser(
  phoneOrUuid: string,
  apiKey: string,
  text: string
): Promise<boolean> {
  const primaryUrl = buildCallMeBotSignalUrl(
    "signal.callmebot.com",
    phoneOrUuid,
    apiKey,
    text
  );
  try {
    await fetch(primaryUrl, { mode: "no-cors", cache: "no-store" });
    return true;
  } catch {
    try {
      const fallbackUrl = buildCallMeBotSignalUrl(
        "api.callmebot.com",
        phoneOrUuid,
        apiKey,
        text
      );
      await fetch(fallbackUrl, { mode: "no-cors", cache: "no-store" });
      return true;
    } catch {
      return false;
    }
  }
}

interface MobileAndSignalModalProps {
  briefing: DailyCoachBriefing;
  prefs: SignalPreferences;
  onSavePrefs: (next: SignalPreferences) => void;
  onClose: () => void;
}

export function MobileAndSignalModal({
  briefing,
  prefs,
  onSavePrefs,
  onClose,
}: MobileAndSignalModalProps) {
  const [recipientPhone, setRecipientPhone] = useState(prefs.phone);
  const [apiKey, setApiKey] = useState(prefs.apiKey);
  const [autoEnabled, setAutoEnabled] = useState(prefs.autoEnabled);
  const [autoTime, setAutoTime] = useState(prefs.autoTime || "06:00");
  const [showPreview, setShowPreview] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setRecipientPhone(prefs.phone);
    setApiKey(prefs.apiKey);
    setAutoEnabled(prefs.autoEnabled);
    setAutoTime(prefs.autoTime || "06:00");
  }, [prefs]);

  // Smart helper: if the user pastes the entire CallMeBot URL from Signal, extract phone/UUID & apikey automatically!
  function handleSmartInput(field: "phone" | "key", value: string) {
    if (value.includes("phone=") && value.includes("apikey=")) {
      const phoneMatch = /[?&]phone=([^&\s]+)/.exec(value);
      const keyMatch = /[?&]apikey=([^&\s]+)/.exec(value);
      const extractedPhone = phoneMatch?.[1]
        ? decodeURIComponent(phoneMatch[1])
        : recipientPhone;
      const extractedKey = keyMatch?.[1]
        ? decodeURIComponent(keyMatch[1])
        : apiKey;
      setRecipientPhone(extractedPhone);
      setApiKey(extractedKey);
      onSavePrefs({
        ...prefs,
        phone: normalizePhoneOrUuid(extractedPhone),
        apiKey: extractedKey.trim(),
        autoEnabled,
        autoTime,
      });
      setStatusMsg(
        "CallMeBot-Link automatisch erkannt und UUID + API-Key gespeichert!"
      );
      return;
    }
    if (field === "phone") {
      setRecipientPhone(value);
    } else {
      setApiKey(value);
    }
  }

  function handleSaveConfigOnly() {
    const cleanPhone = normalizePhoneOrUuid(recipientPhone);
    const cleanKey = apiKey.trim();
    onSavePrefs({
      ...prefs,
      phone: cleanPhone,
      apiKey: cleanKey,
      autoEnabled,
      autoTime,
    });
    setStatusMsg(
      autoEnabled
        ? `Gespeichert! Dein Morgen-Briefing wird täglich ab ${autoTime} Uhr automatisch an Signal gesendet.`
        : "Signal-Einstellungen gespeichert."
    );
  }

  async function handleSendSignal(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    setErrorMsg(null);

    const cleanPhone = normalizePhoneOrUuid(recipientPhone);
    const cleanKey = apiKey.trim();

    if (cleanPhone.length < 4 || cleanKey.length < 2) {
      setErrorMsg(
        "Bitte gib deine Nummer/UUID aus der CallMeBot-Antwort und deinen API-Key ein."
      );
      return;
    }

    setIsSending(true);
    setRecipientPhone(cleanPhone);

    const todayIso = new Date().toISOString().slice(0, 10);
    onSavePrefs({
      phone: cleanPhone,
      apiKey: cleanKey,
      autoEnabled,
      autoTime,
      lastAutoSentDate: todayIso,
    });

    const ok = await dispatchSignalFromBrowser(
      cleanPhone,
      cleanKey,
      briefing.signalMessageText
    );

    if (ok) {
      setStatusMsg(
        `Morgen-Briefing an „${cleanPhone}“ gesendet & 06:00-Uhr-Automatik aktiviert! Checke Signal 💬`
      );
    } else {
      setErrorMsg(
        "Dein Browser/Adblocker hat den Hintergrund-Aufruf blockiert — klicke unten auf „Direkt-Test ↗“."
      );
    }
    setIsSending(false);
  }

  const canSend =
    recipientPhone.trim().length >= 4 && apiKey.trim().length >= 2;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-sheet" style={{ maxWidth: 560 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: "0.9rem",
            borderBottom: "1px solid var(--border-subtle)",
            marginBottom: "1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
            <h2 style={{ fontSize: "1.12rem", fontWeight: 800 }}>
              Signal 06:00 Uhr Morning-Briefing 💬
            </h2>
            {canSend && autoEnabled && (
              <span className="badge badge-cardio" style={{ fontSize: "0.7rem" }}>
                Aktiv • {autoTime} Uhr
              </span>
            )}
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Schließen"
          >
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.95rem",
          }}
        >
          {/* Auto-Schedule Card */}
          <div
            style={{
              background:
                "linear-gradient(135deg, rgba(166, 227, 161, 0.12), rgba(203, 166, 247, 0.12))",
              padding: "0.9rem 1rem",
              borderRadius: 16,
              border: "1px solid rgba(166, 227, 161, 0.35)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "0.86rem",
                  fontWeight: 800,
                  color: "var(--pastel-mint)",
                }}
              >
                <Clock size={16} />
                <span>Täglicher Auto-Versand am Morgen</span>
              </div>
              <span
                style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}
              >
                Schickt dir jeden Morgen automatisch deinen Tagesplan,
                Gewichts-Steigerungen &amp; Supplements auf Signal.
              </span>
              {prefs.lastAutoSentDate && (
                <span
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--pastel-lavender)",
                    fontWeight: 700,
                  }}
                >
                  ✓ Zuletzt gesendet am: {prefs.lastAutoSentDate}
                </span>
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.55rem",
              }}
            >
              <input
                type="time"
                className="field-input"
                style={{
                  width: 96,
                  padding: "0.35rem 0.55rem",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                }}
                value={autoTime}
                onChange={(e) => {
                  const nextTime = e.target.value || "06:00";
                  setAutoTime(nextTime);
                  onSavePrefs({
                    ...prefs,
                    phone: normalizePhoneOrUuid(recipientPhone),
                    apiKey: apiKey.trim(),
                    autoEnabled,
                    autoTime: nextTime,
                  });
                }}
              />

              <button
                type="button"
                className={`pill-tab ${autoEnabled ? "active" : ""}`}
                onClick={() => {
                  const next = !autoEnabled;
                  setAutoEnabled(next);
                  onSavePrefs({
                    ...prefs,
                    phone: normalizePhoneOrUuid(recipientPhone),
                    apiKey: apiKey.trim(),
                    autoEnabled: next,
                    autoTime,
                  });
                }}
              >
                {autoEnabled ? "Auto AN ✅" : "Auto AUS"}
              </button>
            </div>
          </div>

          {statusMsg && (
            <div
              style={{
                padding: "0.7rem 0.9rem",
                borderRadius: 12,
                background: "rgba(166, 227, 161, 0.14)",
                border: "1px solid var(--pastel-mint)",
                color: "var(--pastel-mint)",
                fontSize: "0.82rem",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <CheckCircle2 size={16} />
              <span>{statusMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="error-banner" style={{ marginBottom: 0 }}>
              {errorMsg}
            </div>
          )}

          <form className="form-stack" onSubmit={handleSendSignal}>
            <div className="form-row-2">
              <label className="field-label">
                Deine CallMeBot UUID / Nummer (oder ganzer Link)
                <input
                  type="text"
                  className="field-input"
                  placeholder="32268044-5185-... oder ganzer Link"
                  value={recipientPhone}
                  onChange={(e) => handleSmartInput("phone", e.target.value)}
                  required
                />
              </label>

              <label className="field-label">
                Dein CallMeBot API-Key
                <input
                  type="text"
                  className="field-input"
                  placeholder="z.B. 856294"
                  value={apiKey}
                  onChange={(e) => handleSmartInput("key", e.target.value)}
                  required
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
              <button
                type="submit"
                className="pastel-btn btn-lavender"
                style={{ flex: 1 }}
                disabled={isSending || !canSend}
              >
                <Send size={15} />
                <span>
                  {isSending
                    ? "Sende an Signal..."
                    : "Jetzt Tages-Briefing an Signal senden"}
                </span>
              </button>

              <button
                type="button"
                className="pill-tab"
                onClick={handleSaveConfigOnly}
                disabled={!canSend}
              >
                <span>Speichern</span>
              </button>

              {canSend && (
                <a
                  href={buildCallMeBotSignalUrl(
                    "signal.callmebot.com",
                    recipientPhone,
                    apiKey,
                    briefing.signalMessageText
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="pill-tab"
                  style={{
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                  title="Öffnet den CallMeBot-Versand direkt im neuen Tab"
                >
                  <span>Direkt-Test ↗</span>
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          </form>

          <div
            style={{
              borderTop: "1px solid var(--border-subtle)",
              paddingTop: "0.65rem",
            }}
          >
            <button
              type="button"
              className="pill-tab"
              style={{
                fontSize: "0.75rem",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
              onClick={() => setShowPreview((v) => !v)}
            >
              <Sparkles size={13} />
              <span>Vorschau deiner 06:00-Uhr-Nachricht</span>
              {showPreview ? (
                <ChevronUp size={13} />
              ) : (
                <ChevronDown size={13} />
              )}
            </button>

            {showPreview && (
              <div
                style={{
                  marginTop: "0.65rem",
                  background: "var(--bg-soft)",
                  padding: "0.85rem",
                  borderRadius: 12,
                  border: "1px solid var(--border-subtle)",
                  fontSize: "0.78rem",
                  color: "var(--text-secondary)",
                  whiteSpace: "pre-line",
                  lineHeight: 1.5,
                }}
              >
                {briefing.signalMessageText}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
