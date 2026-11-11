"use client";

import React, { useState } from "react";
import { RefreshCw, CheckCircle2, KeyRound, FileJson, X } from "lucide-react";
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
  const [perPage, setPerPage] = useState("20");
  const [rawJson, setRawJson] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function handleTokenSync(e: React.FormEvent) {
    e.preventDefault();
    setStatusMessage(null);
    setIsSyncing(true);
    try {
      const res = await fetch("/api/strava/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "token",
          accessToken,
          perPage: Number(perPage),
        }),
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

  // Realistic sample showing how a Hevy Gym workout synced via Strava + Cardio run looks when imported
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
            marginBottom: "1.25rem",
          }}
        >
          <div>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 800 }}>
              Strava &amp; Hevy Sync
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              Liest deine Läufe, Sportarten und sogar deine Hevy-Übungen &amp;
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
            <h3 className="panel-title">
              <KeyRound size={18} color="var(--pastel-peach)" />
              Direkter Strava API Sync
            </h3>
            <p className="panel-desc">
              Gib deinen Strava Access Token ein (unter{" "}
              <code>strava.com/settings/api</code>). Er wird nur im RAM genutzt
              und niemals gespeichert.
            </p>

            <form className="form-stack" onSubmit={handleTokenSync}>
              <label className="field-label">
                Strava OAuth Access Token
                <input
                  type="password"
                  className="field-input"
                  placeholder="Bearer Token einfügen..."
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  required
                />
              </label>

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
              Hevy + Strava Demo oder JSON Import
            </h3>
            <p className="panel-desc">
              Wenn Hevy deine Sätze in die Strava-Beschreibung schreibt, baut
              Schym daraus automatisch deinen Gym-Plan + Muskel-Map!
            </p>

            <div className="form-stack">
              <button
                type="button"
                className="pastel-btn btn-mint"
                disabled={isSyncing}
                onClick={() => handleJsonImport(sampleHevyAndStravaActivities)}
              >
                <RefreshCw size={15} />
                <span>Test: Hevy Gym-Plan + Lauf aus Strava laden</span>
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
