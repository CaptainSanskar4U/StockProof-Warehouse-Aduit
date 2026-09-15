import type { VercelRequest, VercelResponse } from '@vercel/node';
import { methodNotAllowed } from '../lib/apiHelpers.js';
import { isRedisConfigured } from '../lib/persistentStore.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  return res.json({
    status: 'ok',
    time: new Date().toISOString(),
    app: 'STOCKPROOF',
    storage: isRedisConfigured() ? 'redis' : 'memory',
  });
}
