"use client";

import React, { useState } from "react";
import {
  RefreshCw,
  CheckCircle2,
  Upload,
  ClipboardPaste,
  KeyRound,
  X,
  Sparkles,
} from "lucide-react";
import type { FitnessDataset } from "@/lib/db/schema";

interface StravaSyncModuleProps {
  todayIso: string;
  onSynced: (newData: FitnessDataset, importedCount: number) => void;
  onError: (msg: string) => void;
  onClose?: () => void;
}

type ImportTab = "file_drop" | "copy_paste" | "oauth_free";

export function StravaSyncModule({
  todayIso,
  onSynced,
  onError,
  onClose,
}: StravaSyncModuleProps) {
  const [activeTab, setActiveTab] = useState<ImportTab>("file_drop");
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Copy & Paste state
  const [pasteFormat, setPasteFormat] = useState<
    "strava_copy_paste" | "hevy_text"
  >("strava_copy_paste");
  const [pastedText, setPastedText] = useState("");

  // Free OAuth state (works on Free Strava accounts by requesting activity:read_all!)
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [oauthCode, setOauthCode] = useState("");

  async function runFreeImport(
    format: "hevy_csv" | "strava_csv" | "strava_copy_paste" | "hevy_text",
    rawContent: string
  ) {
    setStatusMessage(null);
    setIsSyncing(true);
    try {
      const res = await fetch("/api/strava/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "free_import",
          format,
          rawContent,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        importedCount?: number;
        data?: FitnessDataset;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.data) {
        onError(json.error ?? "Import fehlgeschlagen.");
        return;
      }
      setPastedText("");
      setStatusMessage(
        `Mega! ${json.importedCount ?? 0} Einträge erfolgreich importiert (inkl. Kalender, Streak & Muskel-Map)!`
      );
      onSynced(json.data, json.importedCount ?? 0);
    } catch {
      onError("Netzwerkfehler beim Importieren.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleFileUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    format: "hevy_csv" | "strava_csv"
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await runFreeImport(format, text);
    e.target.value = "";
  }

  async function handleOauthCodeExchange(e: React.FormEvent) {
    e.preventDefault();
    setStatusMessage(null);
    setIsSyncing(true);
    try {
      // Extract `code=` if the user pasted the full localhost URL after authorizing
      let cleanCode = oauthCode.trim();
      if (cleanCode.includes("code=")) {
        const match = /[?&]code=([^&]+)/.exec(cleanCode);
        if (match?.[1]) cleanCode = match[1];
      }

      const res = await fetch("/api/strava/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "oauth_code",
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          code: cleanCode,
          perPage: 50,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        importedCount?: number;
        data?: FitnessDataset;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.data) {
        onError(json.error ?? "OAuth Code Austausch fehlgeschlagen.");
        return;
      }
      setOauthCode("");
      setStatusMessage(
        `${json.importedCount ?? 0} Aktivitäten kostenlos über die Strava API geladen!`
      );
      onSynced(json.data, json.importedCount ?? 0);
    } catch {
      onError("Fehler beim Strava OAuth Sync.");
    } finally {
      setIsSyncing(false);
    }
  }

  const sampleHevyCsv = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"
"Ganzkörper Plan A","${todayIso} 17:30:00","${todayIso} 18:30:00","","Bench Press (Machine)","","",0,"normal",75,8,0,0,8
"Ganzkörper Plan A","${todayIso} 17:30:00","${todayIso} 18:30:00","","Bench Press (Machine)","","",1,"normal",75,8,0,0,8
"Ganzkörper Plan A","${todayIso} 17:30:00","${todayIso} 18:30:00","","Lat Pulldown (Cable)","","",0,"normal",65,10,0,0,8
"Ganzkörper Plan A","${todayIso} 17:30:00","${todayIso} 18:30:00","","Lat Pulldown (Cable)","","",1,"normal",65,10,0,0,8
"Ganzkörper Plan A","${todayIso} 17:30:00","${todayIso} 18:30:00","","Leg Press (Machine)","","",0,"normal",145,10,0,0,8`;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-sheet">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: "1rem",
            borderBottom: "1px solid var(--border-subtle)",
            marginBottom: "1.1rem",
          }}
        >
          <div>
            <h2 style={{ fontSize: "1.18rem", fontWeight: 800 }}>
              100% Kostenloser Strava &amp; Hevy Import (Ohne Pro-Abo!)
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              Du brauchst weder Strava Pro noch Hevy Pro — wähle einfach einen
              der 3 kostenlosen Wege:
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              aria-label="Schließen"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* 3 Free Methods Switcher */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
            marginBottom: "1.2rem",
          }}
        >
          <button
            type="button"
            className={`pill-tab ${activeTab === "file_drop" ? "active" : ""}`}
            onClick={() => setActiveTab("file_drop")}
          >
            <Upload size={14} style={{ display: "inline", marginRight: 5 }} />
            1. Datei-Upload (Hevy CSV &amp; Strava CSV)
          </button>
          <button
            type="button"
            className={`pill-tab ${activeTab === "copy_paste" ? "active" : ""}`}
            onClick={() => setActiveTab("copy_paste")}
          >
            <ClipboardPaste
              size={14}
              style={{ display: "inline", marginRight: 5 }}
            />
            2. Copy &amp; Paste (von Strava-Webseite / Hevy)
          </button>
          <button
            type="button"
            className={`pill-tab ${activeTab === "oauth_free" ? "active" : ""}`}
            onClick={() => setActiveTab("oauth_free")}
          >
            <KeyRound size={14} style={{ display: "inline", marginRight: 5 }} />
            3. Kostenloser Strava OAuth-Trick
          </button>
        </div>

        {statusMessage && (
          <div
            style={{
              background: "rgba(166, 227, 161, 0.14)",
              border: "1px solid rgba(166, 227, 161, 0.4)",
              color: "var(--pastel-mint)",
              padding: "0.75rem 1rem",
              borderRadius: 12,
              fontSize: "0.85rem",
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <CheckCircle2 size={16} />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* TAB 1: FREE CSV FILE UPLOAD (HEVY & STRAVA) */}
        {activeTab === "file_drop" && (
          <div className="workspace-grid">
            <section
              style={{
                background: "var(--bg-soft)",
                padding: "1.2rem",
                borderRadius: 18,
                border: "1px solid rgba(203, 166, 247, 0.28)",
                display: "flex",
                flexDirection: "column",
                gap: "0.85rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  color: "var(--pastel-lavender)",
                  textTransform: "uppercase",
                }}
              >
                100% Kostenlos in der Hevy App
              </div>
              <h3 className="panel-title">Hevy CSV-Datei hochladen</h3>
              <p className="panel-desc" style={{ marginBottom: 0 }}>
                Öffne deine kostenlose Hevy App →{" "}
                <strong>Profil → Einstellungen (⚙️) → Daten exportieren</strong>
                . Lade die <code>workouts.csv</code> hier hoch — Schym baut
                daraus automatisch deine Gym-Pläne, Maschinen, Gewichte &amp;
                Körper-Map!
              </p>

              <label
                className="pastel-btn btn-lavender"
                style={{ cursor: "pointer", textAlign: "center" }}
              >
                <Upload size={16} />
                <span>Hevy CSV-Datei auswählen...</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: "none" }}
                  onChange={(e) => handleFileUpload(e, "hevy_csv")}
                />
              </label>

              <button
                type="button"
                className="pill-tab"
                style={{ marginTop: "0.25rem" }}
                disabled={isSyncing}
                onClick={() => runFreeImport("hevy_csv", sampleHevyCsv)}
              >
                <Sparkles
                  size={14}
                  style={{ display: "inline", marginRight: 5 }}
                />
                Test: Beispiel Hevy-CSV jetzt ausprobieren
              </button>
            </section>

            <section
              style={{
                background: "var(--bg-soft)",
                padding: "1.2rem",
                borderRadius: 18,
                border: "1px solid rgba(166, 227, 161, 0.28)",
                display: "flex",
                flexDirection: "column",
                gap: "0.85rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  color: "var(--pastel-mint)",
                  textTransform: "uppercase",
                }}
              >
                100% Kostenlos im Strava Account
              </div>
              <h3 className="panel-title">
                Strava <code>activities.csv</code> hochladen
              </h3>
              <p className="panel-desc" style={{ marginBottom: 0 }}>
                Auf Strava.com →{" "}
                <strong>
                  Einstellungen → Mein Konto → Dein Archiv anfordern
                </strong>{" "}
                (komplett kostenlos ohne Pro!). Wähle aus der ZIP-Datei einfach
                die <code>activities.csv</code> aus:
              </p>

              <label
                className="pastel-btn btn-mint"
                style={{ cursor: "pointer", textAlign: "center" }}
              >
                <Upload size={16} />
                <span>Strava activities.csv auswählen...</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: "none" }}
                  onChange={(e) => handleFileUpload(e, "strava_csv")}
                />
              </label>
            </section>
          </div>
        )}

        {/* TAB 2: COPY & PASTE FROM STRAVA WEB OR HEVY */}
        {activeTab === "copy_paste" && (
          <div
            style={{
              background: "var(--bg-soft)",
              padding: "1.2rem",
              borderRadius: 18,
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "0.9rem",
            }}
          >
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className={`pill-tab ${
                  pasteFormat === "strava_copy_paste" ? "active" : ""
                }`}
                onClick={() => setPasteFormat("strava_copy_paste")}
              >
                Strava „Meine Aktivitäten“ Tabelle (Strg+C / Strg+V)
              </button>
              <button
                type="button"
                className={`pill-tab ${
                  pasteFormat === "hevy_text" ? "active" : ""
                }`}
                onClick={() => setPasteFormat("hevy_text")}
              >
                Hevy Workout Share-Text
              </button>
            </div>

            {pasteFormat === "strava_copy_paste" ? (
              <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                Öffne im Browser{" "}
                <a
                  href="https://www.strava.com/athlete/training"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--pastel-mint)", fontWeight: 700 }}
                >
                  strava.com/athlete/training („Meine Aktivitäten“)
                </a>{" "}
                — das ist bei Strava 100 % kostenlos! Markiere einfach die
                Zeilen in deiner Tabelle mit der Maus, drücke{" "}
                <code>Strg+C</code> und füge sie hier mit <code>Strg+V</code>{" "}
                ein:
              </p>
            ) : (
              <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                Tippe in Hevy nach einem Workout auf{" "}
                <strong>Teilen → Text kopieren</strong> und füge ihn hier ein:
              </p>
            )}

            <textarea
              className="field-input"
              rows={6}
              placeholder={
                pasteFormat === "strava_copy_paste"
                  ? "Lauf\t10.11.2026\tAbendlauf\t38:12\t7,50 km\nRadfahrt\t08.11.2026\tSonntagsrunde\t1:15:00\t28,4 km"
                  : "Bench Press (Machine)\nSet 1: 75 kg x 8\nSet 2: 75 kg x 8\n\nLat Pulldown\nSet 1: 65 kg x 10"
              }
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
            />

            <button
              type="button"
              className="pastel-btn btn-mint"
              disabled={isSyncing || pastedText.trim().length < 5}
              onClick={() => runFreeImport(pasteFormat, pastedText)}
            >
              <RefreshCw size={15} />
              <span>Kopierten Text jetzt automatisch auslesen &amp; speichern</span>
            </button>
          </div>
        )}

        {/* TAB 3: FREE STRAVA OAUTH TRICK (WHY STRAVA API IS ACTUALLY FREE!) */}
        {activeTab === "oauth_free" && (
          <div
            style={{
              background: "var(--bg-soft)",
              padding: "1.2rem",
              borderRadius: 18,
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "0.9rem",
            }}
          >
            <div
              style={{
                fontSize: "0.83rem",
                color: "var(--text-secondary)",
                lineHeight: 1.55,
              }}
            >
              <strong style={{ color: "var(--pastel-peach)" }}>
                Geheimtipp: Die Strava API kostet gar kein Pro-Abo!
              </strong>{" "}
              Auf{" "}
              <a
                href="https://www.strava.com/settings/api"
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--pastel-mint)", fontWeight: 700 }}
              >
                strava.com/settings/api
              </a>{" "}
              hat der Standard-Token nur die Berechtigung <code>read</code>{" "}
              (deshalb zeigt er keine Trainings an). Mit deiner{" "}
              <strong>Client ID</strong> kannst du dir hier mit 1 Klick
              kostenlos die echte <code>activity:read_all</code> Berechtigung
              holen:
            </div>

            <div className="form-row-2">
              <label className="field-label">
                1. Deine Strava Client ID
                <input
                  type="text"
                  className="field-input"
                  placeholder="z.B. 135790"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
              </label>
              <label className="field-label">
                2. Dein Strava Client Secret
                <input
                  type="password"
                  className="field-input"
                  placeholder="Client Secret von strava.com/settings/api"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                />
              </label>
            </div>

            {clientId.trim().length > 1 && (
              <a
                href={`https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(
                  clientId.trim()
                )}&response_type=code&redirect_uri=http://localhost:3000&approval_prompt=force&scope=activity:read_all`}
                target="_blank"
                rel="noreferrer"
                className="pastel-btn btn-peach"
                style={{ textDecoration: "none" }}
              >
                Schritt A: Hier klicken &amp; bei Strava „Autorisieren“ drücken ↗
              </a>
            )}

            <form className="form-stack" onSubmit={handleOauthCodeExchange}>
              <label className="field-label">
                3. Nach dem Klick auf „Autorisieren“: Kopiere die URL (oder den{" "}
                <code>code=...</code> Teil) aus deiner Browser-Adresszeile hier
                rein:
                <input
                  type="text"
                  className="field-input"
                  placeholder="http://localhost:3000/?state=&code=dein_code_hier&scope=read,activity:read_all"
                  value={oauthCode}
                  onChange={(e) => setOauthCode(e.target.value)}
                  required
                />
              </label>
              <button
                type="submit"
                className="pastel-btn btn-lavender"
                disabled={
                  isSyncing ||
                  !clientId.trim() ||
                  !clientSecret.trim() ||
                  !oauthCode.trim()
                }
              >
                {isSyncing
                  ? "Lade Trainings..."
                  : "Schritt B: Jetzt alle Strava-Trainings kostenlos importieren"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
