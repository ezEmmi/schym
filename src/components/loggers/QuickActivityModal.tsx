"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import {
  SPORTS_CATALOG,
  getSportDefinition,
  type SportCategory,
} from "@/lib/sports-catalog";
import {
  climbingGrades,
  climbingStyles,
  wallAngles,
} from "@/lib/validation/fitness";

interface QuickActivityModalProps {
  todayIso: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmitCardio: (payload: Record<string, unknown>) => Promise<boolean>;
  onSubmitBoulder: (payload: Record<string, unknown>) => Promise<boolean>;
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

export function QuickActivityModal({
  todayIso,
  isSubmitting,
  onClose,
  onSubmitCardio,
  onSubmitBoulder,
}: QuickActivityModalProps) {
  const [kind, setKind] = useState<"sport" | "boulder">("sport");

  // Sport state
  const [sessionDate, setSessionDate] = useState(todayIso);
  const [modality, setModality] = useState("Run");
  const [durationMinutes, setDurationMinutes] = useState("40");
  const [distanceKm, setDistanceKm] = useState("6.5");
  const [avgHeartRate, setAvgHeartRate] = useState("150");
  const [rpe, setRpe] = useState("7");
  const [notes, setNotes] = useState("");

  // Boulder state
  const [location, setLocation] = useState("Boulderhalle");
  const [grade, setGrade] = useState<(typeof climbingGrades)[number]>("6B+");
  const [style, setStyle] = useState<(typeof climbingStyles)[number]>("Flash");
  const [wallAngle, setWallAngle] =
    useState<(typeof wallAngles)[number]>("Overhang");
  const [attempts, setAttempts] = useState("2");
  const [topped, setTopped] = useState(true);
  const [skinAndFingerFeel, setSkinAndFingerFeel] = useState("8");

  const sportDef = getSportDefinition(modality);

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
          <h2 style={{ fontSize: "1.1rem", fontWeight: 800 }}>
            Sport / Cardio / Bouldern eintragen
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

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.1rem" }}>
          <button
            type="button"
            className={`pill-tab ${kind === "sport" ? "active" : ""}`}
            onClick={() => setKind("sport")}
          >
            Cardio &amp; 24+ Sportarten
          </button>
          <button
            type="button"
            className={`pill-tab ${kind === "boulder" ? "active" : ""}`}
            onClick={() => setKind("boulder")}
          >
            Boulder-Problem / Session
          </button>
        </div>

        {kind === "sport" ? (
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await onSubmitCardio({
                sessionDate,
                modality,
                durationMinutes: Number(durationMinutes),
                distanceKm: Number(distanceKm || 0),
                avgHeartRate:
                  avgHeartRate.trim() === "" ? null : Number(avgHeartRate),
                rpe: Number(rpe),
                notes,
              });
              if (ok) onClose();
            }}
          >
            <div className="form-row-2">
              <label className="field-label">
                Datum
                <input
                  type="date"
                  className="field-input"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  required
                />
              </label>
              <label className="field-label">
                Sportart wählen
                <select
                  className="field-select"
                  value={modality}
                  onChange={(e) => {
                    const def = getSportDefinition(e.target.value);
                    setModality(def.id);
                    if (!def.tracksDistance) setDistanceKm("0");
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
                Dauer (Min)
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
                Distanz (km)
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
                Ø Puls (bpm)
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
                Anstrengung RPE (1–10)
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="field-input"
                  value={rpe}
                  onChange={(e) => setRpe(e.target.value)}
                  required
                />
              </label>
              <label className="field-label">
                Notiz
                <input
                  type="text"
                  className="field-input"
                  placeholder="Runde, Match-Ergebnis..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </div>

            <button
              type="submit"
              className="pastel-btn btn-mint"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Speichere..." : `+ ${sportDef.label} speichern`}
            </button>
          </form>
        ) : (
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await onSubmitBoulder({
                sessionDate,
                location,
                grade,
                style,
                wallAngle,
                attempts: Number(attempts),
                topped,
                durationMinutes: Number(durationMinutes),
                skinAndFingerFeel: Number(skinAndFingerFeel),
                notes,
              });
              if (ok) onClose();
            }}
          >
            <div className="form-row-2">
              <label className="field-label">
                Datum
                <input
                  type="date"
                  className="field-input"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  required
                />
              </label>
              <label className="field-label">
                Halle / Spot
                <input
                  type="text"
                  className="field-input"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                />
              </label>
            </div>

            <div className="form-row-3">
              <label className="field-label">
                Grad
                <select
                  className="field-select"
                  value={grade}
                  onChange={(e) =>
                    setGrade(e.target.value as (typeof climbingGrades)[number])
                  }
                >
                  {climbingGrades.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Style
                <select
                  className="field-select"
                  value={style}
                  onChange={(e) =>
                    setStyle(e.target.value as (typeof climbingStyles)[number])
                  }
                >
                  {climbingStyles.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Wandwinkel
                <select
                  className="field-select"
                  value={wallAngle}
                  onChange={(e) =>
                    setWallAngle(e.target.value as (typeof wallAngles)[number])
                  }
                >
                  {wallAngles.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-row-3">
              <label className="field-label">
                Versuche
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="field-input"
                  value={attempts}
                  onChange={(e) => setAttempts(e.target.value)}
                  required
                />
              </label>
              <label className="field-label">
                Dauer (Min)
                <input
                  type="number"
                  min={5}
                  max={480}
                  className="field-input"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  required
                />
              </label>
              <label className="field-label">
                Finger/Haut (1–10)
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="field-input"
                  value={skinAndFingerFeel}
                  onChange={(e) => setSkinAndFingerFeel(e.target.value)}
                  required
                />
              </label>
            </div>

            <label
              className="field-label"
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <input
                type="checkbox"
                checked={topped}
                onChange={(e) => setTopped(e.target.checked)}
              />
              <span>Problem getoppt / geschickt</span>
            </label>

            <button
              type="submit"
              className="pastel-btn btn-peach"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Speichere..." : "+ Boulder speichern"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
