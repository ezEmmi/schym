"use client";

import React from "react";
import { Dumbbell, HeartPulse, Mountain, Flame } from "lucide-react";
import type { WeeklyAdherenceSummary } from "@/lib/metrics";

interface WeeklySplitCardsProps {
  summary: WeeklyAdherenceSummary;
}

export function WeeklySplitCards({ summary }: WeeklySplitCardsProps) {
  const gymPct = Math.min(
    100,
    Math.round((summary.gymDaysCount / summary.gymTarget) * 100)
  );
  const cardioPct = Math.min(
    100,
    Math.round((summary.cardioSessionsCount / summary.cardioTarget) * 100)
  );

  return (
    <section className="split-grid" aria-label="Wochen-Fortschritt">
      {/* 1. Weekly Streak Card */}
      <div className="metric-card pastel-card-peach">
        <div className="metric-top">
          <span className="metric-label">Wochen-Streak</span>
          <Flame size={19} color="var(--pastel-peach)" />
        </div>
        <div className="metric-value">
          {summary.weeklyStreakCount}{" "}
          <span className="metric-unit">
            {summary.weeklyStreakCount === 1 ? "Woche" : "Wochen"} 🔥
          </span>
        </div>
        <div className="metric-foot">
          <span>{summary.activeDaysThisWeek} aktive Tage diese Woche</span>
        </div>
      </div>

      {/* 2. Gym 2x/wk Card */}
      <div className="metric-card pastel-card-lavender">
        <div className="metric-top">
          <span className="metric-label">Gym (Ziel: 2x / Woche)</span>
          <Dumbbell size={19} color="var(--pastel-lavender)" />
        </div>
        <div className="metric-value">
          {summary.gymDaysCount} / {summary.gymTarget}{" "}
          <span className="metric-unit">Sessions</span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width: `${gymPct}%`,
              backgroundColor: "var(--pastel-lavender)",
            }}
          />
        </div>
        <div className="metric-foot">
          <span>Volumen: {summary.totalVolumeKg.toLocaleString()} kg</span>
        </div>
      </div>

      {/* 3. Cardio & Multi-Sport 2+/wk Card */}
      <div className="metric-card pastel-card-mint">
        <div className="metric-top">
          <span className="metric-label">Cardio &amp; Sport (2+ / Woche)</span>
          <HeartPulse size={19} color="var(--pastel-mint)" />
        </div>
        <div className="metric-value">
          {summary.cardioSessionsCount} / {summary.cardioTarget}+{" "}
          <span className="metric-unit">Sessions</span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width: `${cardioPct}%`,
              backgroundColor: "var(--pastel-mint)",
            }}
          />
        </div>
        <div className="metric-foot">
          <span>Dauer: {summary.totalCardioMinutes} Min</span>
        </div>
      </div>

      {/* 4. Bouldering Card */}
      <div className="metric-card pastel-card-pink">
        <div className="metric-top">
          <span className="metric-label">Bouldern &amp; Klettern</span>
          <Mountain size={19} color="var(--pastel-pink)" />
        </div>
        <div className="metric-value">
          {summary.boulderingSendsCount}{" "}
          <span className="metric-unit">
            Tops ({summary.boulderingSessionsCount} Sessions)
          </span>
        </div>
        <div className="metric-foot">
          <span>Woche ab {summary.weekStart}</span>
        </div>
      </div>
    </section>
  );
}
