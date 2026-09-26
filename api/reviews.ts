import type { VercelRequest, VercelResponse } from '@vercel/node';
import { methodNotAllowed, readBody } from '../lib/apiHelpers.js';
import { getReviews, updateReview } from '../lib/persistentStore.js';
import type { ReviewItem } from '../src/types.js';

/** Reviews list (GET) + single-review update (PATCH ?id=). Merged into one
 * serverless function to stay within the Hobby function count. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const id = typeof req.query.id === 'string' ? req.query.id : '';
      if (id) {
        const found = (await getReviews()).find((r) => r.id === id);
        if (!found) return res.status(404).json({ error: 'Review item not found' });
        return res.json(found);
      }
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      return res.json(await getReviews(status));
    }
    if (req.method === 'PATCH') {
      const id = typeof req.query.id === 'string' ? req.query.id : '';
      const body = readBody<{
        status?: ReviewItem['status'];
        note?: string;
        resolutionType?: ReviewItem['resolutionType'];
        priority?: string;
        assignedTo?: string;
      }>(req);
      const { status, note, resolutionType, priority, assignedTo } = body;

      const existing = (await getReviews()).find((r) => r.id === id);
      if (!existing) {
        return res.status(404).json({ error: 'Review item not found' });
      }

      const updates: Partial<ReviewItem> = {};
      if (status) {
        if (!['open', 'resolved', 'escalated'].includes(status)) {
          return res.status(400).json({ error: 'Invalid review status' });
        }
        updates.status = status;
      }
      if (resolutionType) updates.resolutionType = resolutionType;
      if (priority) {
        if (!['routine', 'medium', 'urgent'].includes(priority)) {
          return res.status(400).json({ error: 'Invalid review priority' });
        }
        updates.priority = priority as ReviewItem['priority'];
      }
      if (assignedTo) updates.assignedTo = assignedTo;
      if (status === 'resolved') {
        updates.resolvedAt = new Date().toISOString();
      }
      if (note && typeof note === 'string') {
        updates.notes = [...existing.notes, `[${new Date().toISOString()}] ${note}`];
      }

      const updated = await updateReview(id, updates);
      return res.json(updated);
    }
    return methodNotAllowed(res, ['GET', 'PATCH']);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
