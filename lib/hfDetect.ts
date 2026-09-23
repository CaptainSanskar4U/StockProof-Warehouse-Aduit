/** Cloud AI-image detection via HuggingFace serverless inference.
 * Used by Vercel functions (deployed) and as local fallback when the
 * lynote-ai/ai-image-detector sidecars are not running.
 * Models picked by 4-image smoke test (clear AI / hard AI / retouched / real):
 * haywoodsloan 4/4, Smogy 3/4 — both free on hf-inference. */

export const HF_PRIMARY_MODEL = 'haywoodsloan/ai-image-detector-deploy';
export const HF_XCHECK_MODEL = 'Smogy/SMOGY-Ai-images-detector';

const ROUTER = 'https://router.huggingface.co/hf-inference/models/';

export interface DetectFinding {
  label: string;
  probability_ai: number;
  probability_real: number;
  confidence: number;
  raw_score: number;
  backend: string;
  filename?: string;
}

function isAiLabel(raw: string): boolean {
  const l = raw.toLowerCase();
  return (
    l.includes('fake') ||
    l === 'ai' ||
    l.includes('ai-generated') ||
    l.includes('generated') ||
    l.includes('artificial')
  );
}

/** Accepts a data: URL or a remote http(s) URL and returns raw image bytes. */
export async function resolveImageBytes(source: string): Promise<{ buf: Uint8Array; contentType: string }> {
  const m = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(source);
  if (m) {
    const contentType = m[1] || 'application/octet-stream';
    if (m[2]) {
      const bin = atob(m[3]);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
      return { buf: out, contentType };
    }
    return { buf: new TextEncoder().encode(decodeURIComponent(m[3])), contentType };
  }
  if (/^https?:\/\//i.test(source)) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    try {
      const r = await fetch(source, { signal: ctrl.signal });
      if (!r.ok) throw new Error(`image fetch ${r.status}`);
      const contentType = r.headers.get('content-type') || 'image/jpeg';
      const buf = new Uint8Array(await r.arrayBuffer());
      return { buf, contentType };
    } finally {
      clearTimeout(t);
    }
  }
  throw new Error('unsupported image source');
}

/** One HF image-classification call → their DetectionResult shape. */
export async function detectWithHF(
  source: string,
  filename: string | undefined,
  model: string,
  token: string | undefined,
): Promise<DetectFinding> {
  if (!token) throw new Error('HF_TOKEN missing');
  const { buf, contentType } = await resolveImageBytes(source);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(ROUTER + model, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
      body: buf as unknown as BodyInit,
      signal: ctrl.signal,
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`HF ${r.status}: ${text.slice(0, 200)}`);
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('HF non-JSON response');
    }
    if (!Array.isArray(data) || data.length === 0) throw new Error('HF empty predictions');
    const preds = (data as { label: string; score: number }[]).filter(
      (p) => typeof p.label === 'string' && typeof p.score === 'number',
    );
    if (preds.length === 0) throw new Error('HF malformed predictions');
    const aiPred = preds.find((p) => isAiLabel(p.label));
    let pAi: number;
    if (aiPred) {
      pAi = aiPred.score;
    } else {
      const realSum = preds.filter((p) => !isAiLabel(p.label)).reduce((s, p) => s + p.score, 0);
      pAi = Math.max(0, Math.min(1, 1 - realSum));
    }
    pAi = Math.max(0, Math.min(1, pAi));
    return {
      label: pAi >= 0.5 ? 'ai' : 'real',
      probability_ai: pAi,
      probability_real: 1 - pAi,
      confidence: Math.max(pAi, 1 - pAi),
      raw_score: pAi,
      backend: model,
      filename,
    };
  } finally {
    clearTimeout(t);
  }
}
