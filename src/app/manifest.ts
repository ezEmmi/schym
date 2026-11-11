import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Schym — Smart Gym, Cardio & Supplement Coach",
    short_name: "Schym",
    description:
      "Local-First Fitness PWA mit Smart Habit-Engine, Hevy-Brain-Cloning, Körper-Map & Signal-Reminder.",
    start_url: "/",
    display: "standalone",
    background_color: "#181926",
    theme_color: "#181926",
    orientation: "portrait",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
