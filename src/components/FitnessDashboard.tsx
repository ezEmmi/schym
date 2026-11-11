"use client";

import React, { useState } from "react";
import {
  Dumbbell,
  Plus,
  RefreshCw,
  Trash2,
  Sparkles,
  Smartphone,
} from "lucide-react";
import type { FitnessDataset } from "@/lib/db/schema";
import { computeWeeklySummary, formatPaceMinPerKm } from "@/lib/metrics";
import { computeCoachBriefing } from "@/lib/coach";
import { getSportDefinition } from "@/lib/sports-catalog";
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

export function FitnessDashboard({
  initialData,
  todayIso,
}: FitnessDashboardProps) {
  const [data, setData] = useState<FitnessDataset>(initialData);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Popups / Modals
  const [isGymModalOpen, setIsGymModalOpen] = useState(false);
  const [isQuickSportModalOpen, setIsQuickSportModalOpen] = useState(false);
  const [isStravaModalOpen, setIsStravaModalOpen] = useState(false);
  const [isMobileSignalModalOpen, setIsMobileSignalModalOpen] = useState(false);

  const summary = computeWeeklySummary(
    todayIso,
    data.gym,
    data.cardio,
    data.bouldering
  );

  const coachBriefing = computeCoachBriefing(data, todayIso);

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
            <span>Strava &amp; Hevy Import</span>
          </button>

          <button
            type="button"
            className="pill-tab"
            onClick={() => setIsMobileSignalModalOpen(true)}
            title="Handy-App (PWA) & Signal-Bot verbinden"
          >
            <Smartphone size={15} style={{ display: "inline", marginRight: 5 }} />
            Handy &amp; Signal 📲
          </button>
        </div>
      </header>

      {errorMsg && (
        <div className="error-banner" role="alert">
          <strong>Hinweis:</strong> {errorMsg}
        </div>
      )}

      {/* 1. Smart Habit-Engine & Daily Coach Banner */}
      <SmartCoachBanner
        briefing={coachBriefing}
        onStartGym={() => setIsGymModalOpen(true)}
        onStartCardio={() => setIsQuickSportModalOpen(true)}
        onOpenMobileAndSignal={() => setIsMobileSignalModalOpen(true)}
      />

      {/* 2. 1-Click Daily Supplement Tracker */}
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

      {/* 4. Main Two-Column Visual Dashboard: Calendar on Left, Body Muscle Map on Right */}
      <div className="dashboard-two-col">
        <ActivityCalendar
          data={data}
          todayIso={todayIso}
          weeklyStreakCount={summary.weeklyStreakCount}
          activeDaysThisWeek={summary.activeDaysThisWeek}
        />

        <BodyMuscleMap gymEntries={data.gym} todayIso={todayIso} />
      </div>

      {/* 5. Machine Strength & Weight Progression Chart */}
      <ProgressionChartCard gymEntries={data.gym} />

      {/* 6. Unified Activity Stream */}
      <section className="panel-card" style={{ marginTop: "1.35rem" }}>
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
              Deine letzten Trainings &amp; Aktivitäten (
              {data.gym.length + data.cardio.length + data.bouldering.length})
            </h2>
            <p className="panel-desc" style={{ marginBottom: 0 }}>
              Alle deine geloggten oder aus Hevy/Strava gelernten Sessions im
              Überblick
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
              Lade einmalig deine <strong>Hevy-CSV</strong> unter{" "}
              <strong>„Strava &amp; Hevy Import“</strong> hoch — Schym lernt
              sofort deine Pläne, Gewichte &amp; Trainingstage, und du kannst
              Hevy danach löschen!
            </p>
          </div>
        ) : (
          <div className="session-list">
            {data.gym.slice(0, 40).map((item) => (
              <div key={`gym-${item.id}`} className="session-item">
                <div className="session-main">
                  <div className="session-header">
                    <span className="badge badge-gym">
                      GYM • {item.workoutFocus}
                    </span>
                    <span className="session-title">{item.exerciseName}</span>
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
                    {item.notes && (
                      <span style={{ color: "var(--pastel-mint)" }}>
                        {item.notes}
                      </span>
                    )}
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

            {data.cardio.slice(0, 40).map((item) => {
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

            {data.bouldering.slice(0, 40).map((item) => (
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
