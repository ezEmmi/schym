"use client";

import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  CalendarDays,
  History,
} from "lucide-react";
import type { FitnessDataset } from "@/lib/db/schema";

interface ActivityCalendarProps {
  data: FitnessDataset;
  todayIso: string;
  weeklyStreakCount: number;
  activeDaysThisWeek: number;
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTH_NAMES = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

export function ActivityCalendar({
  data,
  todayIso,
  weeklyStreakCount,
  activeDaysThisWeek,
}: ActivityCalendarProps) {
  // Find latest logged activity date across all disciplines (so imported 2025/2026 Hevy CSVs are immediately visible!)
  const allDates = [
    ...data.gym.map((g) => g.sessionDate),
    ...data.cardio.map((c) => c.sessionDate),
    ...data.bouldering.map((b) => b.sessionDate),
  ]
    .filter(Boolean)
    .sort();

  const latestActivityDate = allDates[allDates.length - 1] ?? todayIso;

  const [year, setYear] = useState(() =>
    Number(latestActivityDate.slice(0, 4))
  );
  const [month, setMonth] = useState(
    () => Number(latestActivityDate.slice(5, 7)) - 1
  );
  const [selectedDay, setSelectedDay] = useState<string>(latestActivityDate);

  // When a new CSV import arrives and changes latestActivityDate, jump to it automatically
  useEffect(() => {
    if (latestActivityDate) {
      setYear(Number(latestActivityDate.slice(0, 4)));
      setMonth(Number(latestActivityDate.slice(5, 7)) - 1);
      setSelectedDay(latestActivityDate);
    }
  }, [latestActivityDate]);

  const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const startOffset = (firstDayOfMonth.getUTCDay() + 6) % 7;

  const cells: Array<string | null> = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(
      d
    ).padStart(2, "0")}`;
    cells.push(iso);
  }

  function changeMonth(delta: number) {
    const next = new Date(Date.UTC(year, month + delta, 1));
    setYear(next.getUTCFullYear());
    setMonth(next.getUTCMonth());
  }

  function jumpToDate(iso: string) {
    setYear(Number(iso.slice(0, 4)));
    setMonth(Number(iso.slice(5, 7)) - 1);
    setSelectedDay(iso);
  }

  const dayGym = data.gym.filter((g) => g.sessionDate === selectedDay);
  const dayCardio = data.cardio.filter((c) => c.sessionDate === selectedDay);
  const dayBoulder = data.bouldering.filter(
    (b) => b.sessionDate === selectedDay
  );

  return (
    <div
      className="panel-card"
      style={{ display: "flex", flexDirection: "column", gap: "1.05rem" }}
    >
      {/* Top Row: Title + Streak Pill */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.65rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
          <CalendarDays size={20} color="var(--pastel-lavender)" />
          <h2 className="panel-title" style={{ margin: 0 }}>
            Aktivitäts-Kalender
          </h2>
        </div>

        <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
          {allDates.length > 0 && (
            <button
              type="button"
              className="pill-tab"
              style={{ fontSize: "0.72rem", padding: "0.3rem 0.65rem" }}
              onClick={() => jumpToDate(latestActivityDate)}
              title="Zum neuesten importierten oder geloggten Training springen"
            >
              <History size={13} style={{ display: "inline", marginRight: 4 }} />
              Letztes Training ({latestActivityDate})
            </button>
          )}

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.32rem 0.75rem",
              borderRadius: "999px",
              background: "rgba(250, 179, 135, 0.14)",
              border: "1px solid rgba(250, 179, 135, 0.35)",
              color: "var(--pastel-peach)",
              fontWeight: 700,
              fontSize: "0.78rem",
            }}
          >
            <Flame size={14} />
            <span>
              {weeklyStreakCount}{" "}
              {weeklyStreakCount === 1 ? "Woche" : "Wochen"} Streak •{" "}
              {activeDaysThisWeek}T aktiv
            </span>
          </div>
        </div>
      </div>

      {/* Month Switcher */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--bg-soft)",
          padding: "0.5rem 0.85rem",
          borderRadius: "12px",
        }}
      >
        <button
          type="button"
          className="icon-btn"
          onClick={() => changeMonth(-1)}
          aria-label="Vorheriger Monat"
        >
          <ChevronLeft size={18} />
        </button>
        <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          type="button"
          className="icon-btn"
          onClick={() => changeMonth(1)}
          aria-label="Nächster Monat"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="calendar-grid">
        {WEEKDAYS.map((w) => (
          <div key={w} className="calendar-weekday">
            {w}
          </div>
        ))}
        {cells.map((iso, idx) => {
          if (!iso) {
            return <div key={`empty-${idx}`} className="calendar-cell empty" />;
          }
          const hasGym = data.gym.some((g) => g.sessionDate === iso);
          const hasCardio = data.cardio.some((c) => c.sessionDate === iso);
          const hasBoulder = data.bouldering.some((b) => b.sessionDate === iso);
          const isSelected = selectedDay === iso;
          const isToday = todayIso === iso;

          return (
            <button
              key={iso}
              type="button"
              onClick={() => setSelectedDay(iso)}
              className={`calendar-cell ${isSelected ? "selected" : ""} ${
                isToday ? "today" : ""
              }`}
            >
              <span className="calendar-day-num">
                {Number(iso.slice(8, 10))}
              </span>
              <div className="calendar-dots">
                {hasGym && (
                  <span
                    className="cal-dot"
                    style={{ backgroundColor: "var(--pastel-lavender)" }}
                    title="Gym"
                  />
                )}
                {hasCardio && (
                  <span
                    className="cal-dot"
                    style={{ backgroundColor: "var(--pastel-mint)" }}
                    title="Cardio / Sport"
                  />
                )}
                {hasBoulder && (
                  <span
                    className="cal-dot"
                    style={{ backgroundColor: "var(--pastel-peach)" }}
                    title="Bouldern"
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          fontSize: "0.75rem",
          color: "var(--text-secondary)",
          flexWrap: "wrap",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            className="cal-dot"
            style={{ backgroundColor: "var(--pastel-lavender)" }}
          />
          Gym Workout
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            className="cal-dot"
            style={{ backgroundColor: "var(--pastel-mint)" }}
          />
          Cardio / Strava Sport
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            className="cal-dot"
            style={{ backgroundColor: "var(--pastel-peach)" }}
          />
          Bouldern
        </span>
      </div>

      {/* Selected Day Details */}
      <div
        style={{
          background: "var(--bg-soft)",
          borderRadius: 12,
          padding: "0.85rem 1rem",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            fontSize: "0.8rem",
            fontWeight: 700,
            color: "var(--text-secondary)",
            marginBottom: "0.45rem",
          }}
        >
          Aktivitäten am {selectedDay}:
        </div>
        {dayGym.length === 0 &&
        dayCardio.length === 0 &&
        dayBoulder.length === 0 ? (
          <p style={{ fontSize: "0.83rem", color: "var(--text-muted)" }}>
            Kein Training an diesem Tag eingetragen (Rest Day ✨).
          </p>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}
          >
            {dayGym.map((g) => (
              <div
                key={`g-${g.id}`}
                style={{ fontSize: "0.84rem", display: "flex", gap: "0.5rem" }}
              >
                <span
                  style={{ color: "var(--pastel-lavender)", fontWeight: 700 }}
                >
                  [Gym]
                </span>
                <span>
                  {g.exerciseName} — {g.sets}×{g.reps} @ {g.weightKg}kg
                </span>
              </div>
            ))}
            {dayCardio.map((c) => (
              <div
                key={`c-${c.id}`}
                style={{ fontSize: "0.84rem", display: "flex", gap: "0.5rem" }}
              >
                <span style={{ color: "var(--pastel-mint)", fontWeight: 700 }}>
                  [{c.modality}]
                </span>
                <span>
                  {c.durationMinutes} min
                  {c.distanceKm > 0 ? ` • ${c.distanceKm} km` : ""}
                  {c.notes ? ` — ${c.notes}` : ""}
                </span>
              </div>
            ))}
            {dayBoulder.map((b) => (
              <div
                key={`b-${b.id}`}
                style={{ fontSize: "0.84rem", display: "flex", gap: "0.5rem" }}
              >
                <span style={{ color: "var(--pastel-peach)", fontWeight: 700 }}>
                  [Boulder]
                </span>
                <span>
                  {b.grade} ({b.style}) @ {b.location}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
