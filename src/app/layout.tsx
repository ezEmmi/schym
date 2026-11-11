import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#181926",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "schym. — Smart Gym, Cardio & Supplement Coach",
  description:
    "Security-first, local SQLite fitness PWA with Smart Habit-Engine, Hevy-Brain-Cloning, Body Muscle Map & Signal Messenger Reminders.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "schym.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
