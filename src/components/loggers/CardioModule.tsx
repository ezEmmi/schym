"use client";

import React, { useState } from "react";
import { HeartPulse, Flame, Trash2, Filter } from "lucide-react";
import type { CardioSession } from "@/lib/db/schema";
import {
  SPORTS_CATALOG,
  getSportDefinition,
  type SportCategory,
} from "@/lib/sports-catalog";
import { formatPaceMinPerKm } from "@/lib/metrics";

interface CardioModuleProps {
  entries: CardioSession[];
  todayIso: string;
  isSubmitting: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<boolean>;
  onDelete: (id: number) => Promise<void>;
}

const CATEGORIES: readonly SportCategory[] = [
  "Endurance",
  "Climbing & Outdoor",
  "Team & Ball",
  "Racket",
  "Combat & Martial Arts",
  "Water & Winter",
  "Mind, Mobility & Other",
];

export function CardioModule({
  entries,
  todayIso,
  isSubmitting,
  onSubmit,
  onDelete,
}: CardioModuleProps) {
  const [cardioDate, setCardioDate] = useState(todayIso);
  const [modality, setModality] = useState<string>("Run");
  const [durationMinutes, setDurationMinutes] = useState("45");
  const [distanceKm, setDistanceKm] = useState("7.5");
  const [avgHeartRate, setAvgHeartRate] = useState("152");
  const [cardioRpe, setCardioRpe] = useState("7");
  const [cardioNotes, setCardioNotes] = useState("");
  const [selectedSportFilter, setSelectedSportFilter] = useState<string>("ALL");

  const activeSportDef = getSportDefinition(modality);

  // Compute unique sports present in logged sessions so the user can filter or view all 24+ sports
  const filteredEntries =
    selectedSportFilter === "ALL"
      ? entries
      : entries.filter((e) => e.modality === selectedSportFilter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Interactive Sport Picker Pills */}
      <section className="panel-card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem",
            marginBottom: "0.85rem",
          }}
        >
          <div>
            <h2 className="panel-title">
              <Filter size={18} color="var(--accent-cardio)" />
              Multi-Sport Selector ({SPORTS_CATALOG.length} Sports Available)
            </h2>
            <p className="panel-desc" style={{ marginBottom: 0 }}>
              Click any sport below to pre-select it for logging or filter your
              activity feed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedSportFilter("ALL")}
            style={{
              padding: "0.4rem 0.85rem",
              borderRadius: "999px",
              border: "1px solid var(--border-subtle)",
              background:
                selectedSportFilter === "ALL"
                  ? "var(--accent-cardio)"
                  : "rgba(255,255,255,0.04)",
              color: selectedSportFilter === "ALL" ? "#090d16" : "var(--text-primary)",
              fontWeight: 700,
              fontSize: "0.78rem",
              cursor: "pointer",
            }}
          >
            Show All Logged ({entries.length})
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.45rem",
          }}
        >
          {SPORTS_CATALOG.map((sport) => {
            const count = entries.filter((e) => e.modality === sport.id).length;
            const isSelected =
              modality === sport.id || selectedSportFilter === sport.id;
            return (
              <button
                key={sport.id}
                type="button"
                onClick={() => {
                  setModality(sport.id);
                  if (!sport.tracksDistance) {
                    setDistanceKm("0");
                  }
                  setSelectedSportFilter(
                    selectedSportFilter === sport.id ? "ALL" : sport.id
                  );
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.38rem 0.75rem",
                  borderRadius: "999px",
                  border: isSelected
                    ? `1px solid ${sport.accentColor}`
                    : "1px solid var(--border-subtle)",
                  background: isSelected
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(255, 255, 255, 0.025)",
                  color: "var(--text-primary)",
                  fontSize: "0.78rem",
                  fontWeight: isSelected ? 700 : 500,
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: sport.accentColor,
                  }}
                />
                <span>{sport.label}</span>
                {count > 0 && (
                  <span
                    style={{
                      background: "rgba(255,255,255,0.12)",
                      padding: "0.05rem 0.4rem",
                      borderRadius: "999px",
                      fontSize: "0.7rem",
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <div className="workspace-grid">
        <section className="panel-card">
          <h2 className="panel-title">
            <HeartPulse size={19} color={activeSportDef.accentColor} />
            Log {activeSportDef.label}
          </h2>
          <p className="panel-desc">
            Category: <strong>{activeSportDef.category}</strong> • Counts toward
            your weekly conditioning &amp; multi-sport target.
          </p>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await onSubmit({
                sessionDate: cardioDate,
                modality,
                durationMinutes: Number(durationMinutes),
                distanceKm: Number(distanceKm || 0),
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
                Sport / Discipline
                <select
                  className="field-select"
                  value={modality}
                  onChange={(e) => {
                    const nextSport = getSportDefinition(e.target.value);
                    setModality(nextSport.id);
                    if (!nextSport.tracksDistance) {
                      setDistanceKm("0");
                    }
                  }}
                >
                  {CATEGORIES.map((cat) => (
                    <optgroup key={cat} label={cat}>
                      {SPORTS_CATALOG.filter((s) => s.category === cat).map(
                        (s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        )
                      )}
                    </optgroup>
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
                  max={1440}
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
                  max={1000}
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
                Notes / Match Result / Route
                <input
                  type="text"
                  className="field-input"
                  placeholder="Zone 2, match score, sparing rounds..."
                  value={cardioNotes}
                  onChange={(e) => setCardioNotes(e.target.value)}
                />
              </label>
            </div>

            <button
              type="submit"
              className="submit-btn btn-cardio"
              style={{ backgroundColor: activeSportDef.accentColor }}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Saving..."
                : `+ Log ${activeSportDef.label} Session`}
            </button>
          </form>
        </section>

        <section className="panel-card">
          <h2 className="panel-title">
            <Flame size={19} color="var(--accent-cardio)" />
            Multi-Sport &amp; Cardio Feed ({filteredEntries.length})
          </h2>
          <p className="panel-desc">
            Showing logged sports, pace/distance, duration, heart rate, and
            Strava-synced workouts.
          </p>
          <div className="session-list">
            {filteredEntries.map((item) => {
              const def = getSportDefinition(item.modality);
              return (
                <div key={item.id} className="session-item">
                  <div className="session-main">
                    <div className="session-header">
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          backgroundColor: def.accentColor,
                          display: "inline-block",
                        }}
                      />
                      <span className="session-title">
                        {def.label}
                        {item.distanceKm > 0 ? ` — ${item.distanceKm} km` : ""}
                      </span>
                      {item.distanceKm > 0 && (
                        <span className="badge badge-cardio">
                          {formatPaceMinPerKm(
                            item.durationMinutes,
                            item.distanceKm
                          )}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-secondary)",
                          background: "rgba(255,255,255,0.05)",
                          padding: "0.15rem 0.45rem",
                          borderRadius: 6,
                        }}
                      >
                        {def.category}
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
                    {item.notes && (
                      <p className="session-notes">“{item.notes}”</p>
                    )}
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
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
