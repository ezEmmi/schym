"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Dumbbell,
  HeartPulse,
  ChevronDown,
  ChevronUp,
  Send,
  Bell,
  CheckCircle2,
} from "lucide-react";
import type { DailyCoachBriefing } from "@/lib/coach";

interface SmartCoachBannerProps {
  briefing: DailyCoachBriefing;
  onStartGym: () => void;
  onStartCardio: () => void;
  onOpenMobileAndSignal: () => void;
}

export function SmartCoachBanner({
  briefing,
  onStartGym,
  onStartCardio,
  onOpenMobileAndSignal,
}: SmartCoachBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [notifStatus, setNotifStatus] = useState<string | null>(null);

  async function enableBrowserReminder() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifStatus("Dein Browser unterstützt keine lokalen Notifications.");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      new Notification("Schym Smart Coach 💪", {
        body: `${briefing.headline} — ${briefing.subline}`,
      });
      setNotifStatus("Lokale Browser-Erinnerung aktiviert!");
    } else {
      setNotifStatus("Bitte Browser-Berechtigung erlauben.");
    }
  }

  return (
    <section
      className="panel-card"
      style={{
        marginBottom: "0.85rem",
        padding: "0.9rem 1.15rem",
        background:
          "linear-gradient(135deg, rgba(203, 166, 247, 0.12) 0%, rgba(166, 227, 161, 0.08) 100%)",
        border: "1px solid rgba(203, 166, 247, 0.28)",
      }}
    >
      {/* Compact Single Row */}
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
            alignItems: "center",
            gap: "0.65rem",
            flex: 1,
            minWidth: 240,
            cursor: "pointer",
          }}
          onClick={() => setIsExpanded((v) => !v)}
        >
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "rgba(203, 166, 247, 0.18)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--pastel-lavender)",
              flexShrink: 0,
            }}
          >
            <Sparkles size={17} />
          </span>
          <div>
            <div
              style={{
                fontSize: "0.95rem",
                fontWeight: 800,
                color: "var(--text-primary)",
              }}
            >
              {briefing.headline}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
              {briefing.subline}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {briefing.recommendedAction === "gym" ? (
            <button
              type="button"
              className="pastel-btn btn-lavender"
              style={{ padding: "0.5rem 0.95rem", fontSize: "0.8rem" }}
              onClick={onStartGym}
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
              style={{ padding: "0.5rem 0.95rem", fontSize: "0.8rem" }}
              onClick={onStartCardio}
            >
              <HeartPulse size={15} />
              <span>Sport loggen</span>
            </button>
          )}

          <button
            type="button"
            className="pill-tab"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "0.45rem 0.75rem",
            }}
            onClick={() => setIsExpanded((v) => !v)}
          >
            <span>Wochen-Rhythmus</span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Expandable Details on Click */}
      {isExpanded && (
        <div
          style={{
            marginTop: "0.85rem",
            paddingTop: "0.85rem",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
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
                      fontSize: "0.73rem",
                      padding: "0.2rem 0.55rem",
                      borderRadius: 999,
                      background: "var(--bg-soft)",
                      border:
                        h.dominantType !== "rest"
                          ? `1px solid ${col}`
                          : "1px solid var(--border-subtle)",
                    }}
                  >
                    <strong>{h.weekdayShort}:</strong>{" "}
                    <span style={{ color: col, fontWeight: 700 }}>{h.label}</span>
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
                Per Signal ans Handy senden
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
    </section>
  );
}
