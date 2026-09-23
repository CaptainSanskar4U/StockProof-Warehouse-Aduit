/**
 * STOCKPROOF proof math — single deterministic model shared by
 * client tabs and the server estimation service.
 *
 * Pure functions only. No Node deps, no network. Works offline.
 */
import type { CompactionLevel, GrainType, Season } from './types.js';
import { GRAIN_BULK_DENSITIES } from './constants.js';
import { getSeasonProfile, getSeasonAirFactor } from './seasonProfiles.js';

export const REPOSE_MIN_DEG = 27;
export const REPOSE_MAX_DEG = 34;

export interface ProofContext {
  grainType: GrainType;
  season: Season;
  humidityPercent: number;
  compaction: CompactionLevel;
  storageDays: number;
}

const COMPACTION_MULT: Record<CompactionLevel, number> = {
  low: 0.94,
  medium: 1.0,
  high: 1.06,
};

export function coneVolumeM3(heightM: number, baseDiameterM: number): number {
  const r = baseDiameterM / 2;
  return Number(((1 / 3) * Math.PI * r * r * heightM).toFixed(1));
}

function humidityModifier(grainType: GrainType, humidityPercent: number): number {
  const safeBase = GRAIN_BULK_DENSITIES[grainType]?.safeMoistureMax ?? 12.0;
  const delta = humidityPercent - safeBase;
  if (delta >= 0) {
    return 1.0 + Math.min(delta, 6.0) * 0.0075;
  }
  return 1.0 + Math.max(delta, -5.0) * 0.006;
}

/** Same formula as server/estimation-service.ts — do not diverge. */
export function getEffectiveDensity(ctx: ProofContext): number {
  const base = GRAIN_BULK_DENSITIES[ctx.grainType]?.density ?? 0.77;
  const profile = getSeasonProfile(ctx.season);
  const humidityMod = humidityModifier(ctx.grainType, ctx.humidityPercent);
  const compactionMod = COMPACTION_MULT[ctx.compaction] ?? 1.0;
  const durationMod = Math.min(
    (Math.min(Math.max(ctx.storageDays, 0), 120) / 30) * profile.settleRatePer30d,
    profile.maxConsolidation,
  );
  const seasonAir = getSeasonAirFactor(ctx.season);
  return base * humidityMod * seasonAir * (compactionMod + profile.compactionBias + durationMod);
}

// ---------- 1. REVERSE PROOF ----------
export interface ReverseProof {
  declaredTonnes: number;
  effectiveDensity: number;
  requiredVolumeM3: number;
  requiredHeightM: number;
  measuredHeightM: number;
  measuredVolumeM3: number;
  heightGapM: number;
  supported: boolean;
}

export function reverseProof(
  declaredTonnes: number,
  baseDiameterM: number,
  measuredHeightM: number,
  ctx: ProofContext,
): ReverseProof {
  const effectiveDensity = getEffectiveDensity(ctx);
  const requiredVolumeM3 =
    declaredTonnes > 0 && effectiveDensity > 0
      ? Number((declaredTonnes / effectiveDensity).toFixed(1))
      : 0;
  const r = Math.max(baseDiameterM / 2, 0.01);
  const requiredHeightM =
    requiredVolumeM3 > 0 ? Number(((3 * requiredVolumeM3) / (Math.PI * r * r)).toFixed(1)) : 0;
  const measuredVolumeM3 = coneVolumeM3(measuredHeightM, baseDiameterM);
  const heightGapM = Number((requiredHeightM - measuredHeightM).toFixed(1));
  // Supported if required height fits within measured height + small tolerance (0.3m).
  const supported = heightGapM <= 0.3;
  return {
    declaredTonnes,
    effectiveDensity: Number(effectiveDensity.toFixed(3)),
    requiredVolumeM3,
    requiredHeightM,
    measuredHeightM,
    measuredVolumeM3,
    heightGapM,
    supported,
  };
}

// ---------- 2. IMPOSSIBLE GEOMETRY ----------
export function reposeDeg(heightM: number, baseDiameterM: number): number {
  if (baseDiameterM <= 0) return 0;
  return Number((Math.atan((2 * heightM) / baseDiameterM) * (180 / Math.PI)).toFixed(1));
}

export interface ReposeVerdict {
  deg: number;
  min: number;
  max: number;
  violation: boolean;
  label: string;
}

export function reposeVerdict(heightM: number, baseDiameterM: number): ReposeVerdict {
  const deg = reposeDeg(heightM, baseDiameterM);
  const violation = deg < REPOSE_MIN_DEG || deg > REPOSE_MAX_DEG;
  return {
    deg,
    min: REPOSE_MIN_DEG,
    max: REPOSE_MAX_DEG,
    violation,
    label: violation
      ? `Measured ${deg}° is outside the ${REPOSE_MIN_DEG}–${REPOSE_MAX_DEG}° grain repose band — this pile shape cannot stand as entered.`
      : `Measured ${deg}° sits inside the ${REPOSE_MIN_DEG}–${REPOSE_MAX_DEG}° grain repose band.`,
  };
}

// ---------- 3. BANKABLE TONNES ----------
export interface BankableResult {
  bankableTonnes: number;
  haircutPct: number;
  baseLow: number;
  breakdown: string[];
}

export function bankableTonnes(
  rangeLow: number,
  confidencePercent: number,
  humidityPercent: number,
  measurementPenalty: boolean,
): BankableResult {
  let haircut = 0;
  const breakdown: string[] = [];
  // Lower confidence -> larger haircut (0% at 96+, up to ~5% at 80).
  const confHaircut = Math.max(0, Math.min(0.05, (96 - confidencePercent) * 0.004));
  if (confHaircut > 0) {
    haircut += confHaircut;
    breakdown.push(`confidence ${confidencePercent}% → ${(confHaircut * 100).toFixed(1)}% haircut`);
  }
  if (humidityPercent > 17.5 || humidityPercent < 9.0) {
    haircut += 0.015;
    breakdown.push('extreme moisture → 1.5% haircut');
  }
  if (measurementPenalty) {
    haircut += 0.01;
    breakdown.push('visual estimate → 1.0% haircut');
  }
  haircut = Math.min(haircut, 0.08);
  const bankableTonnes = Number((rangeLow * (1 - haircut)).toFixed(1));
  if (breakdown.length === 0) breakdown.push('range low taken as-is — clean reading');
  return { bankableTonnes, haircutPct: Number((haircut * 100).toFixed(1)), baseLow: rangeLow, breakdown };
}

// ---------- 4. PHOTO QUALITY GATE (honest heuristics, offline) ----------
export interface PhotoQualityInput {
  width: number;
  height: number;
  sizeKB: number;
  meanLuma: number;
  blurVariance: number; // variance-of-Laplacian on 64px thumb; higher = sharper
}

export interface PhotoQuality {
  ok: boolean;
  verdict: 'ok' | 'not_suitable';
  reasons: string[];
  headline: string;
}

export function evaluatePhotoQuality(q: PhotoQualityInput): PhotoQuality {
  const reasons: string[] = [];
  const longEdge = Math.max(q.width, q.height);
  if (longEdge < 800) reasons.push(`low resolution (${q.width}×${q.height}) — step back and capture the whole pile`);
  if (q.meanLuma < 60) reasons.push('too dark — use morning light, no flash shadow');
  if (q.meanLuma > 200) reasons.push('overexposed — avoid harsh noon glare');
  if (q.blurVariance > 0 && q.blurVariance < 18) reasons.push('too blurry — hold steady, tap to focus');
  // Overcompressed for its pixels often means heavy crop/zoom.
  if (longEdge >= 1200 && q.sizeKB > 0 && q.sizeKB < 60)
    reasons.push('heavily compressed — looks zoomed or cropped, capture wider');
  const ok = reasons.length === 0;
  return {
    ok,
    verdict: ok ? 'ok' : 'not_suitable',
    reasons,
    headline: ok ? 'FULL PILE VISIBLE' : 'PHOTO NOT SUITABLE',
  };
}

// ---------- AI / synthetic image suspicion (heuristic only, never blocks) ----------
export interface AiSuspicionInput {
  fileName: string;
  width: number;
  height: number;
  sizeKB: number;
  meanLuma: number;
  blurVariance: number;
}

export interface AiSuspicion {
  score: number; // 0-100
  suspect: boolean;
  reasons: string[];
}

const AI_NAME_HINTS = ['midjourney', 'dalle', 'dall-e', 'stable-diffusion', 'firefly', 'ai-generated', 'generated', 'synthetic', 'leonardo', 'bing-image'];

export function evaluateAiSuspicion(inp: AiSuspicionInput): AiSuspicion {
  const reasons: string[] = [];
  let score = 0;
  const name = (inp.fileName || '').toLowerCase();
  if (AI_NAME_HINTS.some((h) => name.includes(h))) {
    score += 45;
    reasons.push('filename looks AI-generated');
  }
  const squareAI = inp.width === inp.height && [512, 768, 1024].includes(inp.width);
  if (squareAI) {
    score += 20;
    reasons.push('square AI-typical size');
  }
  // Plasticky-smooth + vivid at high res is a weak synthetic hint, never proof.
  if (inp.blurVariance > 0 && inp.blurVariance < 12 && Math.max(inp.width, inp.height) >= 1000) {
    score += 15;
    reasons.push('over-smooth texture for this resolution');
  }
  if (inp.sizeKB > 0 && Math.max(inp.width, inp.height) >= 1200 && inp.sizeKB < 50) {
    score += 10;
    reasons.push('too clean for a field photo');
  }
  score = Math.min(95, score);
  return { score, suspect: score >= 50, reasons };
}

/** Laplacian variance on a small grayscale grid — caller builds the grid from canvas. */
export function laplacianVariance(gray: number[], w: number, h: number): number {
  if (gray.length < 9 || w < 3 || h < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      const lap = Math.abs(4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w]);
      sum += lap;
      sumSq += lap * lap;
      n += 1;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return Number((sumSq / n - mean * mean).toFixed(1));
}
