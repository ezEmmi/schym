import { buildPreseededDataset } from "@/lib/hevy-seed";
import { FitnessDashboard } from "@/components/FitnessDashboard";

export default async function HomePage() {
  const isStatic = process.env.SCHYM_STATIC_EXPORT === "true";
  const initialData = isStatic
    ? buildPreseededDataset()
    : (await import("@/lib/db")).getAllFitnessData();
  const todayIso = new Date().toISOString().slice(0, 10);

  return <FitnessDashboard initialData={initialData} todayIso={todayIso} />;
}
