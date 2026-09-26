import type { VercelRequest, VercelResponse } from '@vercel/node';
import { methodNotAllowed, readBody, withSeasonDefaults } from '../lib/apiHelpers.js';
import { getVerifications, getWarehouseById, addVerification } from '../lib/persistentStore.js';
import {
  computeGrainStockEstimate,
  calculatePileVolume,
} from '../server/estimation-service.js';
import { SAMPLE_GRAIN_IMAGES } from '../server/store.js';
import type { Verification } from '../src/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const warehouseId =
        typeof req.query.warehouseId === 'string' ? req.query.warehouseId : undefined;
      return res.json(await getVerifications(warehouseId));
    }

    if (req.method === 'POST') {
      const body = readBody<{
        warehouseId?: string;
        photoUrl?: string;
        mediaType?: string;
        referenceScale?: string;
        receiptPhotoUrl?: string;
        declaredSource?: string;
        geometry?: Verification['geometry'];
        context?: Verification['context'];
        declaredTonnes?: number;
        runBy?: Verification['runBy'];
      }>(req);
      const {
        warehouseId,
        photoUrl,
        mediaType,
        referenceScale,
        receiptPhotoUrl,
        declaredSource,
        geometry,
        context,
        declaredTonnes,
        runBy,
      } = body;

      if (!warehouseId || !geometry || !context) {
        return res
          .status(400)
          .json({ error: 'warehouseId, geometry, and context are required' });
      }

      const warehouse = await getWarehouseById(warehouseId);
      if (!warehouse) {
        return res.status(404).json({ error: 'Warehouse not found' });
      }

      const finalDeclared =
        typeof declaredTonnes === 'number' ? declaredTonnes : warehouse.currentDeclaredTonnes;
      if (!Number.isFinite(finalDeclared)) {
        return res.status(400).json({ error: 'declaredTonnes must be a finite number' });
      }
      const normalizedContext = withSeasonDefaults(context);
      const providedVolume = Number(geometry.calculatedVolumeM3);
      const calculatedVolume =
        Number.isFinite(providedVolume) && providedVolume > 0
          ? providedVolume
          : calculatePileVolume(
              geometry.heightMeters,
              geometry.baseDiameterMeters,
              geometry.topDiameterMeters,
              geometry.pileType,
            );

      const estimateResult = computeGrainStockEstimate(
        { ...geometry, calculatedVolumeM3: calculatedVolume },
        normalizedContext,
        finalDeclared,
      );

      const newVerification: Verification = {
        id: `ver-${Date.now().toString().slice(-6)}`,
        warehouseId,
        timestamp: new Date().toISOString(),
        photoUrl: photoUrl || warehouse.pilePhotoUrl || SAMPLE_GRAIN_IMAGES.wheat_pile,
        mediaType: mediaType === 'video-frame' ? 'video-frame' : 'photo',
        referenceScale: typeof referenceScale === 'string' ? referenceScale : undefined,
        receiptPhotoUrl: typeof receiptPhotoUrl === 'string' && receiptPhotoUrl.length > 0 ? receiptPhotoUrl : undefined,
        declaredSource: declaredSource === 'manual' ? 'manual' : 'registry',
        geometry: {
          ...geometry,
          calculatedVolumeM3: Number(calculatedVolume.toFixed(1)),
        },
        context: normalizedContext,
        estimate: {
          centralTonnes: estimateResult.centralEstimateTonnes,
          rangeLow: estimateResult.rangeLowTonnes,
          rangeHigh: estimateResult.rangeHighTonnes,
          confidencePercent: estimateResult.confidencePercent,
          effectiveDensity: estimateResult.effectiveDensity,
          volumeM3: Number(calculatedVolume.toFixed(1)),
        },
        declaredAtTimeOfRun: finalDeclared,
        discrepancyTonnes: estimateResult.discrepancyTonnes,
        status: estimateResult.status,
        explanatoryReason: estimateResult.explanatoryReason,
        auditRecommendation: estimateResult.auditRecommendation,
        runBy: runBy || {
          id: 'aud-01',
          name: 'Priya Sharma',
          role: 'Senior Field Auditor (North Zone)',
        },
      };

      const saved = await addVerification(newVerification);
      return res.status(201).json(saved);
    }

    return methodNotAllowed(res, ['GET', 'POST']);
  } catch (err: unknown) {
    console.error('Error in /api/verifications:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
