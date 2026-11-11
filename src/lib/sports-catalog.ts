/**
 * Comprehensive Multi-Sport Catalog for Schym
 * Allows toggling active sports, filtering logs by sport, and mapping Strava `sport_type` / `type` automatically.
 */

export type SportCategory =
  | "Endurance"
  | "Climbing & Outdoor"
  | "Team & Ball"
  | "Racket"
  | "Combat & Martial Arts"
  | "Water & Winter"
  | "Mind, Mobility & Other";

export interface SportDefinition {
  id: string;
  label: string;
  category: SportCategory;
  tracksDistance: boolean;
  defaultUnit: "km" | "m" | "none";
  stravaTypes: string[];
  accentColor: string;
}

export const SPORTS_CATALOG: readonly SportDefinition[] = [
  // Endurance
  {
    id: "Run",
    label: "Running (Road / Track)",
    category: "Endurance",
    tracksDistance: true,
    defaultUnit: "km",
    stravaTypes: ["Run", "VirtualRun"],
    accentColor: "#34d399",
  },
  {
    id: "TrailRun",
    label: "Trail Running",
    category: "Endurance",
    tracksDistance: true,
    defaultUnit: "km",
    stravaTypes: ["TrailRun"],
    accentColor: "#10b981",
  },
  {
    id: "Cycle",
    label: "Road Cycling",
    category: "Endurance",
    tracksDistance: true,
    defaultUnit: "km",
    stravaTypes: ["Ride", "VirtualRide", "EBikeRide"],
    accentColor: "#38bdf8",
  },
  {
    id: "GravelMtb",
    label: "Gravel / Mountain Bike",
    category: "Endurance",
    tracksDistance: true,
    defaultUnit: "km",
    stravaTypes: ["GravelRide", "MountainBikeRide", "EMountainBikeRide"],
    accentColor: "#0ea5e9",
  },
  {
    id: "Swim",
    label: "Swimming",
    category: "Endurance",
    tracksDistance: true,
    defaultUnit: "km",
    stravaTypes: ["Swim"],
    accentColor: "#22d3ee",
  },
  {
    id: "Row",
    label: "Rowing / Ergometer",
    category: "Endurance",
    tracksDistance: true,
    defaultUnit: "km",
    stravaTypes: ["Rowing", "VirtualRow"],
    accentColor: "#60a5fa",
  },
  {
    id: "HIIT",
    label: "HIIT / CrossFit / Circuit",
    category: "Endurance",
    tracksDistance: false,
    defaultUnit: "none",
    stravaTypes: ["HIIT", "Crossfit", "Workout"],
    accentColor: "#f43f5e",
  },

  // Climbing & Outdoor
  {
    id: "Bouldering",
    label: "Bouldering",
    category: "Climbing & Outdoor",
    tracksDistance: false,
    defaultUnit: "none",
    stravaTypes: ["Bouldering"],
    accentColor: "#fbbf24",
  },
  {
    id: "RockClimbing",
    label: "Sport / Lead / Trad Climbing",
    category: "Climbing & Outdoor",
    tracksDistance: false,
    defaultUnit: "none",
    stravaTypes: ["RockClimbing"],
    accentColor: "#f59e0b",
  },
  {
    id: "Hike",
    label: "Hiking & Mountaineering",
    category: "Climbing & Outdoor",
    tracksDistance: true,
    defaultUnit: "km",
    stravaTypes: ["Hike", "Walk"],
    accentColor: "#84cc16",
  },

  // Team & Ball
  {
    id: "Football",
    label: "Football / Soccer",
    category: "Team & Ball",
    tracksDistance: true,
    defaultUnit: "km",
    stravaTypes: ["Soccer"],
    accentColor: "#4ade80",
  },
  {
    id: "Basketball",
    label: "Basketball",
    category: "Team & Ball",
    tracksDistance: false,
    defaultUnit: "none",
    stravaTypes: ["Basketball"],
    accentColor: "#fb923c",
  },
  {
    id: "Volleyball",
    label: "Volleyball / Beach Volley",
    category: "Team & Ball",
    tracksDistance: false,
    defaultUnit: "none",
    stravaTypes: ["Volleyball"],
    accentColor: "#facc15",
  },
  {
    id: "Handball",
    label: "Handball",
    category: "Team & Ball",
    tracksDistance: false,
    defaultUnit: "none",
    stravaTypes: ["Handball"],
    accentColor: "#a78bfa",
  },

  // Racket Sports
  {
    id: "Tennis",
    label: "Tennis",
    category: "Racket",
    tracksDistance: false,
    defaultUnit: "none",
    stravaTypes: ["Tennis"],
    accentColor: "#a3e635",
  },
  {
    id: "Padel",
    label: "Padel / Squash / Pickleball",
    category: "Racket",
    tracksDistance: false,
    defaultUnit: "none",
    stravaTypes: ["Padel", "Squash", "Pickleball", "Racquetball"],
    accentColor: "#2dd4bf",
  },
  {
    id: "Badminton",
    label: "Badminton / Table Tennis",
    category: "Racket",
    tracksDistance: false,
    defaultUnit: "none",
    stravaTypes: ["Badminton", "TableTennis"],
    accentColor: "#38bdf8",
  },

  // Combat & Martial Arts
  {
    id: "Boxing",
    label: "Boxing / Kickboxing / Muay Thai",
    category: "Combat & Martial Arts",
    tracksDistance: false,
    defaultUnit: "none",
    stravaTypes: ["Boxing"],
    accentColor: "#ef4444",
  },
  {
    id: "Grappling",
    label: "BJJ / MMA / Wrestling / Judo",
    category: "Combat & Martial Arts",
    tracksDistance: false,
    defaultUnit: "none",
    stravaTypes: ["MartialArts"],
    accentColor: "#f87171",
  },

  // Water & Winter
  {
    id: "SkiSnowboard",
    label: "Skiing / Snowboarding",
    category: "Water & Winter",
    tracksDistance: true,
    defaultUnit: "km",
    stravaTypes: ["AlpineSki", "BackcountrySki", "NordicSki", "Snowboard"],
    accentColor: "#93c5fd",
  },
  {
    id: "WaterSports",
    label: "Kayaking / SUP / Surfing",
    category: "Water & Winter",
    tracksDistance: true,
    defaultUnit: "km",
    stravaTypes: ["Kayaking", "StandUpPaddling", "Surfing", "Kitesurf", "Windsurf"],
    accentColor: "#06b6d4",
  },
  {
    id: "Skate",
    label: "Skating / Inline / Skateboard",
    category: "Water & Winter",
    tracksDistance: true,
    defaultUnit: "km",
    stravaTypes: ["InlineSkate", "IceSkate", "Skateboard"],
    accentColor: "#e879f9",
  },

  // Mind, Mobility & Other
  {
    id: "MobilityYoga",
    label: "Yoga / Mobility / Stretching",
    category: "Mind, Mobility & Other",
    tracksDistance: false,
    defaultUnit: "none",
    stravaTypes: ["Yoga", "Pilates"],
    accentColor: "#c084fc",
  },
  {
    id: "Calisthenics",
    label: "Calisthenics / Gymnastics",
    category: "Mind, Mobility & Other",
    tracksDistance: false,
    defaultUnit: "none",
    stravaTypes: ["WeightTraining"],
    accentColor: "#818cf8",
  },
] as const;

export const SPORT_IDS = SPORTS_CATALOG.map((s) => s.id) as [string, ...string[]];

export function getSportDefinition(sportId: string): SportDefinition {
  const found = SPORTS_CATALOG.find((s) => s.id === sportId);
  if (found) return found;
  return {
    id: sportId,
    label: sportId,
    category: "Endurance",
    tracksDistance: true,
    defaultUnit: "km",
    stravaTypes: [],
    accentColor: "#34d399",
  };
}

/**
 * Maps a Strava `sport_type` or `type` string to our internal Sport ID.
 */
export function mapStravaSportToSchym(stravaSportType: string): string {
  for (const sport of SPORTS_CATALOG) {
    if (
      sport.stravaTypes.some(
        (t) => t.toLowerCase() === stravaSportType.toLowerCase()
      )
    ) {
      return sport.id;
    }
  }
  return "Run";
}
