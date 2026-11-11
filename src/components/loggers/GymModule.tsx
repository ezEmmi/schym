"use client";

import React, { useState } from "react";
import { Dumbbell, Trophy, Trash2 } from "lucide-react";
import type { GymEntry } from "@/lib/db/schema";

interface GymModuleProps {
  entries: GymEntry[];
  todayIso: string;
  isSubmitting: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<boolean>;
  onDelete: (id: number) => Promise<void>;
}

export function GymModule({
  entries,
  todayIso,
  isSubmitting,
  onSubmit,
  onDelete,
}: GymModuleProps) {
  const [gymDate, setGymDate] = useState(todayIso);
  const [workoutFocus, setWorkoutFocus] = useState("Full Body Strength A");
  const [exerciseName, setExerciseName] = useState("");
  const [sets, setSets] = useState("4");
  const [reps, setReps] = useState("6");
  const [weightKg, setWeightKg] = useState("80");
  const [gymRpe, setGymRpe] = useState("8");
  const [gymNotes, setGymNotes] = useState("");

  return (
    <div className="workspace-grid">
      <section className="panel-card">
        <h2 className="panel-title">
          <Dumbbell size={19} color="var(--accent-gym)" />
          Log Gym Exercise
        </h2>
        <p className="panel-desc">
          Automatically computes your Epley e1RM and tracks your 2x/week strength
          split.
        </p>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await onSubmit({
              sessionDate: gymDate,
              workoutFocus,
              exerciseName,
              sets: Number(sets),
              reps: Number(reps),
              weightKg: Number(weightKg),
              rpe: Number(gymRpe),
              notes: gymNotes,
            });
            if (ok) {
              setExerciseName("");
              setGymNotes("");
            }
          }}
        >
          <div className="form-row-2">
            <label className="field-label">
              Date
              <input
                type="date"
                className="field-input"
                value={gymDate}
                onChange={(e) => setGymDate(e.target.value)}
                required
              />
            </label>
            <label className="field-label">
              Split / Focus
              <input
                type="text"
                className="field-input"
                placeholder="Full Body A / Upper"
                value={workoutFocus}
                onChange={(e) => setWorkoutFocus(e.target.value)}
                required
              />
            </label>
          </div>

          <label className="field-label">
            Exercise Name
            <input
              type="text"
              className="field-input"
              placeholder="e.g., Barbell Bench Press, RDL, Pull-Ups"
              value={exerciseName}
              onChange={(e) => setExerciseName(e.target.value)}
              required
            />
          </label>

          <div className="form-row-3">
            <label className="field-label">
              Sets
              <input
                type="number"
                min={1}
                max={30}
                className="field-input"
                value={sets}
                onChange={(e) => setSets(e.target.value)}
                required
              />
            </label>
            <label className="field-label">
              Reps
              <input
                type="number"
                min={1}
                max={100}
                className="field-input"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                required
              />
            </label>
            <label className="field-label">
              Load (kg)
              <input
                type="number"
                step="0.5"
                min={0}
                max={600}
                className="field-input"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                required
              />
            </label>
          </div>

          <div className="form-row-2">
            <label className="field-label">
              RPE (1–10)
              <input
                type="number"
                step="0.5"
                min={1}
                max={10}
                className="field-input"
                value={gymRpe}
                onChange={(e) => setGymRpe(e.target.value)}
                required
              />
            </label>
            <label className="field-label">
              Notes
              <input
                type="text"
                className="field-input"
                placeholder="Tempo, cues, PR..."
                value={gymNotes}
                onChange={(e) => setGymNotes(e.target.value)}
              />
            </label>
          </div>

          <button
            type="submit"
            className="submit-btn btn-gym"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "+ Save Gym Set"}
          </button>
        </form>
      </section>

      <section className="panel-card">
        <h2 className="panel-title">
          <Trophy size={19} color="var(--accent-gym)" />
          Gym Strength Log
        </h2>
        <p className="panel-desc">
          Showing logged sets, volume, and Epley estimated 1-Rep Max.
        </p>
        <div className="session-list">
          {entries.map((item) => (
            <div key={item.id} className="session-item">
              <div className="session-main">
                <div className="session-header">
                  <span className="session-title">{item.exerciseName}</span>
                  <span className="badge badge-gym">{item.workoutFocus}</span>
                  <span
                    style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}
                  >
                    {item.sessionDate}
                  </span>
                </div>
                <div className="session-stats">
                  <span>
                    <strong>
                      {item.sets} × {item.reps}
                    </strong>{" "}
                    @ {item.weightKg} kg
                  </span>
                  <span>e1RM: {item.estimated1Rm} kg</span>
                  <span>RPE {item.rpe}</span>
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
