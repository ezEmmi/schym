"use client";

import React from "react";

export function SchymLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
      <svg
        width="48"
        height="48"
        viewBox="0 0 56 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          filter: "drop-shadow(0 8px 18px rgba(196, 181, 253, 0.22))",
          flexShrink: 0,
        }}
      >
        <rect
          x="2"
          y="2"
          width="52"
          height="52"
          rx="16"
          fill="url(#schym_bg)"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="1.5"
        />
        {/* Minimalist Boulder / Mountain Peak */}
        <path
          d="M14 39L24.5 19L32 31L37.5 23.5L44 39H14Z"
          fill="url(#schym_peak)"
          fillOpacity="0.9"
        />
        {/* Heartbeat / Barbell Wave Overlay */}
        <path
          d="M11 32H18.5L22 24L26.5 37L31 28L34.5 32H45"
          stroke="#181926"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="42" cy="15" r="4" fill="#fde68a" />
        <defs>
          <linearGradient
            id="schym_bg"
            x1="0"
            y1="0"
            x2="56"
            y2="56"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#c4b5fd" />
            <stop offset="0.5" stopColor="#a7f3d0" />
            <stop offset="1" stopColor="#fbcfe8" />
          </linearGradient>
          <linearGradient
            id="schym_peak"
            x1="28"
            y1="18"
            x2="28"
            y2="39"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#1e2030" stopOpacity="0.25" />
            <stop offset="1" stopColor="#1e2030" stopOpacity="0.55" />
          </linearGradient>
        </defs>
      </svg>
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.55rem",
          }}
        >
          <span
            style={{
              fontSize: "1.55rem",
              fontWeight: 900,
              letterSpacing: "-0.04em",
              background:
                "linear-gradient(95deg, #f5e0dc 0%, #cba6f7 48%, #a6e3a1 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            schym.
          </span>
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              padding: "0.18rem 0.55rem",
              borderRadius: "999px",
              background: "rgba(203, 166, 247, 0.14)",
              color: "#cba6f7",
              border: "1px solid rgba(203, 166, 247, 0.28)",
            }}
          >
            LOCAL-FIRST
          </span>
        </div>
        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--text-secondary)",
            marginTop: "-2px",
          }}
        >
          Dein smarter Gym, Cardio &amp; Strava Begleiter
        </p>
      </div>
    </div>
  );
}
