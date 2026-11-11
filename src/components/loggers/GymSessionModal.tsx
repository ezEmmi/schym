"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Minus,
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

export interface SetRowState {
  setNumber: number;
  setType: "normal" | "warmup" | "dropset";
  weightKg: string;
  reps: string;
  rpe: string;
  done: boolean;
}

export interface SessionExerciseState {
  name: string;
  muscleGroup: MuscleGroup;
  seatNote: string;
  previousSummary: string;
  coachHint: string;
  shouldIncrease: boolean;
  logged: boolean;
  isNewPr: boolean;
  setRows: SetRowState[];
}

interface GymSessionModalProps {
  templates: WorkoutTemplate[];
  gymHistory: GymEntry[];
  todayIso: string;
  initialTemplateName?: string | null;
  recommendedTemplateName?: string | null;
  onClose: () => void;
  onSaveGymSet: (payload: Record<string, unknown>) => Promise<boolean>;
  onSaveTemplate: (payload: Record<string, unknown>) => Promise<boolean>;
  onDeleteTemplate: (id: number) => Promise<void>;
}

export function GymSessionModal({
  templates,
  gymHistory,
  todayIso,
  initialTemplateName,
  recommendedTemplateName,
  onClose,
  onSaveGymSet,
  onSaveTemplate,
  onDeleteTemplate,
}: GymSessionModalProps) {
  const [mode, setMode] = useState<"choose" | "active" | "builder">(
    templates.length > 0 ? "choose" : "builder"
  );
  const [expandedTplId, setExpandedTplId] = useState<number | null>(null);
  const [activeWorkoutName, setActiveWorkoutName] =
    useState("Mein Gym Workout");
  const [sessionExercises, setSessionExercises] = useState<
    SessionExerciseState[]
  >([]);

  // Live Rest-Timer State (in seconds)
  const [restDurationPref, setRestDurationPref] = useState<number>(90);
  const [restSecondsLeft, setRestSecondsLeft] = useState<number>(0);

  const checkIsPersonalRecord = useCallback(
    (exerciseName: string, weightKg: number, reps: number): boolean => {
      const norm = exerciseName.trim().toLowerCase();
      const pastEntries = gymHistory.filter(
        (h) => h.exerciseName.trim().toLowerCase() === norm
      );
      if (pastEntries.length === 0) return false;
      const pastMax1Rm = Math.max(...pastEntries.map((h) => h.estimated1Rm));
      const current1Rm = calculateEstimated1Rm(weightKg, reps);
      return current1Rm > pastMax1Rm;
    },
    [gymHistory]
  );

  const buildExerciseState = useCallback(
    (
      name: string,
      muscleGroup: MuscleGroup,
      targetSets: number,
      targetReps: number,
      defaultWeightKg: number
    ): SessionExerciseState => {
      const norm = name.trim().toLowerCase();
      const pastEntries = gymHistory.filter(
        (h) => h.exerciseName.trim().toLowerCase() === norm
      );
      const latest = pastEntries[0];
      const savedNoteEntry = pastEntries.find(
        (h) =>
          h.notes &&
          h.notes.trim().length > 0 &&
          h.notes !== "Hevy Import" &&
          !h.notes.startsWith("Sätze:")
      );

      const suggestion = computeOverloadSuggestion(
        name,
        targetReps,
        defaultWeightKg,
        gymHistory
      );

      const count = Math.max(1, Math.min(10, targetSets || 3));
      const rows: SetRowState[] = Array.from({ length: count }, (_, idx) => ({
        setNumber: idx + 1,
        setType: "normal",
        weightKg: String(suggestion.suggestedWeightKg),
        reps: String(suggestion.suggestedReps),
        rpe: idx === count - 1 ? "9" : "8",
        done: false,
      }));

      return {
        name,
        muscleGroup,
        seatNote: savedNoteEntry?.notes ?? "",
        previousSummary: latest
          ? `Zuletzt (${latest.sessionDate}): ${latest.weightKg} kg × ${latest.reps} Wdh`
          : `Startwert: ${defaultWeightKg} kg × ${targetReps} Wdh`,
        coachHint: suggestion.reason,
        shouldIncrease: suggestion.shouldIncrease,
        logged: false,
        isNewPr: checkIsPersonalRecord(
          name,
          suggestion.suggestedWeightKg,
          suggestion.suggestedReps
        ),
        setRows: rows,
      };
    },
    [gymHistory, checkIsPersonalRecord]
  );

  const startFromTemplate = useCallback(
    (tpl: WorkoutTemplate) => {
      setActiveWorkoutName(tpl.name);
      const prepared = tpl.exercises.map((ex) =>
        buildExerciseState(
          ex.name,
          ex.muscleGroup,
          ex.targetSets,
          ex.targetReps,
          ex.defaultWeightKg
        )
      );
      setSessionExercises(prepared);
      setMode("active");
    },
    [buildExerciseState]
  );

  // If initialTemplateName was passed (e.g. from the 7-day Future Planner), open that workout immediately!
  useEffect(() => {
    if (initialTemplateName && templates.length > 0) {
      const match = templates.find(
        (t) => t.name.toLowerCase() === initialTemplateName.toLowerCase()
      );
      if (match) {
        startFromTemplate(match);
      }
    }
  }, [initialTemplateName, templates, startFromTemplate]);

  useEffect(() => {
    if (restSecondsLeft <= 0) return;
    const interval = setInterval(() => {
      setRestSecondsLeft((prev) => {
        if (prev <= 1) {
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
  const [exRepsInput, setExRepsInput] = useState("10");
  const [exWeightInput, setExWeightInput] = useState("25");

  // Quick add single machine inside active workout
  const [quickMachineName, setQuickMachineName] = useState("");
  const [quickMuscle, setQuickMuscle] = useState<MuscleGroup>("chest");

  function startFreestyleSession() {
    setActiveWorkoutName("Freestyle Gym Session");
    setSessionExercises([]);
    setMode("active");
  }

  function addMachineToActiveSession() {
    if (quickMachineName.trim().length < 2) return;
    const newEx = buildExerciseState(
      quickMachineName.trim(),
      quickMuscle,
      3,
      10,
      20
    );
    setSessionExercises((prev) => [...prev, newEx]);
    setQuickMachineName("");
  }

  function updateSetRow(
    exIdx: number,
    setIdx: number,
    patch: Partial<SetRowState>
  ) {
    setSessionExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const nextRows = ex.setRows.map((row, rIdx) =>
          rIdx === setIdx ? { ...row, ...patch } : row
        );
        const workingRows = nextRows.filter((r) => r.setType !== "warmup");
        const bestRow =
          workingRows.sort(
            (a, b) =>
              calculateEstimated1Rm(Number(b.weightKg), Number(b.reps)) -
              calculateEstimated1Rm(Number(a.weightKg), Number(a.reps))
          )[0] ?? nextRows[0];

        const isPr = bestRow
          ? checkIsPersonalRecord(
              ex.name,
              Number(bestRow.weightKg),
              Number(bestRow.reps)
            )
          : false;

        return {
          ...ex,
          setRows: nextRows,
          isNewPr: isPr,
        };
      })
    );
  }

  function addSetRowToExercise(exIdx: number) {
    setSessionExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const lastRow = ex.setRows[ex.setRows.length - 1];
        const nextRow: SetRowState = {
          setNumber: ex.setRows.length + 1,
          setType: "normal",
          weightKg: lastRow?.weightKg ?? "20",
          reps: lastRow?.reps ?? "10",
          rpe: "9",
          done: false,
        };
        return {
          ...ex,
          setRows: [...ex.setRows, nextRow],
        };
      })
    );
  }

  function removeLastSetRow(exIdx: number) {
    setSessionExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx || ex.setRows.length <= 1) return ex;
        return {
          ...ex,
          setRows: ex.setRows.slice(0, -1),
        };
      })
    );
  }

  async function persistExerciseToDb(ex: SessionExerciseState, exIdx: number) {
    const workingSets = ex.setRows.filter((r) => r.setType !== "warmup");
    const activeSets = workingSets.length > 0 ? workingSets : ex.setRows;

    // Pick best working set by e1RM for main stats, and store full per-set breakdown in notes!
    const sortedBy1Rm = [...activeSets].sort(
      (a, b) =>
        calculateEstimated1Rm(Number(b.weightKg), Number(b.reps)) -
        calculateEstimated1Rm(Number(a.weightKg), Number(a.reps))
    );
    const topSet = sortedBy1Rm[0] ?? ex.setRows[0]!;
    const topWeight = Number(topSet.weightKg) || 0;
    const topReps = Math.max(1, Number(topSet.reps) || 8);
    const maxRpe = Math.min(
      10,
      Math.max(
        1,
        Math.max(...activeSets.map((s) => Number(s.rpe) || 8))
      )
    );
    const isPr = checkIsPersonalRecord(ex.name, topWeight, topReps);

    const setBreakdown = ex.setRows
      .map((r, idx) => {
        const prefix =
          r.setType === "warmup"
            ? "W"
            : r.setType === "dropset"
              ? "D"
              : `S${idx + 1}`;
        return `${prefix}: ${r.weightKg}kg×${r.reps}`;
      })
      .join(" | ");

    const noteParts = [`Sätze: ${setBreakdown}`];
    if (ex.seatNote.trim()) {
      noteParts.push(ex.seatNote.trim());
    }
    if (isPr) {
      noteParts.push("🏆 PR!");
    }

    const ok = await onSaveGymSet({
      sessionDate: todayIso,
      workoutFocus: activeWorkoutName,
      exerciseName: ex.name,
      muscleGroup: ex.muscleGroup,
      sets: activeSets.length,
      reps: topReps,
      weightKg: topWeight,
      rpe: maxRpe,
      notes: noteParts.join(" • ").slice(0, 280),
    });

    if (ok) {
      setSessionExercises((prev) =>
        prev.map((row, i) =>
          i === exIdx
            ? {
                ...row,
                logged: true,
                isNewPr: isPr,
                setRows: row.setRows.map((sr) => ({ ...sr, done: true })),
              }
            : row
        )
      );
    }
  }

  async function handleToggleSingleSetDone(exIdx: number, setIdx: number) {
    const currentEx = sessionExercises[exIdx];
    if (!currentEx) return;
    const targetSet = currentEx.setRows[setIdx];
    if (!targetSet) return;

    const nextDone = !targetSet.done;
    // Start Rest-Timer immediately whenever a set is checked off!
    if (nextDone) {
      setRestSecondsLeft(restDurationPref);
    }

    const updatedRows = currentEx.setRows.map((r, idx) =>
      idx === setIdx ? { ...r, done: nextDone } : r
    );
    const updatedEx: SessionExerciseState = {
      ...currentEx,
      setRows: updatedRows,
    };

    setSessionExercises((prev) =>
      prev.map((ex, i) => (i === exIdx ? updatedEx : ex))
    );

    // If all sets of this machine are now checked off and it wasn't saved yet, auto-save the exercise!
    const allSetsDone = updatedRows.every((r) => r.done);
    if (allSetsDone && !currentEx.logged) {
      await persistExerciseToDb(updatedEx, exIdx);
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
        targetReps: Number(exRepsInput) || 10,
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
      <div className="modal-sheet" style={{ maxWidth: 680 }}>
        {/* Modal Header */}
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
              <h2 style={{ fontSize: "1.12rem", fontWeight: 800 }}>
                Gym Live-Logger (Gewicht &amp; Wdh. pro Satz) 💪
              </h2>
              <p style={{ fontSize: "0.77rem", color: "var(--text-secondary)" }}>
                Trage jeden Satz einzeln ein, hake ihn ab für den Pausen-Timer
                &amp; sieh deine Coach-Zielgewichte
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
            padding: "0.6rem 0.95rem",
            marginBottom: "1rem",
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
            <span style={{ fontSize: "0.83rem", fontWeight: 700 }}>
              {restSecondsLeft > 0
                ? `Satzpause läuft: ${formatTimer(restSecondsLeft)}`
                : "Pausen-Timer (startet automatisch beim Satz-Abhaken ✓):"}
            </span>
          </div>

          <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
            {[60, 90, 120, 180].map((sec) => (
              <button
                key={sec}
                type="button"
                className={`pill-tab ${
                  restDurationPref === sec ? "active" : ""
                }`}
                style={{ padding: "0.24rem 0.55rem", fontSize: "0.73rem" }}
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
                  style={{ padding: "0.24rem 0.55rem", fontSize: "0.73rem" }}
                  onClick={() => setRestSecondsLeft((s) => s + 15)}
                >
                  +15s
                </button>
                <button
                  type="button"
                  className="pill-tab"
                  style={{
                    padding: "0.24rem 0.55rem",
                    fontSize: "0.73rem",
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
            marginBottom: "1.1rem",
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
          {sessionExercises.length > 0 && (
            <button
              type="button"
              className={`pill-tab ${mode === "active" ? "active" : ""}`}
              onClick={() => setMode("active")}
            >
              Laufendes Workout: {activeWorkoutName}
            </button>
          )}
          <button
            type="button"
            className={`pill-tab ${mode === "builder" ? "active" : ""}`}
            onClick={() => setMode("builder")}
          >
            + Eigenen Plan bauen
          </button>
          <button
            type="button"
            className="pill-tab"
            onClick={startFreestyleSession}
          >
            Freestyle Session
          </button>
        </div>

        {/* 1. CHOOSE SAVED WORKOUT TEMPLATE */}
        {mode === "choose" && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}
          >
            {templates.map((tpl) => {
              const isExpanded = expandedTplId === tpl.id;
              const isRecommended =
                recommendedTemplateName &&
                tpl.name.toLowerCase() ===
                  recommendedTemplateName.toLowerCase();

              return (
                <div
                  key={tpl.id}
                  style={{
                    background: isRecommended
                      ? "linear-gradient(135deg, rgba(203, 166, 247, 0.14), rgba(166, 227, 161, 0.08))"
                      : "var(--bg-soft)",
                    borderRadius: 16,
                    padding: "0.95rem 1.1rem",
                    border: isRecommended
                      ? "1.5px solid rgba(203, 166, 247, 0.45)"
                      : "1px solid var(--border-subtle)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.75rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.6rem",
                        flexWrap: "wrap",
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        setExpandedTplId(isExpanded ? null : tpl.id)
                      }
                    >
                      <strong style={{ fontSize: "1.02rem" }}>{tpl.name}</strong>
                      <span className="badge badge-gym">
                        {tpl.exercises.length} Übungen
                      </span>
                      {isRecommended && (
                        <span
                          className="badge badge-cardio"
                          style={{ fontSize: "0.7rem" }}
                        >
                          🔥 Vom Coach als Nächstes geplant
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {isExpanded ? "▲ Einklappen" : "▼ Ziel-Gewichte zeigen"}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        className="pastel-btn btn-lavender"
                        style={{ padding: "0.5rem 0.95rem", fontSize: "0.82rem" }}
                        onClick={() => startFromTemplate(tpl)}
                      >
                        <Play size={14} />
                        <span>Pro-Satz Logger starten</span>
                      </button>
                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() => onDeleteTemplate(tpl.id)}
                        title="Plan löschen"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.4rem",
                        paddingTop: "0.55rem",
                        borderTop: "1px solid var(--border-subtle)",
                      }}
                    >
                      {tpl.exercises.map((ex, i) => {
                        const sug = computeOverloadSuggestion(
                          ex.name,
                          ex.targetReps,
                          ex.defaultWeightKg,
                          gymHistory
                        );
                        return (
                          <span
                            key={`${tpl.id}-${i}`}
                            style={{
                              fontSize: "0.75rem",
                              padding: "0.26rem 0.65rem",
                              borderRadius: 999,
                              background: sug.shouldIncrease
                                ? "rgba(166, 227, 161, 0.14)"
                                : "rgba(255,255,255,0.06)",
                              border: sug.shouldIncrease
                                ? "1px solid rgba(166, 227, 161, 0.35)"
                                : "none",
                              color: "var(--text-secondary)",
                            }}
                          >
                            <strong style={{ color: "var(--text-primary)" }}>
                              {ex.name}
                            </strong>{" "}
                            • Ziel: {ex.targetSets}×{sug.suggestedReps} @{" "}
                            <strong style={{ color: "var(--pastel-lavender)" }}>
                              {sug.suggestedWeightKg} kg
                            </strong>
                            {sug.shouldIncrease ? " 🔼" : ""}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 2. CUSTOM WORKOUT BUILDER */}
        {mode === "builder" && (
          <form
            onSubmit={saveNewWorkoutTemplate}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <label className="field-label">
              Name deines Workouts (z. B. „Drücken“, „Ziehen“ oder „Beine“)
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
                  Standard-Sätze
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

        {/* 3. ACTIVE LIVE GYM WORKOUT (PER-SET WEIGHT & REPS LOGGER!) */}
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
              <div style={{ fontWeight: 800, fontSize: "1.04rem" }}>
                Aktives Workout: {activeWorkoutName}
              </div>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--pastel-mint)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontWeight: 700,
                }}
              >
                <Sparkles size={14} /> Pro-Satz Gewicht &amp; Coach-Ziele aktiv
              </span>
            </div>

            {/* Quick Add Machine inside Live Session */}
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                flexWrap: "wrap",
                background: "var(--bg-soft)",
                padding: "0.7rem",
                borderRadius: 12,
                border: "1px solid var(--border-subtle)",
              }}
            >
              <input
                type="text"
                className="field-input"
                style={{ flex: 2, minWidth: 180 }}
                placeholder="Weitere Maschine spontan hinzufügen (z.B. Beinpresse)..."
                value={quickMachineName}
                onChange={(e) => {
                  setQuickMachineName(e.target.value);
                  setQuickMuscle(inferMuscleGroupFromExercise(e.target.value));
                }}
              />
              <select
                className="field-select"
                style={{ flex: 1, minWidth: 135 }}
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

            {/* Machine Cards with Per-Set Table */}
            {sessionExercises.map((ex, exIdx) => {
              const doneSetsCount = ex.setRows.filter((r) => r.done).length;
              return (
                <div
                  key={`${ex.name}-${exIdx}`}
                  style={{
                    background: ex.logged
                      ? "rgba(166, 227, 161, 0.08)"
                      : "var(--bg-soft)",
                    border: ex.logged
                      ? "1.5px solid rgba(166, 227, 161, 0.45)"
                      : "1px solid var(--border-subtle)",
                    borderRadius: 16,
                    padding: "0.95rem 1.05rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.7rem",
                  }}
                >
                  {/* Exercise Header + Coach Target Hint */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: "0.98rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <span>{ex.name}</span>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            color: "var(--text-muted)",
                            fontWeight: 600,
                          }}
                        >
                          ({ ex.previousSummary })
                        </span>
                        {ex.isNewPr && (
                          <span
                            style={{
                              fontSize: "0.7rem",
                              padding: "0.14rem 0.5rem",
                              borderRadius: 999,
                              background: "rgba(250, 179, 135, 0.2)",
                              color: "var(--pastel-peach)",
                              border: "1px solid rgba(250, 179, 135, 0.45)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Trophy size={11} /> Neuer PR!
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: "0.77rem",
                          color: ex.shouldIncrease
                            ? "var(--pastel-mint)"
                            : "var(--pastel-lavender)",
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          fontWeight: 700,
                        }}
                      >
                        {ex.shouldIncrease && <TrendingUp size={13} />}
                        <span>🎯 Coach-Vorschlag: {ex.coachHint}</span>
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
                        <Check size={15} /> Alle Sätze gespeichert!
                      </span>
                    )}
                  </div>

                  {/* Seat / Machine Note Input */}
                  <div>
                    <input
                      type="text"
                      className="field-input"
                      style={{
                        padding: "0.35rem 0.65rem",
                        fontSize: "0.76rem",
                        background: "rgba(255,255,255,0.03)",
                      }}
                      placeholder="📌 Sitz-/Maschinen-Notiz (z.B. Sitz auf 6, Griff breit)..."
                      value={ex.seatNote}
                      onChange={(e) =>
                        setSessionExercises((prev) =>
                          prev.map((row, i) =>
                            i === exIdx
                              ? { ...row, seatNote: e.target.value }
                              : row
                          )
                        )
                      }
                    />
                  </div>

                  {/* PER-SET TABLE (Satz 1, Satz 2, Satz 3...) */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.4rem",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "56px 1fr 88px 72px 44px",
                        gap: "0.45rem",
                        fontSize: "0.7rem",
                        fontWeight: 800,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        padding: "0 0.25rem",
                      }}
                    >
                      <span>Satz</span>
                      <span>Gewicht (kg)</span>
                      <span>Wdh.</span>
                      <span>RPE</span>
                      <span style={{ textAlign: "center" }}>✓</span>
                    </div>

                    {ex.setRows.map((setRow, setIdx) => {
                      const typeBadge =
                        setRow.setType === "warmup"
                          ? { label: "W 🔥", color: "var(--pastel-peach)" }
                          : setRow.setType === "dropset"
                            ? { label: "D ⚡", color: "var(--pastel-lavender)" }
                            : {
                                label: `#${setIdx + 1}`,
                                color: "var(--text-primary)",
                              };

                      return (
                        <div
                          key={`set-${exIdx}-${setIdx}`}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "56px 1fr 88px 72px 44px",
                            gap: "0.45rem",
                            alignItems: "center",
                            padding: "0.38rem 0.45rem",
                            borderRadius: 10,
                            background: setRow.done
                              ? "rgba(166, 227, 161, 0.14)"
                              : "rgba(255, 255, 255, 0.03)",
                            border: setRow.done
                              ? "1px solid rgba(166, 227, 161, 0.4)"
                              : "1px solid var(--border-subtle)",
                          }}
                        >
                          {/* Set Number / Type Button */}
                          <button
                            type="button"
                            className="pill-tab"
                            style={{
                              padding: "0.28rem 0.35rem",
                              fontSize: "0.74rem",
                              fontWeight: 800,
                              color: typeBadge.color,
                              textAlign: "center",
                            }}
                            title="Klicken für Arbeitssatz / Warmup (W) / Dropset (D)"
                            onClick={() => {
                              const nextType =
                                setRow.setType === "normal"
                                  ? "warmup"
                                  : setRow.setType === "warmup"
                                    ? "dropset"
                                    : "normal";
                              updateSetRow(exIdx, setIdx, {
                                setType: nextType,
                              });
                            }}
                          >
                            {typeBadge.label}
                          </button>

                          {/* Weight (kg) per Set + Quick -/+ Buttons */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <button
                              type="button"
                              className="pill-tab"
                              style={{ padding: "0.25rem 0.45rem", fontSize: "0.72rem" }}
                              onClick={() => {
                                const nextW = Math.max(
                                  0,
                                  (Number(setRow.weightKg) || 0) - 2.5
                                );
                                updateSetRow(exIdx, setIdx, {
                                  weightKg: String(nextW),
                                });
                              }}
                              title="-2.5 kg"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              step="0.5"
                              min={0}
                              max={600}
                              className="field-input"
                              style={{
                                padding: "0.32rem 0.45rem",
                                fontSize: "0.84rem",
                                fontWeight: 700,
                                textAlign: "center",
                              }}
                              value={setRow.weightKg}
                              onChange={(e) =>
                                updateSetRow(exIdx, setIdx, {
                                  weightKg: e.target.value,
                                })
                              }
                            />
                            <button
                              type="button"
                              className="pill-tab"
                              style={{ padding: "0.25rem 0.45rem", fontSize: "0.72rem" }}
                              onClick={() => {
                                const nextW =
                                  (Number(setRow.weightKg) || 0) + 2.5;
                                updateSetRow(exIdx, setIdx, {
                                  weightKg: String(nextW),
                                });
                              }}
                              title="+2.5 kg"
                            >
                              +
                            </button>
                          </div>

                          {/* Reps per Set */}
                          <input
                            type="number"
                            min={1}
                            max={100}
                            className="field-input"
                            style={{
                              padding: "0.32rem 0.45rem",
                              fontSize: "0.84rem",
                              fontWeight: 700,
                              textAlign: "center",
                            }}
                            value={setRow.reps}
                            onChange={(e) =>
                              updateSetRow(exIdx, setIdx, {
                                reps: e.target.value,
                              })
                            }
                          />

                          {/* RPE per Set */}
                          <input
                            type="number"
                            step="0.5"
                            min={1}
                            max={10}
                            className="field-input"
                            style={{
                              padding: "0.32rem 0.4rem",
                              fontSize: "0.8rem",
                              textAlign: "center",
                            }}
                            value={setRow.rpe}
                            onChange={(e) =>
                              updateSetRow(exIdx, setIdx, {
                                rpe: e.target.value,
                              })
                            }
                          />

                          {/* Checkmark Set Done + Trigger Rest Timer */}
                          <button
                            type="button"
                            onClick={() =>
                              void handleToggleSingleSetDone(exIdx, setIdx)
                            }
                            style={{
                              height: 32,
                              borderRadius: 8,
                              border: setRow.done
                                ? "1px solid var(--pastel-mint)"
                                : "1px solid var(--border-subtle)",
                              background: setRow.done
                                ? "var(--pastel-mint)"
                                : "rgba(255,255,255,0.06)",
                              color: setRow.done
                                ? "#11111b"
                                : "var(--text-secondary)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              fontWeight: 800,
                            }}
                            title={`Satz #${setIdx + 1} abhaken & ${restDurationPref}s Pause starten`}
                          >
                            <Check size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer Actions: + Satz / - Satz / Save Exercise */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "0.5rem",
                      paddingTop: "0.25rem",
                    }}
                  >
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button
                        type="button"
                        className="pill-tab"
                        style={{
                          padding: "0.3rem 0.65rem",
                          fontSize: "0.74rem",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                        onClick={() => addSetRowToExercise(exIdx)}
                      >
                        <Plus size={13} />
                        <span>Satz hinzufügen</span>
                      </button>

                      {ex.setRows.length > 1 && (
                        <button
                          type="button"
                          className="pill-tab"
                          style={{
                            padding: "0.3rem 0.6rem",
                            fontSize: "0.74rem",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                          onClick={() => removeLastSetRow(exIdx)}
                        >
                          <Minus size={13} />
                          <span>Satz -</span>
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      className="pastel-btn btn-lavender"
                      style={{ padding: "0.45rem 0.9rem", fontSize: "0.79rem" }}
                      onClick={() => void persistExerciseToDb(ex, exIdx)}
                    >
                      <Check size={14} />
                      <span>
                        {ex.logged
                          ? "Aktualisieren"
                          : `Übung speichern (${doneSetsCount}/${ex.setRows.length} Sätze)`}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
