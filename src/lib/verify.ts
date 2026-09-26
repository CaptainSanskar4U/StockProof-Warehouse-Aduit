import type {
  GovCheck,
  PhotoAuthenticity,
  PhotoVerdictFinding,
  Verification,
  VerificationStatus,
  Warehouse,
} from '../types.js';
import type { GovCheckInput } from '../services/api.js';

/** Public verify URL — query param so SPA hosting resolves it. */
export function buildVerifyUrl(id: string, origin?: string): string {
  const base = origin || reportOrigin();
  return `${base}/?verify=${encodeURIComponent(id)}`;
}

/**
 * Origin baked into a printed report's QR code.
 *
 * A report is printed and handed to a person, then scanned later — often on
 * mobile data, away from the inspector's machine. A QR minted on localhost is
 * dead paper, so VITE_REPORT_ORIGIN lets printed reports always encode the
 * public deployment regardless of where the report was generated.
 */
export function reportOrigin(): string {
  const configured =
    (import.meta.env?.VITE_REPORT_ORIGIN as string | undefined) ||
    (typeof process !== 'undefined' ? process.env?.VITE_REPORT_ORIGIN : undefined);
  const fromEnv = typeof configured === 'string' ? configured.trim().replace(/\/+$/, '') : '';
  if (fromEnv) return fromEnv;
  return typeof window !== 'undefined' ? window.location.origin : '';
}

/** Derive the stored authenticity verdict from detector findings. Mirrors the server. */
export function authenticityOf(photoVerdict?: {
  primary?: PhotoVerdictFinding | null;
  cross?: PhotoVerdictFinding | null;
}): PhotoAuthenticity {
  const labels = [photoVerdict?.primary?.label, photoVerdict?.cross?.label].filter(
    (l): l is string => typeof l === 'string',
  );
  if (labels.length === 0) return 'unchecked';
  if (labels.some((l) => l === 'ai')) return 'ai';
  if (labels.every((l) => l === 'real')) return 'real';
  return 'inconclusive';
}

/** Display match verdict: boolean | null, where null = UNVERIFIED. Mirrors the server. */
export function matchOf(authenticity: PhotoAuthenticity, status: VerificationStatus): boolean | null {
  if (authenticity === 'ai' || authenticity === 'inconclusive') return null;
  return status === 'consistent';
}

/** UNVERIFIED rule: ai or inconclusive — headline case, numbers untrusted. */
export function isUnverifiedRecord(r: { authenticity: PhotoAuthenticity }): boolean {
  return r.authenticity === 'ai' || r.authenticity === 'inconclusive';
}

export const UNVERIFIED_HEADLINE =
  '⚠️ UNVERIFIED — this image could not be confirmed as genuine and should not be used as audit evidence.';

export function authenticityNote(authenticity: PhotoAuthenticity): string {
  switch (authenticity) {
    case 'real':
      return 'Photo confirmed genuine by detectors.';
    case 'ai':
      return 'Detectors flag this image as AI-generated.';
    case 'inconclusive':
      return 'Detectors disagree on this image.';
    case 'unchecked':
      return 'Authenticity check unavailable — detectors did not report.';
  }
}

/**
 * Map a saved Verification to a gov-checks POST body.
 * Same mapping the New Audit flow uses at record time.
 */
export function govCheckInputFromVerification(v: Verification, warehouse?: Warehouse): GovCheckInput {
  const isGov = (v.agentType || 'bank') === 'government';
  return {
    inspectorName: (!isGov ? v.bank?.farmerName?.trim() : undefined) || v.runBy.name,
    location: isGov
      ? v.gov?.region || (warehouse ? `${warehouse.district}, ${warehouse.state}` : v.warehouseId)
      : warehouse
        ? `${warehouse.district}, ${warehouse.state}`
        : v.bank?.warehouseName || v.warehouseId,
    storageName: warehouse?.name || v.bank?.warehouseName,
    declaredTonnes: v.declaredAtTimeOfRun,
    estCentral: v.estimate.centralTonnes,
    estLow: v.estimate.rangeLow,
    estHigh: v.estimate.rangeHigh,
    volumeM3: v.estimate.volumeM3,
    status: v.status,
    checkerNote: v.auditRecommendation,
    photoDataUrl: v.photoUrl,
    photoVerdict: v.photoVerdict
      ? { primary: v.photoVerdict.primary ?? null, cross: v.photoVerdict.cross ?? null }
      : undefined,
    verificationId: v.id,
    agentType: v.agentType || 'bank',
    scheme: v.gov?.scheme,
  };
}

export type { GovCheck };
