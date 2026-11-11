"use client";

import React, { useState } from "react";
import { RefreshCw, CheckCircle2, KeyRound, FileJson, X, ExternalLink } from "lucide-react";
import type { FitnessDataset } from "@/lib/db/schema";

interface StravaSyncModuleProps {
  todayIso: string;
  onSynced: (newData: FitnessDataset, importedCount: number) => void;
  onError: (msg: string) => void;
  onClose?: () => void;
}

export function StravaSyncModule({
  todayIso,
  onSynced,
  onError,
  onClose,
}: StravaSyncModuleProps) {
  const [accessToken, setAccessToken] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [useRefreshFlow, setUseRefreshFlow] = useState(false);

  const [perPage, setPerPage] = useState("30");
  const [rawJson, setRawJson] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function handleTokenSync(e: React.FormEvent) {
    e.preventDefault();
    setStatusMessage(null);
    setIsSyncing(true);
    try {
      const bodyPayload = useRefreshFlow
        ? {
            mode: "refresh" as const,
            clientId: clientId.trim(),
            clientSecret: clientSecret.trim(),
            refreshToken: refreshToken.trim(),
            perPage: Number(perPage),
          }
        : {
            mode: "token" as const,
            accessToken: accessToken.trim(),
            perPage: Number(perPage),
          };

      const res = await fetch("/api/strava/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      const json = (await res.json()) as {
        ok: boolean;
        importedCount?: number;
        data?: FitnessDataset;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.data) {
        onError(json.error ?? "Strava API Sync fehlgeschlagen.");
        return;
      }
      setAccessToken("");
      setClientSecret("");
      setRefreshToken("");
      setStatusMessage(
        `${json.importedCount ?? 0} Aktivitäten (inkl. Hevy Gym-Pläne) von Strava geladen!`
      );
      onSynced(json.data, json.importedCount ?? 0);
    } catch {
      onError("Netzwerkfehler beim Strava Sync.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleJsonImport(payloadActivities: unknown) {
    setStatusMessage(null);
    setIsSyncing(true);
    try {
      const res = await fetch("/api/strava/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "json",
          activities: payloadActivities,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        importedCount?: number;
        data?: FitnessDataset;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.data) {
        onError(json.error ?? "Strava JSON Import fehlgeschlagen.");
        return;
      }
      setRawJson("");
      setStatusMessage(
        `${json.importedCount ?? 0} Strava / Hevy Workouts erfolgreich importiert!`
      );
      onSynced(json.data, json.importedCount ?? 0);
    } catch {
      onError("Fehler beim Importieren der Strava JSON Daten.");
    } finally {
      setIsSyncing(false);
    }
  }

  const sampleHevyAndStravaActivities = [
    {
      name: "Oberkörper & Maschinen (Hevy)",
      sport_type: "WeightTraining",
      start_date_local: `${todayIso}T18:00:00Z`,
      moving_time: 3600,
      distance: 0,
      average_heartrate: 128,
      description:
        "Bench Press (Machine)\nSet 1: 75 kg x 8\nSet 2: 75 kg x 8\nSet 3: 75 kg x 8\n\nLat Pulldown (Cable)\nSet 1: 65 kg x 10\nSet 2: 65 kg x 10\nSet 3: 65 kg x 10\n\nShoulder Press (Machine)\nSet 1: 45 kg x 10\nSet 2: 45 kg x 10\n\nLeg Press (Machine)\nSet 1: 140 kg x 10\nSet 2: 140 kg x 10",
    },
    {
      name: "Abendrunde Laufen",
      sport_type: "Run",
      start_date_local: `${todayIso}T19:30:00Z`,
      moving_time: 2280,
      distance: 6800,
      average_heartrate: 154,
    },
  ];

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
            <h2 style={{ fontSize: "1.15rem", fontWeight: 800 }}>
              Strava &amp; Hevy Sync
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              Liest deine Läufe, Sportarten und deine Hevy-Übungen &amp;
              Gewichte direkt aus Strava aus!
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              aria-label="Schließen"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Step-by-Step Guide Box */}
        <div
          style={{
            background: "rgba(203, 166, 247, 0.08)",
            border: "1px solid rgba(203, 166, 247, 0.25)",
            borderRadius: 16,
            padding: "0.95rem 1.1rem",
            marginBottom: "1.2rem",
            fontSize: "0.81rem",
            color: "var(--text-secondary)",
          }}
        >
          <div
            style={{
              fontWeight: 800,
              color: "var(--pastel-lavender)",
              marginBottom: "0.35rem",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <ExternalLink size={15} />
            <span>So verbindest du dein Strava in 30 Sekunden:</span>
          </div>
          <ol style={{ paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: 4 }}>
            <li>
              Öffne{" "}
              <a
                href="https://www.strava.com/settings/api"
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--pastel-mint)", fontWeight: 700 }}
              >
                strava.com/settings/api
              </a>{" "}
              (falls du noch keine App dort hast: Name z. B. <code>Schym</code>,
              Website <code>http://localhost</code>, Callback Domain{" "}
              <code>localhost</code>).
            </li>
            <li>
              Kopiere dort deinen <strong>Access Token</strong> (oder nutze
              Client ID + Client Secret + Refresh Token, falls der Token
              abgelaufen ist).
            </li>
            <li>
              <strong>Wichtig für private Workouts:</strong> Wenn dein Standard-Token nur{" "}
              <code>read</code> hat, klicke unten auf{" "}
              <strong>„Mit Client ID &amp; Refresh Token verbinden“</strong> —
              damit holt sich Schym automatisch einen frischen Token!
            </li>
          </ol>
        </div>

        {statusMessage && (
          <div
            style={{
              background: "rgba(166, 227, 161, 0.14)",
              border: "1px solid rgba(166, 227, 161, 0.4)",
              color: "var(--pastel-mint)",
              padding: "0.75rem 1rem",
              borderRadius: 12,
              fontSize: "0.85rem",
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <CheckCircle2 size={16} />
            <span>{statusMessage}</span>
          </div>
        )}

        <div className="workspace-grid">
          <section
            style={{
              background: "var(--bg-soft)",
              padding: "1.1rem",
              borderRadius: 16,
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.5rem",
              }}
            >
              <h3 className="panel-title">
                <KeyRound size={18} color="var(--pastel-peach)" />
                Direkter Strava Sync
              </h3>
              <button
                type="button"
                className="pill-tab"
                style={{ fontSize: "0.72rem", padding: "0.25rem 0.65rem" }}
                onClick={() => setUseRefreshFlow(!useRefreshFlow)}
              >
                {useRefreshFlow
                  ? "Nur Access Token"
                  : "Client ID + Secret nutzen"}
              </button>
            </div>

            <form className="form-stack" onSubmit={handleTokenSync}>
              {!useRefreshFlow ? (
                <label className="field-label">
                  Strava Access Token
                  <input
                    type="password"
                    className="field-input"
                    placeholder="Dein Access Token von strava.com/settings/api"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    required
                  />
                </label>
              ) : (
                <>
                  <label className="field-label">
                    Client ID
                    <input
                      type="text"
                      className="field-input"
                      placeholder="z.B. 123456"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      required
                    />
                  </label>
                  <label className="field-label">
                    Client Secret
                    <input
                      type="password"
                      className="field-input"
                      placeholder="Dein Client Secret..."
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      required
                    />
                  </label>
                  <label className="field-label">
                    Refresh Token
                    <input
                      type="password"
                      className="field-input"
                      placeholder="Dein Refresh Token..."
                      value={refreshToken}
                      onChange={(e) => setRefreshToken(e.target.value)}
                      required
                    />
                  </label>
                </>
              )}

              <label className="field-label">
                Anzahl letzter Aktivitäten (1–100)
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="field-input"
                  value={perPage}
                  onChange={(e) => setPerPage(e.target.value)}
                  required
                />
              </label>

              <button
                type="submit"
                className="pastel-btn btn-peach"
                disabled={isSyncing}
              >
                {isSyncing
                  ? "Synchronisiere..."
                  : "Jetzt von Strava synchronisieren"}
              </button>
            </form>
          </section>

          <section
            style={{
              background: "var(--bg-soft)",
              padding: "1.1rem",
              borderRadius: 16,
              border: "1px solid var(--border-subtle)",
            }}
          >
            <h3 className="panel-title">
              <FileJson size={18} color="var(--pastel-mint)" />
              Hevy + Strava Vorschau &amp; JSON Import
            </h3>
            <p className="panel-desc">
              Teste mit 1 Klick, wie Schym ein Hevy-Workout + Lauf aus Strava
              importiert, oder füge ein Strava-JSON ein.
            </p>

            <div className="form-stack">
              <button
                type="button"
                className="pastel-btn btn-mint"
                disabled={isSyncing}
                onClick={() => handleJsonImport(sampleHevyAndStravaActivities)}
              >
                <RefreshCw size={15} />
                <span>Vorschau: Hevy Gym-Plan + Lauf laden</span>
              </button>

              <label className="field-label" style={{ marginTop: "0.35rem" }}>
                Oder Strava JSON Array einfügen
                <textarea
                  className="field-input"
                  rows={4}
                  placeholder='[{"name":"Push Hevy","sport_type":"WeightTraining","start_date_local":"2026-11-11T18:00:00Z","moving_time":3600,"description":"Bench Press\nSet 1: 80 kg x 8"}]'
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
                  style={{ fontFamily: "monospace", fontSize: "0.78rem" }}
                />
              </label>

              <button
                type="button"
                className="pastel-btn btn-lavender"
                disabled={isSyncing || rawJson.trim().length === 0}
                onClick={() => {
                  try {
                    const parsed: unknown = JSON.parse(rawJson);
                    const arr = Array.isArray(parsed) ? parsed : [parsed];
                    void handleJsonImport(arr);
                  } catch {
                    onError("Ungültiges JSON-Format.");
                  }
                }}
              >
                JSON importieren
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
