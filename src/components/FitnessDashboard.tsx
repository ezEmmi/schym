"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dumbbell,
  Plus,
  RefreshCw,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type {
  FitnessDataset,
  GymEntry,
  MuscleGroup,
  SupplementTiming,
  WorkoutTemplateExercise,
} from "@/lib/db/schema";
import {
  calculateEstimated1Rm,
  computeWeeklySummary,
  formatPaceMinPerKm,
} from "@/lib/metrics";
import { computeCoachBriefing } from "@/lib/coach";
import { getSportDefinition } from "@/lib/sports-catalog";
import { inferMuscleGroupFromExercise } from "@/lib/muscles";
import { buildPreseededDataset } from "@/lib/hevy-seed";
import { SchymLogo } from "@/components/dashboard/SchymLogo";
import { SmartCoachBanner } from "@/components/dashboard/SmartCoachBanner";
import { SupplementTracker } from "@/components/dashboard/SupplementTracker";
import { WeeklySplitCards } from "@/components/dashboard/WeeklySplitCards";
import { ActivityCalendar } from "@/components/dashboard/ActivityCalendar";
import { BodyMuscleMap } from "@/components/dashboard/BodyMuscleMap";
import { ProgressionChartCard } from "@/components/dashboard/ProgressionChartCard";
import { GymSessionModal } from "@/components/loggers/GymSessionModal";
import { QuickActivityModal } from "@/components/loggers/QuickActivityModal";
import { StravaSyncModule } from "@/components/loggers/StravaSyncModule";
import { MobileAndSignalModal } from "@/components/dashboard/MobileAndSignalModal";

interface FitnessDashboardProps {
  initialData: FitnessDataset;
  todayIso: string;
}

const HYBRID_STORAGE_KEY = "schym_hybrid_dataset_v2";

export function FitnessDashboard({
  initialData,
  todayIso,
}: FitnessDashboardProps) {
  const [data, setData] = useState<FitnessDataset>(() =>
    initialData.gym.length > 0 ? initialData : buildPreseededDataset()
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Accordion UI states for progressive disclosure
  const [isHistorySectionOpen, setIsHistorySectionOpen] = useState(true);
  const [expandedWorkoutKeys, setExpandedWorkoutKeys] = useState<
    Record<string, boolean>
  >({});

  // Popups / Modals
  const [isGymModalOpen, setIsGymModalOpen] = useState(false);
  const [isQuickSportModalOpen, setIsQuickSportModalOpen] = useState(false);
  const [isStravaModalOpen, setIsStravaModalOpen] = useState(false);
  const [isMobileSignalModalOpen, setIsMobileSignalModalOpen] = useState(false);

  // Hydrate from localStorage on static hosts (e.g. GitHub Pages ezemmi.github.io)
  useEffect(() => {
    try {
      const savedRaw = window.localStorage.getItem(HYBRID_STORAGE_KEY);
      if (savedRaw && initialData.gym.length === 0) {
        const parsed = JSON.parse(savedRaw) as FitnessDataset;
        if (parsed && Array.isArray(parsed.gym) && parsed.gym.length > 0) {
          setData(parsed);
        }
      }
    } catch {
      // ignore storage read error
    }
  }, [initialData.gym.length]);

  function persistDataset(next: FitnessDataset) {
    setData(next);
    try {
      window.localStorage.setItem(HYBRID_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
  }

  const summary = computeWeeklySummary(
    todayIso,
    data.gym,
    data.cardio,
    data.bouldering
  );

  const coachBriefing = computeCoachBriefing(data, todayIso);

  // Group Gym entries by (sessionDate + workoutFocus) so 70 flat rows become 11 clean collapsible Workout Days!
  const groupedGymWorkouts = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        sessionDate: string;
        workoutFocus: string;
        exercises: GymEntry[];
        totalSets: number;
        totalVolumeKg: number;
      }
    >();

    for (const item of data.gym) {
      const key = `${item.sessionDate}__${item.workoutFocus}`;
      const existing = map.get(key);
      const vol = item.sets * item.reps * item.weightKg;
      if (!existing) {
        map.set(key, {
          key,
          sessionDate: item.sessionDate,
          workoutFocus: item.workoutFocus,
          exercises: [item],
          totalSets: item.sets,
          totalVolumeKg: Math.round(vol),
        });
      } else {
        existing.exercises.push(item);
        existing.totalSets += item.sets;
        existing.totalVolumeKg = Math.round(existing.totalVolumeKg + vol);
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      b.sessionDate.localeCompare(a.sessionDate)
    );
  }, [data.gym]);

  function applyLocalMutation(
    type:
      | "gym"
      | "cardio"
      | "bouldering"
      | "template"
      | "supplement_item"
      | "supplement_toggle",
    payload: Record<string, unknown>
  ): FitnessDataset {
    const nowIso = new Date().toISOString();
    const nextId = Date.now();

    if (type === "gym") {
      const w = Number(payload.weightKg ?? 0);
      const r = Number(payload.reps ?? 8);
      const exName = String(payload.exerciseName ?? "Maschine");
      const newEntry: GymEntry = {
        id: nextId,
        sessionDate: String(payload.sessionDate ?? todayIso),
        workoutFocus: String(payload.workoutFocus ?? "Gym Workout"),
        exerciseName: exName,
        muscleGroup:
          (payload.muscleGroup as MuscleGroup | undefined) ??
          inferMuscleGroupFromExercise(exName),
        sets: Number(payload.sets ?? 3),
        reps: r,
        weightKg: w,
        rpe: Number(payload.rpe ?? 8),
        estimated1Rm: calculateEstimated1Rm(w, r),
        notes: String(payload.notes ?? ""),
        createdAt: nowIso,
      };
      return { ...data, gym: [newEntry, ...data.gym] };
    }

    if (type === "cardio") {
      return {
        ...data,
        cardio: [
          {
            id: nextId,
            sessionDate: String(payload.sessionDate ?? todayIso),
            modality: String(payload.modality ?? "Run"),
            durationMinutes: Number(payload.durationMinutes ?? 30),
            distanceKm: Number(payload.distanceKm ?? 0),
            avgHeartRate:
              payload.avgHeartRate === null ||
              payload.avgHeartRate === undefined
                ? null
                : Number(payload.avgHeartRate),
            rpe: Number(payload.rpe ?? 7),
            notes: String(payload.notes ?? ""),
            createdAt: nowIso,
          },
          ...data.cardio,
        ],
      };
    }

    if (type === "bouldering") {
      return {
        ...data,
        bouldering: [
          {
            id: nextId,
            sessionDate: String(payload.sessionDate ?? todayIso),
            location: String(payload.location ?? "Boulderhalle"),
            grade: String(payload.grade ?? "6A"),
            style: String(payload.style ?? "Flash"),
            wallAngle: String(payload.wallAngle ?? "Overhang"),
            attempts: Number(payload.attempts ?? 1),
            topped: Boolean(payload.topped ?? true),
            durationMinutes: Number(payload.durationMinutes ?? 60),
            skinAndFingerFeel: Number(payload.skinAndFingerFeel ?? 8),
            notes: String(payload.notes ?? ""),
            createdAt: nowIso,
          },
          ...data.bouldering,
        ],
      };
    }

    if (type === "template") {
      const name = String(payload.name ?? "Neuer Plan");
      const exercises = (payload.exercises ?? []) as WorkoutTemplateExercise[];
      return {
        ...data,
        templates: [
          { id: nextId, name, exercises, createdAt: nowIso },
          ...data.templates.filter(
            (t) => t.name.toLowerCase() !== name.toLowerCase()
          ),
        ],
      };
    }

    if (type === "supplement_item") {
      return {
        ...data,
        supplements: [
          ...data.supplements,
          {
            id: nextId,
            name: String(payload.name ?? "Supplement"),
            dosage: String(payload.dosage ?? "5g"),
            timing: String(payload.timing ?? "Morgens") as SupplementTiming,
            color: String(payload.color ?? "#cba6f7"),
            createdAt: nowIso,
          },
        ],
      };
    }

    // supplement_toggle
    const suppId = Number(payload.supplementId);
    const logDate = String(payload.logDate ?? todayIso);
    const exists = data.supplementLogs.some(
      (l) => l.supplementId === suppId && l.logDate === logDate
    );
    return {
      ...data,
      supplementLogs: exists
        ? data.supplementLogs.filter(
            (l) => !(l.supplementId === suppId && l.logDate === logDate)
          )
        : [
            ...data.supplementLogs,
            {
              id: nextId,
              supplementId: suppId,
              logDate,
              createdAt: nowIso,
            },
          ],
    };
  }

  async function submitEntry(
    type:
      | "gym"
      | "cardio"
      | "bouldering"
      | "template"
      | "supplement_item"
      | "supplement_toggle",
    payload: Record<string, unknown>
  ) {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/fitness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, payload }),
      });

      if (res.ok) {
        const json = (await res.json()) as {
          ok: boolean;
          data?: FitnessDataset;
        };
        if (json.ok && json.data) {
          persistDataset(json.data);
          return true;
        }
      }

      // Hybrid fallback for GitHub Pages static mode
      const next = applyLocalMutation(type, payload);
      persistDataset(next);
      return true;
    } catch {
      const next = applyLocalMutation(type, payload);
      persistDataset(next);
      return true;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(
    category: "gym" | "cardio" | "bouldering" | "template" | "supplement",
    id: number
  ) {
    setErrorMsg(null);
    try {
      const res = await fetch("/api/fitness", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, id }),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          ok: boolean;
          data?: FitnessDataset;
        };
        if (json.ok && json.data) {
          persistDataset(json.data);
          return;
        }
      }
    } catch {
      // Fallback below for static mode
    }

    const next: FitnessDataset = {
      ...data,
      gym: category === "gym" ? data.gym.filter((x) => x.id !== id) : data.gym,
      cardio:
        category === "cardio"
          ? data.cardio.filter((x) => x.id !== id)
          : data.cardio,
      bouldering:
        category === "bouldering"
          ? data.bouldering.filter((x) => x.id !== id)
          : data.bouldering,
      templates:
        category === "template"
          ? data.templates.filter((x) => x.id !== id)
          : data.templates,
      supplements:
        category === "supplement"
          ? data.supplements.filter((x) => x.id !== id)
          : data.supplements,
    };
    persistDataset(next);
  }

  return (
    <div className="app-shell">
      {/* Top Bar: Hip Logo + Action Buttons */}
      <header className="top-header">
        <SchymLogo />

        <div className="action-bar">
          <button
            type="button"
            className="pastel-btn btn-lavender"
            onClick={() => setIsGymModalOpen(true)}
          >
            <Dumbbell size={17} />
            <span>Ich bin im Gym 💪</span>
          </button>

          <button
            type="button"
            className="pastel-btn btn-mint"
            onClick={() => setIsQuickSportModalOpen(true)}
          >
            <Plus size={17} />
            <span>Sport / Bouldern +</span>
          </button>

          <button
            type="button"
            className="pastel-btn btn-peach"
            onClick={() => setIsStravaModalOpen(true)}
          >
            <RefreshCw size={16} />
            <span>Hevy &amp; Strava</span>
          </button>

          <button
            type="button"
            className="pill-tab"
            onClick={() => setIsMobileSignalModalOpen(true)}
            title="Signal Daily Reminder verbinden"
          >
            Signal Bot 💬
          </button>
        </div>
      </header>

      {errorMsg && (
        <div className="error-banner" role="alert">
          <strong>Hinweis:</strong> {errorMsg}
        </div>
      )}

      {/* 1. Compact Smart Coach Bar (click to expand weekday rhythm) */}
      <SmartCoachBanner
        briefing={coachBriefing}
        onStartGym={() => setIsGymModalOpen(true)}
        onStartCardio={() => setIsQuickSportModalOpen(true)}
        onOpenMobileAndSignal={() => setIsMobileSignalModalOpen(true)}
      />

      {/* 2. Compact 1-Line Supplement Strip */}
      <SupplementTracker
        supplements={data.supplements}
        supplementLogs={data.supplementLogs}
        todayIso={todayIso}
        onToggleSupplement={(supplementId) =>
          submitEntry("supplement_toggle", { supplementId, logDate: todayIso })
        }
        onAddSupplement={(payload) => submitEntry("supplement_item", payload)}
        onDeleteSupplement={(id) => handleDelete("supplement", id)}
      />

      {/* 3. 4 Soft-Pastel Overview Cards (Streak, Gym, Cardio, Bouldering) */}
      <WeeklySplitCards summary={summary} />

      {/* 4. Main Two-Column Visual Dashboard: Calendar on Left, Body Muscle Map on Right (Unchanged as requested!) */}
      <div className="dashboard-two-col">
        <ActivityCalendar
          data={data}
          todayIso={todayIso}
          weeklyStreakCount={summary.weeklyStreakCount}
          activeDaysThisWeek={summary.activeDaysThisWeek}
        />

        <BodyMuscleMap gymEntries={data.gym} todayIso={todayIso} />
      </div>

      {/* 5. Collapsible Machine Progression Accordion */}
      <ProgressionChartCard gymEntries={data.gym} />

      {/* 6. Grouped & Collapsible Workout Diary (1Row per Workout Day, click to unfold exercises!) */}
      <section
        className="panel-card"
        style={{
          marginTop: "1rem",
          padding: isHistorySectionOpen ? "1.15rem 1.25rem" : "0.85rem 1.25rem",
        }}
      >
        <div
          onClick={() => setIsHistorySectionOpen((v) => !v)}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem",
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Sparkles size={18} color="var(--pastel-lavender)" />
            <span style={{ fontWeight: 800, fontSize: "0.95rem" }}>
              Trainings-Tagebuch ({groupedGymWorkouts.length} Gym-Workouts
              {data.cardio.length + data.bouldering.length > 0
                ? ` • ${data.cardio.length + data.bouldering.length} Sport/Boulder`
                : ""}
              )
            </span>
          </div>

          <button
            type="button"
            className="pill-tab"
            style={{
              padding: "0.32rem 0.7rem",
              fontSize: "0.75rem",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>
              {isHistorySectionOpen ? "Einklappen" : "Workouts ausklappen"}
            </span>
            {isHistorySectionOpen ? (
              <ChevronUp size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </button>
        </div>

        {isHistorySectionOpen && (
          <div
            className="session-list"
            style={{
              marginTop: "0.9rem",
              paddingTop: "0.85rem",
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            {/* Grouped Gym Workout Days (Click to unfold the exercises of that day!) */}
            {groupedGymWorkouts.map((workout) => {
              const isDayOpen = Boolean(expandedWorkoutKeys[workout.key]);
              return (
                <div
                  key={workout.key}
                  style={{
                    background: "var(--bg-soft)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 16,
                    padding: "0.75rem 1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.65rem",
                  }}
                >
                  <div
                    onClick={() =>
                      setExpandedWorkoutKeys((prev) => ({
                        ...prev,
                        [workout.key]: !prev[workout.key],
                      }))
                    }
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "0.5rem",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.6rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <span className="badge badge-gym">
                        GYM • {workout.workoutFocus}
                      </span>
                      <strong style={{ fontSize: "0.9rem" }}>
                        {workout.sessionDate}
                      </strong>
                      <span
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {workout.exercises.length} Übungen • {workout.totalSets}{" "}
                        Sätze • {workout.totalVolumeKg.toLocaleString("de-DE")}{" "}
                        kg Volumen
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: "0.76rem",
                        color: "var(--pastel-lavender)",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {isDayOpen ? "Zuklappen" : "Übungen ansehen"}
                      {isDayOpen ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </span>
                  </div>

                  {isDayOpen && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.45rem",
                        paddingTop: "0.55rem",
                        borderTop: "1px solid var(--border-subtle)",
                      }}
                    >
                      {workout.exercises.map((item) => (
                        <div
                          key={`gym-${item.id}`}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "0.45rem 0.65rem",
                            borderRadius: 10,
                            background: "rgba(255,255,255,0.03)",
                            fontSize: "0.82rem",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              alignItems: "center",
                              gap: "0.65rem",
                            }}
                          >
                            <strong>{item.exerciseName}</strong>
                            <span style={{ color: "var(--pastel-lavender)" }}>
                              {item.sets} × {item.reps} @ {item.weightKg} kg
                            </span>
                            <span style={{ color: "var(--text-muted)" }}>
                              (e1RM: {item.estimated1Rm} kg)
                            </span>
                            {item.notes && item.notes !== "Hevy Import" && (
                              <span
                                style={{
                                  color: "var(--pastel-mint)",
                                  fontSize: "0.76rem",
                                }}
                              >
                                📌 {item.notes}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            className="delete-btn"
                            onClick={() => handleDelete("gym", item.id)}
                            title="Löschen"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Cardio & Multi-Sport entries */}
            {data.cardio.slice(0, 20).map((item) => {
              const def = getSportDefinition(item.modality);
              return (
                <div key={`cardio-${item.id}`} className="session-item">
                  <div className="session-main">
                    <div className="session-header">
                      <span className="badge badge-cardio">{def.label}</span>
                      <span className="session-title">
                        {item.durationMinutes} Min
                        {item.distanceKm > 0 ? ` • ${item.distanceKm} km` : ""}
                      </span>
                      {item.distanceKm > 0 && (
                        <span
                          style={{
                            fontSize: "0.78rem",
                            color: "var(--pastel-mint)",
                            fontWeight: 700,
                          }}
                        >
                          {formatPaceMinPerKm(
                            item.durationMinutes,
                            item.distanceKm
                          )}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {item.sessionDate}
                      </span>
                    </div>
                    {item.notes && (
                      <p className="session-notes">“{item.notes}”</p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="delete-btn"
                    onClick={() => handleDelete("cardio", item.id)}
                    title="Löschen"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}

            {/* Bouldering entries */}
            {data.bouldering.slice(0, 20).map((item) => (
              <div key={`boulder-${item.id}`} className="session-item">
                <div className="session-main">
                  <div className="session-header">
                    <span className="badge badge-boulder">BOULDER</span>
                    <span className="session-title">
                      Grad {item.grade} ({item.style}) @ {item.location}
                    </span>
                    <span
                      style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}
                    >
                      {item.sessionDate}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="delete-btn"
                  onClick={() => handleDelete("bouldering", item.id)}
                  title="Löschen"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* POPUP 1: "Ich bin im Gym" Live Modal */}
      {isGymModalOpen && (
        <GymSessionModal
          templates={data.templates}
          gymHistory={data.gym}
          todayIso={todayIso}
          onClose={() => setIsGymModalOpen(false)}
          onSaveGymSet={(payload) => submitEntry("gym", payload)}
          onSaveTemplate={(payload) => submitEntry("template", payload)}
          onDeleteTemplate={(id) => handleDelete("template", id)}
        />
      )}

      {/* POPUP 2: Quick Sport / Bouldering Modal */}
      {isQuickSportModalOpen && (
        <QuickActivityModal
          todayIso={todayIso}
          isSubmitting={isSubmitting}
          onClose={() => setIsQuickSportModalOpen(false)}
          onSubmitCardio={(payload) => submitEntry("cardio", payload)}
          onSubmitBoulder={(payload) => submitEntry("bouldering", payload)}
        />
      )}

      {/* POPUP 3: Strava & Hevy Sync Modal */}
      {isStravaModalOpen && (
        <StravaSyncModule
          currentData={data}
          onClose={() => setIsStravaModalOpen(false)}
          onSynced={(newData) => {
            setErrorMsg(null);
            persistDataset(newData);
          }}
          onError={(msg) => setErrorMsg(msg)}
        />
      )}

      {/* POPUP 4: Mobile PWA, Server & Signal Messenger Modal */}
      {isMobileSignalModalOpen && (
        <MobileAndSignalModal
          briefing={coachBriefing}
          onClose={() => setIsMobileSignalModalOpen(false)}
        />
      )}
    </div>
  );
}
