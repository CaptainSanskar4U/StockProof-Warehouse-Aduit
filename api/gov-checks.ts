import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { methodNotAllowed, readBody } from '../lib/apiHelpers.js';
import {
  addGovCheck,
  getGovCheckById,
  getGovChecksByOfficial,
  getGovChecksByVerification,
} from '../lib/persistentStore.js';
import type { GovCheck, PhotoAuthenticity } from '../src/types.js';

function deriveAuthenticity(photoVerdict: unknown): PhotoAuthenticity {
  try {
    const pv = (photoVerdict || {}) as Record<string, { label?: unknown } | null | undefined>;
    const labels = [pv.primary?.label, pv.cross?.label].filter(
      (l): l is string => typeof l === 'string',
    );
    if (labels.length === 0) return 'unchecked';
    if (labels.some((l) => l === 'ai')) return 'ai';
    if (labels.every((l) => l === 'real')) return 'real';
    return 'inconclusive';
  } catch {
    return 'unchecked';
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'POST') {
      const body = readBody<Record<string, unknown>>(req);
      const str = (v: unknown, max = 160): string | undefined => {
        if (typeof v !== 'string') return undefined;
        const t = v.trim();
        return t ? t.slice(0, max) : undefined;
      };
      const num = (v: unknown): number | undefined =>
        typeof v === 'number' && Number.isFinite(v) ? v : undefined;

      const inspectorName = str(body['inspectorName'], 120);
      const location = str(body['location'], 200);
      const declaredTonnes = num(body['declaredTonnes']);
      const estCentral = num(body['estCentral']);
      const estLow = num(body['estLow']);
      const estHigh = num(body['estHigh']);
      const volumeM3 = num(body['volumeM3']);

      if (
        !inspectorName || !location || declaredTonnes === undefined ||
        estCentral === undefined || estLow === undefined ||
        estHigh === undefined || volumeM3 === undefined
      ) {
        return res.status(400).json({
          error: 'inspectorName, location, declaredTonnes, estCentral, estLow, estHigh, volumeM3 are required',
        });
      }

      const authenticity = deriveAuthenticity(body['photoVerdict']);
      const statusRaw = typeof body['status'] === 'string' ? body['status'] : '';
      const match =
        authenticity === 'ai' || authenticity === 'inconclusive'
          ? null
          : statusRaw === 'consistent';

      let id = '';
      for (let i = 0; i < 5; i += 1) {
        const candidate = `gc-${crypto.randomBytes(4).toString('hex')}`;
        if (!(await getGovCheckById(candidate))) {
          id = candidate;
          break;
        }
      }
      if (!id) return res.status(500).json({ error: 'Could not mint a unique record id' });

      const photo = typeof body['photoDataUrl'] === 'string' ? body['photoDataUrl'] : undefined;
      const record: GovCheck = {
        id,
        createdAt: new Date().toISOString(),
        inspectorName,
        location,
        storageName: str(body['storageName'], 160),
        declaredTonnes,
        estCentral,
        estLow,
        estHigh,
        volumeM3,
        match,
        authenticity,
        checkerNote: str(body['checkerNote'], 600),
        photoDataUrl: photo && photo.startsWith('data:') && photo.length <= 2800000 ? photo : undefined,
        verificationId: str(body['verificationId'], 40),
        agentType: body['agentType'] === 'government' ? 'government' : 'bank',
        scheme:
          body['scheme'] === 'Public Distribution System' ||
          body['scheme'] === 'Buffer Stock' ||
          body['scheme'] === 'Other'
            ? body['scheme']
            : undefined,
      };
      return res.status(201).json(await addGovCheck(record));
    }

    if (req.method === 'GET') {
      // Single-record read. /api/gov-checks/:id is rewritten here by vercel.json,
      // which keeps the deployment inside the 12-function Hobby limit.
      const rawId = req.query.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      if (typeof id === 'string' && id.trim()) {
        const record = await getGovCheckById(id.trim());
        if (!record) return res.status(404).json({ error: 'Record not found' });
        return res.json(record);
      }
      const verificationId = req.query.verificationId;
      if (typeof verificationId === 'string' && verificationId.trim()) {
        return res.json(await getGovChecksByVerification(verificationId.trim()));
      }
      const official = req.query.official;
      if (typeof official !== 'string' || !official.trim()) {
        return res.status(400).json({ error: 'id, official or verificationId query parameter is required' });
      }
      return res.json(await getGovChecksByOfficial(official));
    }

    return methodNotAllowed(res, ['GET', 'POST']);
  } catch (err: unknown) {
    console.error('Error in /api/gov-checks:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
