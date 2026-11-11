"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  RefreshCw,
  CheckCircle2,
  Upload,
  ClipboardPaste,
  KeyRound,
  X,
  Sparkles,
  Send,
  Download,
  Copy,
} from "lucide-react";
import type { FitnessDataset, GymEntry } from "@/lib/db/schema";
import {
  parseHevyCsv,
  parseStravaActivitiesCsv,
  parseStravaWebTableText,
} from "@/lib/importers";
import { USER_HEVY_CSV_RAW } from "@/lib/hevy-seed";

interface StravaSyncModuleProps {
  currentData: FitnessDataset;
  onSynced: (newData: FitnessDataset, importedCount: number) => void;
  onError: (msg: string) => void;
  onClose?: () => void;
}

type SyncTab = "push_to_strava" | "file_drop" | "copy_paste" | "oauth_free";

const STRAVA_CREDS_KEY = "schym_strava_creds_v1";

interface SavedStravaCreds {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken?: string;
}

export function StravaSyncModule({
  currentData,
  onSynced,
  onError,
  onClose,
}: StravaSyncModuleProps) {
  const [activeTab, setActiveTab] = useState<SyncTab>("push_to_strava");
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const [pasteFormat, setPasteFormat] = useState<
    "strava_copy_paste" | "hevy_csv"
  >("strava_copy_paste");
  const [pastedText, setPastedText] = useState("");

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [oauthCode, setOauthCode] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STRAVA_CREDS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SavedStravaCreds>;
        if (parsed.clientId) setClientId(parsed.clientId);
        if (parsed.clientSecret) setClientSecret(parsed.clientSecret);
        if (parsed.accessToken) setAccessToken(parsed.accessToken);
      }
    } catch {
      // ignore storage read error
    }
  }, []);

  function saveStravaCreds(next: SavedStravaCreds) {
    setClientId(next.clientId);
    setClientSecret(next.clientSecret);
    setAccessToken(next.accessToken);
    try {
      window.localStorage.setItem(STRAVA_CREDS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  // Group Gym workouts by (sessionDate + workoutFocus) so the user can push any completed Gym workout to Strava!
  const groupedWorkouts = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        sessionDate: string;
        workoutFocus: string;
        exercises: GymEntry[];
        totalSets: number;
        totalVolumeKg: number;
      }
    >();

    for (const g of currentData.gym) {
      const key = `${g.sessionDate}__${g.workoutFocus}`;
      const existing = map.get(key);
      const vol = g.sets * g.reps * g.weightKg;
      if (!existing) {
        map.set(key, {
          key,
          sessionDate: g.sessionDate,
          workoutFocus: g.workoutFocus,
          exercises: [g],
          totalSets: g.sets,
          totalVolumeKg: Math.round(vol),
        });
      } else {
        existing.exercises.push(g);
        existing.totalSets += g.sets;
        existing.totalVolumeKg = Math.round(existing.totalVolumeKg + vol);
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      b.sessionDate.localeCompare(a.sessionDate)
    );
  }, [currentData.gym]);

  function formatWorkoutDescriptionForStrava(workout: {
    sessionDate: string;
    workoutFocus: string;
    exercises: GymEntry[];
    totalSets: number;
    totalVolumeKg: number;
  }): string {
    const lines = workout.exercises.map((ex) => {
      const setDetail =
        ex.notes && ex.notes.startsWith("Sätze:") ? ` (${ex.notes})` : "";
      return `• ${ex.exerciseName}: ${ex.sets} × ${ex.reps} @ ${ex.weightKg} kg (e1RM ${ex.estimated1Rm} kg)${setDetail}`;
    });
    return [
      `🏋️ Schym Gym Workout: ${workout.workoutFocus} (${workout.sessionDate})`,
      `📊 Gesamt: ${workout.exercises.length} Übungen • ${workout.totalSets} Sätze • ${workout.totalVolumeKg.toLocaleString("de-DE")} kg Bewegt-Volumen`,
      "",
      ...lines,
    ].join("\n");
  }

  async function handlePushWorkoutToStravaApi(workout: {
    sessionDate: string;
    workoutFocus: string;
    exercises: GymEntry[];
    totalSets: number;
    totalVolumeKg: number;
  }) {
    setStatusMessage(null);
    setLocalError(null);

    if (!accessToken.trim()) {
      setLocalError(
        "Bitte trage unten (oder im Tab „Strava API Verbinden“) einmalig deinen kostenlosen Strava Access-Token ein, oder nutze den 1-Klick TCX-Download!"
      );
      return;
    }

    setIsSyncing(true);
    try {
      const description = formatWorkoutDescriptionForStrava(workout);
      const startIso = `${workout.sessionDate}T18:00:00Z`;

      const res = await fetch("https://www.strava.com/api/v3/activities", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `${workout.workoutFocus} 💪 (Schym)`,
          type: "WeightTraining",
          sport_type: "WeightTraining",
          start_date_local: startIso,
          elapsed_time: Math.max(1800, workout.totalSets * 150),
          description,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        setLocalError(
          `Strava API Antwort (HTTP ${res.status}): Stelle sicher, dass dein Token die Berechtigung „activity:write“ hat (${errText.slice(0, 90)}).`
        );
        return;
      }

      setStatusMessage(
        `Workout „${workout.workoutFocus}“ (${workout.sessionDate}) erfolgreich direkt in deinen Strava-Feed gepostet! 🧡`
      );
    } catch {
      setLocalError(
        "Verbindung zu Strava fehlgeschlagen. Nutze alternativ den `.tcx`-Download rechts daneben!"
      );
    } finally {
      setIsSyncing(false);
    }
  }

  function handleDownloadTcxForStrava(workout: {
    sessionDate: string;
    workoutFocus: string;
    exercises: GymEntry[];
    totalSets: number;
    totalVolumeKg: number;
  }) {
    const startIso = `${workout.sessionDate}T18:00:00Z`;
    const durationSec = Math.max(1800, workout.totalSets * 150);
    const notesXml = formatWorkoutDescriptionForStrava(workout)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const tcxContent = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Other">
      <Id>${startIso}</Id>
      <Lap StartTime="${startIso}">
        <TotalTimeSeconds>${durationSec}</TotalTimeSeconds>
        <DistanceMeters>0</DistanceMeters>
        <Calories>${Math.round(durationSec * 0.12)}</Calories>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
      </Lap>
      <Notes>${notesXml}</Notes>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

    const blob = new Blob([tcxContent], {
      type: "application/vnd.garmin.tcx+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schym-${workout.sessionDate}-${workout.workoutFocus.toLowerCase()}.tcx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setStatusMessage(
      `TCX-Datei für „${workout.workoutFocus}“ (${workout.sessionDate}) heruntergeladen! Du kannst sie auf strava.com/upload/select direkt reinziehen.`
    );
  }

  async function handleCopyStravaDescription(workout: {
    sessionDate: string;
    workoutFocus: string;
    exercises: GymEntry[];
    totalSets: number;
    totalVolumeKg: number;
  }) {
    const text = formatWorkoutDescriptionForStrava(workout);
    try {
      await navigator.clipboard.writeText(text);
      setStatusMessage(
        `Workout-Zusammenfassung für „${workout.workoutFocus}“ in die Zwischenablage kopiert!`
      );
    } catch {
      setStatusMessage("Text bereit zum Kopieren.");
    }
  }

  function mergeClientSideImport(
    format: "hevy_csv" | "strava_csv" | "strava_copy_paste",
    rawContent: string
  ): { merged: FitnessDataset; count: number } {
    const parsed =
      format === "hevy_csv"
        ? parseHevyCsv(rawContent)
        : format === "strava_csv"
          ? parseStravaActivitiesCsv(rawContent)
          : parseStravaWebTableText(rawContent);

    const nowIso = new Date().toISOString();
    const existingGym = [...currentData.gym];
    let count = 0;

    for (const g of parsed.gymEntries) {
      const idx = existingGym.findIndex(
        (e) =>
          e.sessionDate === g.sessionDate &&
          e.workoutFocus.toLowerCase() === g.workoutFocus.toLowerCase() &&
          e.exerciseName.toLowerCase() === g.exerciseName.toLowerCase()
      );
      if (idx >= 0) {
        existingGym[idx] = {
          ...existingGym[idx]!,
          ...g,
          muscleGroup: g.muscleGroup ?? existingGym[idx]!.muscleGroup,
        };
      } else {
        existingGym.push({
          id: Date.now() + count,
          ...g,
          muscleGroup: g.muscleGroup ?? "chest",
          createdAt: nowIso,
        });
      }
      count += 1;
    }

    existingGym.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));

    const existingCardio = [...currentData.cardio];
    for (const c of parsed.cardioSessions) {
      existingCardio.unshift({
        id: Date.now() + count,
        ...c,
        createdAt: nowIso,
      });
      count += 1;
    }

    const existingTemplates = [...currentData.templates];
    for (const t of parsed.templates) {
      const tIdx = existingTemplates.findIndex(
        (et) => et.name.toLowerCase() === t.name.toLowerCase()
      );
      if (tIdx >= 0) {
        existingTemplates[tIdx] = {
          ...existingTemplates[tIdx]!,
          exercises: t.exercises,
        };
      } else {
        existingTemplates.push({
          id: Date.now() + existingTemplates.length + 1,
          name: t.name,
          exercises: t.exercises,
          createdAt: nowIso,
        });
      }
    }

    return {
      merged: {
        ...currentData,
        gym: existingGym,
        cardio: existingCardio,
        templates: existingTemplates,
      },
      count,
    };
  }

  async function runFreeImport(
    format: "hevy_csv" | "strava_csv" | "strava_copy_paste",
    rawContent: string
  ) {
    setStatusMessage(null);
    setLocalError(null);
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
      if (res.ok) {
        const json = (await res.json()) as {
          ok: boolean;
          importedCount?: number;
          data?: FitnessDataset;
          error?: string;
        };
        if (json.ok && json.data) {
          setPastedText("");
          setStatusMessage(
            `${json.importedCount ?? 0} Einträge erfolgreich importiert & Coach-Plan aktualisiert!`
          );
          onSynced(json.data, json.importedCount ?? 0);
          return;
        }
      }

      const { merged, count } = mergeClientSideImport(format, rawContent);
      if (count === 0) {
        onError("Keine passenden Aktivitäten im CSV/Text erkannt.");
        return;
      }
      setPastedText("");
      setStatusMessage(
        `${count} Einträge erfolgreich importiert & Coach-Plan aktualisiert!`
      );
      onSynced(merged, count);
    } catch {
      const { merged, count } = mergeClientSideImport(format, rawContent);
      if (count > 0) {
        setPastedText("");
        setStatusMessage(
          `${count} Einträge erfolgreich importiert & Coach-Plan aktualisiert!`
        );
        onSynced(merged, count);
      } else {
        onError("Import fehlgeschlagen.");
      }
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

  async function handleBrowserOAuthExchangeAndSync(e: React.FormEvent) {
    e.preventDefault();
    setStatusMessage(null);
    setLocalError(null);
    setIsSyncing(true);

    try {
      let cleanCode = oauthCode.trim();
      if (cleanCode.includes("code=")) {
        const match = /[?&]code=([^&]+)/.exec(cleanCode);
        if (match?.[1]) cleanCode = decodeURIComponent(match[1]);
      }

      // Exchange OAuth code directly from the browser with Strava so it works even inside sandboxed dev server or GitHub Pages!
      const tokenRes = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId.trim(),
          client_secret: clientSecret.trim(),
          code: cleanCode,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        setLocalError(
          `Strava Code-Austausch fehlgeschlagen (HTTP ${tokenRes.status}). Prüfe Client ID & Secret.`
        );
        return;
      }

      const tokenJson = (await tokenRes.json()) as {
        access_token?: string;
        refresh_token?: string;
      };
      const newToken = tokenJson.access_token ?? "";
      if (!newToken) {
        setLocalError("Kein Access-Token von Strava erhalten.");
        return;
      }

      saveStravaCreds({
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        accessToken: newToken,
        refreshToken: tokenJson.refresh_token,
      });
      setOauthCode("");

      // Also fetch latest activities from Strava right away
      const actRes = await fetch(
        "https://www.strava.com/api/v3/athlete/activities?per_page=30",
        {
          headers: { Authorization: `Bearer ${newToken}` },
        }
      );
      if (actRes.ok) {
        const activities = (await actRes.json()) as unknown[];
        const apiSave = await fetch("/api/strava/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "json",
            activities,
          }),
        }).catch(() => null);

        if (apiSave && apiSave.ok) {
          const json = (await apiSave.json()) as {
            ok: boolean;
            importedCount?: number;
            data?: FitnessDataset;
          };
          if (json.ok && json.data) {
            setStatusMessage(
              `Strava verbunden ✅! ${json.importedCount ?? 0} Aktivitäten geladen & Push-Berechtigung aktiv.`
            );
            onSynced(json.data, json.importedCount ?? 0);
            return;
          }
        }
      }

      setStatusMessage(
        "Strava erfolgreich verbunden ✅! Du kannst deine Schym-Workouts jetzt mit 1 Klick zu Strava posten."
      );
    } catch {
      setLocalError("Strava-Verbindung fehlgeschlagen.");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-sheet" style={{ maxWidth: 620 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: "0.9rem",
            borderBottom: "1px solid var(--border-subtle)",
            marginBottom: "1rem",
          }}
        >
          <div>
            <h2 style={{ fontSize: "1.12rem", fontWeight: 800 }}>
              Strava 2-Wege-Sync &amp; Hevy Import 🔄
            </h2>
            <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
              Schym-Workouts zu Strava posten (wie bei Hevy) oder Strava/Hevy-Daten
              importieren
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

        {/* 4-Tab Switcher */}
        <div
          style={{
            display: "flex",
            gap: "0.45rem",
            flexWrap: "wrap",
            marginBottom: "1rem",
          }}
        >
          <button
            type="button"
            className={`pill-tab ${
              activeTab === "push_to_strava" ? "active" : ""
            }`}
            onClick={() => setActiveTab("push_to_strava")}
          >
            <Send size={13} style={{ display: "inline", marginRight: 5 }} />
            Von Schym zu Strava 📤
          </button>
          <button
            type="button"
            className={`pill-tab ${activeTab === "file_drop" ? "active" : ""}`}
            onClick={() => setActiveTab("file_drop")}
          >
            <Upload size={13} style={{ display: "inline", marginRight: 5 }} />
            CSV Import 📥
          </button>
          <button
            type="button"
            className={`pill-tab ${activeTab === "copy_paste" ? "active" : ""}`}
            onClick={() => setActiveTab("copy_paste")}
          >
            <ClipboardPaste
              size={13}
              style={{ display: "inline", marginRight: 5 }}
            />
            Copy &amp; Paste
          </button>
          <button
            type="button"
            className={`pill-tab ${activeTab === "oauth_free" ? "active" : ""}`}
            onClick={() => setActiveTab("oauth_free")}
          >
            <KeyRound size={13} style={{ display: "inline", marginRight: 5 }} />
            Strava API Verbinden
          </button>
        </div>

        {statusMessage && (
          <div
            style={{
              background: "rgba(166, 227, 161, 0.14)",
              border: "1px solid var(--pastel-mint)",
              color: "var(--pastel-mint)",
              padding: "0.7rem 0.9rem",
              borderRadius: 12,
              fontSize: "0.82rem",
              marginBottom: "0.9rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <CheckCircle2 size={16} />
            <span>{statusMessage}</span>
          </div>
        )}

        {localError && (
          <div className="error-banner" style={{ marginBottom: "0.9rem" }}>
            {localError}
          </div>
        )}

        {/* TAB 1: PUSH FROM SCHYM TO STRAVA ("Von mir zu Strava syncen") */}
        {activeTab === "push_to_strava" && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}
          >
            <div
              style={{
                background: "var(--bg-soft)",
                padding: "0.85rem 1rem",
                borderRadius: 14,
                border: "1px solid rgba(250, 179, 135, 0.35)",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                <strong
                  style={{ fontSize: "0.85rem", color: "var(--pastel-peach)" }}
                >
                  🧡 Deine Schym-Workouts zu Strava übertragen (100% kostenlos):
                </strong>
                {accessToken ? (
                  <span className="badge badge-cardio" style={{ fontSize: "0.7rem" }}>
                    Strava Token bereit ✅
                  </span>
                ) : (
                  <button
                    type="button"
                    className="pill-tab"
                    style={{ fontSize: "0.72rem", padding: "0.25rem 0.6rem" }}
                    onClick={() => setActiveTab("oauth_free")}
                  >
                    Optional: Strava API-Token hinterlegen →
                  </button>
                )}
              </div>
              <div
                style={{ fontSize: "0.77rem", color: "var(--text-secondary)" }}
              >
                Wähle unten ein Training aus: Mit{" "}
                <strong>„Direkt zu Strava posten“</strong> landet es sofort inkl.
                aller Übungen, Sätze &amp; Gewichte in deinem Strava-Feed (wie
                früher bei Hevy). Oder lade mit <strong>„.TCX“</strong> die
                fertige Trainingsdatei für{" "}
                <a
                  href="https://www.strava.com/upload/select"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--pastel-peach)" }}
                >
                  strava.com/upload/select
                </a>{" "}
                herunter!
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.55rem",
                maxHeight: 340,
                overflowY: "auto",
              }}
            >
              {groupedWorkouts.slice(0, 12).map((w) => (
                <div
                  key={w.key}
                  style={{
                    background: "var(--bg-soft)",
                    borderRadius: 14,
                    padding: "0.75rem 0.95rem",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.6rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: "0.86rem",
                        fontWeight: 800,
                      }}
                    >
                      <span className="badge badge-gym">{w.workoutFocus}</span>
                      <span>{w.sessionDate}</span>
                    </div>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {w.exercises.length} Übungen • {w.totalSets} Sätze •{" "}
                      {w.totalVolumeKg.toLocaleString("de-DE")} kg Volumen
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "0.4rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      className="pastel-btn btn-peach"
                      style={{
                        padding: "0.4rem 0.75rem",
                        fontSize: "0.76rem",
                      }}
                      disabled={isSyncing}
                      onClick={() => void handlePushWorkoutToStravaApi(w)}
                      title="Postet dieses Workout direkt über die Strava API in deinen Feed"
                    >
                      <Send size={13} />
                      <span>Zu Strava posten</span>
                    </button>

                    <button
                      type="button"
                      className="pill-tab"
                      style={{
                        padding: "0.4rem 0.65rem",
                        fontSize: "0.75rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                      onClick={() => handleDownloadTcxForStrava(w)}
                      title="Lädt eine Garmin/Strava .tcx Datei herunter"
                    >
                      <Download size={13} />
                      <span>.TCX</span>
                    </button>

                    <button
                      type="button"
                      className="pill-tab"
                      style={{
                        padding: "0.4rem 0.65rem",
                        fontSize: "0.75rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                      onClick={() => void handleCopyStravaDescription(w)}
                      title="Kopiert die formatierte Übungs-Übersicht für Strava"
                    >
                      <Copy size={13} />
                      <span>Text</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: CSV FILE UPLOAD */}
        {activeTab === "file_drop" && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}
          >
            <div
              style={{
                background: "var(--bg-soft)",
                padding: "1rem",
                borderRadius: 16,
                border: "1px solid rgba(203, 166, 247, 0.28)",
                display: "flex",
                flexDirection: "column",
                gap: "0.65rem",
              }}
            >
              <strong style={{ fontSize: "0.9rem" }}>
                1. Hevy <code>workouts.csv</code>
              </strong>
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-secondary)",
                  margin: 0,
                }}
              >
                Deine 11 Hevy-Workouts (<em>Drücken</em> &amp; <em>Ziehen</em>{" "}
                von Sept–Nov) sind bereits fest hinterlegt! Du kannst sie hier
                jederzeit neu laden oder eine neuere CSV wählen:
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="pastel-btn btn-lavender"
                  disabled={isSyncing}
                  onClick={() => runFreeImport("hevy_csv", USER_HEVY_CSV_RAW)}
                >
                  <Sparkles size={15} />
                  <span>Meine 11 Hevy-Workouts jetzt synchronisieren</span>
                </button>

                <label
                  className="pill-tab"
                  style={{
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Upload size={14} />
                  <span>Andere Hevy CSV wählen...</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    style={{ display: "none" }}
                    onChange={(e) => handleFileUpload(e, "hevy_csv")}
                  />
                </label>
              </div>
            </div>

            <div
              style={{
                background: "var(--bg-soft)",
                padding: "1rem",
                borderRadius: 16,
                border: "1px solid rgba(166, 227, 161, 0.28)",
                display: "flex",
                flexDirection: "column",
                gap: "0.65rem",
              }}
            >
              <strong style={{ fontSize: "0.9rem" }}>
                2. Strava <code>activities.csv</code> (ohne Pro-Abo)
              </strong>
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-secondary)",
                  margin: 0,
                }}
              >
                Aus deinem kostenlosen Strava-Datenarchiv (
                <em>Einstellungen → Mein Konto → Archiv anfordern</em>):
              </p>
              <label
                className="pastel-btn btn-mint"
                style={{ cursor: "pointer", width: "fit-content" }}
              >
                <Upload size={15} />
                <span>Strava activities.csv auswählen...</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: "none" }}
                  onChange={(e) => handleFileUpload(e, "strava_csv")}
                />
              </label>
            </div>
          </div>
        )}

        {/* TAB 3: COPY & PASTE */}
        {activeTab === "copy_paste" && (
          <div
            style={{
              background: "var(--bg-soft)",
              padding: "1rem",
              borderRadius: 16,
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "0.8rem",
            }}
          >
            <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className={`pill-tab ${
                  pasteFormat === "strava_copy_paste" ? "active" : ""
                }`}
                onClick={() => setPasteFormat("strava_copy_paste")}
              >
                Strava „Meine Aktivitäten“ Tabelle
              </button>
              <button
                type="button"
                className={`pill-tab ${
                  pasteFormat === "hevy_csv" ? "active" : ""
                }`}
                onClick={() => setPasteFormat("hevy_csv")}
              >
                Hevy CSV-Text direkt einfügen
              </button>
            </div>

            <textarea
              className="field-input"
              rows={5}
              placeholder={
                pasteFormat === "strava_copy_paste"
                  ? "Lauf\t10.11.2026\tAbendlauf\t38:12\t7,50 km"
                  : '"title","start_time",...'
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
              <span>Jetzt auslesen &amp; Coach aktualisieren</span>
            </button>
          </div>
        )}

        {/* TAB 4: STRAVA API OAUTH (READ + WRITE) */}
        {activeTab === "oauth_free" && (
          <div
            style={{
              background: "var(--bg-soft)",
              padding: "1rem",
              borderRadius: 16,
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "0.8rem",
            }}
          >
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
              Verbinde einmalig deine kostenlose{" "}
              <a
                href="https://www.strava.com/settings/api"
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--pastel-peach)" }}
              >
                Strava API App (strava.com/settings/api)
              </a>{" "}
              für automatischen <strong>Import &amp; Export</strong>:
            </div>

            <div className="form-row-2">
              <label className="field-label">
                1. Strava Client ID
                <input
                  type="text"
                  className="field-input"
                  placeholder="z.B. 135790"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
              </label>
              <label className="field-label">
                2. Strava Client Secret
                <input
                  type="password"
                  className="field-input"
                  placeholder="Client Secret"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                />
              </label>
            </div>

            {clientId.trim().length > 1 && (
              <a
                href={`https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(
                  clientId.trim()
                )}&response_type=code&redirect_uri=${encodeURIComponent(
                  typeof window !== "undefined"
                    ? window.location.origin + window.location.pathname
                    : "http://localhost:3000"
                )}&approval_prompt=force&scope=activity:read_all,activity:write`}
                target="_blank"
                rel="noreferrer"
                className="pastel-btn btn-peach"
                style={{ textDecoration: "none" }}
              >
                Schritt A: Bei Strava autorisieren (Lesen &amp; Posten) ↗
              </a>
            )}

            <form
              className="form-stack"
              onSubmit={handleBrowserOAuthExchangeAndSync}
            >
              <label className="field-label">
                3. Redirect-URL (mit code=...) nach dem Klick einfügen:
                <input
                  type="text"
                  className="field-input"
                  placeholder="http://localhost:3000/?state=&code=..."
                  value={oauthCode}
                  onChange={(e) => setOauthCode(e.target.value)}
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
                  ? "Verbinde..."
                  : "Schritt B: Strava-Konto verbinden & synchronisieren"}
              </button>
            </form>

            <div
              style={{
                borderTop: "1px solid var(--border-subtle)",
                paddingTop: "0.7rem",
              }}
            >
              <label className="field-label">
                Oder direkt vorhandenen Strava Access-Token eintragen:
                <div style={{ display: "flex", gap: "0.45rem" }}>
                  <input
                    type="password"
                    className="field-input"
                    placeholder="Dein Strava Access Token..."
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                  />
                  <button
                    type="button"
                    className="pill-tab active"
                    onClick={() => {
                      saveStravaCreds({
                        clientId,
                        clientSecret,
                        accessToken: accessToken.trim(),
                      });
                      setStatusMessage("Strava Access-Token gespeichert ✅!");
                    }}
                  >
                    Speichern
                  </button>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
