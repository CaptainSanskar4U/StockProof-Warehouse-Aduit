import type { VercelRequest, VercelResponse } from '@vercel/node';
import { methodNotAllowed } from '../lib/apiHelpers.js';
import { getPortfolioSummary } from '../lib/persistentStore.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    return res.json(await getPortfolioSummary());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
