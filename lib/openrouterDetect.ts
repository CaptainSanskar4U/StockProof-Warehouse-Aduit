/** Emergency last-resort AI-image opinion via OpenRouter.
 * NOT a primary detector: tried only after local sidecars and HuggingFace
 * both fail. Strict JSON prompt, defensive parse, 20s cap. Any failure
 * throws so callers fall through to "checker unavailable". Key stays
 * server-side only (OPENROUTER_API_KEY env) — never in client code. */

import type { DetectFinding } from './hfDetect.js';

export const OPENROUTER_MODEL = 'stealth/space-bunny-alpha';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS = 20000;

export async function detectWithOpenRouter(
  dataUrl: string,
  filename: string | undefined,
  apiKey: string | undefined,
): Promise<DetectFinding> {
  if (!apiKey) throw new Error('OPENROUTER_API_KEY missing');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Is this photo AI-generated or a real photograph? Reply with ONLY this JSON, nothing else: {"label":"ai"|"real","confidence":0-1,"reason":"short"}. Use "ai" only if you see clear signs of AI generation.',
              },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        max_tokens: 150,
        temperature: 0,
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`OpenRouter ${r.status}`);
    const data = (await r.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const content = data?.choices?.[0]?.message?.content;
    const text = typeof content === 'string' ? content : JSON.stringify(content ?? '');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('OpenRouter non-JSON response');
    const parsed = JSON.parse(text.slice(start, end + 1)) as {
      label?: unknown;
      confidence?: unknown;
    };
    if (parsed.label !== 'ai' && parsed.label !== 'real') {
      throw new Error('OpenRouter bad label');
    }
    const conf =
      typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.6;
    const pAi = parsed.label === 'ai' ? conf : 1 - conf;
    return {
      label: pAi >= 0.5 ? 'ai' : 'real',
      probability_ai: pAi,
      probability_real: 1 - pAi,
      confidence: Math.max(pAi, 1 - pAi),
      raw_score: pAi,
      backend: `openrouter:${OPENROUTER_MODEL}`,
      filename,
    };
  } finally {
    clearTimeout(t);
  }
}
