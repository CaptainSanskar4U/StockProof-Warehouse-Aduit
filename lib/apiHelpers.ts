import type { VercelRequest, VercelResponse } from '@vercel/node';

export function methodNotAllowed(res: VercelResponse, allow: string[]) {
  res.setHeader('Allow', allow.join(', '));
  return res.status(405).json({ error: `Method not allowed. Use: ${allow.join(', ')}` });
}

/** Vercel parses JSON bodies, but handle raw strings defensively. */
export function readBody<T = unknown>(req: VercelRequest): T {
  const body = (req as { body?: unknown }).body;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as T;
    } catch {
      throw new Error('Invalid JSON body');
    }
  }
  return (body ?? {}) as T;
}

export function withSeasonDefaults<T extends object>(context: T): T & { season: string } {
  if (!context) return { season: 'rabi' } as T & { season: string };
  return { season: 'rabi', ...context };
}
