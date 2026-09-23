import type { VercelRequest, VercelResponse } from '@vercel/node';
import { methodNotAllowed } from '../lib/apiHelpers.js';
import { detectWithHF, HF_XCHECK_MODEL } from '../lib/hfDetect.js';

/** Deployed AI-image cross-check — second backend via HuggingFace serverless. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const body = (req.body ?? {}) as { dataUrl?: unknown; filename?: unknown };
  const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : '';
  const filename = typeof body.filename === 'string' ? body.filename : undefined;
  if (!dataUrl) return res.status(400).json({ error: 'dataUrl required' });
  try {
    const finding = await detectWithHF(dataUrl, filename, HF_XCHECK_MODEL, process.env.HF_TOKEN);
    return res.json(finding);
  } catch {
    return res.status(503).json({ error: 'AI detector unavailable', unavailable: true });
  }
}
