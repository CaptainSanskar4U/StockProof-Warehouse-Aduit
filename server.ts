import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { store, SAMPLE_GRAIN_IMAGES } from './server/store.js';
import {
  computeGrainStockEstimate,
  GRAIN_BULK_DENSITIES,
  COMPACTION_MULTIPLIERS,
  SEASON_PROFILES,
  calculatePileVolume
} from './server/estimation-service.js';
import { Verification } from './src/types.js';

function withSeasonDefaults(context: any) {
  if (!context) return { season: 'rabi', ...context };
  return { season: 'rabi', ...context };
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

  // Allow larger payload for captured photo base64 / URLs
  app.use(express.json({ limit: '20mb' }));

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString(), app: 'STOCKPROOF' });
  });

  // --- AI image detector sidecar (lynote-ai/ai-image-detector, ultra backend) ---
  // Local field laptop: Express auto-starts the Python sidecar on demand.
  // Vercel/prod: sidecar absent -> 503 + frontend falls back to heuristic warning.
  const AI_DETECT_URL = process.env.AI_DETECT_URL || 'http://127.0.0.1:8000';
  const AI_DETECTOR_DIR = path.join(process.cwd(), '..', 'ai-image-detector');
  const AI_DETECTOR_PY = path.join(AI_DETECTOR_DIR, '.venv', 'Scripts', 'python.exe');

  async function aiDetectorHealthy(): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const r = await fetch(`${AI_DETECT_URL}/health`, { signal: ctrl.signal });
      clearTimeout(t);
      return r.ok;
    } catch {
      return false;
    }
  }

  let aiEnsureStarted = false;
  function ensureAiDetector() {
    if (aiEnsureStarted) return;
    aiEnsureStarted = true;
    (async () => {
      if (await aiDetectorHealthy()) return;
      try {
        const fs = await import('fs');
        const { spawn } = await import('child_process');
        if (!fs.existsSync(AI_DETECTOR_PY)) return; // sidecar not installed: stay on heuristic
        const logFile = path.join(AI_DETECTOR_DIR, 'ai-api.log');
        const out = fs.openSync(logFile, 'a');
        const child = spawn(AI_DETECTOR_PY, ['-u', 'serve_stockproof.py'], {
          cwd: AI_DETECTOR_DIR,
          detached: true,
          stdio: ['ignore', out, out],
          windowsHide: true,
        });
        child.unref();
        // Poll until ultra weights are warm (can take a few minutes on CPU).
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 5000));
          if (await aiDetectorHealthy()) break;
        }
      } catch (err) {
        console.warn('AI detector sidecar could not start:', err);
      }
    })();
  }

  // Score a pile photo with the ultra ensemble. Body: { dataUrl }.
  app.post('/api/ai-detect', async (req, res) => {
    try {
      const { dataUrl } = req.body as { dataUrl?: string };
      if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
        return res.status(400).json({ error: 'dataUrl (data:image/...) required' });
      }
      const m = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!m) return res.status(400).json({ error: 'invalid data URL' });
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length > 18 * 1024 * 1024) {
        return res.status(413).json({ error: 'image too large' });
      }
      const form = new FormData();
      form.append('file', new Blob([buf], { type: m[1] }), 'pile.jpg');
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 180000);
      let upstream: Response;
      try {
        upstream = await fetch(`${AI_DETECT_URL}/detect`, {
          method: 'POST',
          body: form,
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(t);
      }
      if (!upstream.ok) {
        return res.status(502).json({ error: 'detector error', unavailable: true });
      }
      const data = (await upstream.json()) as Record<string, unknown>;
      res.json({ ...data, detector: 'ultra', signal: true });
    } catch {
      res.status(503).json({ error: 'AI detector unavailable', unavailable: true });
    }
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
          w.name.toLowerCase().includes(q) ||
          w.code.toLowerCase().includes(q) ||
          w.district.toLowerCase().includes(q) ||
          w.state.toLowerCase().includes(q) ||
          w.receiptNumber.toLowerCase().includes(q) ||
          w.borrowerName.toLowerCase().includes(q)
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
      if (!geometry || !context || typeof declaredTonnes !== 'number') {
        return res.status(400).json({ error: 'Missing geometry, context, or declaredTonnes in request body' });
      }

      const normalizedContext = withSeasonDefaults(context);
      const calculatedVolume = geometry.calculatedVolumeM3 > 0
        ? geometry.calculatedVolumeM3
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
      const normalizedContext = withSeasonDefaults(context);

      const calculatedVolume = geometry.calculatedVolumeM3 > 0
        ? geometry.calculatedVolumeM3
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
      if (status) updates.status = status;
      if (resolutionType) updates.resolutionType = resolutionType;
      if (priority) updates.priority = priority;
      if (assignedTo) updates.assignedTo = assignedTo;
      if (status === 'resolved') {
        updates.resolvedAt = new Date().toISOString();
      }

      if (note && typeof note === 'string') {
        const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        updates.notes = [...existing.notes, `[${timestampStr}] ${note}`];
      }

      const updated = store.updateReview(id, updates);
      res.json(updated);
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
    ensureAiDetector();
  });
}

startServer();
