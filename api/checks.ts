import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { methodNotAllowed, readBody } from '../lib/apiHelpers.js';
import {
  addGovCheck,
  addFarmerCheck,
  getGovCheckById,
  getGovChecksByOfficial,
  getGovChecksByVerification,
  getFarmerCheckById,
  getFarmerChecksByFarmer,
} from '../lib/persistentStore.js';
import type { FarmerCheck, GovCheck, PhotoAuthenticity } from '../src/types.js';

/**
 * Server-verified QR check records — both namespaces, one function.
 *
 * A Vercel Hobby deployment is capped at 12 serverless functions, and
 * origin/main already sits exactly at 12. The farmer records and the
 * government records are the same concept (a QR points at a stored record,
 * never at a file), so they share a handler and are told apart by prefix.
 *
 * Public URLs are preserved by vercel.json:
 *   /api/gov-checks[/:id]    -> /api/checks[?id=]
 *   /api/farmer-checks[/:id] -> /api/checks[?id=]
 *
 * The two shapes never collide: an official record carries `inspectorName`,
 * a farmer record carries `farmerName`, and their ids are `gc-` / `fc-`.
 */

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

const str = (v: unknown, max = 160): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
};

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

/** `fc-` ids are farmer self-checks; everything else is an official record. */
const isFarmerId = (id: string): boolean => id.startsWith('fc-');

async function postGovCheck(body: Record<string, unknown>, res: VercelResponse) {
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

async function postFarmerCheck(body: Record<string, unknown>, res: VercelResponse) {
  const required = ['farmerName', 'grainType', 'declaredTonnes', 'estCentral', 'estLow', 'estHigh', 'volumeM3', 'photoVerdict'];
  for (const k of required) {
    if (body[k] === undefined || body[k] === null || body[k] === '') {
      return res.status(400).json({ error: `Missing ${k} in request body` });
    }
  }
  if (!['real', 'ai', 'inconclusive', 'unchecked'].includes(String(body['photoVerdict']))) {
    return res.status(400).json({ error: 'Invalid photoVerdict' });
  }
  const numericFields = [body['declaredTonnes'], body['estCentral'], body['estLow'], body['estHigh'], body['volumeM3']].map(Number);
  if (!numericFields.every((n) => Number.isFinite(n))) {
    return res.status(400).json({ error: 'Numeric fields must be finite numbers' });
  }

  const check: FarmerCheck = {
    id: `fc-${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    farmerName: String(body['farmerName']),
    storageName: typeof body['storageName'] === 'string' ? body['storageName'] : '',
    location: typeof body['location'] === 'string' ? body['location'] : '',
    grainType: body['grainType'] as FarmerCheck['grainType'],
    grainName: typeof body['grainName'] === 'string' && body['grainName'] ? body['grainName'] : String(body['grainType']),
    declaredTonnes: Number(body['declaredTonnes']),
    estCentral: Number(body['estCentral']),
    estLow: Number(body['estLow']),
    estHigh: Number(body['estHigh']),
    volumeM3: Number(body['volumeM3'] ?? 0),
    match: typeof body['match'] === 'boolean' ? body['match'] : null,
    photoVerdict: body['photoVerdict'] as FarmerCheck['photoVerdict'],
    checkerNote: typeof body['checkerNote'] === 'string' ? body['checkerNote'] : null,
    photoDataUrl: typeof body['photoDataUrl'] === 'string' ? body['photoDataUrl'] : null,
    heightM: Number(body['heightM'] ?? 0),
    diameterM: Number(body['diameterM'] ?? 0),
  };
  return res.status(201).json(await addFarmerCheck(check));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'POST') {
      // A farmer self-check is identified by its own field, so no query flag is
      // needed and the two public paths can share one endpoint.
      const body = readBody<Record<string, unknown>>(req);
      const isFarmer =
        typeof body['farmerName'] === 'string' && body['farmerName'].trim().length > 0;
      return isFarmer
        ? postFarmerCheck(body, res)
        : postGovCheck(body, res);
    }

    if (req.method === 'GET') {
      // Single-record read. /api/{gov,farmer}-checks/:id is rewritten here by
      // vercel.json, which keeps the deployment inside the 12-function limit.
      const rawId = req.query.id;
      const id = (Array.isArray(rawId) ? rawId[0] : rawId)?.trim();
      if (id) {
        if (isFarmerId(id)) {
          const record = await getFarmerCheckById(id);
          if (!record) return res.status(404).json({ error: 'Check not found' });
          return res.json(record);
        }
        const record = await getGovCheckById(id);
        if (!record) return res.status(404).json({ error: 'Record not found' });
        return res.json(record);
      }

      const farmer = req.query.farmer;
      if (typeof farmer === 'string' && farmer.trim()) {
        return res.json(await getFarmerChecksByFarmer(farmer));
      }

      const verificationId = req.query.verificationId;
      if (typeof verificationId === 'string' && verificationId.trim()) {
        return res.json(await getGovChecksByVerification(verificationId.trim()));
      }
      const official = req.query.official;
      if (typeof official === 'string' && official.trim()) {
        return res.json(await getGovChecksByOfficial(official));
      }

      // No unfiltered feed across either namespace.
      return res.status(400).json({
        error: 'id, official, verificationId or farmer query parameter is required',
      });
    }

    return methodNotAllowed(res, ['GET', 'POST']);
  } catch (err: unknown) {
    console.error('Error in /api/checks:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
