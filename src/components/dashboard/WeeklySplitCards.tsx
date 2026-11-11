"use client";

import React from "react";
import { Dumbbell, HeartPulse, Mountain } from "lucide-react";
import type { WeeklyAdherenceSummary } from "@/lib/metrics";

interface WeeklySplitCardsProps {
  summary: WeeklyAdherenceSummary;
  totalBoulderingProblems: number;
}

export function WeeklySplitCards({
  summary,
  totalBoulderingProblems,
}: WeeklySplitCardsProps) {
  const gymPct = Math.min(
    100,
    Math.round((summary.gymDaysCount / summary.gymTarget) * 100)
  );
  const cardioPct = Math.min(
    100,
    Math.round((summary.cardioSessionsCount / summary.cardioTarget) * 100)
  );
  const boulderPct = Math.min(100, summary.boulderingSessionsCount * 100);

  return (
    <section className="split-grid" aria-label="Weekly Training Split Progress">
      <div className="metric-card">
        <div className="metric-top">
          <span className="metric-label">Gym Strength (Target: 2x / wk)</span>
          <Dumbbell size={18} color="var(--accent-gym)" />
        </div>
        <div className="metric-value">
          {summary.gymDaysCount} / {summary.gymTarget}{" "}
          <span
            style={{
              fontSize: "0.95rem",
              color: "var(--text-secondary)",
              fontWeight: 500,
            }}
          >
            days this week
          </span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width: `${gymPct}%`,
              backgroundColor: "var(--accent-gym)",
            }}
          />
        </div>
        <div className="metric-foot">
          <span>Weekly Tonnage: {summary.totalVolumeKg.toLocaleString()} kg</span>
          <span>Week of {summary.weekStart}</span>
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-top">
          <span className="metric-label">
            Cardio Conditioning (Target: 2+ / wk)
          </span>
          <HeartPulse size={18} color="var(--accent-cardio)" />
        </div>
        <div className="metric-value">
          {summary.cardioSessionsCount} / {summary.cardioTarget}+{" "}
          <span
            style={{
              fontSize: "0.95rem",
              color: "var(--text-secondary)",
              fontWeight: 500,
            }}
          >
            sessions
          </span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width: `${cardioPct}%`,
              backgroundColor: "var(--accent-cardio)",
            }}
          />
        </div>
        <div className="metric-foot">
          <span>Total Time: {summary.totalCardioMinutes} min</span>
          <span>
            {summary.cardioSessionsCount >= summary.cardioTarget
              ? "Target Hit!"
              : `${summary.cardioTarget - summary.cardioSessionsCount} more to go`}
          </span>
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-top">
          <span className="metric-label">Bouldering &amp; Climbing</span>
          <Mountain size={18} color="var(--accent-boulder)" />
        </div>
        <div className="metric-value">
          {summary.boulderingSendsCount}{" "}
          <span
            style={{
              fontSize: "0.95rem",
              color: "var(--text-secondary)",
              fontWeight: 500,
            }}
          >
            tops ({summary.boulderingSessionsCount} session
            {summary.boulderingSessionsCount === 1 ? "" : "s"} this wk)
          </span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width: `${boulderPct}%`,
              backgroundColor: "var(--accent-boulder)",
            }}
          />
        </div>
        <div className="metric-foot">
          <span>All-Time Logged Problems: {totalBoulderingProblems}</span>
          <span>Skin &amp; Finger Tracked</span>
        </div>
      </div>
    </section>
  );
}
