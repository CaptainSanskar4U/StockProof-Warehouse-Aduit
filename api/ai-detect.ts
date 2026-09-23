import type { VercelRequest, VercelResponse } from '@vercel/node';
import { methodNotAllowed } from '../lib/apiHelpers.js';

/**
 * Vercel/serverless stub: the ultra AI-image sidecar only runs on the
 * local field laptop (large Python weights cannot fit serverless limits).
 * The frontend treats this as "detector unavailable" and falls back to
 * the on-device heuristic warning. Warning only — never blocks the audit.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  return res.status(503).json({ error: 'AI detector unavailable', unavailable: true });
}
