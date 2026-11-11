"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Bell,
  Send,
  Dumbbell,
  HeartPulse,
  Smartphone,
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
      setNotifStatus("Lokale Browser-Erinnerung aktiviert & Test gesendet!");
    } else {
      setNotifStatus("Bitte Browser-Berechtigung für Erinnerungen erlauben.");
    }
  }

  return (
    <section
      className="panel-card"
      style={{
        marginBottom: "1.35rem",
        background:
          "linear-gradient(135deg, rgba(203, 166, 247, 0.13) 0%, rgba(166, 227, 161, 0.09) 60%, rgba(250, 179, 135, 0.1) 100%)",
        border: "1px solid rgba(203, 166, 247, 0.32)",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", maxWidth: 680 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              fontSize: "0.74rem",
              fontWeight: 800,
              color: "var(--pastel-lavender)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            <Sparkles size={15} />
            <span>Smart Habit-Engine &amp; Daily Coach</span>
          </div>

          <h2 style={{ fontSize: "1.2rem", fontWeight: 900, letterSpacing: "-0.02em" }}>
            {briefing.headline}
          </h2>

          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>
            {briefing.subline}
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
          {briefing.recommendedAction === "gym" ? (
            <button
              type="button"
              className="pastel-btn btn-lavender"
              onClick={onStartGym}
            >
              <Dumbbell size={16} />
              <span>
                {briefing.recommendedTemplate
                  ? `„${briefing.recommendedTemplate.name}“ starten`
                  : "Gym Session starten"}
              </span>
            </button>
          ) : (
            <button
              type="button"
              className="pastel-btn btn-mint"
              onClick={onStartCardio}
            >
              <HeartPulse size={16} />
              <span>Sport / Cardio eintragen</span>
            </button>
          )}

          <button
            type="button"
            className="pill-tab"
            onClick={enableBrowserReminder}
            title="Lokale Browser-Push-Erinnerung testen"
          >
            <Bell size={14} style={{ display: "inline", marginRight: 5 }} />
            Erinnerung 🔔
          </button>

          <button
            type="button"
            className="pill-tab active"
            onClick={onOpenMobileAndSignal}
          >
            <Smartphone size={14} style={{ display: "inline", marginRight: 5 }} />
            <Send size={13} style={{ display: "inline", marginRight: 5 }} />
            Signal-Bot &amp; Handy-App 📲
          </button>
        </div>
      </div>

      {notifStatus && (
        <div
          style={{
            fontSize: "0.8rem",
            color: "var(--pastel-mint)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <CheckCircle2 size={15} />
          <span>{notifStatus}</span>
        </div>
      )}

      {/* Learned Weekly Habit Rhythm Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.6rem",
          paddingTop: "0.75rem",
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <span
          style={{
            fontSize: "0.76rem",
            fontWeight: 700,
            color: "var(--text-secondary)",
          }}
        >
          Dein gelernter Wochen-Rhythmus (aus deinen Daten):
        </span>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          {briefing.weekdayHabits.map((h) => {
            const colorMap = {
              gym: "var(--pastel-lavender)",
              cardio: "var(--pastel-mint)",
              bouldering: "var(--pastel-peach)",
              rest: "var(--text-muted)",
            };
            const col = colorMap[h.dominantType];
            return (
              <div
                key={h.weekdayShort}
                style={{
                  fontSize: "0.74rem",
                  padding: "0.24rem 0.6rem",
                  borderRadius: 999,
                  background: "rgba(24, 25, 38, 0.65)",
                  border:
                    h.dominantType !== "rest"
                      ? `1px solid ${col}`
                      : "1px solid var(--border-subtle)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <strong style={{ color: "var(--text-primary)" }}>
                  {h.weekdayShort}:
                </strong>
                <span style={{ color: col, fontWeight: 700 }}>{h.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
