"use client";

import React, { useState } from "react";
import { TrendingUp, Trophy } from "lucide-react";
import type { GymEntry } from "@/lib/db/schema";

interface ProgressionChartCardProps {
  gymEntries: GymEntry[];
}

export function ProgressionChartCard({
  gymEntries,
}: ProgressionChartCardProps) {
  const uniqueExercises = Array.from(
    new Set(gymEntries.map((g) => g.exerciseName))
  );

  const [selectedExercise, setSelectedExercise] = useState<string>(
    uniqueExercises[0] ?? ""
  );

  const activeExercise =
    selectedExercise && uniqueExercises.includes(selectedExercise)
      ? selectedExercise
      : uniqueExercises[0] ?? "";

  // Chronological order (oldest -> newest) for the selected machine
  const history = gymEntries
    .filter((g) => g.exerciseName === activeExercise)
    .slice()
    .reverse();

  const maxWeight =
    history.length > 0 ? Math.max(...history.map((h) => h.weightKg)) : 0;
  const max1Rm =
    history.length > 0 ? Math.max(...history.map((h) => h.estimated1Rm)) : 0;
  const firstWeight = history[0]?.weightKg ?? 0;
  const latestWeight = history[history.length - 1]?.weightKg ?? 0;
  const deltaKg = Math.round((latestWeight - firstWeight) * 10) / 10;

  // Compute SVG polyline points
  const width = 560;
  const height = 170;
  const padX = 36;
  const padY = 26;

  const minVal =
    history.length > 0
      ? Math.max(0, Math.min(...history.map((h) => h.weightKg)) - 5)
      : 0;
  const maxVal = Math.max(minVal + 10, maxWeight + 5);

  const points = history.map((item, idx) => {
    const x =
      history.length === 1
        ? width / 2
        : padX + (idx / (history.length - 1)) * (width - padX * 2);
    const y =
      height -
      padY -
      ((item.weightKg - minVal) / (maxVal - minVal)) * (height - padY * 2);
    return { x, y, item };
  });

  const polylineStr = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <section
      className="panel-card"
      style={{
        marginTop: "1.35rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
          <TrendingUp size={20} color="var(--pastel-mint)" />
          <div>
            <h2 className="panel-title" style={{ margin: 0 }}>
              Kraft- &amp; Gewichts-Progression pro Maschine
            </h2>
            <p
              style={{
                fontSize: "0.78rem",
                color: "var(--text-secondary)",
                marginTop: 1,
              }}
            >
              Verfolge deinen Kraftanstieg aus deinen Hevy-Importen &amp; Live
              Gym-Sessions
            </p>
          </div>
        </div>

        {uniqueExercises.length > 0 && (
          <select
            className="field-select"
            style={{ minWidth: 230 }}
            value={activeExercise}
            onChange={(e) => setSelectedExercise(e.target.value)}
          >
            {uniqueExercises.map((ex) => (
              <option key={ex} value={ex}>
                {ex}
              </option>
            ))}
          </select>
        )}
      </div>

      {history.length === 0 ? (
        <div
          style={{
            padding: "1.5rem",
            textAlign: "center",
            background: "var(--bg-soft)",
            borderRadius: 14,
            color: "var(--text-secondary)",
            fontSize: "0.84rem",
          }}
        >
          Sobald du deine Hevy-CSV importierst oder ein Gym-Workout loggst,
          erscheint hier deine Kraft-Kurve für jede Maschine!
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "1.25rem",
              fontSize: "0.83rem",
            }}
          >
            <div>
              <span style={{ color: "var(--text-secondary)" }}>
                Aktuelles Gewicht:{" "}
              </span>
              <strong style={{ color: "var(--pastel-lavender)" }}>
                {latestWeight} kg
              </strong>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)" }}>
                All-Time Rekord (PR):{" "}
              </span>
              <strong style={{ color: "var(--pastel-peach)" }}>
                <Trophy
                  size={13}
                  style={{ display: "inline", marginRight: 3 }}
                />
                {maxWeight} kg (e1RM: {max1Rm} kg)
              </strong>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)" }}>
                Steigerung seit Start:{" "}
              </span>
              <strong
                style={{
                  color:
                    deltaKg >= 0 ? "var(--pastel-mint)" : "var(--text-secondary)",
                }}
              >
                {deltaKg >= 0 ? `+${deltaKg} kg` : `${deltaKg} kg`}
              </strong>
            </div>
          </div>

          <div
            style={{
              background: "var(--bg-soft)",
              borderRadius: 16,
              padding: "0.85rem",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <svg
              viewBox={`0 0 ${width} ${height}`}
              width="100%"
              style={{ maxHeight: 190, overflow: "visible" }}
            >
              {/* Subtle horizontal grid lines */}
              <line
                x1={padX}
                y1={padY}
                x2={width - padX}
                y2={padY}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="4 4"
              />
              <line
                x1={padX}
                y1={height - padY}
                x2={width - padX}
                y2={height - padY}
                stroke="rgba(255,255,255,0.08)"
              />

              {points.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#cba6f7"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={polylineStr}
                />
              )}

              {points.map((p, i) => (
                <g key={i}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="5"
                    fill="#a6e3a1"
                    stroke="#181926"
                    strokeWidth="2"
                  />
                  <text
                    x={p.x}
                    y={p.y - 10}
                    textAnchor="middle"
                    fill="#f4f5f8"
                    fontSize="10"
                    fontWeight="700"
                  >
                    {p.item.weightKg}kg
                  </text>
                  <text
                    x={p.x}
                    y={height - 6}
                    textAnchor="middle"
                    fill="#a6adc8"
                    fontSize="9"
                  >
                    {p.item.sessionDate.slice(5)}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </>
      )}
    </section>
  );
}
