"use client";

import React from "react";
import { UserCheck } from "lucide-react";
import type { GymEntry, MuscleGroup } from "@/lib/db/schema";
import { MUSCLE_GROUPS } from "@/lib/muscles";
import { getIsoWeekMonday } from "@/lib/metrics";

interface BodyMuscleMapProps {
  gymEntries: GymEntry[];
  todayIso: string;
}

export function BodyMuscleMap({ gymEntries, todayIso }: BodyMuscleMapProps) {
  const currentMonday = getIsoWeekMonday(todayIso);
  const thisWeekEntries = gymEntries.filter(
    (e) => getIsoWeekMonday(e.sessionDate) === currentMonday
  );

  // Count sets per muscle group this week
  const setsByMuscle = new Map<MuscleGroup, number>();
  for (const entry of thisWeekEntries) {
    const prev = setsByMuscle.get(entry.muscleGroup) ?? 0;
    setsByMuscle.set(entry.muscleGroup, prev + entry.sets);
  }

  function fillFor(muscle: MuscleGroup, activeHex: string): string {
    const sets = setsByMuscle.get(muscle) ?? 0;
    if (sets <= 0) return "rgba(255, 255, 255, 0.07)";
    return activeHex;
  }

  function opacityFor(muscle: MuscleGroup): number {
    const sets = setsByMuscle.get(muscle) ?? 0;
    if (sets <= 0) return 0.45;
    if (sets < 4) return 0.72;
    return 0.96;
  }

  return (
    <div
      className="panel-card"
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
        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
          <UserCheck size={20} color="var(--pastel-pink)" />
          <h2 className="panel-title" style={{ margin: 0 }}>
            Körper- &amp; Muskel-Map (Diese Woche)
          </h2>
        </div>
        <span style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
          Leuchtet auf, sobald du Sätze im Gym oder via Hevy/Strava loggst
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          alignItems: "center",
          background: "var(--bg-soft)",
          borderRadius: 16,
          padding: "1.1rem",
          border: "1px solid var(--border-subtle)",
        }}
      >
        {/* FRONT VIEW SVG */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "0.74rem",
              fontWeight: 700,
              color: "var(--text-secondary)",
              marginBottom: "0.4rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Front
          </div>
          <svg
            viewBox="0 0 160 280"
            width="100%"
            style={{ maxHeight: 230 }}
            aria-label="Vorderansicht Muskelgruppen"
          >
            {/* Head */}
            <circle cx="80" cy="26" r="16" fill="rgba(255,255,255,0.14)" />
            {/* Shoulders (Delts) */}
            <rect
              x="34"
              y="48"
              width="20"
              height="26"
              rx="9"
              fill={fillFor("shoulders", "#c4b5fd")}
              fillOpacity={opacityFor("shoulders")}
            />
            <rect
              x="106"
              y="48"
              width="20"
              height="26"
              rx="9"
              fill={fillFor("shoulders", "#c4b5fd")}
              fillOpacity={opacityFor("shoulders")}
            />
            {/* Chest (Pecs) */}
            <rect
              x="56"
              y="48"
              width="48"
              height="30"
              rx="8"
              fill={fillFor("chest", "#f9a8d4")}
              fillOpacity={opacityFor("chest")}
            />
            {/* Biceps / Arms */}
            <rect
              x="30"
              y="77"
              width="17"
              height="44"
              rx="8"
              fill={fillFor("biceps", "#6ee7b7")}
              fillOpacity={opacityFor("biceps")}
            />
            <rect
              x="113"
              y="77"
              width="17"
              height="44"
              rx="8"
              fill={fillFor("biceps", "#6ee7b7")}
              fillOpacity={opacityFor("biceps")}
            />
            {/* Core / Abs */}
            <rect
              x="60"
              y="82"
              width="40"
              height="48"
              rx="8"
              fill={fillFor("core", "#fda4af")}
              fillOpacity={opacityFor("core")}
            />
            {/* Quads */}
            <rect
              x="54"
              y="136"
              width="23"
              height="68"
              rx="10"
              fill={fillFor("quads", "#a7f3d0")}
              fillOpacity={opacityFor("quads")}
            />
            <rect
              x="83"
              y="136"
              width="23"
              height="68"
              rx="10"
              fill={fillFor("quads", "#a7f3d0")}
              fillOpacity={opacityFor("quads")}
            />
            {/* Calves (Front Shin/Calf) */}
            <rect
              x="56"
              y="210"
              width="19"
              height="52"
              rx="8"
              fill={fillFor("calves", "#bae6fd")}
              fillOpacity={opacityFor("calves")}
            />
            <rect
              x="85"
              y="210"
              width="19"
              height="52"
              rx="8"
              fill={fillFor("calves", "#bae6fd")}
              fillOpacity={opacityFor("calves")}
            />
          </svg>
        </div>

        {/* BACK VIEW SVG */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "0.74rem",
              fontWeight: 700,
              color: "var(--text-secondary)",
              marginBottom: "0.4rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Back
          </div>
          <svg
            viewBox="0 0 160 280"
            width="100%"
            style={{ maxHeight: 230 }}
            aria-label="Rückansicht Muskelgruppen"
          >
            {/* Head */}
            <circle cx="80" cy="26" r="16" fill="rgba(255,255,255,0.14)" />
            {/* Rear Shoulders */}
            <rect
              x="34"
              y="48"
              width="20"
              height="24"
              rx="9"
              fill={fillFor("shoulders", "#c4b5fd")}
              fillOpacity={opacityFor("shoulders")}
            />
            <rect
              x="106"
              y="48"
              width="20"
              height="24"
              rx="9"
              fill={fillFor("shoulders", "#c4b5fd")}
              fillOpacity={opacityFor("shoulders")}
            />
            {/* Upper & Mid Back / Lats */}
            <path
              d="M54 48 H106 L98 118 H62 Z"
              fill={fillFor("back", "#93c5fd")}
              fillOpacity={opacityFor("back")}
            />
            {/* Triceps */}
            <rect
              x="30"
              y="75"
              width="17"
              height="44"
              rx="8"
              fill={fillFor("triceps", "#fcd34d")}
              fillOpacity={opacityFor("triceps")}
            />
            <rect
              x="113"
              y="75"
              width="17"
              height="44"
              rx="8"
              fill={fillFor("triceps", "#fcd34d")}
              fillOpacity={opacityFor("triceps")}
            />
            {/* Glutes */}
            <rect
              x="54"
              y="122"
              width="52"
              height="28"
              rx="12"
              fill={fillFor("glutes", "#f5d0fe")}
              fillOpacity={opacityFor("glutes")}
            />
            {/* Hamstrings */}
            <rect
              x="54"
              y="154"
              width="23"
              height="52"
              rx="10"
              fill={fillFor("hamstrings", "#fde68a")}
              fillOpacity={opacityFor("hamstrings")}
            />
            <rect
              x="83"
              y="154"
              width="23"
              height="52"
              rx="10"
              fill={fillFor("hamstrings", "#fde68a")}
              fillOpacity={opacityFor("hamstrings")}
            />
            {/* Calves */}
            <rect
              x="56"
              y="210"
              width="19"
              height="52"
              rx="8"
              fill={fillFor("calves", "#bae6fd")}
              fillOpacity={opacityFor("calves")}
            />
            <rect
              x="85"
              y="210"
              width="19"
              height="52"
              rx="8"
              fill={fillFor("calves", "#bae6fd")}
              fillOpacity={opacityFor("calves")}
            />
          </svg>
        </div>
      </div>

      {/* Muscle Chips Breakdown */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
        {MUSCLE_GROUPS.map((m) => {
          const sets = setsByMuscle.get(m.id) ?? 0;
          return (
            <div
              key={m.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.3rem 0.65rem",
                borderRadius: "999px",
                fontSize: "0.76rem",
                fontWeight: sets > 0 ? 700 : 500,
                background:
                  sets > 0 ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
                border:
                  sets > 0
                    ? `1px solid ${m.pastelColor}`
                    : "1px solid var(--border-subtle)",
                color: sets > 0 ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor:
                    sets > 0 ? m.pastelColor : "rgba(255,255,255,0.18)",
                }}
              />
              <span>{m.label}</span>
              {sets > 0 && (
                <span style={{ color: m.pastelColor }}>{sets} Sätze</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
