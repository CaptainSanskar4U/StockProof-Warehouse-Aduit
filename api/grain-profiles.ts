import type { VercelRequest, VercelResponse } from '@vercel/node';
import { methodNotAllowed } from '../lib/apiHelpers.js';
import {
  GRAIN_BULK_DENSITIES,
  COMPACTION_MULTIPLIERS,
  SEASON_PROFILES,
} from '../server/estimation-service.js';
import { SAMPLE_GRAIN_IMAGES } from '../server/store.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  return res.json({
    densities: GRAIN_BULK_DENSITIES,
    compactionMultipliers: COMPACTION_MULTIPLIERS,
    seasons: SEASON_PROFILES,
    sampleImages: SAMPLE_GRAIN_IMAGES,
  });
}
