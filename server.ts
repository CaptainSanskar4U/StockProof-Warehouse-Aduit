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
import { Verification } from './src/types.js';
import { detectWithHF, resolveImageBytes, HF_PRIMARY_MODEL, HF_XCHECK_MODEL } from './lib/hfDetect.js';

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

  // Inspector profile (persisted, reused across audits/reports)
  app.get('/api/inspector-profile', (req, res) => {
    try {
      res.json(store.getProfile() || null);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/inspector-profile', (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const inspectorType = body['inspectorType'] === 'government' ? 'government' : 'bank';
      const str = (v: unknown, max = 160): string | undefined => {
        if (typeof v !== 'string') return undefined;
        const t = v.trim();
        return t ? t.slice(0, max) : undefined;
      };
      const dataUrl = (v: unknown): string | undefined => {
        if (typeof v !== 'string' || !v.startsWith('data:')) return undefined;
        // Cap uploads (~2MB) so storage.json stays small.
        if (v.length > 2_800_000) return undefined;
        return v;
      };
      const bankRaw = (body['bank'] || {}) as Record<string, unknown>;
      const govRaw = (body['gov'] || {}) as Record<string, unknown>;
      // Both branches are always sent. The store merges them, so switching the
      // inspector type never erases the other identity.
      const saved = store.saveProfile({
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
      });
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
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

    // Try one side: local sidecar first, HF cloud on failure.
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
          return null;
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

  // Get verifications (all or filtered by warehouse / agentType).
  // ONE store, filtered views: Bank Checks => ?agentType=bank, Government Audit => ?agentType=government.
  app.get('/api/verifications', (req, res) => {
    try {
      const { warehouseId, agentType } = req.query;
      const verifications = store.getVerifications(
        warehouseId as string | undefined,
        agentType as string | undefined
      );
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

  // Create and commit a new verification run (Inspector Panel: single engine, agentType only changes context/storage/wording)
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
        agentType,
        bank,
        gov,
        photoVerdict,
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

      const safeAgentType = agentType === 'government' ? 'government' : 'bank';
      const cleanFinding = (f: unknown) => {
        if (!f || typeof f !== 'object') return null;
        const r = f as Record<string, unknown>;
        if (typeof r.label !== 'string' || typeof r.probability_ai !== 'number') return null;
        const num = (v: unknown, fb: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fb);
        return {
          label: r.label.slice(0, 24),
          probability_ai: num(r.probability_ai, 0),
          probability_real: num(r.probability_real, 1 - num(r.probability_ai, 0)),
          confidence: num(r.confidence, 0.5),
          raw_score: num(r.raw_score, 0),
          backend: typeof r.backend === 'string' ? r.backend.slice(0, 80) : 'unknown',
          filename: typeof r.filename === 'string' ? r.filename.slice(0, 160) : undefined,
        };
      };
      const verdictRaw = (photoVerdict || {}) as Record<string, unknown>;
      const newVerification: Verification = {
        id: `ver-${Date.now().toString().slice(-6)}`,
        warehouseId,
        timestamp: new Date().toISOString(),
        photoUrl: photoUrl || warehouse.pilePhotoUrl || SAMPLE_GRAIN_IMAGES.wheat_pile,
        mediaType: mediaType === 'video-frame' ? 'video-frame' : 'photo',
        referenceScale: typeof referenceScale === 'string' ? referenceScale : undefined,
        receiptPhotoUrl: typeof receiptPhotoUrl === 'string' && receiptPhotoUrl.length > 0 ? receiptPhotoUrl : undefined,
        declaredSource: declaredSource === 'manual' ? 'manual' : 'registry',
        agentType: safeAgentType,
        bank: safeAgentType === 'bank' && bank && typeof bank === 'object' ? {
          farmerName: typeof bank.farmerName === 'string' ? bank.farmerName.slice(0, 120) : undefined,
          loanRef: typeof bank.loanRef === 'string' ? bank.loanRef.slice(0, 120) : undefined,
          warehouseName: typeof bank.warehouseName === 'string' ? bank.warehouseName.slice(0, 160) : undefined,
        } : undefined,
        gov: safeAgentType === 'government' && gov && typeof gov === 'object' ? {
          warehouseRef: typeof gov.warehouseRef === 'string' ? gov.warehouseRef.slice(0, 160) : undefined,
          region: typeof gov.region === 'string' ? gov.region.slice(0, 160) : undefined,
          scheme: gov.scheme === 'Public Distribution System' || gov.scheme === 'Buffer Stock' || gov.scheme === 'Other' ? gov.scheme : undefined,
        } : undefined,
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
        photoVerdict: {
          primary: cleanFinding(verdictRaw.primary),
          cross: cleanFinding(verdictRaw.cross),
        },
        runBy: runBy || {
          id: 'inspector',
          name: 'Field Inspector',
          role: 'field_inspector',
        },
      };

      const saved = store.addVerification(newVerification);
      res.status(201).json(saved);
    } catch (err: any) {
      console.error('Error adding verification:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- QR gov-check records (permanent evidence; the QR points here, never to a file) ---
  function deriveAuthenticity(photoVerdict: unknown): 'real' | 'ai' | 'inconclusive' | 'unchecked' {
    try {
      const pv = (photoVerdict || {}) as Record<string, { label?: unknown } | null | undefined>;
      const labels = [pv.primary?.label, pv.cross?.label].filter((l): l is string => typeof l === 'string');
      if (labels.length === 0) return 'unchecked';
      if (labels.some((l) => l === 'ai')) return 'ai';
      if (labels.every((l) => l === 'real')) return 'real';
      return 'inconclusive';
    } catch {
      return 'unchecked';
    }
  }

  // Create a permanent QR record. Namespaced away from the audit registry on purpose.
  app.post('/api/gov-checks', (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const str = (v: unknown, max = 160): string | undefined => {
        if (typeof v !== 'string') return undefined;
        const t = v.trim();
        return t ? t.slice(0, max) : undefined;
      };
      const num = (v: unknown): number | undefined =>
        typeof v === 'number' && Number.isFinite(v) ? v : undefined;

      const inspectorName = str(body['inspectorName'], 120);
      const location = str(body['location'], 200);
      const declaredTonnes = num(body['declaredTonnes']);
      const estCentral = num(body['estCentral']);
      const estLow = num(body['estLow']);
      const estHigh = num(body['estHigh']);
      const volumeM3 = num(body['volumeM3']);

      if (!inspectorName || !location || declaredTonnes === undefined ||
          estCentral === undefined || estLow === undefined ||
          estHigh === undefined || volumeM3 === undefined) {
        return res.status(400).json({
          error: 'inspectorName, location, declaredTonnes, estCentral, estLow, estHigh, volumeM3 are required',
        });
      }

      const authenticity = deriveAuthenticity(body['photoVerdict']);
      const statusRaw = typeof body['status'] === 'string' ? body['status'] : '';
      // match: boolean | null — null = UNVERIFIED, never merged into false.
      const match = (authenticity === 'ai' || authenticity === 'inconclusive')
        ? null
        : statusRaw === 'consistent';

      let id = '';
      for (let i = 0; i < 5; i += 1) {
        const candidate = `gc-${crypto.randomBytes(4).toString('hex')}`;
        if (!store.getGovCheckById(candidate)) {
          id = candidate;
          break;
        }
      }
      if (!id) return res.status(500).json({ error: 'Could not mint a unique record id' });

      const photo = typeof body['photoDataUrl'] === 'string' ? body['photoDataUrl'] : undefined;
      const record = store.addGovCheck({
        id,
        createdAt: new Date().toISOString(),
        inspectorName,
        location,
        storageName: str(body['storageName'], 160),
        declaredTonnes,
        estCentral,
        estLow,
        estHigh,
        volumeM3,
        match,
        authenticity,
        checkerNote: str(body['checkerNote'], 600),
        photoDataUrl: photo && photo.startsWith('data:') && photo.length <= 2_800_000 ? photo : undefined,
        verificationId: str(body['verificationId'], 40),
        agentType: body['agentType'] === 'government' ? 'government' : 'bank',
        scheme: body['scheme'] === 'Public Distribution System' || body['scheme'] === 'Buffer Stock' || body['scheme'] === 'Other'
          ? body['scheme'] : undefined,
      });
      res.status(201).json(record);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Read one stored record (public verify page reads this — no stack traces).
  app.get('/api/gov-checks/:id', (req, res) => {
    try {
      const record = store.getGovCheckById(req.params.id);
      if (!record) return res.status(404).json({ error: 'Record not found' });
      res.json(record);
    } catch (err: any) {
      res.status(500).json({ error: 'Read failed' });
    }
  });

  // Filtered lookups only — official history or one verification's record. Never a full feed.
  app.get('/api/gov-checks', (req, res) => {
    try {
      const { official, verificationId } = req.query;
      if (typeof verificationId === 'string' && verificationId.trim()) {
        return res.json(store.getGovChecksByVerification(verificationId.trim()));
      }
      if (typeof official !== 'string' || !official.trim()) {
        return res.status(400).json({ error: 'official or verificationId query parameter is required' });
      }
      res.json(store.getGovChecksByOfficial(official));
    } catch (err: any) {
      res.status(500).json({ error: 'Read failed' });
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
  });
}

startServer();
