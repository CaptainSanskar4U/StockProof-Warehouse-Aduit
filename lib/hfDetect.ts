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

/** One HF image-classification call → their DetectionResult shape.
 * Retries while the model is cold-loading (HF 503 + estimated_time). */
export async function detectWithHF(
  source: string,
  filename: string | undefined,
  model: string,
  token: string | undefined,
): Promise<DetectFinding> {
  if (!token) throw new Error('HF_TOKEN missing');
  if (typeof source === 'string' && source.length > 25_000_000) {
    throw new Error('Image payload too large');
  }
  const { buf, contentType } = await resolveImageBytes(source);
  let lastErr = '';
  for (let attempt = 0; attempt < 3; attempt += 1) {
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
      if (!r.ok) {
        // Cold model — HF tells us how long loading takes. Wait, retry only then.
        // Auth / bad-request errors (401/400/404) are permanent: fail fast.
        lastErr = `HF ${r.status}: ${text.slice(0, 120)}`;
        const retryable = r.status === 503 || r.status === 429;
        if (!retryable || attempt >= 2) {
          throw new Error(lastErr);
        }
        let waitMs = 8000;
        try {
          const errJson = JSON.parse(text) as { estimated_time?: unknown };
          if (typeof errJson.estimated_time === 'number' && errJson.estimated_time > 0) {
            waitMs = Math.min(20000, Math.ceil(errJson.estimated_time * 1000) + 2000);
          }
        } catch {
          /* plain-text error — fixed wait */
        }
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
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
  throw new Error(lastErr || 'HF failed');
}
