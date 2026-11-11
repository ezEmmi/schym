"use client";

import React, { useState } from "react";
import { TrendingUp, Trophy, ChevronDown, ChevronUp } from "lucide-react";
import type { GymEntry } from "@/lib/db/schema";

interface ProgressionChartCardProps {
  gymEntries: GymEntry[];
}

export function ProgressionChartCard({
  gymEntries,
}: ProgressionChartCardProps) {
  const [isOpen, setIsOpen] = useState(false);

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

  const width = 560;
  const height = 165;
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
        marginTop: "1rem",
        padding: isOpen ? "1.15rem 1.25rem" : "0.85rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.9rem",
      }}
    >
      {/* Clickable Accordion Header */}
      <div
        onClick={() => setIsOpen((v) => !v)}
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
          <TrendingUp size={18} color="var(--pastel-mint)" />
          <span style={{ fontWeight: 800, fontSize: "0.95rem" }}>
            Kraft-Progression pro Maschine ({uniqueExercises.length} Maschinen)
          </span>
          {activeExercise && (
            <span
              className="badge badge-cardio"
              style={{ fontSize: "0.73rem" }}
            >
              {activeExercise}: {latestWeight} kg (
              {deltaKg >= 0 ? `+${deltaKg}` : deltaKg} kg)
            </span>
          )}
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
          <span>{isOpen ? "Einklappen" : "Kurve anzeigen"}</span>
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Unfolded Content */}
      {isOpen && (
        <div
          style={{
            paddingTop: "0.75rem",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            gap: "0.85rem",
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
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "1.1rem",
                fontSize: "0.82rem",
              }}
            >
              <div>
                <span style={{ color: "var(--text-secondary)" }}>Aktuell: </span>
                <strong style={{ color: "var(--pastel-lavender)" }}>
                  {latestWeight} kg
                </strong>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)" }}>PR: </span>
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
                  Steigerung:{" "}
                </span>
                <strong style={{ color: "var(--pastel-mint)" }}>
                  {deltaKg >= 0 ? `+${deltaKg} kg` : `${deltaKg} kg`}
                </strong>
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

          {history.length > 0 && (
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
                style={{ maxHeight: 185, overflow: "visible" }}
              >
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
          )}
        </div>
      )}
    </section>
  );
}
