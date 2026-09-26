import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { methodNotAllowed, readBody } from '../lib/apiHelpers.js';
import {
  addFarmerCheck,
  getFarmerCheckById,
  getFarmerChecksByFarmer,
} from '../lib/persistentStore.js';
import type { FarmerCheck } from '../src/types.js';

/**
 * Farmer self-checks — namespaced store, separate from the Inspector's
 * verifications registry. GET needs ?farmer=<name> (lookup-only, never a
 * feed) or ?id=<check-id> (public QR verification).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const id = typeof req.query.id === 'string' ? req.query.id : undefined;
      if (id) {
        const found = await getFarmerCheckById(id);
        if (!found) return res.status(404).json({ error: 'Check not found' });
        return res.json(found);
      }
      const farmer = typeof req.query.farmer === 'string' ? req.query.farmer : '';
      if (!farmer.trim()) {
        return res.status(400).json({ error: 'Query ?farmer=<name> or ?id=<check-id> is required' });
      }
      return res.json(await getFarmerChecksByFarmer(farmer));
    }

    if (req.method === 'POST') {
      const b = readBody<Record<string, unknown>>(req);
      const required = ['farmerName', 'grainType', 'declaredTonnes', 'estCentral', 'estLow', 'estHigh', 'volumeM3', 'photoVerdict'];
      for (const k of required) {
        if (b[k] === undefined || b[k] === null || b[k] === '') {
          return res.status(400).json({ error: `Missing ${k} in request body` });
        }
      }
      if (!['real', 'ai', 'inconclusive', 'unchecked'].includes(String(b.photoVerdict))) {
        return res.status(400).json({ error: 'Invalid photoVerdict' });
      }
      const numericFields = [b.declaredTonnes, b.estCentral, b.estLow, b.estHigh, b.volumeM3].map(Number);
      if (!numericFields.every((n) => Number.isFinite(n))) {
        return res.status(400).json({ error: 'Numeric fields must be finite numbers' });
      }
      const check: FarmerCheck = {
        id: `fc-${crypto.randomUUID().slice(0, 8)}`,
        createdAt: new Date().toISOString(),
        farmerName: String(b.farmerName),
        storageName: typeof b.storageName === 'string' ? b.storageName : '',
        location: typeof b.location === 'string' ? b.location : '',
        grainType: b.grainType as FarmerCheck['grainType'],
        grainName: typeof b.grainName === 'string' && b.grainName ? b.grainName : String(b.grainType),
        declaredTonnes: Number(b.declaredTonnes),
        estCentral: Number(b.estCentral),
        estLow: Number(b.estLow),
        estHigh: Number(b.estHigh),
        volumeM3: Number(b.volumeM3 ?? 0),
        match: typeof b.match === 'boolean' ? b.match : null,
        photoVerdict: b.photoVerdict as FarmerCheck['photoVerdict'],
        checkerNote: typeof b.checkerNote === 'string' ? b.checkerNote : null,
        photoDataUrl: typeof b.photoDataUrl === 'string' ? b.photoDataUrl : null,
        heightM: Number(b.heightM ?? 0),
        diameterM: Number(b.diameterM ?? 0),
      };
      const saved = await addFarmerCheck(check);
      return res.status(201).json(saved);
    }

    return methodNotAllowed(res, ['GET', 'POST']);
  } catch (err: unknown) {
    console.error('Error in /api/farmer-checks:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
