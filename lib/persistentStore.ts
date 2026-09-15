/**
 * Serverless-safe persistent store for Vercel.
 *
 * - Production (Vercel): persists to Upstash Redis (Vercel Marketplace Redis /
 *   legacy KV). Requires KV_REST_API_URL + KV_REST_API_TOKEN env vars.
 * - Fallback (no Redis configured): in-memory copy seeded from defaults.
 *   Survives warm lambda reuse; reseeds on cold start. Writes never crash.
 */
import { Redis } from '@upstash/redis';
import {
  INITIAL_WAREHOUSES,
  INITIAL_VERIFICATIONS,
  INITIAL_REVIEWS,
  type StorageData,
} from '../server/store.js';
import type {
  PortfolioSummary,
  ReviewItem,
  Verification,
  Warehouse,
} from '../src/types.js';

const KEYS = {
  warehouses: 'stockproof:warehouses',
  verifications: 'stockproof:verifications',
  reviews: 'stockproof:reviews',
} as const;

function redisConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

let redisClient: Redis | null = null;
function getRedis(): Redis | null {
  if (!redisConfigured()) return null;
  if (!redisClient) {
    redisClient = new Redis({
      url: process.env.KV_REST_API_URL as string,
      token: process.env.KV_REST_API_TOKEN as string,
    });
  }
  return redisClient;
}

function freshSeed(): StorageData {
  // JSON clone so callers can never mutate the seed constants.
  return {
    warehouses: JSON.parse(JSON.stringify(INITIAL_WAREHOUSES)),
    verifications: JSON.parse(JSON.stringify(INITIAL_VERIFICATIONS)),
    reviews: JSON.parse(JSON.stringify(INITIAL_REVIEWS)),
  };
}

let mem: StorageData | null = null;

async function load(): Promise<StorageData> {
  const redis = getRedis();
  if (redis) {
    try {
      const [warehouses, verifications, reviews] = await Promise.all([
        redis.get<Warehouse[]>(KEYS.warehouses),
        redis.get<Verification[]>(KEYS.verifications),
        redis.get<ReviewItem[]>(KEYS.reviews),
      ]);
      if (warehouses && verifications && reviews) {
        return { warehouses, verifications, reviews };
      }
      const seed = freshSeed();
      await save(seed);
      return seed;
    } catch (err) {
      console.warn('Redis unavailable, falling back to memory store:', err);
    }
  }
  if (!mem) mem = freshSeed();
  return mem;
}

async function save(data: StorageData): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await Promise.all([
        redis.set(KEYS.warehouses, data.warehouses),
        redis.set(KEYS.verifications, data.verifications),
        redis.set(KEYS.reviews, data.reviews),
      ]);
      return;
    } catch (err) {
      console.error('Redis save failed, keeping memory copy:', err);
    }
  }
  mem = data;
}

export function isRedisConfigured(): boolean {
  return redisConfigured();
}

export async function getWarehouses(status?: string, search?: string): Promise<Warehouse[]> {
  const data = await load();
  let warehouses = data.warehouses;
  if (status && status !== 'all') {
    warehouses = warehouses.filter((w) => w.status === status);
  }
  if (search) {
    const q = search.toLowerCase();
    warehouses = warehouses.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.code.toLowerCase().includes(q) ||
        w.district.toLowerCase().includes(q) ||
        w.state.toLowerCase().includes(q) ||
        w.receiptNumber.toLowerCase().includes(q) ||
        w.borrowerName.toLowerCase().includes(q),
    );
  }
  return warehouses;
}

export async function getWarehouseById(id: string): Promise<Warehouse | undefined> {
  const data = await load();
  return data.warehouses.find((w) => w.id === id);
}

export async function getVerifications(warehouseId?: string): Promise<Verification[]> {
  const data = await load();
  const list = warehouseId
    ? data.verifications.filter((v) => v.warehouseId === warehouseId)
    : [...data.verifications];
  return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function getLatestVerificationPerWarehouse(): Promise<Record<string, Verification>> {
  const data = await load();
  const sorted = [...data.verifications].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  const latest: Record<string, Verification> = {};
  for (const v of sorted) {
    if (!latest[v.warehouseId]) latest[v.warehouseId] = v;
  }
  return latest;
}

export async function addVerification(verification: Verification): Promise<Verification> {
  const data = await load();
  data.verifications.unshift(verification);

  const idx = data.warehouses.findIndex((w) => w.id === verification.warehouseId);
  if (idx !== -1) {
    data.warehouses[idx] = {
      ...data.warehouses[idx],
      status: verification.status,
      lastVerifiedDate: verification.timestamp,
      pilePhotoUrl: verification.photoUrl || data.warehouses[idx].pilePhotoUrl,
    };
  }

  if (verification.status === 'high_priority' || verification.status === 'review') {
    const warehouse = data.warehouses.find((w) => w.id === verification.warehouseId);
    const newReview: ReviewItem = {
      id: `rev-${Date.now().toString().slice(-6)}`,
      verificationId: verification.id,
      warehouseId: verification.warehouseId,
      warehouseName: warehouse?.name || 'Warehouse',
      warehouseLocation: warehouse ? `${warehouse.district}, ${warehouse.state}` : 'Location',
      grainType: verification.context.grainType,
      season: verification.context.season || 'rabi',
      priority: verification.status === 'high_priority' ? 'urgent' : 'medium',
      assignedTo:
        verification.status === 'high_priority'
          ? 'Arjun Mehta (Risk VP)'
          : 'Priya Sharma (Field Auditor)',
      status: 'open',
      declaredTonnes: verification.declaredAtTimeOfRun,
      estimatedRange: [verification.estimate.rangeLow, verification.estimate.rangeHigh],
      discrepancyTonnes: verification.discrepancyTonnes,
      confidencePercent: verification.estimate.confidencePercent,
      notes: [
        `Verification on ${new Date(verification.timestamp).toLocaleDateString()} resulted in ${verification.status === 'high_priority' ? 'HIGH PRIORITY discrepancy' : 'Review Required'}.`,
        verification.auditRecommendation,
      ],
      createdAt: new Date().toISOString(),
    };
    data.reviews.unshift(newReview);
  }

  await save(data);
  return verification;
}

export async function getReviews(status?: string): Promise<ReviewItem[]> {
  const data = await load();
  let reviews = [...data.reviews];
  if (status && status !== 'all') {
    reviews = reviews.filter((r) => r.status === status);
  }
  const prioOrder: Record<string, number> = { urgent: 0, medium: 1, routine: 2 };
  return reviews.sort((a, b) => {
    if (a.status === 'open' && b.status !== 'open') return -1;
    if (a.status !== 'open' && b.status === 'open') return 1;
    const diff = (prioOrder[a.priority] ?? 2) - (prioOrder[b.priority] ?? 2);
    if (diff !== 0) return diff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export async function updateReview(
  id: string,
  updates: Partial<ReviewItem>,
): Promise<ReviewItem | undefined> {
  const data = await load();
  const idx = data.reviews.findIndex((r) => r.id === id);
  if (idx === -1) return undefined;
  data.reviews[idx] = { ...data.reviews[idx], ...updates };

  if (updates.status === 'resolved') {
    const rev = data.reviews[idx];
    const remainingOpen = data.reviews.filter(
      (r) => r.warehouseId === rev.warehouseId && r.status === 'open' && r.id !== id,
    );
    if (remainingOpen.length === 0) {
      const wIdx = data.warehouses.findIndex((w) => w.id === rev.warehouseId);
      if (wIdx !== -1) {
        data.warehouses[wIdx] = { ...data.warehouses[wIdx], status: 'consistent' };
      }
    }
  }

  await save(data);
  return data.reviews[idx];
}

export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  const data = await load();
  const totalWarehouses = data.warehouses.length;
  let totalDeclaredTonnes = 0;
  let tonnageAtRisk = 0;
  let consistentCount = 0;
  let reviewRequiredCount = 0;
  let highPriorityCount = 0;

  for (const wh of data.warehouses) {
    totalDeclaredTonnes += wh.currentDeclaredTonnes;
    if (wh.status === 'consistent') {
      consistentCount++;
    } else if (wh.status === 'review') {
      reviewRequiredCount++;
      tonnageAtRisk += wh.currentDeclaredTonnes * 0.15;
    } else if (wh.status === 'high_priority') {
      highPriorityCount++;
      tonnageAtRisk += wh.currentDeclaredTonnes;
    }
  }

  const openReviewsCount = data.reviews.filter((r) => r.status === 'open').length;
  const totalLoanExposureCr = Number((totalDeclaredTonnes * 0.026).toFixed(2));

  return {
    totalWarehouses,
    totalDeclaredTonnes: Number(totalDeclaredTonnes.toFixed(1)),
    totalLoanExposureCr,
    tonnageAtRisk: Number(tonnageAtRisk.toFixed(1)),
    flaggedCount: reviewRequiredCount + highPriorityCount,
    consistentCount,
    reviewRequiredCount,
    highPriorityCount,
    openReviewsCount,
  };
}

export async function resetToDefaults(): Promise<PortfolioSummary> {
  const seed = freshSeed();
  await save(seed);
  return getPortfolioSummary();
}
