import type { VercelRequest, VercelResponse } from '@vercel/node';
import { methodNotAllowed, readBody, withSeasonDefaults } from '../../lib/apiHelpers.js';
import {
  computeGrainStockEstimate,
  calculatePileVolume,
} from '../../server/estimation-service.js';
import type { ContextInputs, GeometryInputs } from '../../src/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const body = readBody<{
      geometry?: GeometryInputs;
      context?: ContextInputs;
      declaredTonnes?: number;
    }>(req);
    const { geometry, context, declaredTonnes } = body;
    if (!geometry || !context || typeof declaredTonnes !== 'number') {
      return res
        .status(400)
        .json({ error: 'Missing geometry, context, or declaredTonnes in request body' });
    }

    const normalizedContext = withSeasonDefaults(context);
    const calculatedVolume =
      geometry.calculatedVolumeM3 > 0
        ? geometry.calculatedVolumeM3
        : calculatePileVolume(
            geometry.heightMeters,
            geometry.baseDiameterMeters,
            geometry.topDiameterMeters,
            geometry.pileType,
          );

    const estimate = computeGrainStockEstimate(
      { ...geometry, calculatedVolumeM3: calculatedVolume },
      normalizedContext,
      declaredTonnes,
    );

    return res.json({ ...estimate, volumeM3: calculatedVolume });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(400).json({ error: message });
  }
}
