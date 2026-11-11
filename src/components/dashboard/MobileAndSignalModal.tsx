"use client";

import React, { useState, useEffect } from "react";
import {
  Smartphone,
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
  const [activeTab, setActiveTab] = useState<"signal" | "mobile_plan">(
    "signal"
  );
  const [mode, setMode] = useState<"callmebot" | "signal_cli">("callmebot");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [endpointUrl, setEndpointUrl] = useState(
    "http://127.0.0.1:8080/v2/send"
  );
  const [showPreview, setShowPreview] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Load saved phone & API key from localStorage so you only enter them once
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SIGNAL_PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          phone?: string;
          apiKey?: string;
          mode?: "callmebot" | "signal_cli";
        };
        if (parsed.phone) setRecipientPhone(parsed.phone);
        if (parsed.apiKey) setApiKey(parsed.apiKey);
        if (parsed.mode) setMode(parsed.mode);
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

    // Save preferences locally on the device
    try {
      window.localStorage.setItem(
        SIGNAL_PREFS_KEY,
        JSON.stringify({
          phone: recipientPhone.trim(),
          apiKey: apiKey.trim(),
          mode,
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
          mode,
          recipientPhone: recipientPhone.trim(),
          endpointUrl: mode === "signal_cli" ? endpointUrl.trim() : undefined,
          apiKey: mode === "callmebot" ? apiKey.trim() : undefined,
          message: briefing.signalMessageText,
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as { ok: boolean; error?: string };
        if (json.ok) {
          setStatusMsg(
            "Signal-Nachricht erfolgreich an dein Handy geschickt! 📲"
          );
          return;
        }
        setErrorMsg(json.error ?? "Signal-Versand fehlgeschlagen.");
        return;
      }

      // If running on static GitHub Pages (404/405 on /api/notify/signal) and mode is CallMeBot:
      if (mode === "callmebot" && apiKey.trim()) {
        const url = new URL("https://api.callmebot.com/signal/send.php");
        url.searchParams.set("phone", recipientPhone.trim());
        url.searchParams.set("apikey", apiKey.trim());
        url.searchParams.set("text", briefing.signalMessageText);
        await fetch(url.toString(), { mode: "no-cors" });
        setStatusMsg(
          "Signal-Nachricht über CallMeBot an dein Handy ausgelöst! 📲"
        );
        return;
      }

      const errJson = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      setErrorMsg(
        errJson.error ??
          "Signal-Versand fehlgeschlagen. Prüfe deinen 6-stelligen API-Key."
      );
    } catch {
      if (mode === "callmebot" && apiKey.trim()) {
        try {
          const url = new URL("https://api.callmebot.com/signal/send.php");
          url.searchParams.set("phone", recipientPhone.trim());
          url.searchParams.set("apikey", apiKey.trim());
          url.searchParams.set("text", briefing.signalMessageText);
          await fetch(url.toString(), { mode: "no-cors" });
          setStatusMsg(
            "Signal-Nachricht über CallMeBot an dein Handy ausgelöst! 📲"
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
      <div className="modal-sheet" style={{ maxWidth: 600 }}>
        {/* Clean Header */}
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
            Handy-App &amp; Signal Reminder 📲
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

        {/* Simple 2-Tab Switcher */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            marginBottom: "1.1rem",
          }}
        >
          <button
            type="button"
            className={`pill-tab ${activeTab === "signal" ? "active" : ""}`}
            onClick={() => setActiveTab("signal")}
          >
            <Send size={14} style={{ display: "inline", marginRight: 5 }} />
            1. Signal API-Key &amp; Bot
          </button>
          <button
            type="button"
            className={`pill-tab ${activeTab === "mobile_plan" ? "active" : ""}`}
            onClick={() => setActiveTab("mobile_plan")}
          >
            <Smartphone
              size={14}
              style={{ display: "inline", marginRight: 5 }}
            />
            2. 1-zu-1 Plan fürs Handy
          </button>
        </div>

        {activeTab === "signal" ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.95rem",
            }}
          >
            {/* Step-by-Step How to get the Signal API Key */}
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
                <strong>1.</strong> Speichere die Nummer{" "}
                <code style={{ color: "var(--pastel-mint)", fontWeight: 800 }}>
                  +34 644 52 74 88
                </code>{" "}
                als Kontakt in deinem Handy (z. B. als „Signal Bot“).
              </div>
              <div>
                <strong>2.</strong> Öffne <strong>Signal</strong> und schicke an
                diesen Kontakt exakt diese Nachricht:
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
                <strong>3.</strong> Der Bot antwortet dir sofort in Signal mit{" "}
                <code>Your APIKEY is 123456</code>. Diesen 6-stelligen Code
                trägst du unten ein!
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
                  Deine Signal-Handynummer (mit +49)
                  <input
                    type="text"
                    className="field-input"
                    placeholder="+491701234567"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    required
                  />
                </label>

                {mode === "callmebot" ? (
                  <label className="field-label">
                    Dein Signal API-Key (aus dem Chat)
                    <input
                      type="text"
                      className="field-input"
                      placeholder="z.B. 123456"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      required
                    />
                  </label>
                ) : (
                  <label className="field-label">
                    Lokale Docker signal-cli URL
                    <input
                      type="text"
                      className="field-input"
                      value={endpointUrl}
                      onChange={(e) => setEndpointUrl(e.target.value)}
                      required
                    />
                  </label>
                )}
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

            {/* Collapsible Message Preview & Advanced Docker Mode */}
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
                <span>Vorschau &amp; Docker-Option</span>
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
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                  }}
                >
                  <div
                    style={{
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
                  <div style={{ display: "flex", gap: "0.45rem" }}>
                    <button
                      type="button"
                      className={`pill-tab ${
                        mode === "callmebot" ? "active" : ""
                      }`}
                      onClick={() => setMode("callmebot")}
                    >
                      CallMeBot (Empfohlen, ohne Server)
                    </button>
                    <button
                      type="button"
                      className={`pill-tab ${
                        mode === "signal_cli" ? "active" : ""
                      }`}
                      onClick={() => setMode("signal_cli")}
                    >
                      Eigener Docker signal-cli
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* TAB 2: 1-TO-1 MOBILE PLAN */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.85rem",
              fontSize: "0.84rem",
            }}
          >
            <div
              style={{
                background: "var(--bg-soft)",
                padding: "1rem",
                borderRadius: 16,
                border: "1px solid rgba(166, 227, 161, 0.3)",
              }}
            >
              <strong style={{ color: "var(--pastel-mint)" }}>
                Schritt 1: GitHub Pages in 2 Klicks aktivieren (0 € &amp; 24/7
                online)
              </strong>
              <p style={{ marginTop: 4, color: "var(--text-secondary)" }}>
                Ich habe dir eine automatische GitHub-Pages-Pipeline (
                <code>.github/workflows/deploy-pages.yml</code>) eingebaut:
              </p>
              <ol
                style={{
                  marginTop: 6,
                  paddingLeft: "1.2rem",
                  color: "var(--text-primary)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <li>
                  Öffne auf GitHub dein Repo{" "}
                  <strong>github.com/ezEmmi/schym</strong> →{" "}
                  <strong>Settings → Pages</strong>.
                </li>
                <li>
                  Wähle unter <strong>Build and deployment → Source</strong>{" "}
                  einfach <strong>„GitHub Actions“</strong> aus.
                </li>
                <li>
                  Nach ~1 Minute ist deine App dauerhaft unter{" "}
                  <strong style={{ color: "var(--pastel-lavender)" }}>
                    https://ezemmi.github.io/schym
                  </strong>{" "}
                  auf deinem Handy erreichbar!
                </li>
              </ol>
            </div>

            <div
              style={{
                background: "var(--bg-soft)",
                padding: "1rem",
                borderRadius: 16,
                border: "1px solid rgba(203, 166, 247, 0.3)",
              }}
            >
              <strong style={{ color: "var(--pastel-lavender)" }}>
                Schritt 2: Als echte Vollbild-App aufs Handy holen
              </strong>
              <ol
                style={{
                  marginTop: 6,
                  paddingLeft: "1.2rem",
                  color: "var(--text-primary)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <li>
                  Öffne{" "}
                  <strong style={{ color: "var(--pastel-mint)" }}>
                    https://ezemmi.github.io/schym
                  </strong>{" "}
                  in Safari (iPhone) oder Chrome (Android).
                </li>
                <li>
                  Tippe auf <strong>Teilen → „Zum Home-Bildschirm“</strong>{" "}
                  (iPhone) bzw. <strong>„App installieren“</strong> (Android).
                </li>
                <li>
                  Deine 11 Hevy-Workouts („Drücken“ &amp; „Ziehen“) sind dort
                  bereits vorinstalliert, und neue Sätze im Gym werden direkt im
                  Handy-Speicher gesichert!
                </li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
