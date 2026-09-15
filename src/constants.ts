import { GrainType, CompactionLevel } from './types.js';

export { SEASON_PROFILES, SEASON_ORDER, getSeasonProfile } from './seasonProfiles.js';

export interface GrainDensityProfile {
  name: string;
  density: number; // tonnes per cubic meter at standard ~12% moisture
  safeMoistureMax: number;
  description: string;
}

export const GRAIN_BULK_DENSITIES: Record<GrainType, GrainDensityProfile> = {
  wheat: {
    name: 'Wheat (Milling)',
    density: 0.77,
    safeMoistureMax: 13.5,
    description: 'Standard wheat test weight ~770 kg/m³',
  },
  rice: {
    name: 'Paddy Rice (Rough)',
    density: 0.75,
    safeMoistureMax: 14.0,
    description: 'Unmilled paddy grain ~750 kg/m³',
  },
  maize: {
    name: 'Yellow Maize (Corn)',
    density: 0.72,
    safeMoistureMax: 13.5,
    description: 'Shelled dried maize ~720 kg/m³',
  },
  barley: {
    name: 'Feed Barley',
    density: 0.62,
    safeMoistureMax: 13.0,
    description: 'Standard barley ~620 kg/m³',
  },
  pulses: {
    name: 'Pulses / Chickpeas / Dal',
    density: 0.80,
    safeMoistureMax: 12.0,
    description: 'Dense legume seeds ~800 kg/m³',
  },
  soybean: {
    name: 'Oilseed Soybean',
    density: 0.77,
    safeMoistureMax: 12.5,
    description: 'High-protein oilseed ~770 kg/m³',
  },
};

export const COMPACTION_MULTIPLIERS: Record<CompactionLevel, number> = {
  low: 0.94, // freshly dumped loose heap
  medium: 1.00, // natural settlement 7-30 days
  high: 1.06, // bottom half of deep pile >4m or stored >60 days
};

export const SAMPLE_GRAIN_IMAGES = {
  wheat_pile: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=1200&q=80',
  rice_pile: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1200&q=80',
  maize_pile: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=1200&q=80',
  soybean_pile: 'https://images.unsplash.com/photo-1569718974246-7b898eae87d3?auto=format&fit=crop&w=1200&q=80',
  pulses_pile: 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?auto=format&fit=crop&w=1200&q=80',
  silo_interior: 'https://images.unsplash.com/photo-1595246140625-573b715d11dc?auto=format&fit=crop&w=1200&q=80',
};
