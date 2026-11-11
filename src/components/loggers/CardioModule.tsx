"use client";

import React, { useState } from "react";
import { HeartPulse, Flame, Trash2 } from "lucide-react";
import type { CardioSession } from "@/lib/db/schema";
import { cardioModalities } from "@/lib/validation/fitness";
import { formatPaceMinPerKm } from "@/lib/metrics";

interface CardioModuleProps {
  entries: CardioSession[];
  todayIso: string;
  isSubmitting: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<boolean>;
  onDelete: (id: number) => Promise<void>;
}

export function CardioModule({
  entries,
  todayIso,
  isSubmitting,
  onSubmit,
  onDelete,
}: CardioModuleProps) {
  const [cardioDate, setCardioDate] = useState(todayIso);
  const [modality, setModality] =
    useState<(typeof cardioModalities)[number]>("Run");
  const [durationMinutes, setDurationMinutes] = useState("35");
  const [distanceKm, setDistanceKm] = useState("6.5");
  const [avgHeartRate, setAvgHeartRate] = useState("150");
  const [cardioRpe, setCardioRpe] = useState("7");
  const [cardioNotes, setCardioNotes] = useState("");

  return (
    <div className="workspace-grid">
      <section className="panel-card">
        <h2 className="panel-title">
          <HeartPulse size={19} color="var(--accent-cardio)" />
          Log Cardio Session
        </h2>
        <p className="panel-desc">
          Track runs, rides, rows, or HIIT toward your 2+ weekly conditioning
          target.
        </p>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await onSubmit({
              sessionDate: cardioDate,
              modality,
              durationMinutes: Number(durationMinutes),
              distanceKm: Number(distanceKm),
              avgHeartRate:
                avgHeartRate.trim() === "" ? null : Number(avgHeartRate),
              rpe: Number(cardioRpe),
              notes: cardioNotes,
            });
            if (ok) {
              setCardioNotes("");
            }
          }}
        >
          <div className="form-row-2">
            <label className="field-label">
              Date
              <input
                type="date"
                className="field-input"
                value={cardioDate}
                onChange={(e) => setCardioDate(e.target.value)}
                required
              />
            </label>
            <label className="field-label">
              Modality
              <select
                className="field-select"
                value={modality}
                onChange={(e) =>
                  setModality(
                    e.target.value as (typeof cardioModalities)[number]
                  )
                }
              >
                {cardioModalities.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-row-3">
            <label className="field-label">
              Duration (min)
              <input
                type="number"
                min={1}
                max={720}
                className="field-input"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                required
              />
            </label>
            <label className="field-label">
              Distance (km)
              <input
                type="number"
                step="0.1"
                min={0}
                max={500}
                className="field-input"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                required
              />
            </label>
            <label className="field-label">
              Avg HR (bpm)
              <input
                type="number"
                min={35}
                max={230}
                placeholder="Optional"
                className="field-input"
                value={avgHeartRate}
                onChange={(e) => setAvgHeartRate(e.target.value)}
              />
            </label>
          </div>

          <div className="form-row-2">
            <label className="field-label">
              Effort RPE (1–10)
              <input
                type="number"
                min={1}
                max={10}
                className="field-input"
                value={cardioRpe}
                onChange={(e) => setCardioRpe(e.target.value)}
                required
              />
            </label>
            <label className="field-label">
              Notes
              <input
                type="text"
                className="field-input"
                placeholder="Zone 2, intervals, route..."
                value={cardioNotes}
                onChange={(e) => setCardioNotes(e.target.value)}
              />
            </label>
          </div>

          <button
            type="submit"
            className="submit-btn btn-cardio"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "+ Save Cardio Session"}
          </button>
        </form>
      </section>

      <section className="panel-card">
        <h2 className="panel-title">
          <Flame size={19} color="var(--accent-cardio)" />
          Cardio Conditioning Log
        </h2>
        <p className="panel-desc">
          Showing pace, duration, distance, and heart-rate conditioning data.
        </p>
        <div className="session-list">
          {entries.map((item) => (
            <div key={item.id} className="session-item">
              <div className="session-main">
                <div className="session-header">
                  <span className="session-title">
                    {item.modality} — {item.distanceKm} km
                  </span>
                  <span className="badge badge-cardio">
                    {formatPaceMinPerKm(item.durationMinutes, item.distanceKm)}
                  </span>
                  <span
                    style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}
                  >
                    {item.sessionDate}
                  </span>
                </div>
                <div className="session-stats">
                  <span>Duration: {item.durationMinutes} min</span>
                  {item.avgHeartRate && (
                    <span>Avg HR: {item.avgHeartRate} bpm</span>
                  )}
                  <span>RPE {item.rpe}/10</span>
                </div>
                {item.notes && <p className="session-notes">“{item.notes}”</p>}
              </div>
              <button
                type="button"
                className="delete-btn"
                title="Delete entry"
                onClick={() => onDelete(item.id)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
