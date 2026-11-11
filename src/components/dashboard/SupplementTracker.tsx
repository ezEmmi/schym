"use client";

import React, { useState } from "react";
import { Pill, Check, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
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
  const [showManage, setShowManage] = useState(false);
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
        marginBottom: "1.1rem",
        padding: "0.75rem 1.1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      {/* Compact Single Row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.6rem",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.45rem",
            fontSize: "0.84rem",
            fontWeight: 800,
          }}
        >
          <Pill size={16} color="var(--pastel-sky)" />
          <span>
            Supplements ({takenCount}/{supplements.length})
          </span>
        </div>

        {/* Inline 1-Click Pills */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.4rem",
            flex: 1,
            justifyContent: "flex-start",
          }}
        >
          {supplements.map((supp) => {
            const isTaken = takenTodaySet.has(supp.id);
            return (
              <div
                key={supp.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "0.28rem 0.65rem",
                  borderRadius: 999,
                  background: isTaken
                    ? "rgba(166, 227, 161, 0.16)"
                    : "var(--bg-soft)",
                  border: isTaken
                    ? "1px solid var(--pastel-mint)"
                    : "1px solid var(--border-subtle)",
                  fontSize: "0.76rem",
                }}
              >
                <button
                  type="button"
                  onClick={() => onToggleSupplement(supp.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    background: "transparent",
                    border: "none",
                    color: isTaken ? "var(--pastel-mint)" : "var(--text-primary)",
                    cursor: "pointer",
                    fontWeight: isTaken ? 800 : 600,
                    fontSize: "0.76rem",
                  }}
                >
                  {isTaken && <Check size={12} strokeWidth={3} />}
                  <span>{supp.name}</span>
                  <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>
                    ({supp.dosage})
                  </span>
                </button>
                {showManage && (
                  <button
                    type="button"
                    onClick={() => onDeleteSupplement(supp.id)}
                    className="delete-btn"
                    style={{ padding: 2 }}
                    title="Löschen"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="pill-tab"
          style={{
            padding: "0.3rem 0.65rem",
            fontSize: "0.74rem",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
          onClick={() => setShowManage((v) => !v)}
        >
          <Plus size={12} />
          <span>Anpassen</span>
          {showManage ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Expandable Add Form */}
      {showManage && (
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
              setShowManage(false);
            }
          }}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            alignItems: "flex-end",
            paddingTop: "0.65rem",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <label className="field-label" style={{ flex: 2, minWidth: 150 }}>
            Neues Supplement
            <input
              type="text"
              className="field-input"
              placeholder="z.B. Zink, Ashwagandha..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="field-label" style={{ flex: 1, minWidth: 100 }}>
            Dosis
            <input
              type="text"
              className="field-input"
              placeholder="5g"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              required
            />
          </label>
          <label className="field-label" style={{ flex: 1, minWidth: 110 }}>
            Timing
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
          <button
            type="submit"
            className="pastel-btn btn-lavender"
            style={{ padding: "0.55rem 0.9rem", fontSize: "0.8rem" }}
          >
            + Hinzufügen
          </button>
        </form>
      )}
    </section>
  );
}
