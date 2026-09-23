import type { VercelRequest, VercelResponse } from '@vercel/node';
import { methodNotAllowed } from '../lib/apiHelpers.js';
import { getWarehouses, getWarehouseById } from '../lib/persistentStore.js';

/** Warehouse list (GET) + single warehouse (GET ?id=). Merged into one
 * serverless function to stay within the Hobby function count. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (id) {
      const warehouse = await getWarehouseById(id);
      if (!warehouse) {
        return res.status(404).json({ error: 'Warehouse not found' });
      }
      return res.json(warehouse);
    }
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    return res.json(await getWarehouses(status, search));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
