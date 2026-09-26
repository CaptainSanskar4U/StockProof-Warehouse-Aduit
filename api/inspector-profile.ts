import type { VercelRequest, VercelResponse } from '@vercel/node';
import { methodNotAllowed, readBody } from '../lib/apiHelpers.js';
import { getProfile, saveProfile } from '../lib/persistentStore.js';
import type { InspectorProfile } from '../src/types.js';

/**
 * Serverless mirror of the Express /api/inspector-profile routes.
 *
 * Without this the deployed app had no profile endpoint at all — the panel
 * silently fell back to the generic "Field Inspector". Validation mirrors
 * server.ts exactly, including the ~2.8MB data-URL cap.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      return res.json(await getProfile());
    }

    if (req.method === 'PUT') {
      const body = readBody<Record<string, unknown>>(req);
      const inspectorType = body['inspectorType'] === 'government' ? 'government' : 'bank';
      const str = (v: unknown, max = 160): string | undefined => {
        if (typeof v !== 'string') return undefined;
        const t = v.trim();
        return t ? t.slice(0, max) : undefined;
      };
      const dataUrl = (v: unknown): string | undefined => {
        if (typeof v !== 'string' || !v.startsWith('data:')) return undefined;
        // Cap uploads (~2MB) so the store stays small.
        if (v.length > 2_800_000) return undefined;
        return v;
      };

      const bankRaw = (body['bank'] || {}) as Record<string, unknown>;
      const govRaw = (body['gov'] || {}) as Record<string, unknown>;
      // Both branches are always sent; the store merges them so switching the
      // inspector type never erases the other identity.
      const profile: InspectorProfile = {
        inspectorType,
        displayName: str(body['displayName'], 120),
        bank: {
          bankName: str(bankRaw['bankName']),
          employeeName: str(bankRaw['employeeName']),
          employeeId: str(bankRaw['employeeId'], 80),
          idCardDetails: str(bankRaw['idCardDetails'], 300),
          contact: str(bankRaw['contact'], 80),
          email: str(bankRaw['email'], 120),
          region: str(bankRaw['region']),
          photoDataUrl: dataUrl(bankRaw['photoDataUrl']),
          documentDataUrl: dataUrl(bankRaw['documentDataUrl']),
          documentName: str(bankRaw['documentName'], 160),
        },
        gov: {
          department: str(govRaw['department']),
          inspectorName: str(govRaw['inspectorName']),
          govId: str(govRaw['govId'], 80),
          designation: str(govRaw['designation']),
          cardDetails: str(govRaw['cardDetails'], 300),
          contact: str(govRaw['contact'], 80),
          email: str(govRaw['email'], 120),
          region: str(govRaw['region']),
          photoDataUrl: dataUrl(govRaw['photoDataUrl']),
          documentDataUrl: dataUrl(govRaw['documentDataUrl']),
          documentName: str(govRaw['documentName'], 160),
        },
      };
      return res.json(await saveProfile(profile));
    }

    return methodNotAllowed(res, ['GET', 'PUT']);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
