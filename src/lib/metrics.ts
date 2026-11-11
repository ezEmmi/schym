/**
 * Calculates Epley's estimated 1-Rep Max (e1RM):
 * e1RM = weight * (1 + reps / 30)
 */
export function calculateEstimated1Rm(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weightKg * 10) / 10;
  const raw = weightKg * (1 + reps / 30);
  return Math.round(raw * 10) / 10;
}

/**
 * Formats pace in min/km (e.g., "5:12 /km") when distance > 0
 */
export function formatPaceMinPerKm(durationMinutes: number, distanceKm: number): string {
  if (distanceKm <= 0 || durationMinutes <= 0) return "—";
  const paceDecimal = durationMinutes / distanceKm;
  const mins = Math.floor(paceDecimal);
  const secs = Math.round((paceDecimal - mins) * 60);
  if (secs === 60) {
    return `${mins + 1}:00 /km`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")} /km`;
}

/**
 * Returns the Monday (YYYY-MM-DD) of the ISO week for a given YYYY-MM-DD date string.
 */
export function getIsoWeekMonday(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay(); // 0 is Sunday, 1 is Monday
  const diff = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}

export interface WeeklyAdherenceSummary {
  weekStart: string;
  gymDaysCount: number;
  gymTarget: number;
  cardioSessionsCount: number;
  cardioTarget: number;
  boulderingSessionsCount: number;
  boulderingSendsCount: number;
  totalVolumeKg: number;
  totalCardioMinutes: number;
}

export function computeWeeklySummary(
  referenceDateStr: string,
  gymRows: Array<{ sessionDate: string; sets: number; reps: number; weightKg: number }>,
  cardioRows: Array<{ sessionDate: string; durationMinutes: number }>,
  boulderingRows: Array<{ sessionDate: string; topped: boolean }>
): WeeklyAdherenceSummary {
  const weekStart = getIsoWeekMonday(referenceDateStr);

  const gymThisWeek = gymRows.filter((r) => getIsoWeekMonday(r.sessionDate) === weekStart);
  const cardioThisWeek = cardioRows.filter((r) => getIsoWeekMonday(r.sessionDate) === weekStart);
  const boulderThisWeek = boulderingRows.filter((r) => getIsoWeekMonday(r.sessionDate) === weekStart);

  // Count distinct gym days so multiple exercises on the same day count as 1 gym session toward the 2x/wk goal
  const distinctGymDays = new Set(gymThisWeek.map((r) => r.sessionDate)).size;

  const totalVolumeKg = gymThisWeek.reduce(
    (acc, r) => acc + r.sets * r.reps * r.weightKg,
    0
  );

  const totalCardioMinutes = cardioThisWeek.reduce(
    (acc, r) => acc + r.durationMinutes,
    0
  );

  const boulderingSendsCount = boulderThisWeek.filter((r) => r.topped).length;

  return {
    weekStart,
    gymDaysCount: distinctGymDays,
    gymTarget: 2,
    cardioSessionsCount: cardioThisWeek.length,
    cardioTarget: 2,
    boulderingSessionsCount: new Set(boulderThisWeek.map((r) => r.sessionDate)).size,
    boulderingSendsCount,
    totalVolumeKg: Math.round(totalVolumeKg),
    totalCardioMinutes,
  };
}
