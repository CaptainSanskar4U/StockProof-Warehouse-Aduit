import { Season } from './types.js';

export interface SeasonProfile {
  id: Season;
  name: string;
  short: string;
  harvestWindow: string;
  storageHint: string;
  /** Ambient hygroscopic bias (% points of effective moisture) at the same meter reading. */
  moistureBiasPct: number;
  /** Consolidation rate per 30 days of storage under grain pressure. */
  settleRatePer30d: number;
  /** Static compaction bias added to the compaction multiplier. */
  compactionBias: number;
  /** Cap on duration consolidation. */
  maxConsolidation: number;
  typicalHumidity: [number, number];
  description: string;
}

export const SEASON_PROFILES: Record<Season, SeasonProfile> = {
  kharif: {
    id: 'kharif',
    name: 'Kharif (Monsoon)',
    short: 'Kharif',
    harvestWindow: 'Jun – Oct harvest · monsoon storage',
    storageHint: 'Humid air, fast settling, watch spoilage above 17%',
    moistureBiasPct: 0.6,
    settleRatePer30d: 0.014,
    compactionBias: 0.008,
    maxConsolidation: 0.05,
    typicalHumidity: [13.0, 15.5],
    description:
      'Monsoon-stored grain holds ambient moisture and consolidates fast. Same photo fill = heavier tonnage than winter.',
  },
  rabi: {
    id: 'rabi',
    name: 'Rabi (Winter)',
    short: 'Rabi',
    harvestWindow: 'Nov – Apr harvest · dry winter storage',
    storageHint: 'Reference curve — stable, slow settling',
    moistureBiasPct: -0.3,
    settleRatePer30d: 0.011,
    compactionBias: 0,
    maxConsolidation: 0.04,
    typicalHumidity: [11.0, 13.0],
    description:
      'Dry winter baseline used as the reference calibration. Moderate settling under steady grain pressure.',
  },
  zaid: {
    id: 'zaid',
    name: 'Zaid (Summer)',
    short: 'Zaid',
    harvestWindow: 'May – Jun harvest · hot dry storage',
    storageHint: 'Very dry, aerated, loose — same fill = lighter tonnage',
    moistureBiasPct: -0.9,
    settleRatePer30d: 0.008,
    compactionBias: -0.012,
    maxConsolidation: 0.032,
    typicalHumidity: [9.5, 12.0],
    description:
      'Hot dry air pulls moisture out and keeps piles aerated. Identical geometry reads lighter than Kharif.',
  },
};

export const SEASON_ORDER: Season[] = ['kharif', 'rabi', 'zaid'];

export function getSeasonProfile(season: Season | string | undefined): SeasonProfile {
  if (season === 'kharif' || season === 'rabi' || season === 'zaid') {
    return SEASON_PROFILES[season];
  }
  return SEASON_PROFILES.rabi;
}

/** Small multiplicative air-equilibrium factor so the same meter reading still differs by season. */
export function getSeasonAirFactor(season: Season | string | undefined): number {
  const p = getSeasonProfile(season);
  return 1 + p.moistureBiasPct * 0.003;
}
