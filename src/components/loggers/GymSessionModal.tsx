"use client";

import React, { useState, useEffect } from "react";
import {
  Dumbbell,
  Play,
  Plus,
  Sparkles,
  Trash2,
  X,
  Check,
  TrendingUp,
  Timer,
  Trophy,
} from "lucide-react";
import type {
  GymEntry,
  MuscleGroup,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from "@/lib/db/schema";
import {
  MUSCLE_GROUPS,
  computeOverloadSuggestion,
  inferMuscleGroupFromExercise,
} from "@/lib/muscles";
import { calculateEstimated1Rm } from "@/lib/metrics";

interface GymSessionModalProps {
  templates: WorkoutTemplate[];
  gymHistory: GymEntry[];
  todayIso: string;
  onClose: () => void;
  onSaveGymSet: (payload: Record<string, unknown>) => Promise<boolean>;
  onSaveTemplate: (payload: Record<string, unknown>) => Promise<boolean>;
  onDeleteTemplate: (id: number) => Promise<void>;
}

export function GymSessionModal({
  templates,
  gymHistory,
  todayIso,
  onClose,
  onSaveGymSet,
  onSaveTemplate,
  onDeleteTemplate,
}: GymSessionModalProps) {
  const [mode, setMode] = useState<"choose" | "active" | "builder">(
    templates.length > 0 ? "choose" : "builder"
  );
  const [activeWorkoutName, setActiveWorkoutName] = useState("Mein Gym Workout");
  const [sessionExercises, setSessionExercises] = useState<
    Array<{
      name: string;
      muscleGroup: MuscleGroup;
      sets: string;
      reps: string;
      weightKg: string;
      rpe: string;
      logged: boolean;
      isNewPr: boolean;
      coachHint: string;
      shouldIncrease: boolean;
    }>
  >([]);

  // Live Rest-Timer State (in seconds)
  const [restDurationPref, setRestDurationPref] = useState<number>(90);
  const [restSecondsLeft, setRestSecondsLeft] = useState<number>(0);

  useEffect(() => {
    if (restSecondsLeft <= 0) return;
    const interval = setInterval(() => {
      setRestSecondsLeft((prev) => {
        if (prev <= 1) {
          // Play subtle Web Audio chime when rest timer finishes
          try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = 660;
            gain.gain.value = 0.08;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.25);
          } catch {
            // AudioContext may be blocked
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [restSecondsLeft]);

  // Builder state
  const [newPlanName, setNewPlanName] = useState("");
  const [draftExercises, setDraftExercises] = useState<
    WorkoutTemplateExercise[]
  >([]);
  const [exNameInput, setExNameInput] = useState("");
  const [exMuscleInput, setExMuscleInput] = useState<MuscleGroup>("chest");
  const [exSetsInput, setExSetsInput] = useState("3");
  const [exRepsInput, setExRepsInput] = useState("8");
  const [exWeightInput, setExWeightInput] = useState("40");

  // Quick add single machine inside active workout
  const [quickMachineName, setQuickMachineName] = useState("");
  const [quickMuscle, setQuickMuscle] = useState<MuscleGroup>("chest");

  function checkIsPersonalRecord(
    exerciseName: string,
    weightKg: number,
    reps: number
  ): boolean {
    const norm = exerciseName.trim().toLowerCase();
    const pastEntries = gymHistory.filter(
      (h) => h.exerciseName.trim().toLowerCase() === norm
    );
    if (pastEntries.length === 0) return false;
    const pastMax1Rm = Math.max(...pastEntries.map((h) => h.estimated1Rm));
    const current1Rm = calculateEstimated1Rm(weightKg, reps);
    return current1Rm > pastMax1Rm;
  }

  function startFromTemplate(tpl: WorkoutTemplate) {
    setActiveWorkoutName(tpl.name);
    const prepared = tpl.exercises.map((ex) => {
      const suggestion = computeOverloadSuggestion(
        ex.name,
        ex.targetReps,
        ex.defaultWeightKg,
        gymHistory
      );
      return {
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        sets: String(ex.targetSets),
        reps: String(suggestion.suggestedReps),
        weightKg: String(suggestion.suggestedWeightKg),
        rpe: "8",
        logged: false,
        isNewPr: checkIsPersonalRecord(
          ex.name,
          suggestion.suggestedWeightKg,
          suggestion.suggestedReps
        ),
        coachHint: suggestion.reason,
        shouldIncrease: suggestion.shouldIncrease,
      };
    });
    setSessionExercises(prepared);
    setMode("active");
  }

  function startFreestyleSession() {
    setActiveWorkoutName("Freestyle Gym Session");
    setSessionExercises([]);
    setMode("active");
  }

  function addMachineToActiveSession() {
    if (quickMachineName.trim().length < 2) return;
    const suggestion = computeOverloadSuggestion(
      quickMachineName,
      8,
      40,
      gymHistory
    );
    setSessionExercises((prev) => [
      ...prev,
      {
        name: quickMachineName.trim(),
        muscleGroup: quickMuscle,
        sets: "3",
        reps: String(suggestion.suggestedReps),
        weightKg: String(suggestion.suggestedWeightKg),
        rpe: "8",
        logged: false,
        isNewPr: checkIsPersonalRecord(
          quickMachineName.trim(),
          suggestion.suggestedWeightKg,
          suggestion.suggestedReps
        ),
        coachHint: suggestion.reason,
        shouldIncrease: suggestion.shouldIncrease,
      },
    ]);
    setQuickMachineName("");
  }

  async function logSingleMachine(idx: number) {
    const item = sessionExercises[idx];
    if (!item) return;
    const w = Number(item.weightKg);
    const r = Number(item.reps);
    const isPr = checkIsPersonalRecord(item.name, w, r);

    const ok = await onSaveGymSet({
      sessionDate: todayIso,
      workoutFocus: activeWorkoutName,
      exerciseName: item.name,
      muscleGroup: item.muscleGroup,
      sets: Number(item.sets),
      reps: r,
      weightKg: w,
      rpe: Number(item.rpe),
      notes: isPr
        ? "🏆 Neuer PR!"
        : item.shouldIncrease
        ? "Progressive Overload +2.5kg"
        : "",
    });
    if (ok) {
      setSessionExercises((prev) =>
        prev.map((row, i) =>
          i === idx ? { ...row, logged: true, isNewPr: isPr } : row
        )
      );
      // Automatically start rest timer!
      setRestSecondsLeft(restDurationPref);
    }
  }

  function addExerciseToBuilderDraft() {
    if (exNameInput.trim().length < 2) return;
    setDraftExercises((prev) => [
      ...prev,
      {
        name: exNameInput.trim(),
        muscleGroup: exMuscleInput,
        targetSets: Number(exSetsInput) || 3,
        targetReps: Number(exRepsInput) || 8,
        defaultWeightKg: Number(exWeightInput) || 0,
      },
    ]);
    setExNameInput("");
  }

  async function saveNewWorkoutTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (newPlanName.trim().length < 2 || draftExercises.length === 0) return;
    const ok = await onSaveTemplate({
      name: newPlanName.trim(),
      exercises: draftExercises,
    });
    if (ok) {
      setNewPlanName("");
      setDraftExercises([]);
      setMode("choose");
    }
  }

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-sheet">
        {/* Modal Header */}
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
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: "rgba(203, 166, 247, 0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--pastel-lavender)",
              }}
            >
              <Dumbbell size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800 }}>
                Gym Live-Modus, Rest-Timer &amp; Smart Coach
              </h2>
              <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                Starte deine gelernten Hevy-Pläne, tracke PRs &amp; nutze den
                automatischen Satzpausen-Timer
              </p>
            </div>
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

        {/* Live Rest-Timer Bar */}
        <div
          style={{
            background:
              restSecondsLeft > 0
                ? "rgba(166, 227, 161, 0.14)"
                : "var(--bg-soft)",
            border:
              restSecondsLeft > 0
                ? "1px solid var(--pastel-mint)"
                : "1px solid var(--border-subtle)",
            borderRadius: 14,
            padding: "0.65rem 1rem",
            marginBottom: "1.1rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
            <Timer
              size={18}
              color={
                restSecondsLeft > 0
                  ? "var(--pastel-mint)"
                  : "var(--text-secondary)"
              }
            />
            <span style={{ fontSize: "0.84rem", fontWeight: 700 }}>
              {restSecondsLeft > 0
                ? `Satzpause läuft: ${formatTimer(restSecondsLeft)}`
                : "Automatischer Pausen-Timer nach jedem Satz:"}
            </span>
          </div>

          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            {[60, 90, 120, 180].map((sec) => (
              <button
                key={sec}
                type="button"
                className={`pill-tab ${
                  restDurationPref === sec ? "active" : ""
                }`}
                style={{ padding: "0.25rem 0.6rem", fontSize: "0.74rem" }}
                onClick={() => {
                  setRestDurationPref(sec);
                  setRestSecondsLeft(sec);
                }}
              >
                {sec}s
              </button>
            ))}
            {restSecondsLeft > 0 && (
              <>
                <button
                  type="button"
                  className="pill-tab"
                  style={{ padding: "0.25rem 0.6rem", fontSize: "0.74rem" }}
                  onClick={() => setRestSecondsLeft((s) => s + 15)}
                >
                  +15s
                </button>
                <button
                  type="button"
                  className="pill-tab"
                  style={{
                    padding: "0.25rem 0.6rem",
                    fontSize: "0.74rem",
                    color: "var(--danger)",
                  }}
                  onClick={() => setRestSecondsLeft(0)}
                >
                  Skip
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mode Switcher Pills */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            marginBottom: "1.2rem",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className={`pill-tab ${mode === "choose" ? "active" : ""}`}
            onClick={() => setMode("choose")}
          >
            Meine Pläne ({templates.length})
          </button>
          <button
            type="button"
            className={`pill-tab ${mode === "builder" ? "active" : ""}`}
            onClick={() => setMode("builder")}
          >
            + Eigenen Plan bauen
          </button>
          <button
            type="button"
            className={`pill-tab ${mode === "active" ? "active" : ""}`}
            onClick={startFreestyleSession}
          >
            Freestyle Session starten
          </button>
        </div>

        {/* 1. CHOOSE SAVED WORKOUT TEMPLATE */}
        {mode === "choose" && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}
          >
            {templates.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "2rem 1rem",
                  background: "var(--bg-soft)",
                  borderRadius: 16,
                  border: "1px dashed var(--border-subtle)",
                }}
              >
                <p style={{ fontWeight: 700, marginBottom: "0.4rem" }}>
                  Noch kein eigener Gym-Plan gespeichert
                </p>
                <p
                  style={{
                    fontSize: "0.84rem",
                    color: "var(--text-secondary)",
                    marginBottom: "1rem",
                  }}
                >
                  Importiere einmalig deine kostenlose Hevy-CSV (unter „Strava
                  &amp; Hevy Sync“) — dann sind alle deine Pläne sofort hier
                  drin! Oder bau dir hier direkt deinen eigenen Plan:
                </p>
                <button
                  type="button"
                  className="pastel-btn btn-lavender"
                  onClick={() => setMode("builder")}
                >
                  + Ersten eigenen Gym-Plan erstellen
                </button>
              </div>
            ) : (
              templates.map((tpl) => (
                <div
                  key={tpl.id}
                  style={{
                    background: "var(--bg-soft)",
                    borderRadius: 16,
                    padding: "1.1rem",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: "1.02rem",
                        marginBottom: "0.3rem",
                      }}
                    >
                      {tpl.name}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.4rem",
                      }}
                    >
                      {tpl.exercises.map((ex, i) => (
                        <span
                          key={`${tpl.id}-${i}`}
                          style={{
                            fontSize: "0.75rem",
                            padding: "0.2rem 0.55rem",
                            borderRadius: 999,
                            background: "rgba(255,255,255,0.06)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {ex.name} ({ex.targetSets}×{ex.targetReps} @{" "}
                          {ex.defaultWeightKg}kg)
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      className="pastel-btn btn-lavender"
                      onClick={() => startFromTemplate(tpl)}
                    >
                      <Play size={15} />
                      <span>Starten</span>
                    </button>
                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => onDeleteTemplate(tpl.id)}
                      title="Plan löschen"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 2. CUSTOM WORKOUT BUILDER */}
        {mode === "builder" && (
          <form
            onSubmit={saveNewWorkoutTemplate}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <label className="field-label">
              Name deines Workouts (z. B. „Gym Tag A — Ganzkörper“ oder „Push“)
              <input
                type="text"
                className="field-input"
                placeholder="Workout Name eingeben..."
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                required
              />
            </label>

            <div
              style={{
                background: "var(--bg-soft)",
                padding: "1rem",
                borderRadius: 14,
                border: "1px solid var(--border-subtle)",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div style={{ fontSize: "0.84rem", fontWeight: 700 }}>
                Maschine / Übung zum Plan hinzufügen
              </div>
              <div className="form-row-2">
                <label className="field-label">
                  Maschine / Übung
                  <input
                    type="text"
                    className="field-input"
                    placeholder="z.B. Brustpresse, Latzug, Beinpresse..."
                    value={exNameInput}
                    onChange={(e) => {
                      setExNameInput(e.target.value);
                      setExMuscleInput(
                        inferMuscleGroupFromExercise(e.target.value)
                      );
                    }}
                  />
                </label>
                <label className="field-label">
                  Ziel-Muskel (für Körper-Map)
                  <select
                    className="field-select"
                    value={exMuscleInput}
                    onChange={(e) =>
                      setExMuscleInput(e.target.value as MuscleGroup)
                    }
                  >
                    {MUSCLE_GROUPS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="form-row-3">
                <label className="field-label">
                  Sätze
                  <input
                    type="number"
                    min={1}
                    max={20}
                    className="field-input"
                    value={exSetsInput}
                    onChange={(e) => setExSetsInput(e.target.value)}
                  />
                </label>
                <label className="field-label">
                  Ziel-Wdh. (Reps)
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className="field-input"
                    value={exRepsInput}
                    onChange={(e) => setExRepsInput(e.target.value)}
                  />
                </label>
                <label className="field-label">
                  Start-Gewicht (kg)
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    max={600}
                    className="field-input"
                    value={exWeightInput}
                    onChange={(e) => setExWeightInput(e.target.value)}
                  />
                </label>
              </div>

              <button
                type="button"
                className="pastel-btn btn-mint"
                onClick={addExerciseToBuilderDraft}
              >
                <Plus size={16} />
                <span>Maschine zur Liste hinzufügen</span>
              </button>
            </div>

            {draftExercises.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.45rem",
                }}
              >
                <div style={{ fontSize: "0.8rem", fontWeight: 700 }}>
                  Übungen in diesem Plan ({draftExercises.length}):
                </div>
                {draftExercises.map((ex, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.6rem 0.85rem",
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.04)",
                      fontSize: "0.85rem",
                    }}
                  >
                    <span>
                      <strong>{ex.name}</strong> • {ex.targetSets}×
                      {ex.targetReps} @ {ex.defaultWeightKg} kg
                    </span>
                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() =>
                        setDraftExercises((prev) =>
                          prev.filter((_, idx) => idx !== i)
                        )
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="submit"
              className="pastel-btn btn-lavender"
              disabled={
                newPlanName.trim().length < 2 || draftExercises.length === 0
              }
            >
              Plan speichern &amp; bereitmachen
            </button>
          </form>
        )}

        {/* 3. ACTIVE LIVE GYM WORKOUT */}
        {mode === "active" && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>
                Aktives Workout: {activeWorkoutName}
              </div>
              <span
                style={{
                  fontSize: "0.76rem",
                  color: "var(--pastel-mint)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Sparkles size={14} /> Smart Overload &amp; PR-Erkennung aktiv
              </span>
            </div>

            {/* Quick Add Machine inside Live Session */}
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                flexWrap: "wrap",
                background: "var(--bg-soft)",
                padding: "0.75rem",
                borderRadius: 12,
              }}
            >
              <input
                type="text"
                className="field-input"
                style={{ flex: 2, minWidth: 180 }}
                placeholder="Spontan Maschine hinzufügen (z.B. Seitheben Maschine)..."
                value={quickMachineName}
                onChange={(e) => {
                  setQuickMachineName(e.target.value);
                  setQuickMuscle(inferMuscleGroupFromExercise(e.target.value));
                }}
              />
              <select
                className="field-select"
                style={{ flex: 1, minWidth: 140 }}
                value={quickMuscle}
                onChange={(e) => setQuickMuscle(e.target.value as MuscleGroup)}
              >
                {MUSCLE_GROUPS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="pastel-btn btn-mint"
                onClick={addMachineToActiveSession}
              >
                + Hinzufügen
              </button>
            </div>

            {/* Machine Cards */}
            {sessionExercises.map((ex, idx) => (
              <div
                key={`${ex.name}-${idx}`}
                style={{
                  background: ex.logged
                    ? "rgba(166, 227, 161, 0.08)"
                    : "var(--bg-soft)",
                  border: ex.logged
                    ? "1px solid rgba(166, 227, 161, 0.4)"
                    : "1px solid var(--border-subtle)",
                  borderRadius: 16,
                  padding: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: "1rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span>{ex.name}</span>
                      {ex.isNewPr && (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            padding: "0.15rem 0.55rem",
                            borderRadius: 999,
                            background: "rgba(250, 179, 135, 0.2)",
                            color: "var(--pastel-peach)",
                            border: "1px solid rgba(250, 179, 135, 0.45)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Trophy size={12} /> Neuer PR!
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: "0.78rem",
                        color: ex.shouldIncrease
                          ? "var(--pastel-mint)"
                          : "var(--text-secondary)",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        marginTop: 2,
                      }}
                    >
                      {ex.shouldIncrease && <TrendingUp size={14} />}
                      <span>{ex.coachHint}</span>
                    </div>
                  </div>
                  {ex.logged && (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        color: "var(--pastel-mint)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Check size={15} /> Geloggt &amp; Pause gestartet!
                    </span>
                  )}
                </div>

                <div className="form-row-3">
                  <label className="field-label">
                    Sätze
                    <input
                      type="number"
                      min={1}
                      max={30}
                      className="field-input"
                      value={ex.sets}
                      onChange={(e) =>
                        setSessionExercises((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, sets: e.target.value } : r
                          )
                        )
                      }
                    />
                  </label>
                  <label className="field-label">
                    Wdh. (Reps)
                    <input
                      type="number"
                      min={1}
                      max={100}
                      className="field-input"
                      value={ex.reps}
                      onChange={(e) => {
                        const nextReps = e.target.value;
                        setSessionExercises((prev) =>
                          prev.map((r, i) =>
                            i === idx
                              ? {
                                  ...r,
                                  reps: nextReps,
                                  isNewPr: checkIsPersonalRecord(
                                    r.name,
                                    Number(r.weightKg),
                                    Number(nextReps)
                                  ),
                                }
                              : r
                          )
                        );
                      }}
                    />
                  </label>
                  <label className="field-label">
                    Gewicht (kg)
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      max={600}
                      className="field-input"
                      value={ex.weightKg}
                      onChange={(e) => {
                        const nextW = e.target.value;
                        setSessionExercises((prev) =>
                          prev.map((r, i) =>
                            i === idx
                              ? {
                                  ...r,
                                  weightKg: nextW,
                                  isNewPr: checkIsPersonalRecord(
                                    r.name,
                                    Number(nextW),
                                    Number(r.reps)
                                  ),
                                }
                              : r
                          )
                        );
                      }}
                    />
                  </label>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.75rem",
                  }}
                >
                  <label
                    className="field-label"
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span>Anstrengung (RPE 1–10):</span>
                    <input
                      type="number"
                      step="0.5"
                      min={1}
                      max={10}
                      className="field-input"
                      style={{ width: 75 }}
                      value={ex.rpe}
                      onChange={(e) =>
                        setSessionExercises((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, rpe: e.target.value } : r
                          )
                        )
                      }
                    />
                  </label>

                  <button
                    type="button"
                    className="pastel-btn btn-lavender"
                    onClick={() => logSingleMachine(idx)}
                  >
                    {ex.logged
                      ? "Nochmal speichern"
                      : `Satz abhaken & ${restDurationPref}s Pause ✓`}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
