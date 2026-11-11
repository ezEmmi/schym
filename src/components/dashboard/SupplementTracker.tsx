"use client";

import React, { useState } from "react";
import { Pill, Check, Plus, Trash2 } from "lucide-react";
import type {
  SupplementItem,
  SupplementLog,
  SupplementTiming,
} from "@/lib/db/schema";
import { supplementTimings } from "@/lib/validation/fitness";

interface SupplementTrackerProps {
  supplements: SupplementItem[];
  supplementLogs: SupplementLog[];
  todayIso: string;
  onToggleSupplement: (supplementId: number) => Promise<boolean>;
  onAddSupplement: (payload: Record<string, unknown>) => Promise<boolean>;
  onDeleteSupplement: (id: number) => Promise<void>;
}

const PASTEL_SWATCHES = [
  "#cba6f7",
  "#a6e3a1",
  "#89dceb",
  "#fab387",
  "#f5c2e7",
];

export function SupplementTracker({
  supplements,
  supplementLogs,
  todayIso,
  onToggleSupplement,
  onAddSupplement,
  onDeleteSupplement,
}: SupplementTrackerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("5g");
  const [timing, setTiming] = useState<SupplementTiming>("Morgens");

  const takenTodaySet = new Set(
    supplementLogs
      .filter((l) => l.logDate === todayIso)
      .map((l) => l.supplementId)
  );

  const takenCount = supplements.filter((s) => takenTodaySet.has(s.id)).length;

  return (
    <section
      className="panel-card"
      style={{
        marginBottom: "1.4rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.95rem",
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
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <Pill size={19} color="var(--pastel-sky)" />
          <div>
            <h2 className="panel-title" style={{ margin: 0 }}>
              Daily Supplement-Tracker ({takenCount} / {supplements.length}{" "}
              heute genommen)
            </h2>
            <p
              style={{
                fontSize: "0.78rem",
                color: "var(--text-secondary)",
                marginTop: 1,
              }}
            >
              1-Klick Abhaken für heute ({todayIso}) — der Smart Coach erinnert
              dich an offene Supplements
            </p>
          </div>
        </div>

        <button
          type="button"
          className="pill-tab"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus size={14} style={{ display: "inline", marginRight: 4 }} />
          {showAddForm ? "Schließen" : "Eigenes Supplement +"}
        </button>
      </div>

      {/* Clickable Supplement Pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
        {supplements.map((supp) => {
          const isTaken = takenTodaySet.has(supp.id);
          return (
            <div
              key={supp.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.48rem 0.85rem",
                borderRadius: 14,
                background: isTaken
                  ? "rgba(166, 227, 161, 0.14)"
                  : "var(--bg-soft)",
                border: isTaken
                  ? "1px solid var(--pastel-mint)"
                  : "1px solid var(--border-subtle)",
                transition: "all 0.14s ease",
              }}
            >
              <button
                type="button"
                onClick={() => onToggleSupplement(supp.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontSize: "0.84rem",
                  fontWeight: isTaken ? 800 : 600,
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    background: isTaken
                      ? "var(--pastel-mint)"
                      : "rgba(255,255,255,0.08)",
                    color: "#181926",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isTaken && <Check size={14} strokeWidth={3} />}
                </span>
                <span
                  style={{
                    textDecoration: isTaken ? "line-through" : "none",
                    opacity: isTaken ? 0.88 : 1,
                  }}
                >
                  {supp.name}
                </span>
                <span
                  style={{
                    fontSize: "0.73rem",
                    padding: "0.1rem 0.45rem",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.06)",
                    color: supp.color,
                    fontWeight: 700,
                  }}
                >
                  {supp.dosage} • {supp.timing}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onDeleteSupplement(supp.id)}
                className="delete-btn"
                style={{ padding: "0.15rem" }}
                title="Supplement entfernen"
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add New Custom Supplement Form */}
      {showAddForm && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (name.trim().length < 2) return;
            const randomColor =
              PASTEL_SWATCHES[supplements.length % PASTEL_SWATCHES.length] ??
              "#cba6f7";
            const ok = await onAddSupplement({
              name: name.trim(),
              dosage: dosage.trim() || "1 Portion",
              timing,
              color: randomColor,
            });
            if (ok) {
              setName("");
              setShowAddForm(false);
            }
          }}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.6rem",
            alignItems: "flex-end",
            background: "var(--bg-soft)",
            padding: "0.85rem",
            borderRadius: 14,
            border: "1px solid var(--border-subtle)",
          }}
        >
          <label className="field-label" style={{ flex: 2, minWidth: 160 }}>
            Supplement Name
            <input
              type="text"
              className="field-input"
              placeholder="z.B. Ashwagandha, Zink, Citrullin..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="field-label" style={{ flex: 1, minWidth: 110 }}>
            Dosierung
            <input
              type="text"
              className="field-input"
              placeholder="z.B. 5g / 2 Kapseln"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              required
            />
          </label>
          <label className="field-label" style={{ flex: 1, minWidth: 120 }}>
            Einnahmezeit
            <select
              className="field-select"
              value={timing}
              onChange={(e) => setTiming(e.target.value as SupplementTiming)}
            >
              {supplementTimings.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="pastel-btn btn-lavender">
            + Speichern
          </button>
        </form>
      )}
    </section>
  );
}
