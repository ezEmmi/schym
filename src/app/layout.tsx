import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Schym — Local-First Gym, Cardio & Bouldering Tracker",
  description:
    "Security-first, local SQLite fitness tracker for your 2x/wk Gym, 2x+/wk Cardio, and Bouldering split.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
