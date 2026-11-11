"use client";

import React, { useState, useEffect } from "react";
import {
  Send,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import type { DailyCoachBriefing } from "@/lib/coach";

interface MobileAndSignalModalProps {
  briefing: DailyCoachBriefing;
  onClose: () => void;
}

const SIGNAL_PREFS_KEY = "schym_signal_prefs_v1";

function normalizePhoneOrUuid(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, "");
  if (/^0[1-9][0-9]{6,14}$/.test(cleaned)) {
    return `+49${cleaned.slice(1)}`;
  }
  if (/^[1-9][0-9]{7,15}$/.test(cleaned)) {
    return `+${cleaned}`;
  }
  return cleaned;
}

export function MobileAndSignalModal({
  briefing,
  onClose,
}: MobileAndSignalModalProps) {
  const [recipientPhone, setRecipientPhone] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SIGNAL_PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          phone?: string;
          apiKey?: string;
        };
        if (parsed.phone) setRecipientPhone(parsed.phone);
        if (parsed.apiKey) setApiKey(parsed.apiKey);
      }
    } catch {
      // ignore storage read error
    }
  }, []);

  // Smart helper: if the user pastes the entire CallMeBot URL from Signal, extract phone/UUID & apikey automatically!
  function handleSmartInput(field: "phone" | "key", value: string) {
    if (value.includes("phone=") && value.includes("apikey=")) {
      const phoneMatch = /[?&]phone=([^&\s]+)/.exec(value);
      const keyMatch = /[?&]apikey=([^&\s]+)/.exec(value);
      if (phoneMatch?.[1]) {
        setRecipientPhone(decodeURIComponent(phoneMatch[1]));
      }
      if (keyMatch?.[1]) {
        setApiKey(decodeURIComponent(keyMatch[1]));
      }
      return;
    }
    if (field === "phone") {
      setRecipientPhone(value);
    } else {
      setApiKey(value);
    }
  }

  function buildCallMeBotUrl(host: "signal.callmebot.com" | "api.callmebot.com"): string {
    const cleanPhone = normalizePhoneOrUuid(recipientPhone);
    const url = new URL(`https://${host}/signal/send.php`);
    url.searchParams.set("phone", cleanPhone);
    url.searchParams.set("apikey", apiKey.trim());
    url.searchParams.set("text", briefing.signalMessageText);
    return url.toString();
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

    try {
      window.localStorage.setItem(
        SIGNAL_PREFS_KEY,
        JSON.stringify({
          phone: cleanPhone,
          apiKey: cleanKey,
        })
      );
    } catch {
      // ignore storage write error
    }

    try {
      // Dispatch directly from the user's browser to CallMeBot's official Signal gateway
      const primaryUrl = buildCallMeBotUrl("signal.callmebot.com");
      await fetch(primaryUrl, { mode: "no-cors", cache: "no-store" });

      setStatusMsg(
        `Signal-Nachricht an „${cleanPhone}“ gesendet! Checke deine Signal-App 💬`
      );
    } catch {
      try {
        const fallbackUrl = buildCallMeBotUrl("api.callmebot.com");
        await fetch(fallbackUrl, { mode: "no-cors", cache: "no-store" });
        setStatusMsg(
          `Signal-Nachricht an „${cleanPhone}“ gesendet! Checke deine Signal-App 💬`
        );
      } catch {
        setErrorMsg(
          "Dein Browser/Adblocker hat den Hintergrund-Aufruf blockiert — klicke unten auf „Direkt-Link öffnen“."
        );
      }
    } finally {
      setIsSending(false);
    }
  }

  const canSend =
    recipientPhone.trim().length >= 4 && apiKey.trim().length >= 2;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-sheet" style={{ maxWidth: 540 }}>
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
          <h2 style={{ fontSize: "1.12rem", fontWeight: 800 }}>
            Signal Daily Reminder 💬
          </h2>
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
          <div
            style={{
              background: "var(--bg-soft)",
              padding: "1rem",
              borderRadius: 16,
              border: "1px solid rgba(203, 166, 247, 0.3)",
              fontSize: "0.82rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.45rem",
            }}
          >
            <strong style={{ color: "var(--pastel-lavender)" }}>
              Wichtig bei CallMeBot Signal (UUID vs. Telefonnummer):
            </strong>
            <div>
              Wenn CallMeBot dir in Signal geantwortet hat, schickt er dir eine
              Beispiel-URL wie:
              <div
                style={{
                  marginTop: 4,
                  padding: "0.4rem 0.65rem",
                  background: "var(--bg-input)",
                  borderRadius: 8,
                  fontFamily: "monospace",
                  fontSize: "0.74rem",
                  color: "var(--pastel-peach)",
                  wordBreak: "break-all",
                }}
              >
                https://signal.callmebot.com/signal/send.php?phone=DEINE_UUID_ODER_NUMMER&amp;apikey=DEIN_KEY
              </div>
            </div>
            <div style={{ color: "var(--text-secondary)" }}>
              💡 <strong>Geheimtipp:</strong> Kopiere einfach die{" "}
              <strong>komplette URL</strong> aus der Signal-Nachricht von
              CallMeBot in das erste Feld unten — Schym liest deine{" "}
              <code>phone</code> / <code>UUID</code> und den{" "}
              <code>apikey</code> automatisch daraus aus!
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
                CallMeBot Link ODER Nummer / UUID
                <input
                  type="text"
                  className="field-input"
                  placeholder="+4917... oder UUID oder ganzer Link"
                  value={recipientPhone}
                  onChange={(e) => handleSmartInput("phone", e.target.value)}
                  required
                />
              </label>

              <label className="field-label">
                Dein API-Key (z. B. 123456)
                <input
                  type="text"
                  className="field-input"
                  placeholder="API-Key aus Signal"
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
                    : "Jetzt Briefing an Signal senden"}
                </span>
              </button>

              {canSend && (
                <a
                  href={buildCallMeBotUrl("signal.callmebot.com")}
                  target="_blank"
                  rel="noreferrer"
                  className="pill-tab"
                  style={{
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                  title="Öffnet den CallMeBot-Versand direkt im neuen Tab (zeigt exakten Status)"
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
              <span>Nachrichten-Vorschau ansehen</span>
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
                  padding: "0.75rem",
                  borderRadius: 12,
                  fontSize: "0.78rem",
                  color: "var(--text-secondary)",
                  whiteSpace: "pre-line",
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
