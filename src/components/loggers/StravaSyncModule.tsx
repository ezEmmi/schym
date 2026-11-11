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

type ImportTab = "file_drop" | "copy_paste" | "oauth_free";

export function StravaSyncModule({
  currentData,
  onSynced,
  onError,
  onClose,
}: StravaSyncModuleProps) {
  const [activeTab, setActiveTab] = useState<ImportTab>("file_drop");
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [pasteFormat, setPasteFormat] = useState<
    "strava_copy_paste" | "hevy_csv"
  >("strava_copy_paste");
  const [pastedText, setPastedText] = useState("");

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [oauthCode, setOauthCode] = useState("");

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
            `${json.importedCount ?? 0} Einträge erfolgreich importiert!`
          );
          onSynced(json.data, json.importedCount ?? 0);
          return;
        }
      }

      // Fallback for GitHub Pages (static mode without /api route)
      const { merged, count } = mergeClientSideImport(format, rawContent);
      if (count === 0) {
        onError("Keine passenden Aktivitäten im CSV/Text erkannt.");
        return;
      }
      setPastedText("");
      setStatusMessage(`${count} Einträge erfolgreich importiert!`);
      onSynced(merged, count);
    } catch {
      const { merged, count } = mergeClientSideImport(format, rawContent);
      if (count > 0) {
        setPastedText("");
        setStatusMessage(`${count} Einträge im Handy-Speicher importiert!`);
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

  async function handleOauthCodeExchange(e: React.FormEvent) {
    e.preventDefault();
    setStatusMessage(null);
    setIsSyncing(true);
    try {
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
        `${json.importedCount ?? 0} Aktivitäten über die Strava API geladen!`
      );
      onSynced(json.data, json.importedCount ?? 0);
    } catch {
      onError("Strava OAuth benötigt den lokalen Server.");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-sheet" style={{ maxWidth: 580 }}>
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
          <h2 style={{ fontSize: "1.12rem", fontWeight: 800 }}>
            Hevy &amp; Strava Import 📥
          </h2>
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

        {/* Clean 3-Tab Switcher */}
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
            className={`pill-tab ${activeTab === "file_drop" ? "active" : ""}`}
            onClick={() => setActiveTab("file_drop")}
          >
            <Upload size={13} style={{ display: "inline", marginRight: 5 }} />
            CSV-Datei Upload
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
            Strava API
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
              <span>Jetzt auslesen &amp; speichern</span>
            </button>
          </div>
        )}

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
                )}&response_type=code&redirect_uri=http://localhost:3000&approval_prompt=force&scope=activity:read_all`}
                target="_blank"
                rel="noreferrer"
                className="pastel-btn btn-peach"
                style={{ textDecoration: "none" }}
              >
                Schritt A: Bei Strava autorisieren ↗
              </a>
            )}

            <form className="form-stack" onSubmit={handleOauthCodeExchange}>
              <label className="field-label">
                3. Redirect-URL (mit code=...) einfügen:
                <input
                  type="text"
                  className="field-input"
                  placeholder="http://localhost:3000/?state=&code=..."
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
                {isSyncing ? "Lade..." : "Schritt B: Trainings importieren"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
