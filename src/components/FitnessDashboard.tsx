"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dumbbell,
  Plus,
  RefreshCw,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Menu,
  X,
  Send,
  FlaskConical,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import type {
  FitnessDataset,
  GymEntry,
  MuscleGroup,
  SupplementTiming,
  WorkoutTemplateExercise,
} from "@/lib/db/schema";
import {
  calculateEstimated1Rm,
  computeWeeklySummary,
  formatPaceMinPerKm,
} from "@/lib/metrics";
import {
  computeCoachBriefing,
  DEFAULT_ATHLETE_PROFILE,
  type AthleteProfile,
} from "@/lib/coach";
import { getSportDefinition } from "@/lib/sports-catalog";
import { inferMuscleGroupFromExercise } from "@/lib/muscles";
import { buildPreseededDataset } from "@/lib/hevy-seed";
import { SchymLogo } from "@/components/dashboard/SchymLogo";
import {
  SmartCoachBanner,
  type CoachDrawerMode,
} from "@/components/dashboard/SmartCoachBanner";
import { SupplementTracker } from "@/components/dashboard/SupplementTracker";
import { WeeklySplitCards } from "@/components/dashboard/WeeklySplitCards";
import { ActivityCalendar } from "@/components/dashboard/ActivityCalendar";
import { BodyMuscleMap } from "@/components/dashboard/BodyMuscleMap";
import { ProgressionChartCard } from "@/components/dashboard/ProgressionChartCard";
import { GymSessionModal } from "@/components/loggers/GymSessionModal";
import { QuickActivityModal } from "@/components/loggers/QuickActivityModal";
import { StravaSyncModule } from "@/components/loggers/StravaSyncModule";
import {
  MobileAndSignalModal,
  SIGNAL_PREFS_KEY,
  dispatchSignalFromBrowser,
  type SignalPreferences,
} from "@/components/dashboard/MobileAndSignalModal";

interface FitnessDashboardProps {
  initialData: FitnessDataset;
  todayIso: string;
}

const HYBRID_STORAGE_KEY = "schym_hybrid_dataset_v2";
const PROFILE_STORAGE_KEY = "schym_athlete_profile_v1";

export function FitnessDashboard({
  initialData,
  todayIso,
}: FitnessDashboardProps) {
  const [data, setData] = useState<FitnessDataset>(() =>
    initialData.gym.length > 0 ? initialData : buildPreseededDataset()
  );
  const [profile, setProfile] = useState<AthleteProfile>(
    DEFAULT_ATHLETE_PROFILE
  );
  const [signalPrefs, setSignalPrefs] = useState<SignalPreferences>({
    phone: "",
    apiKey: "",
    autoEnabled: true,
    autoTime: "06:00",
  });
  const [signalToast, setSignalToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Burger Menu & Coach Drawer state
  const [isBurgerOpen, setIsBurgerOpen] = useState(false);
  const [coachDrawer, setCoachDrawer] = useState<CoachDrawerMode>("none");

  // Accordion UI states for progressive disclosure
  const [isHistorySectionOpen, setIsHistorySectionOpen] = useState(true);
  const [expandedWorkoutKeys, setExpandedWorkoutKeys] = useState<
    Record<string, boolean>
  >({});

  // Popups / Modals
  const [isGymModalOpen, setIsGymModalOpen] = useState(false);
  const [selectedGymTemplateName, setSelectedGymTemplateName] = useState<
    string | null
  >(null);
  const [isQuickSportModalOpen, setIsQuickSportModalOpen] = useState(false);
  const [isStravaModalOpen, setIsStravaModalOpen] = useState(false);
  const [isMobileSignalModalOpen, setIsMobileSignalModalOpen] = useState(false);

  function openGymModal(templateName: string | null = null) {
    setSelectedGymTemplateName(templateName);
    setIsGymModalOpen(true);
  }

  function saveSignalPrefs(next: SignalPreferences) {
    setSignalPrefs(next);
    try {
      window.localStorage.setItem(SIGNAL_PREFS_KEY, JSON.stringify(next));
    } catch {
      // ignore storage write error
    }
  }

  // Hydrate dataset, athlete profile, and Signal config (from localStorage + .env.local via /api/notify/signal)
  useEffect(() => {
    let loadedPrefs: SignalPreferences | null = null;
    try {
      const savedRaw = window.localStorage.getItem(HYBRID_STORAGE_KEY);
      if (savedRaw && initialData.gym.length === 0) {
        const parsed = JSON.parse(savedRaw) as FitnessDataset;
        if (parsed && Array.isArray(parsed.gym) && parsed.gym.length > 0) {
          setData(parsed);
        }
      }
      const savedProf = window.localStorage.getItem(PROFILE_STORAGE_KEY);
      if (savedProf) {
        const parsedProf = JSON.parse(savedProf) as AthleteProfile;
        if (parsedProf && parsedProf.weightKg > 30) {
          setProfile(parsedProf);
        }
      }
      const savedSig = window.localStorage.getItem(SIGNAL_PREFS_KEY);
      if (savedSig) {
        const parsedSig = JSON.parse(savedSig) as Partial<SignalPreferences>;
        if (parsedSig.phone && parsedSig.apiKey) {
          loadedPrefs = {
            phone: parsedSig.phone,
            apiKey: parsedSig.apiKey,
            autoEnabled: parsedSig.autoEnabled ?? true,
            autoTime: parsedSig.autoTime || "06:00",
            lastAutoSentDate: parsedSig.lastAutoSentDate,
          };
          setSignalPrefs(loadedPrefs);
        }
      }
    } catch {
      // ignore storage read error
    }

    // Also hydrate from local server .env.local if not yet in localStorage
    if (!loadedPrefs) {
      fetch("/api/notify/signal")
        .then((r) => (r.ok ? r.json() : null))
        .then(
          (
            res: {
              ok?: boolean;
              configured?: boolean;
              phone?: string;
              apiKey?: string;
              autoTime?: string;
            } | null
          ) => {
            if (res?.ok && res.configured && res.phone && res.apiKey) {
              const hydrated: SignalPreferences = {
                phone: res.phone,
                apiKey: res.apiKey,
                autoEnabled: true,
                autoTime: res.autoTime || "06:00",
              };
              saveSignalPrefs(hydrated);
            }
          }
        )
        .catch(() => {
          // static host fallback
        });
    }
  }, [initialData.gym.length]);

  const summary = computeWeeklySummary(
    todayIso,
    data.gym,
    data.cardio,
    data.bouldering
  );

  const coachBriefing = computeCoachBriefing(data, todayIso, profile);

  // Automatic 06:00 AM Daily Signal Briefing Scheduler
  useEffect(() => {
    if (
      !signalPrefs.autoEnabled ||
      signalPrefs.phone.length < 4 ||
      signalPrefs.apiKey.length < 2
    ) {
      return;
    }

    async function checkAndSendDailyBriefing() {
      const now = new Date();
      const currentDayIso = now.toISOString().slice(0, 10);
      if (signalPrefs.lastAutoSentDate === currentDayIso) {
        return;
      }

      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const currentHm = `${hh}:${mm}`;
      const targetHm = signalPrefs.autoTime || "06:00";

      if (currentHm >= targetHm) {
        const nextPrefs: SignalPreferences = {
          ...signalPrefs,
          lastAutoSentDate: currentDayIso,
        };
        saveSignalPrefs(nextPrefs);
        const sent = await dispatchSignalFromBrowser(
          signalPrefs.phone,
          signalPrefs.apiKey,
          coachBriefing.signalMessageText
        );
        if (sent) {
          setSignalToast(
            `Tägliches ${targetHm}-Uhr-Briefing automatisch an Signal gesendet 💬`
          );
          setTimeout(() => setSignalToast(null), 7000);
        }
      }
    }

    void checkAndSendDailyBriefing();
    const timer = window.setInterval(() => {
      void checkAndSendDailyBriefing();
    }, 30000);

    return () => window.clearInterval(timer);
  }, [
    signalPrefs,
    coachBriefing.signalMessageText,
  ]);

  function handleUpdateProfile(next: AthleteProfile) {
    setProfile(next);
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  async function handleApplyScienceUpgrade() {
    for (const tpl of data.templates) {
      const lower = tpl.name.toLowerCase();
      if (lower.includes("drücken")) {
        const hasTriceps = tpl.exercises.some((e) =>
          e.name.toLowerCase().includes("trizeps")
        );
        const nextEx: WorkoutTemplateExercise[] = hasTriceps
          ? tpl.exercises
          : [
              ...tpl.exercises,
              {
                name: "Trizepsdrücken Überkopf (Kabelzug)",
                muscleGroup: "triceps",
                targetSets: 3,
                targetReps: 12,
                defaultWeightKg: 12,
              },
            ];
        await submitEntry("template", { name: tpl.name, exercises: nextEx });
      } else if (lower.includes("ziehen")) {
        const hasChest = tpl.exercises.some(
          (e) =>
            e.name.toLowerCase().includes("brust") ||
            e.name.toLowerCase().includes("fliegende")
        );
        const nextEx: WorkoutTemplateExercise[] = hasChest
          ? tpl.exercises
          : [
              ...tpl.exercises,
              {
                name: "Brustpresse (Maschine)",
                muscleGroup: "chest",
                targetSets: 3,
                targetReps: 10,
                defaultWeightKg: 23,
              },
              {
                name: "Seitheben (Maschine)",
                muscleGroup: "shoulders",
                targetSets: 3,
                targetReps: 12,
                defaultWeightKg: 10,
              },
            ];
        await submitEntry("template", { name: tpl.name, exercises: nextEx });
      }
    }
  }

  function persistDataset(next: FitnessDataset) {
    setData(next);
    try {
      window.localStorage.setItem(HYBRID_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
  }

  // Group Gym entries by (sessionDate + workoutFocus) so 70 flat rows become 11 clean collapsible Workout Days!
  const groupedGymWorkouts = useMemo(() => {
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

    for (const item of data.gym) {
      const key = `${item.sessionDate}__${item.workoutFocus}`;
      const existing = map.get(key);
      const vol = item.sets * item.reps * item.weightKg;
      if (!existing) {
        map.set(key, {
          key,
          sessionDate: item.sessionDate,
          workoutFocus: item.workoutFocus,
          exercises: [item],
          totalSets: item.sets,
          totalVolumeKg: Math.round(vol),
        });
      } else {
        existing.exercises.push(item);
        existing.totalSets += item.sets;
        existing.totalVolumeKg = Math.round(existing.totalVolumeKg + vol);
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      b.sessionDate.localeCompare(a.sessionDate)
    );
  }, [data.gym]);

  function applyLocalMutation(
    type:
      | "gym"
      | "cardio"
      | "bouldering"
      | "template"
      | "supplement_item"
      | "supplement_toggle",
    payload: Record<string, unknown>
  ): FitnessDataset {
    const nowIso = new Date().toISOString();
    const nextId = Date.now();

    if (type === "gym") {
      const w = Number(payload.weightKg ?? 0);
      const r = Number(payload.reps ?? 8);
      const exName = String(payload.exerciseName ?? "Maschine");
      const newEntry: GymEntry = {
        id: nextId,
        sessionDate: String(payload.sessionDate ?? todayIso),
        workoutFocus: String(payload.workoutFocus ?? "Gym Workout"),
        exerciseName: exName,
        muscleGroup:
          (payload.muscleGroup as MuscleGroup | undefined) ??
          inferMuscleGroupFromExercise(exName),
        sets: Number(payload.sets ?? 3),
        reps: r,
        weightKg: w,
        rpe: Number(payload.rpe ?? 8),
        estimated1Rm: calculateEstimated1Rm(w, r),
        notes: String(payload.notes ?? ""),
        createdAt: nowIso,
      };
      return { ...data, gym: [newEntry, ...data.gym] };
    }

    if (type === "cardio") {
      return {
        ...data,
        cardio: [
          {
            id: nextId,
            sessionDate: String(payload.sessionDate ?? todayIso),
            modality: String(payload.modality ?? "Run"),
            durationMinutes: Number(payload.durationMinutes ?? 30),
            distanceKm: Number(payload.distanceKm ?? 0),
            avgHeartRate:
              payload.avgHeartRate === null ||
              payload.avgHeartRate === undefined
                ? null
                : Number(payload.avgHeartRate),
            rpe: Number(payload.rpe ?? 7),
            notes: String(payload.notes ?? ""),
            createdAt: nowIso,
          },
          ...data.cardio,
        ],
      };
    }

    if (type === "bouldering") {
      return {
        ...data,
        bouldering: [
          {
            id: nextId,
            sessionDate: String(payload.sessionDate ?? todayIso),
            location: String(payload.location ?? "Boulderhalle"),
            grade: String(payload.grade ?? "6A"),
            style: String(payload.style ?? "Flash"),
            wallAngle: String(payload.wallAngle ?? "Overhang"),
            attempts: Number(payload.attempts ?? 1),
            topped: Boolean(payload.topped ?? true),
            durationMinutes: Number(payload.durationMinutes ?? 60),
            skinAndFingerFeel: Number(payload.skinAndFingerFeel ?? 8),
            notes: String(payload.notes ?? ""),
            createdAt: nowIso,
          },
          ...data.bouldering,
        ],
      };
    }

    if (type === "template") {
      const name = String(payload.name ?? "Neuer Plan");
      const exercises = (payload.exercises ?? []) as WorkoutTemplateExercise[];
      return {
        ...data,
        templates: [
          { id: nextId, name, exercises, createdAt: nowIso },
          ...data.templates.filter(
            (t) => t.name.toLowerCase() !== name.toLowerCase()
          ),
        ],
      };
    }

    if (type === "supplement_item") {
      return {
        ...data,
        supplements: [
          ...data.supplements,
          {
            id: nextId,
            name: String(payload.name ?? "Supplement"),
            dosage: String(payload.dosage ?? "5g"),
            timing: String(payload.timing ?? "Morgens") as SupplementTiming,
            color: String(payload.color ?? "#cba6f7"),
            createdAt: nowIso,
          },
        ],
      };
    }

    // supplement_toggle
    const suppId = Number(payload.supplementId);
    const logDate = String(payload.logDate ?? todayIso);
    const exists = data.supplementLogs.some(
      (l) => l.supplementId === suppId && l.logDate === logDate
    );
    return {
      ...data,
      supplementLogs: exists
        ? data.supplementLogs.filter(
            (l) => !(l.supplementId === suppId && l.logDate === logDate)
          )
        : [
            ...data.supplementLogs,
            {
              id: nextId,
              supplementId: suppId,
              logDate,
              createdAt: nowIso,
            },
          ],
    };
  }

  async function submitEntry(
    type:
      | "gym"
      | "cardio"
      | "bouldering"
      | "template"
      | "supplement_item"
      | "supplement_toggle",
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

      if (res.ok) {
        const json = (await res.json()) as {
          ok: boolean;
          data?: FitnessDataset;
        };
        if (json.ok && json.data) {
          persistDataset(json.data);
          return true;
        }
      }

      // Hybrid fallback for GitHub Pages static mode
      const next = applyLocalMutation(type, payload);
      persistDataset(next);
      return true;
    } catch {
      const next = applyLocalMutation(type, payload);
      persistDataset(next);
      return true;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(
    category: "gym" | "cardio" | "bouldering" | "template" | "supplement",
    id: number
  ) {
    setErrorMsg(null);
    try {
      const res = await fetch("/api/fitness", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, id }),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          ok: boolean;
          data?: FitnessDataset;
        };
        if (json.ok && json.data) {
          persistDataset(json.data);
          return;
        }
      }
    } catch {
      // Fallback below for static mode
    }

    const next: FitnessDataset = {
      ...data,
      gym: category === "gym" ? data.gym.filter((x) => x.id !== id) : data.gym,
      cardio:
        category === "cardio"
          ? data.cardio.filter((x) => x.id !== id)
          : data.cardio,
      bouldering:
        category === "bouldering"
          ? data.bouldering.filter((x) => x.id !== id)
          : data.bouldering,
      templates:
        category === "template"
          ? data.templates.filter((x) => x.id !== id)
          : data.templates,
      supplements:
        category === "supplement"
          ? data.supplements.filter((x) => x.id !== id)
          : data.supplements,
    };
    persistDataset(next);
  }

  const isSignalReady =
    signalPrefs.phone.length >= 4 && signalPrefs.apiKey.length >= 2;

  return (
    <div className="app-shell">
      {/* Top Bar: Hip Logo + Primary Action + Clean Burger Menu for all Config */}
      <header className="top-header" style={{ position: "relative" }}>
        <SchymLogo />

        <div className="action-bar">
          <button
            type="button"
            className="pastel-btn btn-lavender"
            onClick={() =>
              openGymModal(coachBriefing.recommendedTemplate?.name ?? null)
            }
          >
            <Dumbbell size={17} />
            <span>Ich bin im Gym 💪</span>
          </button>

          <button
            type="button"
            className={`pill-tab ${isBurgerOpen ? "active" : ""}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "0.62rem 1rem",
              fontSize: "0.86rem",
            }}
            onClick={() => setIsBurgerOpen((v) => !v)}
            aria-expanded={isBurgerOpen}
            aria-label="Menü & Einstellungen öffnen"
          >
            {isBurgerOpen ? <X size={18} /> : <Menu size={18} />}
            <span>Menü</span>
            {isSignalReady && signalPrefs.autoEnabled && (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--pastel-mint)",
                  display: "inline-block",
                }}
                title={`Signal Auto-Briefing aktiv (${signalPrefs.autoTime} Uhr)`}
              />
            )}
          </button>
        </div>

        {/* Sleek Burger Dropdown Menu hiding all Config & Secondary Actions */}
        {isBurgerOpen && (
          <div
            className="panel-card pro-glass-card smooth-unfold"
            style={{
              position: "absolute",
              top: "calc(100% + 0.55rem)",
              right: 0,
              zIndex: 80,
              width: "min(340px, 92vw)",
              padding: "0.85rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.45rem",
              boxShadow: "0 20px 48px rgba(0, 0, 0, 0.55)",
              border: "1px solid rgba(203, 166, 247, 0.35)",
            }}
          >
            <div
              style={{
                fontSize: "0.7rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--text-muted)",
                padding: "0.2rem 0.45rem",
              }}
            >
              Aktionen &amp; Einstellungen
            </div>

            <button
              type="button"
              className="pill-tab"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                textAlign: "left",
                padding: "0.65rem 0.8rem",
              }}
              onClick={() => {
                setIsBurgerOpen(false);
                setIsQuickSportModalOpen(true);
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Plus size={16} color="var(--pastel-mint)" />
                <span>Sport / Cardio / Bouldern +</span>
              </span>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                Loggen
              </span>
            </button>

            <button
              type="button"
              className={`pill-tab ${coachDrawer === "science" ? "active" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                textAlign: "left",
                padding: "0.65rem 0.8rem",
              }}
              onClick={() => {
                setIsBurgerOpen(false);
                setCoachDrawer((d) => (d === "science" ? "none" : "science"));
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <FlaskConical size={16} color="var(--pastel-lavender)" />
                <span>Studien-Labor &amp; Athleten-Profil</span>
              </span>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                {coachDrawer === "science" ? "Offen" : "Öffnen"}
              </span>
            </button>

            <button
              type="button"
              className={`pill-tab ${coachDrawer === "habits" ? "active" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                textAlign: "left",
                padding: "0.65rem 0.8rem",
              }}
              onClick={() => {
                setIsBurgerOpen(false);
                setCoachDrawer((d) => (d === "habits" ? "none" : "habits"));
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <BarChart3 size={16} color="var(--pastel-sky)" />
                <span>Gelerntes Wochen-Verhalten</span>
              </span>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                {coachDrawer === "habits" ? "Offen" : "Öffnen"}
              </span>
            </button>

            <button
              type="button"
              className="pill-tab"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                textAlign: "left",
                padding: "0.65rem 0.8rem",
              }}
              onClick={() => {
                setIsBurgerOpen(false);
                setIsMobileSignalModalOpen(true);
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Send size={15} color="var(--pastel-mint)" />
                <span>Signal 06:00 Uhr Auto-Bot</span>
              </span>
              <span
                style={{
                  fontSize: "0.7rem",
                  color:
                    isSignalReady && signalPrefs.autoEnabled
                      ? "var(--pastel-mint)"
                      : "var(--text-muted)",
                  fontWeight: 700,
                }}
              >
                {isSignalReady && signalPrefs.autoEnabled
                  ? `Aktiv (${signalPrefs.autoTime})`
                  : "Konfigurieren"}
              </span>
            </button>

            <button
              type="button"
              className="pill-tab"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                textAlign: "left",
                padding: "0.65rem 0.8rem",
              }}
              onClick={() => {
                setIsBurgerOpen(false);
                setIsStravaModalOpen(true);
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <RefreshCw size={15} color="var(--pastel-peach)" />
                <span>Strava 2-Wege-Sync &amp; Hevy</span>
              </span>
              <span
                style={{
                  fontSize: "0.72rem",
                  color: "var(--pastel-peach)",
                  fontWeight: 700,
                }}
              >
                Push &amp; Import
              </span>
            </button>
          </div>
        )}
      </header>

      {signalToast && (
        <div
          style={{
            marginBottom: "0.85rem",
            padding: "0.65rem 1rem",
            borderRadius: 14,
            background: "rgba(166, 227, 161, 0.14)",
            border: "1px solid var(--pastel-mint)",
            color: "var(--pastel-mint)",
            fontSize: "0.82rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <CheckCircle2 size={16} />
          <span>{signalToast}</span>
        </div>
      )}

      {errorMsg && (
        <div className="error-banner" role="alert">
          <strong>Hinweis:</strong> {errorMsg}
        </div>
      )}

      {/* 1. Compact Smart Coach Bar (drawers controlled from Burger Menu) */}
      <SmartCoachBanner
        briefing={coachBriefing}
        profile={profile}
        openDrawer={coachDrawer}
        onChangeDrawer={setCoachDrawer}
        onUpdateProfile={handleUpdateProfile}
        onApplyScienceUpgrade={handleApplyScienceUpgrade}
        onStartGym={(tplName) =>
          openGymModal(
            tplName ?? coachBriefing.recommendedTemplate?.name ?? null
          )
        }
        onStartCardio={() => setIsQuickSportModalOpen(true)}
        onOpenMobileAndSignal={() => setIsMobileSignalModalOpen(true)}
      />

      {/* 2. Compact 1-Line Supplement Strip */}
      <SupplementTracker
        supplements={data.supplements}
        supplementLogs={data.supplementLogs}
        todayIso={todayIso}
        onToggleSupplement={(supplementId) =>
          submitEntry("supplement_toggle", { supplementId, logDate: todayIso })
        }
        onAddSupplement={(payload) => submitEntry("supplement_item", payload)}
        onDeleteSupplement={(id) => handleDelete("supplement", id)}
      />

      {/* 3. 4 Soft-Pastel Overview Cards (Streak, Gym, Cardio, Bouldering) */}
      <WeeklySplitCards summary={summary} />

      {/* 4. Main Two-Column Visual Dashboard: Calendar on Left, Body Muscle Map on Right (Unchanged as requested!) */}
      <div className="dashboard-two-col">
        <ActivityCalendar
          data={data}
          todayIso={todayIso}
          weeklyStreakCount={summary.weeklyStreakCount}
          activeDaysThisWeek={summary.activeDaysThisWeek}
          futureSchedule={coachBriefing.futureSchedule}
          onStartPlannedGym={(tplName) => openGymModal(tplName)}
        />

        <BodyMuscleMap gymEntries={data.gym} todayIso={todayIso} />
      </div>

      {/* 5. Collapsible Machine Progression Accordion */}
      <ProgressionChartCard gymEntries={data.gym} />

      {/* 6. Grouped & Collapsible Workout Diary (1Row per Workout Day, click to unfold exercises!) */}
      <section
        className="panel-card"
        style={{
          marginTop: "1rem",
          padding: isHistorySectionOpen ? "1.15rem 1.25rem" : "0.85rem 1.25rem",
        }}
      >
        <div
          onClick={() => setIsHistorySectionOpen((v) => !v)}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem",
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Sparkles size={18} color="var(--pastel-lavender)" />
            <span style={{ fontWeight: 800, fontSize: "0.95rem" }}>
              Trainings-Tagebuch ({groupedGymWorkouts.length} Gym-Workouts
              {data.cardio.length + data.bouldering.length > 0
                ? ` • ${data.cardio.length + data.bouldering.length} Sport/Boulder`
                : ""}
              )
            </span>
          </div>

          <button
            type="button"
            className="pill-tab"
            style={{
              padding: "0.32rem 0.7rem",
              fontSize: "0.75rem",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>
              {isHistorySectionOpen ? "Einklappen" : "Workouts ausklappen"}
            </span>
            {isHistorySectionOpen ? (
              <ChevronUp size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </button>
        </div>

        {isHistorySectionOpen && (
          <div
            className="session-list"
            style={{
              marginTop: "0.9rem",
              paddingTop: "0.85rem",
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            {groupedGymWorkouts.map((workout) => {
              const isDayOpen = Boolean(expandedWorkoutKeys[workout.key]);
              return (
                <div
                  key={workout.key}
                  style={{
                    background: "var(--bg-soft)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 16,
                    padding: "0.75rem 1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.65rem",
                  }}
                >
                  <div
                    onClick={() =>
                      setExpandedWorkoutKeys((prev) => ({
                        ...prev,
                        [workout.key]: !prev[workout.key],
                      }))
                    }
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "0.5rem",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.6rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <span className="badge badge-gym">
                        GYM • {workout.workoutFocus}
                      </span>
                      <strong style={{ fontSize: "0.9rem" }}>
                        {workout.sessionDate}
                      </strong>
                      <span
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {workout.exercises.length} Übungen • {workout.totalSets}{" "}
                        Sätze • {workout.totalVolumeKg.toLocaleString("de-DE")}{" "}
                        kg Volumen
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.55rem",
                      }}
                    >
                      <button
                        type="button"
                        className="pill-tab"
                        style={{
                          padding: "0.24rem 0.55rem",
                          fontSize: "0.72rem",
                          color: "var(--pastel-peach)",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsStravaModalOpen(true);
                        }}
                        title="Dieses Workout zu Strava übertragen (.tcx oder Strava API)"
                      >
                        🧡 Zu Strava
                      </button>

                      <span
                        style={{
                          fontSize: "0.76rem",
                          color: "var(--pastel-lavender)",
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {isDayOpen ? "Zuklappen" : "Übungen ansehen"}
                        {isDayOpen ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </span>
                    </div>
                  </div>

                  {isDayOpen && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.45rem",
                        paddingTop: "0.55rem",
                        borderTop: "1px solid var(--border-subtle)",
                      }}
                    >
                      {workout.exercises.map((item) => (
                        <div
                          key={`gym-${item.id}`}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "0.45rem 0.65rem",
                            borderRadius: 10,
                            background: "rgba(255,255,255,0.03)",
                            fontSize: "0.82rem",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              alignItems: "center",
                              gap: "0.65rem",
                            }}
                          >
                            <strong>{item.exerciseName}</strong>
                            <span style={{ color: "var(--pastel-lavender)" }}>
                              {item.sets} × {item.reps} @ {item.weightKg} kg
                            </span>
                            <span style={{ color: "var(--text-muted)" }}>
                              (e1RM: {item.estimated1Rm} kg)
                            </span>
                            {item.notes && item.notes !== "Hevy Import" && (
                              <span
                                style={{
                                  color: "var(--pastel-mint)",
                                  fontSize: "0.76rem",
                                }}
                              >
                                📌 {item.notes}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            className="delete-btn"
                            onClick={() => handleDelete("gym", item.id)}
                            title="Löschen"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {data.cardio.slice(0, 20).map((item) => {
              const def = getSportDefinition(item.modality);
              return (
                <div key={`cardio-${item.id}`} className="session-item">
                  <div className="session-main">
                    <div className="session-header">
                      <span className="badge badge-cardio">{def.label}</span>
                      <span className="session-title">
                        {item.durationMinutes} Min
                        {item.distanceKm > 0 ? ` • ${item.distanceKm} km` : ""}
                      </span>
                      {item.distanceKm > 0 && (
                        <span
                          style={{
                            fontSize: "0.78rem",
                            color: "var(--pastel-mint)",
                            fontWeight: 700,
                          }}
                        >
                          {formatPaceMinPerKm(
                            item.durationMinutes,
                            item.distanceKm
                          )}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {item.sessionDate}
                      </span>
                    </div>
                    {item.notes && (
                      <p className="session-notes">“{item.notes}”</p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="delete-btn"
                    onClick={() => handleDelete("cardio", item.id)}
                    title="Löschen"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}

            {data.bouldering.slice(0, 20).map((item) => (
              <div key={`boulder-${item.id}`} className="session-item">
                <div className="session-main">
                  <div className="session-header">
                    <span className="badge badge-boulder">BOULDER</span>
                    <span className="session-title">
                      Grad {item.grade} ({item.style}) @ {item.location}
                    </span>
                    <span
                      style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}
                    >
                      {item.sessionDate}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="delete-btn"
                  onClick={() => handleDelete("bouldering", item.id)}
                  title="Löschen"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* POPUP 1: "Ich bin im Gym" Live Modal */}
      {isGymModalOpen && (
        <GymSessionModal
          templates={data.templates}
          gymHistory={data.gym}
          todayIso={todayIso}
          initialTemplateName={selectedGymTemplateName}
          recommendedTemplateName={
            coachBriefing.recommendedTemplate?.name ?? null
          }
          onClose={() => setIsGymModalOpen(false)}
          onSaveGymSet={(payload) => submitEntry("gym", payload)}
          onSaveTemplate={(payload) => submitEntry("template", payload)}
          onDeleteTemplate={(id) => handleDelete("template", id)}
        />
      )}

      {/* POPUP 2: Quick Sport / Bouldering Modal */}
      {isQuickSportModalOpen && (
        <QuickActivityModal
          todayIso={todayIso}
          isSubmitting={isSubmitting}
          onClose={() => setIsQuickSportModalOpen(false)}
          onSubmitCardio={(payload) => submitEntry("cardio", payload)}
          onSubmitBoulder={(payload) => submitEntry("bouldering", payload)}
        />
      )}

      {/* POPUP 3: Strava & Hevy Sync Modal */}
      {isStravaModalOpen && (
        <StravaSyncModule
          currentData={data}
          onClose={() => setIsStravaModalOpen(false)}
          onSynced={(newData) => {
            setErrorMsg(null);
            persistDataset(newData);
          }}
          onError={(msg) => setErrorMsg(msg)}
        />
      )}

      {/* POPUP 4: Signal 06:00 AM Auto-Briefing Modal */}
      {isMobileSignalModalOpen && (
        <MobileAndSignalModal
          briefing={coachBriefing}
          prefs={signalPrefs}
          onSavePrefs={saveSignalPrefs}
          onClose={() => setIsMobileSignalModalOpen(false)}
        />
      )}
    </div>
  );
}
