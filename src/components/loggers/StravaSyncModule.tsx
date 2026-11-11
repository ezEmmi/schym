"use client";

import React, { useState } from "react";
import { RefreshCw, CheckCircle2, KeyRound, FileJson } from "lucide-react";
import type { FitnessDataset } from "@/lib/db/schema";

interface StravaSyncModuleProps {
  todayIso: string;
  onSynced: (newData: FitnessDataset, importedCount: number) => void;
  onError: (msg: string) => void;
}

export function StravaSyncModule({
  todayIso,
  onSynced,
  onError,
}: StravaSyncModuleProps) {
  const [accessToken, setAccessToken] = useState("");
  const [perPage, setPerPage] = useState("15");
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
        onError(json.error ?? "Strava API sync failed.");
        return;
      }
      setAccessToken(""); // Clear token immediately from client memory
      setStatusMessage(
        `Successfully synced ${json.importedCount ?? 0} activities from Strava API!`
      );
      onSynced(json.data, json.importedCount ?? 0);
    } catch {
      onError("Network error while contacting Strava Sync endpoint.");
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
        onError(json.error ?? "Strava JSON import failed validation.");
        return;
      }
      setRawJson("");
      setStatusMessage(
        `Imported ${json.importedCount ?? 0} multi-sport Strava workouts into local SQLite!`
      );
      onSynced(json.data, json.importedCount ?? 0);
    } catch {
      onError("Failed to import Strava JSON activities.");
    } finally {
      setIsSyncing(false);
    }
  }

  const sampleStravaActivities = [
    {
      name: "Evening Gravel Grind & Singletrack",
      sport_type: "GravelRide",
      start_date_local: `${todayIso}T17:30:00Z`,
      moving_time: 3720,
      distance: 24800,
      average_heartrate: 158,
      total_elevation_gain: 410,
    },
    {
      name: "Padel Doubles Match",
      sport_type: "Padel",
      start_date_local: `${todayIso}T19:00:00Z`,
      moving_time: 5400,
      distance: 3200,
      average_heartrate: 146,
    },
    {
      name: "Alpine Ridge Trail Run",
      sport_type: "TrailRun",
      start_date_local: `${todayIso}T08:15:00Z`,
      moving_time: 3180,
      distance: 9400,
      average_heartrate: 164,
      total_elevation_gain: 520,
    },
  ];

  return (
    <div className="workspace-grid">
      <section className="panel-card">
        <h2 className="panel-title">
          <KeyRound size={19} color="#fc4c02" />
          Direct Strava API v3 Sync
        </h2>
        <p className="panel-desc">
          Paste your Strava Access Token (from{" "}
          <code>strava.com/settings/api</code>) to pull your latest activities.
          Your token is used in-memory for the request and is{" "}
          <strong>never written to disk or git</strong>.
        </p>

        {statusMessage && (
          <div
            style={{
              background: "rgba(52, 211, 153, 0.12)",
              border: "1px solid rgba(52, 211, 153, 0.35)",
              color: "#6ee7b7",
              padding: "0.75rem 1rem",
              borderRadius: 10,
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

        <form className="form-stack" onSubmit={handleTokenSync}>
          <label className="field-label">
            Strava OAuth Access Token (Scope: activity:read)
            <input
              type="password"
              className="field-input"
              placeholder="Paste Strava Bearer token..."
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              required
            />
          </label>

          <label className="field-label">
            Number of Recent Activities to Fetch (1–100)
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
            className="submit-btn"
            style={{ backgroundColor: "#fc4c02", color: "#fff" }}
            disabled={isSyncing}
          >
            {isSyncing ? "Syncing from Strava..." : "Sync My Strava Activities"}
          </button>
        </form>
      </section>

      <section className="panel-card">
        <h2 className="panel-title">
          <FileJson size={19} color="var(--accent-cardio)" />
          Strava JSON Import &amp; 1-Click Demo Sync
        </h2>
        <p className="panel-desc">
          Automatically maps Strava <code>sport_type</code> (Run, TrailRun,
          GravelRide, Swim, Padel, Tennis, Soccer, AlpineSki, etc.) into your
          Multi-Sport feed.
        </p>

        <div className="form-stack">
          <button
            type="button"
            className="submit-btn btn-cardio"
            disabled={isSyncing}
            onClick={() => handleJsonImport(sampleStravaActivities)}
          >
            <RefreshCw
              size={15}
              style={{ display: "inline", marginRight: 6, verticalAlign: -2 }}
            />
            1-Click Test: Sync 3 Sample Strava Multi-Sport Workouts
          </button>

          <label className="field-label" style={{ marginTop: "0.5rem" }}>
            Or Paste Strava Activities JSON Array
            <textarea
              className="field-input"
              rows={6}
              placeholder='[{"name":"Morning Run","sport_type":"Run","start_date_local":"2026-11-11T07:00:00Z","moving_time":2400,"distance":7200,"average_heartrate":151}]'
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              style={{ fontFamily: "monospace", fontSize: "0.8rem" }}
            />
          </label>

          <button
            type="button"
            className="submit-btn btn-gym"
            disabled={isSyncing || rawJson.trim().length === 0}
            onClick={() => {
              try {
                const parsed: unknown = JSON.parse(rawJson);
                const arr = Array.isArray(parsed) ? parsed : [parsed];
                void handleJsonImport(arr);
              } catch {
                onError("Invalid JSON syntax in Strava payload.");
              }
            }}
          >
            Validate &amp; Import Strava JSON
          </button>
        </div>
      </section>
    </div>
  );
}
