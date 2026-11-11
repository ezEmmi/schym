"use client";

import React, { useState } from "react";
import { Mountain, CheckCircle2, Trash2 } from "lucide-react";
import type { BoulderingSession } from "@/lib/db/schema";
import {
  climbingGrades,
  climbingStyles,
  wallAngles,
} from "@/lib/validation/fitness";

interface BoulderingModuleProps {
  entries: BoulderingSession[];
  todayIso: string;
  isSubmitting: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<boolean>;
  onDelete: (id: number) => Promise<void>;
}

export function BoulderingModule({
  entries,
  todayIso,
  isSubmitting,
  onSubmit,
  onDelete,
}: BoulderingModuleProps) {
  const [boulderDate, setBoulderDate] = useState(todayIso);
  const [location, setLocation] = useState("Boulderhalle Main");
  const [grade, setGrade] = useState<(typeof climbingGrades)[number]>("6B+");
  const [style, setStyle] = useState<(typeof climbingStyles)[number]>("Flash");
  const [wallAngle, setWallAngle] =
    useState<(typeof wallAngles)[number]>("Overhang");
  const [attempts, setAttempts] = useState("2");
  const [topped, setTopped] = useState(true);
  const [boulderDuration, setBoulderDuration] = useState("90");
  const [skinAndFingerFeel, setSkinAndFingerFeel] = useState("8");
  const [boulderNotes, setBoulderNotes] = useState("");

  return (
    <div className="workspace-grid">
      <section className="panel-card">
        <h2 className="panel-title">
          <Mountain size={19} color="var(--accent-boulder)" />
          Log Boulder Problem / Session
        </h2>
        <p className="panel-desc">
          Track Font or V grades, wall angles, flash/project attempts, and finger
          health.
        </p>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await onSubmit({
              sessionDate: boulderDate,
              location,
              grade,
              style,
              wallAngle,
              attempts: Number(attempts),
              topped,
              durationMinutes: Number(boulderDuration),
              skinAndFingerFeel: Number(skinAndFingerFeel),
              notes: boulderNotes,
            });
            if (ok) {
              setBoulderNotes("");
            }
          }}
        >
          <div className="form-row-2">
            <label className="field-label">
              Date
              <input
                type="date"
                className="field-input"
                value={boulderDate}
                onChange={(e) => setBoulderDate(e.target.value)}
                required
              />
            </label>
            <label className="field-label">
              Gym / Crag
              <input
                type="text"
                className="field-input"
                placeholder="e.g., Boulderwelt"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </label>
          </div>

          <div className="form-row-3">
            <label className="field-label">
              Grade
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
              Wall Angle
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
              Attempts
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
              Session (min)
              <input
                type="number"
                min={5}
                max={480}
                className="field-input"
                value={boulderDuration}
                onChange={(e) => setBoulderDuration(e.target.value)}
                required
              />
            </label>
            <label className="field-label">
              Finger/Skin (1–10)
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

          <div className="form-row-2">
            <label
              className="field-label"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: "0.5rem",
                paddingTop: "1.1rem",
              }}
            >
              <input
                type="checkbox"
                checked={topped}
                onChange={(e) => setTopped(e.target.checked)}
              />
              <span>Topped / Sent Problem</span>
            </label>
            <label className="field-label">
              Beta / Notes
              <input
                type="text"
                className="field-input"
                placeholder="Heel hook, crimp crux..."
                value={boulderNotes}
                onChange={(e) => setBoulderNotes(e.target.value)}
              />
            </label>
          </div>

          <button
            type="submit"
            className="submit-btn btn-boulder"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "+ Log Boulder Problem"}
          </button>
        </form>
      </section>

      <section className="panel-card">
        <h2 className="panel-title">
          <CheckCircle2 size={19} color="var(--accent-boulder)" />
          Bouldering Sends &amp; Projects
        </h2>
        <p className="panel-desc">
          Showing grades, wall angles, attempts, and finger/skin recovery score.
        </p>
        <div className="session-list">
          {entries.map((item) => (
            <div key={item.id} className="session-item">
              <div className="session-main">
                <div className="session-header">
                  <span className="session-title">
                    Grade {item.grade} • {item.location}
                  </span>
                  <span className="badge badge-boulder">
                    {item.topped
                      ? `SENT (${item.style})`
                      : `PROJECT (${item.style})`}
                  </span>
                  <span
                    style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}
                  >
                    {item.sessionDate}
                  </span>
                </div>
                <div className="session-stats">
                  <span>Wall: {item.wallAngle}</span>
                  <span>Attempts: {item.attempts}</span>
                  <span>Session: {item.durationMinutes} min</span>
                  <span>Skin/Fingers: {item.skinAndFingerFeel}/10</span>
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
