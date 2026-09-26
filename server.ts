import 'dotenv/config';
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { store, SAMPLE_GRAIN_IMAGES } from './server/store.js';
import {
  computeGrainStockEstimate,
  GRAIN_BULK_DENSITIES,
  COMPACTION_MULTIPLIERS,
  SEASON_PROFILES,
  calculatePileVolume
} from './server/estimation-service.js';
import { Verification, FarmerCheck } from './src/types.js';
import { detectWithHF, resolveImageBytes, HF_PRIMARY_MODEL, HF_XCHECK_MODEL } from './lib/hfDetect.js';
import { detectWithOpenRouter } from './lib/openrouterDetect.js';

function withSeasonDefaults(context: any) {
  if (!context) return { season: 'rabi', ...context };
  return { season: 'rabi', ...context };
}

async function startServer() {
  const app = express();
  const parsedPort = process.env.PORT ? Number(process.env.PORT) : 3000;
  const PORT = Number.isFinite(parsedPort) ? parsedPort : 3000;

  // Allow larger payload for captured photo base64 / URLs
  app.use(express.json({ limit: '20mb' }));

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString(), app: 'STOCKPROOF', storage: 'file' });
  });

  // --- AI image detection ---
  // Local: their lynote-ai/ai-image-detector sidecars when running (ultra on
  // :8000, sentry on :8001). If a sidecar is down, fall back to HuggingFace
  // serverless (same path the deployed Vercel site uses). Accepts JSON
  // {dataUrl, filename} so one frontend works in both places.
  const AI_PRIMARY_URL = process.env.AI_PRIMARY_URL || 'http://127.0.0.1:8000';
  const AI_XCHECK_URL = process.env.AI_XCHECK_URL || 'http://127.0.0.1:8001';

  async function forwardDetect(
    upstreamBase: string,
    buf: Uint8Array,
    contentType: string,
    filename: string,
  ): Promise<string> {
    const boundary = '----stockproof' + Date.now();
    const safeName = filename.replace(/[^\w.\-]+/g, '_') || 'photo.jpg';
    const head = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${safeName}"\r\nContent-Type: ${contentType}\r\n\r\n`,
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([head, Buffer.from(buf), tail]);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 170000);
    try {
      const upstream = await fetch(`${upstreamBase}/detect`, {
        method: 'POST',
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        body,
        signal: ctrl.signal,
      });
      if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
      return await upstream.text();
    } finally {
      clearTimeout(t);
    }
  }

  async function detectHandler(
    req: express.Request,
    res: express.Response,
  ) {
    const body = (req.body ?? {}) as { dataUrl?: unknown; filename?: unknown };
    const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : '';
    const filename = typeof body.filename === 'string' ? body.filename : undefined;
    if (!dataUrl) return res.status(400).json({ error: 'dataUrl required' });

    // Try one side: local sidecar first, HF cloud on failure,
    // OpenRouter model as emergency last resort only.
    const detectOne = async (upstreamBase: string, hfModel: string) => {
      try {
        const { buf, contentType } = await resolveImageBytes(dataUrl);
        const text = await forwardDetect(upstreamBase, buf, contentType, filename || 'photo.jpg');
        try {
          const parsed = JSON.parse(text) as Record<string, unknown>;
          if (filename && typeof parsed.filename !== 'string') parsed.filename = filename;
          return parsed;
        } catch {
          return null;
        }
      } catch {
        try {
          return await detectWithHF(dataUrl, filename, hfModel, process.env.HF_TOKEN);
        } catch {
          try {
            return await detectWithOpenRouter(dataUrl, filename, process.env.OPENROUTER_API_KEY);
          } catch {
            return null;
          }
        }
      }
    };

    const [primary, cross] = await Promise.all([
      detectOne(AI_PRIMARY_URL, HF_PRIMARY_MODEL),
      detectOne(AI_XCHECK_URL, HF_XCHECK_MODEL),
    ]);
    if (!primary && !cross) {
      return res.status(503).json({ error: 'AI detector unavailable', unavailable: true });
    }
    return res.json({ primary, cross });
  }

  // One call, both backends — matches the deployed api/ai-detect.ts shape.
  app.post('/api/ai-detect', (req, res) => detectHandler(req, res));

  // Detector status for the camera tab (their /health shape, per backend).
  app.get('/api/ai-detectors', async (_req, res) => {
    const check = async (base: string) => {
      try {
        const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(4000) });
        if (!r.ok) return { ok: false };
        return { ok: true, ...(await r.json() as Record<string, unknown>) };
      } catch {
        return { ok: false };
      }
    };
    res.json({ primary: await check(AI_PRIMARY_URL), crosscheck: await check(AI_XCHECK_URL) });
  });

  // Agronomic bulk density and compaction reference table
  app.get('/api/grain-profiles', (req, res) => {
    res.json({
      densities: GRAIN_BULK_DENSITIES,
      compactionMultipliers: COMPACTION_MULTIPLIERS,
      seasons: SEASON_PROFILES,
      sampleImages: SAMPLE_GRAIN_IMAGES,
    });
  });

  // Season-aware calibration presets (Kharif / Rabi / Zaid)
  app.get('/api/season-profiles', (req, res) => {
    res.json(SEASON_PROFILES);
  });

  // Latest verification per warehouse — console declared-vs-estimated cards
  app.get('/api/verifications/latest', (req, res) => {
    try {
      res.json(store.getLatestVerificationPerWarehouse());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Portfolio Summary (for Risk Officer dashboard)
  app.get('/api/portfolio-summary', (req, res) => {
    try {
      const summary = store.getPortfolioSummary();
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get all warehouses (with optional status or search filter)
  app.get('/api/warehouses', (req, res) => {
    try {
      const { status, search } = req.query;
      let warehouses = store.getWarehouses();

      if (status && typeof status === 'string' && status !== 'all') {
        warehouses = warehouses.filter(w => w.status === status);
      }

      if (search && typeof search === 'string') {
        const q = search.toLowerCase();
        warehouses = warehouses.filter(w =>
          (w.name ?? '').toLowerCase().includes(q) ||
          (w.code ?? '').toLowerCase().includes(q) ||
          (w.district ?? '').toLowerCase().includes(q) ||
          (w.state ?? '').toLowerCase().includes(q) ||
          (w.receiptNumber ?? '').toLowerCase().includes(q) ||
          (w.borrowerName ?? '').toLowerCase().includes(q)
        );
      }

      res.json(warehouses);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get single warehouse by ID
  app.get('/api/warehouses/:id', (req, res) => {
    try {
      const warehouse = store.getWarehouseById(req.params.id);
      if (!warehouse) {
        return res.status(404).json({ error: 'Warehouse not found' });
      }
      res.json(warehouse);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get verifications (all or filtered by warehouse)
  app.get('/api/verifications', (req, res) => {
    try {
      const { warehouseId } = req.query;
      const verifications = store.getVerifications(warehouseId as string | undefined);
      res.json(verifications);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Preview estimation without saving (interactive sandbox / verification step)
  app.post('/api/verifications/estimate', (req, res) => {
    try {
      const { geometry, context, declaredTonnes } = req.body;
      if (!geometry || !context || typeof declaredTonnes !== 'number' || !Number.isFinite(declaredTonnes)) {
        return res.status(400).json({ error: 'Missing geometry, context, or declaredTonnes in request body' });
      }

      const normalizedContext = withSeasonDefaults(context);
      const providedVolume = Number(geometry.calculatedVolumeM3);
      const calculatedVolume = Number.isFinite(providedVolume) && providedVolume > 0
        ? providedVolume
        : calculatePileVolume(geometry.heightMeters, geometry.baseDiameterMeters, geometry.topDiameterMeters, geometry.pileType);

      const estimate = computeGrainStockEstimate(
        { ...geometry, calculatedVolumeM3: calculatedVolume },
        normalizedContext,
        declaredTonnes
      );

      res.json({
        ...estimate,
        volumeM3: calculatedVolume,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Create and commit a new verification run
  app.post('/api/verifications', (req, res) => {
    try {
      const {
        warehouseId,
        photoUrl,
        mediaType,
        referenceScale,
        receiptPhotoUrl,
        declaredSource,
        geometry,
        context,
        declaredTonnes,
        runBy,
      } = req.body;

      if (!warehouseId || !geometry || !context) {
        return res.status(400).json({ error: 'warehouseId, geometry, and context are required' });
      }

      const warehouse = store.getWarehouseById(warehouseId);
      if (!warehouse) {
        return res.status(404).json({ error: 'Warehouse not found' });
      }

      const finalDeclared = typeof declaredTonnes === 'number' ? declaredTonnes : warehouse.currentDeclaredTonnes;
      if (!Number.isFinite(finalDeclared)) {
        return res.status(400).json({ error: 'declaredTonnes must be a finite number' });
      }
      const normalizedContext = withSeasonDefaults(context);

      const providedCommitVolume = Number(geometry.calculatedVolumeM3);
      const calculatedVolume = Number.isFinite(providedCommitVolume) && providedCommitVolume > 0
        ? providedCommitVolume
        : calculatePileVolume(geometry.heightMeters, geometry.baseDiameterMeters, geometry.topDiameterMeters, geometry.pileType);

      const estimateResult = computeGrainStockEstimate(
        { ...geometry, calculatedVolumeM3: calculatedVolume },
        normalizedContext,
        finalDeclared
      );

      const newVerification: Verification = {
        id: `ver-${Date.now().toString().slice(-6)}`,
        warehouseId,
        timestamp: new Date().toISOString(),
        photoUrl: photoUrl || warehouse.pilePhotoUrl || SAMPLE_GRAIN_IMAGES.wheat_pile,
        mediaType: mediaType === 'video-frame' ? 'video-frame' : 'photo',
        referenceScale: typeof referenceScale === 'string' ? referenceScale : undefined,
        receiptPhotoUrl: typeof receiptPhotoUrl === 'string' && receiptPhotoUrl.length > 0 ? receiptPhotoUrl : undefined,
        declaredSource: declaredSource === 'manual' ? 'manual' : 'registry',
        geometry: {
          ...geometry,
          calculatedVolumeM3: Number(calculatedVolume.toFixed(1)),
        },
        context: normalizedContext,
        estimate: {
          centralTonnes: estimateResult.centralEstimateTonnes,
          rangeLow: estimateResult.rangeLowTonnes,
          rangeHigh: estimateResult.rangeHighTonnes,
          confidencePercent: estimateResult.confidencePercent,
          effectiveDensity: estimateResult.effectiveDensity,
          volumeM3: Number(calculatedVolume.toFixed(1)),
        },
        declaredAtTimeOfRun: finalDeclared,
        discrepancyTonnes: estimateResult.discrepancyTonnes,
        status: estimateResult.status,
        explanatoryReason: estimateResult.explanatoryReason,
        auditRecommendation: estimateResult.auditRecommendation,
        runBy: runBy || {
          id: 'aud-01',
          name: 'Priya Sharma',
          role: 'Senior Field Auditor (North Zone)',
        },
      };

      const saved = store.addVerification(newVerification);
      res.status(201).json(saved);
    } catch (err: any) {
      console.error('Error adding verification:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Review Queue items
  app.get('/api/reviews', (req, res) => {
    try {
      const { status } = req.query;
      let reviews = store.getReviews();
      if (status && typeof status === 'string' && status !== 'all') {
        reviews = reviews.filter(r => r.status === status);
      }
      res.json(reviews);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update Review Item (Resolve / Escalate / Add note)
  app.patch('/api/reviews/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { status, note, resolutionType, priority, assignedTo } = req.body;

      const existing = store.getReviews().find(r => r.id === id);
      if (!existing) {
        return res.status(404).json({ error: 'Review item not found' });
      }

      const updates: any = {};
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
        updates.priority = priority;
      }
      if (assignedTo) updates.assignedTo = assignedTo;
      if (status === 'resolved') {
        updates.resolvedAt = new Date().toISOString();
      }

      if (note && typeof note === 'string') {
        updates.notes = [...existing.notes, `[${new Date().toISOString()}] ${note}`];
      }

      const updated = store.updateReview(id, updates);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- FARMER SELF-CHECKS (namespaced store; read-only for Inspectors) ---
  // A farmer self-check never enters the verifications registry or the
  // review queue. Inspectors may only read a named farmer's history.

  app.post('/api/farmer-checks', (req, res) => {
    try {
      const b = (req.body ?? {}) as Record<string, unknown>;
      const required = ['farmerName', 'grainType', 'declaredTonnes', 'estCentral', 'estLow', 'estHigh', 'volumeM3', 'photoVerdict'];
      for (const k of required) {
        if (b[k] === undefined || b[k] === null || b[k] === '') {
          return res.status(400).json({ error: `Missing ${k} in request body` });
        }
      }
      if (!['real', 'ai', 'inconclusive', 'unchecked'].includes(String(b.photoVerdict))) {
        return res.status(400).json({ error: 'Invalid photoVerdict' });
      }
      const numericFields = [b.declaredTonnes, b.estCentral, b.estLow, b.estHigh, b.volumeM3].map(Number);
      if (!numericFields.every((n) => Number.isFinite(n))) {
        return res.status(400).json({ error: 'Numeric fields must be finite numbers' });
      }
      const check: FarmerCheck = {
        id: `fc-${crypto.randomUUID().slice(0, 8)}`,
        createdAt: new Date().toISOString(),
        farmerName: String(b.farmerName),
        storageName: typeof b.storageName === 'string' ? b.storageName : '',
        location: typeof b.location === 'string' ? b.location : '',
        grainType: b.grainType as FarmerCheck['grainType'],
        grainName: typeof b.grainName === 'string' && b.grainName ? b.grainName : String(b.grainType),
        declaredTonnes: Number(b.declaredTonnes),
        estCentral: Number(b.estCentral),
        estLow: Number(b.estLow),
        estHigh: Number(b.estHigh),
        volumeM3: Number(b.volumeM3 ?? 0),
        match: typeof b.match === 'boolean' ? b.match : null,
        photoVerdict: b.photoVerdict as FarmerCheck['photoVerdict'],
        checkerNote: typeof b.checkerNote === 'string' ? b.checkerNote : null,
        photoDataUrl: typeof b.photoDataUrl === 'string' ? b.photoDataUrl : null,
        heightM: Number(b.heightM ?? 0),
        diameterM: Number(b.diameterM ?? 0),
      };
      res.status(201).json(store.addFarmerCheck(check));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/farmer-checks/:id', (req, res) => {
    try {
      const found = store.getFarmerCheckById(req.params.id);
      if (!found) {
        return res.status(404).json({ error: 'Check not found' });
      }
      res.json(found);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/farmer-checks', (req, res) => {
    try {
      const { farmer } = req.query;
      if (typeof farmer !== 'string' || !farmer.trim()) {
        // No unfiltered list: farmer history is lookup-only, never a feed.
        return res.status(400).json({ error: 'Query ?farmer=<name> is required' });
      }
      res.json(store.getFarmerChecksByFarmer(farmer));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Reset database back to seed demo state
  app.post('/api/reset-demo', (req, res) => {
    try {
      store.resetToDefaults();
      res.json({ message: 'Demo data reset successfully', summary: store.getPortfolioSummary() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- VITE MIDDLEWARE / STATIC SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`STOCKPROOF Warehouse Audit Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
