"use client";

import React, { useState } from "react";
import {
  Dumbbell,
  Plus,
  RefreshCw,
  Trash2,
  Sparkles,
} from "lucide-react";
import type { FitnessDataset } from "@/lib/db/schema";
import { computeWeeklySummary, formatPaceMinPerKm } from "@/lib/metrics";
import { getSportDefinition } from "@/lib/sports-catalog";
import { SchymLogo } from "@/components/dashboard/SchymLogo";
import { WeeklySplitCards } from "@/components/dashboard/WeeklySplitCards";
import { ActivityCalendar } from "@/components/dashboard/ActivityCalendar";
import { BodyMuscleMap } from "@/components/dashboard/BodyMuscleMap";
import { GymSessionModal } from "@/components/loggers/GymSessionModal";
import { QuickActivityModal } from "@/components/loggers/QuickActivityModal";
import { StravaSyncModule } from "@/components/loggers/StravaSyncModule";

interface FitnessDashboardProps {
  initialData: FitnessDataset;
  todayIso: string;
}

export function FitnessDashboard({
  initialData,
  todayIso,
}: FitnessDashboardProps) {
  const [data, setData] = useState<FitnessDataset>(initialData);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Popups / Modals: Only show when the user explicitly clicks!
  const [isGymModalOpen, setIsGymModalOpen] = useState(false);
  const [isQuickSportModalOpen, setIsQuickSportModalOpen] = useState(false);
  const [isStravaModalOpen, setIsStravaModalOpen] = useState(false);

  const summary = computeWeeklySummary(
    todayIso,
    data.gym,
    data.cardio,
    data.bouldering
  );

  async function submitEntry(
    type: "gym" | "cardio" | "bouldering" | "template",
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
      const json = (await res.json()) as {
        ok: boolean;
        data?: FitnessDataset;
        error?: string;
        issues?: Array<{ path: string; message: string }>;
      };

      if (!res.ok || !json.ok || !json.data) {
        const detail = json.issues
          ? json.issues.map((i) => `${i.path}: ${i.message}`).join(", ")
          : json.error ?? "Fehler beim Speichern";
        setErrorMsg(detail);
        return false;
      }

      setData(json.data);
      return true;
    } catch {
      setErrorMsg("Netzwerkfehler beim Speichern.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(
    category: "gym" | "cardio" | "bouldering" | "template",
    id: number
  ) {
    setErrorMsg(null);
    try {
      const res = await fetch("/api/fitness", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, id }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: FitnessDataset;
        error?: string;
      };
      if (res.ok && json.ok && json.data) {
        setData(json.data);
      } else {
        setErrorMsg(json.error ?? "Konnte Eintrag nicht löschen.");
      }
    } catch {
      setErrorMsg("Netzwerkfehler beim Löschen.");
    }
  }

  return (
    <div className="app-shell">
      {/* Top Bar: Hip Logo + 3 Clean Action Buttons */}
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
            <span>Strava &amp; Hevy Sync</span>
          </button>
        </div>
      </header>

      {errorMsg && (
        <div className="error-banner" role="alert">
          <strong>Hinweis:</strong> {errorMsg}
        </div>
      )}

      {/* 4 Soft-Pastel Overview Cards (Streak, Gym, Cardio, Bouldering) */}
      <WeeklySplitCards summary={summary} />

      {/* Main Two-Column Visual Dashboard: Calendar on Left, Body Muscle Map on Right */}
      <div className="dashboard-two-col">
        <ActivityCalendar
          data={data}
          todayIso={todayIso}
          weeklyStreakCount={summary.weeklyStreakCount}
          activeDaysThisWeek={summary.activeDaysThisWeek}
        />

        <BodyMuscleMap gymEntries={data.gym} todayIso={todayIso} />
      </div>

      {/* Clean Unified Activity Stream */}
      <section className="panel-card" style={{ marginTop: "1.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem",
            marginBottom: "1rem",
          }}
        >
          <div>
            <h2 className="panel-title" style={{ margin: 0 }}>
              <Sparkles size={18} color="var(--pastel-lavender)" />
              Deine letzten Trainings &amp; Aktivitäten
            </h2>
            <p className="panel-desc" style={{ marginBottom: 0 }}>
              Komplett leer ohne nervige Vor-Einträge — synchronisiere einfach
              Strava oder starte dein erstes Gym-Workout!
            </p>
          </div>
        </div>

        {data.gym.length === 0 &&
        data.cardio.length === 0 &&
        data.bouldering.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "2.2rem 1rem",
              background: "var(--bg-soft)",
              borderRadius: 16,
              border: "1px dashed var(--border-subtle)",
            }}
          >
            <p style={{ fontWeight: 700, marginBottom: "0.35rem" }}>
              Noch keine Workouts eingetragen ✨
            </p>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
                marginBottom: "1.1rem",
              }}
            >
              Klicke oben auf <strong>„Ich bin im Gym 💪“</strong> oder lade
              deine bisherigen Hevy- &amp; Sport-Sessions über{" "}
              <strong>„Strava &amp; Hevy Sync“</strong> rein.
            </p>
          </div>
        ) : (
          <div className="session-list">
            {data.gym.map((item) => (
              <div key={`gym-${item.id}`} className="session-item">
                <div className="session-main">
                  <div className="session-header">
                    <span className="badge badge-gym">GYM • {item.workoutFocus}</span>
                    <span className="session-title">{item.exerciseName}</span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
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
                </div>
                <button
                  type="button"
                  className="delete-btn"
                  onClick={() => handleDelete("gym", item.id)}
                  title="Löschen"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}

            {data.cardio.map((item) => {
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
                        style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}
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

            {data.bouldering.map((item) => (
              <div key={`boulder-${item.id}`} className="session-item">
                <div className="session-main">
                  <div className="session-header">
                    <span className="badge badge-boulder">BOULDER</span>
                    <span className="session-title">
                      Grad {item.grade} ({item.style}) @ {item.location}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {item.sessionDate}
                    </span>
                  </div>
                  <div className="session-stats">
                    <span>Wand: {item.wallAngle}</span>
                    <span>Versuche: {item.attempts}</span>
                    <span>Finger/Haut: {item.skinAndFingerFeel}/10</span>
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
          todayIso={todayIso}
          onClose={() => setIsStravaModalOpen(false)}
          onSynced={(newData) => {
            setErrorMsg(null);
            setData(newData);
          }}
          onError={(msg) => setErrorMsg(msg)}
        />
      )}
    </div>
  );
}
