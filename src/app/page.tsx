import { getAllFitnessData } from "@/lib/db";
import { FitnessDashboard } from "@/components/FitnessDashboard";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const initialData = getAllFitnessData();
  const todayIso = new Date().toISOString().slice(0, 10);

  return <FitnessDashboard initialData={initialData} todayIso={todayIso} />;
}
