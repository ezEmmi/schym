"use client";

import React, { useState, useEffect } from "react";
import {
  Send,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { DailyCoachBriefing } from "@/lib/coach";

interface MobileAndSignalModalProps {
  briefing: DailyCoachBriefing;
  onClose: () => void;
}

const SIGNAL_PREFS_KEY = "schym_signal_prefs_v1";

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

  async function handleSendSignal(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    setErrorMsg(null);
    setIsSending(true);

    try {
      window.localStorage.setItem(
        SIGNAL_PREFS_KEY,
        JSON.stringify({
          phone: recipientPhone.trim(),
          apiKey: apiKey.trim(),
        })
      );
    } catch {
      // ignore storage write error
    }

    try {
      const res = await fetch("/api/notify/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "callmebot",
          recipientPhone: recipientPhone.trim(),
          apiKey: apiKey.trim(),
          message: briefing.signalMessageText,
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as { ok: boolean; error?: string };
        if (json.ok) {
          setStatusMsg(
            "Signal-Nachricht erfolgreich geschickt! 💬"
          );
          return;
        }
        setErrorMsg(json.error ?? "Signal-Versand fehlgeschlagen.");
        return;
      }

      if (apiKey.trim()) {
        const url = new URL("https://api.callmebot.com/signal/send.php");
        url.searchParams.set("phone", recipientPhone.trim());
        url.searchParams.set("apikey", apiKey.trim());
        url.searchParams.set("text", briefing.signalMessageText);
        await fetch(url.toString(), { mode: "no-cors" });
        setStatusMsg(
          "Signal-Nachricht über CallMeBot ausgelöst! 💬"
        );
        return;
      }

      setErrorMsg("Bitte prüfe deinen 6-stelligen Signal API-Key.");
    } catch {
      if (apiKey.trim()) {
        try {
          const url = new URL("https://api.callmebot.com/signal/send.php");
          url.searchParams.set("phone", recipientPhone.trim());
          url.searchParams.set("apikey", apiKey.trim());
          url.searchParams.set("text", briefing.signalMessageText);
          await fetch(url.toString(), { mode: "no-cors" });
          setStatusMsg(
            "Signal-Nachricht über CallMeBot ausgelöst! 💬"
          );
          return;
        } catch {
          // fallthrough
        }
      }
      setErrorMsg("Netzwerkfehler beim Senden der Signal-Nachricht.");
    } finally {
      setIsSending(false);
    }
  }

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
              fontSize: "0.83rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.45rem",
            }}
          >
            <strong style={{ color: "var(--pastel-lavender)" }}>
              So bekommst du in 30 Sekunden deinen kostenlosen Signal API-Key:
            </strong>
            <div>
              <strong>1.</strong> Speichere{" "}
              <code style={{ color: "var(--pastel-mint)", fontWeight: 800 }}>
                +34 644 52 74 88
              </code>{" "}
              als Kontakt (z. B. „Signal Bot“).
            </div>
            <div>
              <strong>2.</strong> Sende diesem Kontakt in <strong>Signal</strong>{" "}
              exakt diese Nachricht:
              <div
                style={{
                  marginTop: 4,
                  padding: "0.4rem 0.65rem",
                  background: "var(--bg-input)",
                  borderRadius: 8,
                  fontFamily: "monospace",
                  color: "var(--pastel-peach)",
                  userSelect: "all",
                }}
              >
                I allow callmebot to send me messages
              </div>
            </div>
            <div>
              <strong>3.</strong> Der Bot antwortet dir sofort mit{" "}
              <code>Your APIKEY is 123456</code>.
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
                Deine Signal-Nummer (+49...)
                <input
                  type="text"
                  className="field-input"
                  placeholder="+491701234567"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  required
                />
              </label>

              <label className="field-label">
                Dein 6-stelliger API-Key
                <input
                  type="text"
                  className="field-input"
                  placeholder="z.B. 123456"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  required
                />
              </label>
            </div>

            <button
              type="submit"
              className="pastel-btn btn-lavender"
              disabled={isSending}
            >
              <Send size={15} />
              <span>
                {isSending
                  ? "Sende an Signal..."
                  : "Heutiges Briefing jetzt an Signal senden"}
              </span>
            </button>
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
