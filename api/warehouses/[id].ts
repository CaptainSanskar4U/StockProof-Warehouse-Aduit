import type { VercelRequest, VercelResponse } from '@vercel/node';
import { methodNotAllowed } from '../../lib/apiHelpers.js';
import { getWarehouseById } from '../../lib/persistentStore.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    const warehouse = await getWarehouseById(id);
    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    return res.json(warehouse);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
