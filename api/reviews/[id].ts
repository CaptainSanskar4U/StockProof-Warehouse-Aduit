import type { VercelRequest, VercelResponse } from '@vercel/node';
import { methodNotAllowed, readBody } from '../../lib/apiHelpers.js';
import { getReviews, updateReview } from '../../lib/persistentStore.js';
import type { ReviewItem } from '../../src/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') return methodNotAllowed(res, ['PATCH']);
  try {
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
    if (status) updates.status = status;
    if (resolutionType) updates.resolutionType = resolutionType;
    if (priority) updates.priority = priority as ReviewItem['priority'];
    if (assignedTo) updates.assignedTo = assignedTo;
    if (status === 'resolved') {
      updates.resolvedAt = new Date().toISOString();
    }
    if (note && typeof note === 'string') {
      const timestampStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      updates.notes = [...existing.notes, `[${timestampStr}] ${note}`];
    }

    const updated = await updateReview(id, updates);
    return res.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
