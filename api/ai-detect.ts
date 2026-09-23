import type { VercelRequest, VercelResponse } from '@vercel/node';
import { methodNotAllowed } from '../lib/apiHelpers.js';
import { detectWithHF, HF_PRIMARY_MODEL, HF_XCHECK_MODEL } from '../lib/hfDetect.js';

/** Deployed AI-image detection — primary + cross-check in ONE function call
 * (keeps the Hobby function count). Returns {primary, cross}, each either a
 * finding or null. Frontend shows whichever backends answered. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const body = (req.body ?? {}) as { dataUrl?: unknown; filename?: unknown };
  const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : '';
  const filename = typeof body.filename === 'string' ? body.filename : undefined;
  if (!dataUrl) return res.status(400).json({ error: 'dataUrl required' });
  const [primary, cross] = await Promise.all([
    detectWithHF(dataUrl, filename, HF_PRIMARY_MODEL, process.env.HF_TOKEN).catch(() => null),
    detectWithHF(dataUrl, filename, HF_XCHECK_MODEL, process.env.HF_TOKEN).catch(() => null),
  ]);
  if (!primary && !cross) {
    return res.status(503).json({ error: 'AI detector unavailable', unavailable: true });
  }
  return res.json({ primary, cross });
}
