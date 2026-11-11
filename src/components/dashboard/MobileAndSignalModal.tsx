"use client";

import React, { useState } from "react";
import {
  Smartphone,
  Send,
  ShieldCheck,
  CheckCircle2,
  X,
  Server,
} from "lucide-react";
import type { DailyCoachBriefing } from "@/lib/coach";

interface MobileAndSignalModalProps {
  briefing: DailyCoachBriefing;
  onClose: () => void;
}

export function MobileAndSignalModal({
  briefing,
  onClose,
}: MobileAndSignalModalProps) {
  const [mode, setMode] = useState<"signal_cli" | "callmebot">("signal_cli");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [endpointUrl, setEndpointUrl] = useState(
    "http://127.0.0.1:8080/v2/send"
  );
  const [apiKey, setApiKey] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function handleSendSignal(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    setErrorMsg(null);
    setIsSending(true);
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
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error ?? "Signal-Versand fehlgeschlagen.");
        return;
      }
      setStatusMsg(
        "Signal-Nachricht erfolgreich an dein Handy geschickt! 📲"
      );
    } catch {
      setErrorMsg("Netzwerkfehler beim Senden der Signal-Nachricht.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-sheet">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: "1rem",
            borderBottom: "1px solid var(--border-subtle)",
            marginBottom: "1.1rem",
          }}
        >
          <div>
            <h2 style={{ fontSize: "1.16rem", fontWeight: 800 }}>
              Signal Messenger Reminder &amp; Handy-Zugriff (PWA / Server)
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              100 % privat ohne Cloud-Datenabfluss — verbinde dein Handy per
              WLAN/Tailscale &amp; empfange tägliche Signal-Briefings
            </p>
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

        <div className="workspace-grid">
          {/* LEFT: SIGNAL MESSENGER DAILY COACH */}
          <section
            style={{
              background: "var(--bg-soft)",
              padding: "1.15rem",
              borderRadius: 18,
              border: "1px solid rgba(203, 166, 247, 0.28)",
              display: "flex",
              flexDirection: "column",
              gap: "0.85rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Send size={18} color="var(--pastel-lavender)" />
              <h3 className="panel-title" style={{ margin: 0 }}>
                Signal Daily Briefing Bot
              </h3>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                padding: "0.75rem",
                borderRadius: 12,
                fontSize: "0.78rem",
                color: "var(--text-secondary)",
                whiteSpace: "pre-line",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <strong style={{ color: "var(--pastel-mint)" }}>
                Vorschau deiner heutigen Signal-Nachricht:
              </strong>
              {"\n"}
              {briefing.signalMessageText}
            </div>

            <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className={`pill-tab ${
                  mode === "signal_cli" ? "active" : ""
                }`}
                onClick={() => setMode("signal_cli")}
              >
                Docker signal-cli (Lokal)
              </button>
              <button
                type="button"
                className={`pill-tab ${mode === "callmebot" ? "active" : ""}`}
                onClick={() => setMode("callmebot")}
              >
                CallMeBot Signal API
              </button>
            </div>

            {statusMsg && (
              <div
                style={{
                  color: "var(--pastel-mint)",
                  fontSize: "0.8rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <CheckCircle2 size={15} />
                <span>{statusMsg}</span>
              </div>
            )}
            {errorMsg && (
              <div style={{ color: "var(--danger)", fontSize: "0.8rem" }}>
                {errorMsg}
              </div>
            )}

            <form className="form-stack" onSubmit={handleSendSignal}>
              <label className="field-label">
                Deine Signal-Telefonnummer (mit +49)
                <input
                  type="text"
                  className="field-input"
                  placeholder="+491701234567"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  required
                />
              </label>

              {mode === "signal_cli" ? (
                <label className="field-label">
                  Lokale signal-cli-rest-api URL (aus unserer docker-compose.yml)
                  <input
                    type="text"
                    className="field-input"
                    value={endpointUrl}
                    onChange={(e) => setEndpointUrl(e.target.value)}
                    required
                  />
                </label>
              ) : (
                <label className="field-label">
                  CallMeBot Signal API-Key
                  <input
                    type="password"
                    className="field-input"
                    placeholder="API Key..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    required
                  />
                </label>
              )}

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
          </section>

          {/* RIGHT: MOBILE PWA & PRIVATE SERVER / TAILSCALE GUIDE */}
          <section
            style={{
              background: "var(--bg-soft)",
              padding: "1.15rem",
              borderRadius: 18,
              border: "1px solid rgba(166, 227, 161, 0.28)",
              display: "flex",
              flexDirection: "column",
              gap: "0.85rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Smartphone size={18} color="var(--pastel-mint)" />
              <h3 className="panel-title" style={{ margin: 0 }}>
                Vom Handy aus nutzen (PWA &amp; Server)
              </h3>
            </div>

            <div
              style={{
                fontSize: "0.81rem",
                color: "var(--text-secondary)",
                display: "flex",
                flexDirection: "column",
                gap: "0.65rem",
              }}
            >
              <div>
                <strong style={{ color: "var(--pastel-mint)" }}>
                  Option 1: Sofort im WLAN oder unterwegs per Tailscale VPN
                </strong>
                <p style={{ marginTop: 2 }}>
                  Starte den Server mit{" "}
                  <code>npm.cmd run dev:mobile</code>. Installiere auf PC &amp;
                  Handy kostenlos <strong>Tailscale</strong> (Zero-Trust
                  WireGuard VPN). Damit erreichst du deinen PC/Server sogar
                  mitten im Gym über 5G/LTE unter deiner privaten Tailscale-IP
                  (z. B. <code>http://100.x.y.z:3000</code>), ohne dass irgendjemand
                  im Internet auf deine Daten zugreifen kann!
                </p>
              </div>

              <div>
                <strong style={{ color: "var(--pastel-peach)" }}>
                  Option 2: 24/7 eigener Mini-Server / Raspberry Pi per Docker
                </strong>
                <p style={{ marginTop: 2 }}>
                  In deinem Projekt liegt jetzt eine fertige, gehärtete{" "}
                  <code>docker-compose.yml</code> (inkl.{" "}
                  <code>signal-cli-rest-api</code> Container!). Ein Befehl auf
                  deinem Server reicht:{" "}
                  <code>docker compose up -d --build</code>
                </p>
              </div>

              <div>
                <strong style={{ color: "var(--pastel-lavender)" }}>
                  Als echte App auf dem Handy-Startbildschirm (PWA)
                </strong>
                <p style={{ marginTop: 2 }}>
                  Öffne Schym im Handy-Browser → tippe auf{" "}
                  <strong>Teilen → „Zum Home-Bildschirm“</strong> (iOS) bzw.{" "}
                  <strong>„App installieren“</strong> (Android). Schym startet
                  dann im Vollbild wie eine native App!
                </p>
              </div>

              <div
                style={{
                  marginTop: "0.25rem",
                  padding: "0.6rem 0.8rem",
                  borderRadius: 12,
                  background: "rgba(166, 227, 161, 0.1)",
                  color: "var(--pastel-mint)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "0.76rem",
                  fontWeight: 700,
                }}
              >
                <ShieldCheck size={16} />
                <Server size={15} />
                <span>
                  Zero-Exfiltration aktiv: Strict CSP + Same-Origin CSRF-Guard +
                  lokale SQLite WAL
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
