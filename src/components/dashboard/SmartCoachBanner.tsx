"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Dumbbell,
  HeartPulse,
  Send,
  Bell,
  CheckCircle2,
  FlaskConical,
  UserCheck,
  X,
  CalendarClock,
  TrendingUp,
} from "lucide-react";
import type { AthleteProfile, DailyCoachBriefing } from "@/lib/coach";

export type CoachDrawerMode = "none" | "habits" | "science";

interface SmartCoachBannerProps {
  briefing: DailyCoachBriefing;
  profile: AthleteProfile;
  openDrawer: CoachDrawerMode;
  onChangeDrawer: (mode: CoachDrawerMode) => void;
  onUpdateProfile: (next: AthleteProfile) => void;
  onApplyScienceUpgrade: () => Promise<void>;
  onStartGym: (templateName?: string | null) => void;
  onStartCardio: () => void;
  onOpenMobileAndSignal: () => void;
}

export function SmartCoachBanner({
  briefing,
  profile,
  openDrawer,
  onChangeDrawer,
  onUpdateProfile,
  onApplyScienceUpgrade,
  onStartGym,
  onStartCardio,
  onOpenMobileAndSignal,
}: SmartCoachBannerProps) {
  const [notifStatus, setNotifStatus] = useState<string | null>(null);
  const [upgradeDone, setUpgradeDone] = useState(false);

  // Default selected day in the 7-day future planner: pick the first upcoming Gym day (or Today if none)
  const firstUpcomingGymIdx = Math.max(
    0,
    briefing.futureSchedule.slice(0, 7).findIndex((d) => d.type === "gym")
  );
  const [selectedFutureIdx, setSelectedFutureIdx] =
    useState<number>(firstUpcomingGymIdx);

  const selectedFutureDay =
    briefing.futureSchedule[selectedFutureIdx] ?? briefing.futureSchedule[0];

  async function enableBrowserReminder() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifStatus("Dein Browser unterstützt keine lokalen Notifications.");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      new Notification("Schym Science Coach 💪", {
        body: `${briefing.headline} — ${briefing.subline}`,
      });
      setNotifStatus("Lokale Browser-Erinnerung aktiviert!");
    } else {
      setNotifStatus("Bitte Browser-Berechtigung erlauben.");
    }
  }

  return (
    <section
      className="panel-card pro-glass-card"
      style={{
        marginBottom: "0.95rem",
        padding: "1.05rem 1.25rem",
        background:
          "linear-gradient(135deg, rgba(203, 166, 247, 0.14) 0%, rgba(34, 36, 54, 0.94) 55%, rgba(166, 227, 161, 0.09) 100%)",
        border: "1px solid rgba(203, 166, 247, 0.34)",
        display: "flex",
        flexDirection: "column",
        gap: "0.95rem",
      }}
    >
      {/* Top Row: Coach Headline + Primary Workout Button */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.85rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flex: 1,
            minWidth: 260,
          }}
        >
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background:
                "linear-gradient(135deg, rgba(203, 166, 247, 0.25), rgba(166, 227, 161, 0.2))",
              border: "1px solid rgba(203, 166, 247, 0.35)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--pastel-lavender)",
              flexShrink: 0,
            }}
          >
            <Sparkles size={19} />
          </span>

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "0.14rem 0.55rem",
                  borderRadius: 999,
                  background: "rgba(203, 166, 247, 0.18)",
                  color: "var(--pastel-lavender)",
                }}
              >
                Zukunfts-Planer &amp; Science Coach
              </span>
              <span
                style={{
                  fontSize: "0.73rem",
                  color: "var(--pastel-mint)",
                  fontWeight: 700,
                }}
              >
                Dein Rhythmus: ~{briefing.learnedGymPerWeek}× Gym/Woche • Ø{" "}
                {briefing.learnedAvgRestDays} Tage Pause
              </span>
            </div>

            <div
              style={{
                fontSize: "0.98rem",
                fontWeight: 800,
                color: "var(--text-primary)",
                letterSpacing: "-0.01em",
              }}
            >
              {briefing.headline}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              {briefing.subline}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.45rem",
            flexWrap: "wrap",
          }}
        >
          {briefing.recommendedAction === "gym" ? (
            <button
              type="button"
              className="pastel-btn btn-lavender"
              style={{ padding: "0.55rem 1.05rem", fontSize: "0.82rem" }}
              onClick={() =>
                onStartGym(briefing.recommendedTemplate?.name ?? null)
              }
            >
              <Dumbbell size={15} />
              <span>
                {briefing.recommendedTemplate
                  ? `„${briefing.recommendedTemplate.name}“ starten`
                  : "Gym starten"}
              </span>
            </button>
          ) : (
            <button
              type="button"
              className="pastel-btn btn-mint"
              style={{ padding: "0.55rem 1.05rem", fontSize: "0.82rem" }}
              onClick={onStartCardio}
            >
              <HeartPulse size={15} />
              <span>Sport loggen</span>
            </button>
          )}

          {openDrawer !== "none" && (
            <button
              type="button"
              className="icon-btn"
              onClick={() => onChangeDrawer("none")}
              title="Ansicht schließen"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* PROACTIVE 7-DAY FUTURE TRAINING SCHEDULE ("Für dich in die Zukunft geplant") */}
      <div
        style={{
          borderTop: "1px solid var(--border-subtle)",
          paddingTop: "0.85rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.7rem",
        }}
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "0.8rem",
              fontWeight: 800,
              color: "var(--pastel-lavender)",
            }}
          >
            <CalendarClock size={15} />
            <span>
              Dein 7-Tage Zukunfts-Fahrplan (Klicke auf einen Tag für deine
              Ziel-Gewichte):
            </span>
          </div>
          <span style={{ fontSize: "0.73rem", color: "var(--text-secondary)" }}>
            Automatisch geplant aus Regeneration (48–72h) &amp; deinen
            Stamm-Tagen
          </span>
        </div>

        {/* 7-Day Horizontal Timeline Strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))",
            gap: "0.45rem",
          }}
        >
          {briefing.futureSchedule.slice(0, 7).map((day, idx) => {
            const isSelected = idx === selectedFutureIdx;
            const borderColor =
              day.type === "gym"
                ? "var(--pastel-lavender)"
                : day.type === "cardio"
                  ? "var(--pastel-mint)"
                  : day.type === "completed"
                    ? "var(--pastel-mint)"
                    : "var(--border-subtle)";

            const bg = isSelected
              ? day.type === "gym"
                ? "rgba(203, 166, 247, 0.22)"
                : day.type === "cardio"
                  ? "rgba(166, 227, 161, 0.18)"
                  : "rgba(255, 255, 255, 0.09)"
              : "var(--bg-soft)";

            return (
              <button
                key={day.dateIso}
                type="button"
                onClick={() => setSelectedFutureIdx(idx)}
                style={{
                  textAlign: "left",
                  padding: "0.55rem 0.65rem",
                  borderRadius: 12,
                  background: bg,
                  border: isSelected
                    ? `1.5px solid ${borderColor}`
                    : "1px solid var(--border-subtle)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  transition: "all 0.15s ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "0.7rem",
                    color: "var(--text-secondary)",
                    fontWeight: 700,
                  }}
                >
                  <span>{day.relativeLabel}</span>
                  <span>{day.dateIso.slice(8, 10)}.{day.dateIso.slice(5, 7)}.</span>
                </div>
                <div
                  style={{
                    fontSize: "0.79rem",
                    fontWeight: 800,
                    color:
                      day.type === "gym"
                        ? "var(--pastel-lavender)"
                        : day.type === "cardio" || day.type === "completed"
                          ? "var(--pastel-mint)"
                          : "var(--text-primary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {day.badgeText}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Future Day Details + Concrete Target Weights */}
        {selectedFutureDay && (
          <div
            style={{
              background: "var(--bg-soft)",
              borderRadius: 14,
              padding: "0.8rem 1rem",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "0.65rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.6rem",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div
                  style={{
                    fontSize: "0.86rem",
                    fontWeight: 800,
                    color: "var(--text-primary)",
                  }}
                >
                  {selectedFutureDay.weekdayFull} ({selectedFutureDay.dateIso}):{" "}
                  <span style={{ color: "var(--pastel-lavender)" }}>
                    {selectedFutureDay.title}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "0.77rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  {selectedFutureDay.reason}
                </div>
              </div>

              {selectedFutureDay.type === "gym" &&
                selectedFutureDay.templateName && (
                  <button
                    type="button"
                    className="pastel-btn btn-lavender"
                    style={{ padding: "0.45rem 0.9rem", fontSize: "0.78rem" }}
                    onClick={() => onStartGym(selectedFutureDay.templateName)}
                  >
                    <Dumbbell size={14} />
                    <span>
                      „{selectedFutureDay.templateName}“ mit Ziel-Gewichten
                      öffnen
                    </span>
                  </button>
                )}
            </div>

            {selectedFutureDay.exercises.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(215px, 1fr))",
                  gap: "0.45rem",
                  paddingTop: "0.45rem",
                  borderTop: "1px solid var(--border-subtle)",
                }}
              >
                {selectedFutureDay.exercises.map((ex, i) => (
                  <div
                    key={`${selectedFutureDay.dateIso}-${ex.name}-${i}`}
                    style={{
                      padding: "0.45rem 0.65rem",
                      borderRadius: 10,
                      background: ex.shouldIncrease
                        ? "rgba(166, 227, 161, 0.09)"
                        : "rgba(255, 255, 255, 0.03)",
                      border: ex.shouldIncrease
                        ? "1px solid rgba(166, 227, 161, 0.35)"
                        : "1px solid var(--border-subtle)",
                      fontSize: "0.76rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <strong style={{ color: "var(--text-primary)" }}>
                        {ex.name}
                      </strong>
                      {ex.shouldIncrease && (
                        <span
                          style={{
                            color: "var(--pastel-mint)",
                            fontWeight: 800,
                            fontSize: "0.69rem",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 2,
                          }}
                        >
                          <TrendingUp size={11} /> +Steigerung
                        </span>
                      )}
                    </div>
                    <div style={{ color: "var(--pastel-lavender)", fontWeight: 700 }}>
                      Ziel: {ex.targetSets} Sätze × {ex.targetReps} Wdh @{" "}
                      <strong>{ex.suggestedWeightKg} kg</strong>{" "}
                      <span
                        style={{
                          color: "var(--text-muted)",
                          fontWeight: 400,
                          fontSize: "0.71rem",
                        }}
                      >
                        (zuletzt: {ex.previousWeightKg}kg × {ex.previousReps})
                      </span>
                    </div>
                    {ex.seatNote && (
                      <div
                        style={{
                          color: "var(--pastel-mint)",
                          fontSize: "0.7rem",
                        }}
                      >
                        📌 {ex.seatNote}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* DRAWER 1: LEARNED WEEKDAY HABIT RHYTHM (Opened via Burger Menu) */}
      {openDrawer === "habits" && (
        <div
          className="smooth-unfold"
          style={{
            paddingTop: "0.85rem",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              fontSize: "0.79rem",
              color: "var(--text-secondary)",
            }}
          >
            <strong>Wie der Coach aus deinem Verhalten lernt:</strong> Statt
            jeden Tag mit 1 Training als Sporttag zu werten, filtert der
            Algorithmus deine{" "}
            <strong style={{ color: "var(--pastel-lavender)" }}>
              Top-{Math.max(1, Math.round(briefing.learnedGymPerWeek))} Stamm-Trainingstage
            </strong>{" "}
            heraus (aus 11 Sessions: <strong>Donnerstag</strong> &amp;{" "}
            <strong>Sonntag/Freitag</strong>, mit Ø{" "}
            <strong>{briefing.learnedAvgRestDays} Tagen Pause</strong> zwischen
            Einheiten):
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {briefing.weekdayHabits.map((h) => {
                const colorMap = {
                  gym: "var(--pastel-lavender)",
                  cardio: "var(--pastel-mint)",
                  bouldering: "var(--pastel-peach)",
                  rest: "var(--text-muted)",
                };
                const col = colorMap[h.dominantType];
                return (
                  <span
                    key={h.weekdayShort}
                    style={{
                      fontSize: "0.74rem",
                      padding: "0.24rem 0.65rem",
                      borderRadius: 999,
                      background:
                        h.dominantType !== "rest"
                          ? "rgba(203, 166, 247, 0.14)"
                          : "var(--bg-soft)",
                      border:
                        h.dominantType !== "rest"
                          ? `1px solid ${col}`
                          : "1px solid var(--border-subtle)",
                    }}
                  >
                    <strong>{h.weekdayShort}:</strong>{" "}
                    <span style={{ color: col, fontWeight: 700 }}>
                      {h.label}
                    </span>
                  </span>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="pill-tab"
                onClick={enableBrowserReminder}
              >
                <Bell size={13} style={{ display: "inline", marginRight: 4 }} />
                Browser-Reminder
              </button>
              <button
                type="button"
                className="pill-tab active"
                onClick={onOpenMobileAndSignal}
              >
                <Send size={13} style={{ display: "inline", marginRight: 4 }} />
                Signal 06:00 Uhr Bot
              </button>
            </div>
          </div>

          {notifStatus && (
            <div
              style={{
                fontSize: "0.78rem",
                color: "var(--pastel-mint)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <CheckCircle2 size={14} />
              <span>{notifStatus}</span>
            </div>
          )}
        </div>
      )}

      {/* DRAWER 2: SPORTS SCIENCE LAB & ATHLETE PROFILE (Opened via Burger Menu) */}
      {openDrawer === "science" && (
        <div
          className="smooth-unfold"
          style={{
            paddingTop: "0.95rem",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "0.9rem",
              fontWeight: 800,
              color: "var(--pastel-lavender)",
            }}
          >
            <FlaskConical size={16} />
            <span>
              Sportwissenschaftliches Labor &amp; Progression-Analyse
            </span>
          </div>

          {/* Athlete Profile Bar */}
          <div
            style={{
              background: "var(--bg-soft)",
              padding: "0.85rem 1rem",
              borderRadius: 14,
              border: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.82rem",
                fontWeight: 800,
              }}
            >
              <UserCheck size={16} color="var(--pastel-mint)" />
              <span>Dein Athleten-Profil (für Studien-Formeln):</span>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.6rem",
                alignItems: "center",
              }}
            >
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "0.76rem",
                  color: "var(--text-secondary)",
                }}
              >
                <span>Gewicht (kg):</span>
                <input
                  type="number"
                  min={40}
                  max={180}
                  className="field-input"
                  style={{ width: 68, padding: "0.3rem 0.5rem" }}
                  value={profile.weightKg}
                  onChange={(e) =>
                    onUpdateProfile({
                      ...profile,
                      weightKg: Number(e.target.value) || 75,
                    })
                  }
                />
              </label>

              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "0.76rem",
                  color: "var(--text-secondary)",
                }}
              >
                <span>Größe (cm):</span>
                <input
                  type="number"
                  min={140}
                  max={220}
                  className="field-input"
                  style={{ width: 72, padding: "0.3rem 0.5rem" }}
                  value={profile.heightCm}
                  onChange={(e) =>
                    onUpdateProfile({
                      ...profile,
                      heightCm: Number(e.target.value) || 180,
                    })
                  }
                />
              </label>

              <span
                className="badge badge-cardio"
                style={{ fontSize: "0.73rem" }}
              >
                Protein-Ziel: {Math.round(profile.weightKg * 1.8)} g/Tag •
                Kreatin: {Math.max(3, Math.round(profile.weightKg * 0.05))} g/Tag
              </span>
            </div>
          </div>

          {/* Fractional Weekly Set Volume per Muscle (Pelland et al. 2024) */}
          <div
            style={{
              background: "var(--bg-soft)",
              padding: "0.9rem 1rem",
              borderRadius: 14,
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem",
            }}
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
              <strong style={{ fontSize: "0.84rem" }}>
                Effektives Wochen-Volumen pro Muskel (Pelland et al., 2024
                Fractional Counting):
              </strong>
              <span
                style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}
              >
                Ziel-Korridor für Hypertrophie: 8–16 Sätze / Woche
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "0.55rem",
              }}
            >
              {briefing.muscleVolumes.map((mv) => {
                const pct = Math.min(
                  100,
                  Math.round((mv.weeklyFractionalSets / mv.targetMaxSets) * 100)
                );
                const barColor =
                  mv.status === "optimal"
                    ? "var(--pastel-mint)"
                    : mv.status === "low"
                      ? "var(--pastel-peach)"
                      : "var(--pastel-lavender)";
                return (
                  <div
                    key={mv.muscleId}
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      padding: "0.55rem 0.7rem",
                      borderRadius: 10,
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.76rem",
                        marginBottom: 4,
                      }}
                    >
                      <strong>{mv.label}</strong>
                      <span style={{ color: barColor, fontWeight: 700 }}>
                        {mv.weeklyFractionalSets} / {mv.targetMinSets}–
                        {mv.targetMaxSets} Sätze
                      </span>
                    </div>
                    <div className="progress-track" style={{ height: 6 }}>
                      <div
                        className="progress-fill"
                        style={{ width: `${pct}%`, background: barColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Peer-Reviewed Study Insights Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "0.75rem",
            }}
          >
            {briefing.scienceInsights.map((ins) => (
              <div
                key={ins.id}
                style={{
                  background: "var(--bg-soft)",
                  padding: "0.9rem 1rem",
                  borderRadius: 14,
                  border: `1px solid ${ins.badgeColor}44`,
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.4rem",
                }}
              >
                <div
                  style={{
                    fontSize: "0.84rem",
                    fontWeight: 800,
                    color: ins.badgeColor,
                  }}
                >
                  {ins.title}
                </div>
                <p
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--text-secondary)",
                    margin: 0,
                  }}
                >
                  <strong>Analyse deiner Daten:</strong> {ins.finding}
                </p>
                <p
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--text-primary)",
                    margin: 0,
                  }}
                >
                  <strong>Plan-Empfehlung:</strong> {ins.recommendation}
                </p>
                <span
                  style={{
                    fontSize: "0.69rem",
                    color: "var(--text-muted)",
                    fontStyle: "italic",
                    marginTop: "auto",
                  }}
                >
                  📚 Studie: {ins.citation}
                </span>
              </div>
            ))}
          </div>

          {/* 1-Click Science Plan Upgrade */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.75rem",
              background: "rgba(203, 166, 247, 0.1)",
              padding: "0.75rem 1rem",
              borderRadius: 12,
              border: "1px solid rgba(203, 166, 247, 0.3)",
            }}
          >
            <span style={{ fontSize: "0.8rem" }}>
              💡 Soll ich deine beiden Vorlagen{" "}
              <strong>„Drücken“ &amp; „Ziehen“</strong> direkt nach diesen
              Studien upgraden (2×/Woche Brust- &amp; Trizeps-Reiz ergänzen)?
            </span>

            {upgradeDone ? (
              <span
                style={{
                  color: "var(--pastel-mint)",
                  fontSize: "0.8rem",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <CheckCircle2 size={15} /> Pläne „Drücken“ &amp; „Ziehen“
                wissenschaftlich optimiert!
              </span>
            ) : (
              <button
                type="button"
                className="pastel-btn btn-lavender"
                style={{ padding: "0.48rem 0.95rem", fontSize: "0.79rem" }}
                onClick={async () => {
                  await onApplyScienceUpgrade();
                  setUpgradeDone(true);
                }}
              >
                <Sparkles size={14} />
                <span>Pläne jetzt nach Studien optimieren</span>
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
