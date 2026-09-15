/**
 * STOCKPROOF Estimation Service
 * 
 * Transparent, explainable calculation module for converting warehouse pile geometry
 * and storage context into defensible weight ranges and risk classifications.
 * 
 * DESIGN NOTE:
 * In a production deployment, the initial pile geometry (height, diameter, volume)
 * can be populated by a calibrated photogrammetry / monocular depth AI pipeline
 * (e.g., structure-from-motion or stereoscopic LiDAR on supported devices).
 * This module cleanly encapsulates the physical transformation from volume to mass,
 * guaranteeing that volume is never naively treated as weight.
 */

import { GrainType, GeometryInputs, ContextInputs, EstimationResult, VerificationStatus, Season } from '../src/types.js';
import { getSeasonProfile, getSeasonAirFactor } from '../src/seasonProfiles.js';

export { SEASON_PROFILES } from '../src/seasonProfiles.js';

// Standard agronomic bulk densities (tonnes per cubic meter)
export const GRAIN_BULK_DENSITIES: Record<GrainType, { name: string; density: number; safeMoisture: number }> = {
  wheat: { name: 'Wheat', density: 0.770, safeMoisture: 12.0 },
  rice: { name: 'Paddy Rice', density: 0.750, safeMoisture: 13.0 },
  maize: { name: 'Maize / Corn', density: 0.720, safeMoisture: 13.5 },
  soybean: { name: 'Soybean', density: 0.770, safeMoisture: 11.5 },
  pulses: { name: 'Pulses / Gram', density: 0.800, safeMoisture: 10.5 },
  barley: { name: 'Barley', density: 0.620, safeMoisture: 12.5 },
};

export const COMPACTION_MULTIPLIERS = {
  low: 0.94,    // Freshly dumped / aerated pile
  medium: 1.00, // Standard gravitational settling
  high: 1.06,   // Deep base compaction / mechanical tamping
};

/**
 * Calculates physical pile volume in m³ using a cone or frustum geometry.
 */
export function calculatePileVolume(
  heightMeters: number,
  baseDiameterMeters: number,
  topDiameterMeters: number = 0,
  pileType: 'cone' | 'frustum' = 'cone'
): number {
  const r1 = baseDiameterMeters / 2;
  if (pileType === 'cone' || topDiameterMeters <= 0) {
    // V = (1/3) * π * r² * h
    return (1 / 3) * Math.PI * Math.pow(r1, 2) * heightMeters;
  } else {
    // Truncated cone (frustum): V = (1/3) * π * h * (r1² + r1*r2 + r2²)
    const r2 = topDiameterMeters / 2;
    return (1 / 3) * Math.PI * heightMeters * (Math.pow(r1, 2) + r1 * r2 + Math.pow(r2, 2));
  }
}

/**
 * Computes humidity correction factor.
 * Grain moisture directly contributes to mass per unit volume up to ~18%,
 * above which swelling and mold risk dampens further bulk density gain.
 */
export function getHumidityModifier(grainType: GrainType, humidityPercent: number): number {
  const safeBase = GRAIN_BULK_DENSITIES[grainType].safeMoisture;
  const delta = humidityPercent - safeBase;

  if (delta >= 0) {
    // Effective density increases with moisture absorption up to 18%
    const cappedDelta = Math.min(delta, 6.0); // max 6% above baseline
    return 1.0 + (cappedDelta * 0.0075);
  } else {
    // Drier grain has lower water mass
    const cappedNegativeDelta = Math.max(delta, -5.0);
    return 1.0 + (cappedNegativeDelta * 0.006);
  }
}

/**
 * Calculates compaction increase resulting from prolonged storage under pressure.
 * Deep piles consolidate over weeks — and the rate is season-aware:
 * humid Kharif grain settles fastest, hot dry Zaid grain stays aerated longest.
 * A single fixed factor would misread the same photo fill across seasons.
 */
export function getStorageDurationModifier(days: number, season?: Season | string): number {
  const profile = getSeasonProfile(season as Season);
  const cappedDays = Math.min(Math.max(days, 0), 120);
  const raw = (cappedDays / 30) * profile.settleRatePer30d;
  return Math.min(raw, profile.maxConsolidation);
}

/** Static season compaction bias (Kharif packs denser, Zaid stays loose). */
export function getSeasonCompactionBias(season?: Season | string): number {
  return getSeasonProfile(season as Season).compactionBias;
}

/**
 * Primary Defensible Estimation Engine
 */
export function computeGrainStockEstimate(
  geometry: GeometryInputs,
  context: ContextInputs,
  declaredTonnes: number
): EstimationResult {
  const { grainType, humidityPercent, compaction, storageDays } = context;
  const season: Season = (context as { season?: Season }).season || 'rabi';
  const seasonProfile = getSeasonProfile(season);
  const grainProfile = GRAIN_BULK_DENSITIES[grainType];

  // 1. Calculate or use verified volume
  const volumeM3 = geometry.calculatedVolumeM3 > 0 
    ? geometry.calculatedVolumeM3 
    : calculatePileVolume(geometry.heightMeters, geometry.baseDiameterMeters, geometry.topDiameterMeters, geometry.pileType);

  // 2. Base density from agronomic table
  const baseDensity = grainProfile.density;

  // 3. Season-aware modifiers — no single fixed conversion factor.
  // Same photo fill reads heavier in humid fast-settling Kharif,
  // lighter in hot dry aerated Zaid.
  const humidityMod = getHumidityModifier(grainType, humidityPercent);
  const compactionMod = COMPACTION_MULTIPLIERS[compaction] || 1.0;
  const seasonBias = getSeasonCompactionBias(season);
  const durationMod = getStorageDurationModifier(storageDays, season);
  const seasonAir = getSeasonAirFactor(season);

  const effectiveDensity = baseDensity * humidityMod * seasonAir * (compactionMod + seasonBias + durationMod);

  // 4. Central estimate
  const centralEstimateTonnes = Number((volumeM3 * effectiveDensity).toFixed(1));

  // 5. Defensible range calculation (no deceptive point precision)
  let uncertaintyHalfSpan = 0.035; // baseline ±3.5%
  if (geometry.measurementMethod === 'visual_estimate') {
    uncertaintyHalfSpan += 0.025; // widen to ±6.0%
  } else if (geometry.measurementMethod === 'laser_assisted' || geometry.measurementMethod === 'ar_marker') {
    uncertaintyHalfSpan -= 0.005; // narrow to ±3.0%
  }

  if (humidityPercent > 17.5 || humidityPercent < 9.0) {
    uncertaintyHalfSpan += 0.01; // additional variance for non-standard moisture
  }

  // Season override penalty: meter reading far outside the season's typical band
  const [seasonLow, seasonHigh] = seasonProfile.typicalHumidity;
  const outsideSeasonBand = humidityPercent < seasonLow - 1 || humidityPercent > seasonHigh + 1;
  if (outsideSeasonBand) {
    uncertaintyHalfSpan += 0.005;
  }

  const rangeLowTonnes = Number((centralEstimateTonnes * (1 - uncertaintyHalfSpan)).toFixed(1));
  const rangeHighTonnes = Number((centralEstimateTonnes * (1 + uncertaintyHalfSpan)).toFixed(1));

  // 6. Confidence Score
  let confidence = 94;
  if (geometry.measurementMethod === 'laser_assisted' || geometry.measurementMethod === 'ar_marker') {
    confidence += 3;
  }
  if (geometry.measurementMethod === 'visual_estimate') {
    confidence -= 8;
  }
  if (humidityPercent > 18.0) {
    confidence -= 5;
  }
  if (outsideSeasonBand) {
    confidence -= 2;
  }
  if (storageDays > 120) {
    confidence -= 3;
  }
  const confidencePercent = Math.max(78, Math.min(98, confidence));

  // 7. Comparison with declared warehouse receipt
  let status: VerificationStatus = 'consistent';
  let discrepancyTonnes = 0;
  let discrepancyPercent = 0;

  if (declaredTonnes > rangeHighTonnes) {
    discrepancyTonnes = Number((declaredTonnes - rangeHighTonnes).toFixed(1));
    discrepancyPercent = Number(((discrepancyTonnes / declaredTonnes) * 100).toFixed(1));
    
    // Over-declaration detection
    if (discrepancyPercent > 5.0 || discrepancyTonnes > 5.0) {
      status = 'high_priority';
    } else {
      status = 'review';
    }
  } else if (declaredTonnes < rangeLowTonnes) {
    discrepancyTonnes = Number((rangeLowTonnes - declaredTonnes).toFixed(1));
    discrepancyPercent = Number(((discrepancyTonnes / declaredTonnes) * 100).toFixed(1));
    status = 'review'; // stock exceeds receipt or potential under-reporting
  } else {
    status = 'consistent';
    discrepancyTonnes = 0;
    discrepancyPercent = 0;
  }

  // 8. Plain-language, procedural reasoning & neutral recommendation
  const compactionLabel = compaction === 'high' ? 'dense compaction' : compaction === 'low' ? 'aerated pile' : 'medium compaction';
  let explanatoryReason = `Estimated range ${rangeLowTonnes}–${rangeHighTonnes} T accounts for ${volumeM3.toFixed(0)} m³ pile volume, ${grainProfile.name} bulk density (${baseDensity.toFixed(2)} t/m³), ${compactionLabel}, ${seasonProfile.short} season curve, and ${humidityPercent}% moisture content over ${storageDays} days storage.`;

  let auditRecommendation = 'Declared stock aligns with physical geometry and grain density parameters. Routine audit schedule maintained.';

  if (status === 'high_priority') {
    explanatoryReason += ` Declared receipt of ${declaredTonnes} T exceeds the physical upper boundary by ${discrepancyTonnes} T (+${discrepancyPercent}%).`;
    auditRecommendation = `Review required before next loan disbursement. Recommend immediate on-site physical core sampling and laser depth re-verification.`;
  } else if (status === 'review') {
    if (declaredTonnes > rangeHighTonnes) {
      explanatoryReason += ` Declared receipt of ${declaredTonnes} T is near the upper bound (+${discrepancyTonnes} T difference).`;
      auditRecommendation = `Procedural check recommended. Verify moisture calibration and confirm whether recent consolidation or bagging has occurred.`;
    } else {
      explanatoryReason += ` Declared receipt of ${declaredTonnes} T is ${discrepancyTonnes} T below the estimated lower bound.`;
      auditRecommendation = `Stock exceeds declared receipt. Check for unrecorded incoming lots or uncalibrated weighbridge receipting.`;
    }
  }

  return {
    centralEstimateTonnes,
    rangeLowTonnes,
    rangeHighTonnes,
    confidencePercent,
    volumeM3: Number(volumeM3.toFixed(1)),
    effectiveDensity: Number(effectiveDensity.toFixed(3)),
    status,
    discrepancyTonnes,
    discrepancyPercent,
    explanatoryReason,
    auditRecommendation,
  };
}
