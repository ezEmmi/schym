"use client";

import React, { useState } from "react";
import {
  Dumbbell,
  HeartPulse,
  Mountain,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import type { FitnessDataset } from "@/lib/db/schema";
import { computeWeeklySummary } from "@/lib/metrics";
import { SPORTS_CATALOG } from "@/lib/sports-catalog";
import { WeeklySplitCards } from "@/components/dashboard/WeeklySplitCards";
import { GymModule } from "@/components/loggers/GymModule";
import { CardioModule } from "@/components/loggers/CardioModule";
import { BoulderingModule } from "@/components/loggers/BoulderingModule";
import { StravaSyncModule } from "@/components/loggers/StravaSyncModule";

interface FitnessDashboardProps {
  initialData: FitnessDataset;
  todayIso: string;
}

type ActiveTab = "gym" | "cardio" | "bouldering" | "strava";

export function FitnessDashboard({
  initialData,
  todayIso,
}: FitnessDashboardProps) {
  const [data, setData] = useState<FitnessDataset>(initialData);
  const [activeTab, setActiveTab] = useState<ActiveTab>("cardio");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const summary = computeWeeklySummary(
    todayIso,
    data.gym,
    data.cardio,
    data.bouldering
  );

  async function submitEntry(
    type: "gym" | "cardio" | "bouldering",
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
          : json.error ?? "Failed to save entry";
        setErrorMsg(detail);
        return false;
      }

      setData(json.data);
      return true;
    } catch {
      setErrorMsg("Network error while saving entry.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(
    category: "gym" | "cardio" | "bouldering",
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
        setErrorMsg(json.error ?? "Could not delete entry.");
      }
    } catch {
      setErrorMsg("Network error while deleting entry.");
    }
  }

  return (
    <div className="app-shell">
      <header className="top-header">
        <div className="brand-group">
          <div className="brand-badge">S</div>
          <div>
            <h1 className="brand-title">SCHYM</h1>
            <p className="brand-subtitle">
              2x/wk Gym • {SPORTS_CATALOG.length}+ Sports &amp; Conditioning •
              Bouldering • Strava Sync
            </p>
          </div>
        </div>
        <div className="security-pill">
          <ShieldCheck size={16} />
          <span>
            Local SQLite (WAL) • Strict Zod Guard • Zero Cloud Telemetry
          </span>
        </div>
      </header>

      <WeeklySplitCards
        summary={summary}
        totalBoulderingProblems={data.bouldering.length}
      />

      <nav className="tabs-bar" aria-label="Fitness Modules">
        <button
          type="button"
          className={`tab-btn ${activeTab === "cardio" ? "active" : ""}`}
          onClick={() => setActiveTab("cardio")}
        >
          <HeartPulse size={17} color="var(--accent-cardio)" />
          <span>
            Multi-Sport &amp; Cardio ({data.cardio.length} logged •{" "}
            {SPORTS_CATALOG.length} sports)
          </span>
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "gym" ? "active" : ""}`}
          onClick={() => setActiveTab("gym")}
        >
          <Dumbbell size={17} color="var(--accent-gym)" />
          <span>Gym Logger ({data.gym.length})</span>
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "bouldering" ? "active" : ""}`}
          onClick={() => setActiveTab("bouldering")}
        >
          <Mountain size={17} color="var(--accent-boulder)" />
          <span>Bouldering &amp; Climbing ({data.bouldering.length})</span>
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "strava" ? "active" : ""}`}
          onClick={() => setActiveTab("strava")}
        >
          <RefreshCw size={17} color="#fc4c02" />
          <span>Strava Sync</span>
        </button>
      </nav>

      {errorMsg && (
        <div className="error-banner" role="alert">
          <strong>Validation / Security Guard:</strong> {errorMsg}
        </div>
      )}

      {activeTab === "gym" && (
        <GymModule
          entries={data.gym}
          todayIso={todayIso}
          isSubmitting={isSubmitting}
          onSubmit={(payload) => submitEntry("gym", payload)}
          onDelete={(id) => handleDelete("gym", id)}
        />
      )}

      {activeTab === "cardio" && (
        <CardioModule
          entries={data.cardio}
          todayIso={todayIso}
          isSubmitting={isSubmitting}
          onSubmit={(payload) => submitEntry("cardio", payload)}
          onDelete={(id) => handleDelete("cardio", id)}
        />
      )}

      {activeTab === "bouldering" && (
        <BoulderingModule
          entries={data.bouldering}
          todayIso={todayIso}
          isSubmitting={isSubmitting}
          onSubmit={(payload) => submitEntry("bouldering", payload)}
          onDelete={(id) => handleDelete("bouldering", id)}
        />
      )}

      {activeTab === "strava" && (
        <StravaSyncModule
          todayIso={todayIso}
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
