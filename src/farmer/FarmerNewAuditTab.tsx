import React, { useState, useRef, useEffect } from 'react';
import {
  Warehouse,
  EstimationResult,
  GeometryInputs,
  ContextInputs,
  GrainType,
  Season,
  CompactionLevel,
  PhotoVerdict,
} from '../types.js';
import { SEASON_PROFILES, SEASON_ORDER } from '../seasonProfiles.js';
import { GRAIN_BULK_DENSITIES, SAMPLE_GRAIN_IMAGES } from '../constants.js';
import { SafeImage } from '../components/SafeImage.js';
import { previewEstimate, submitFarmerCheck } from '../services/api.js';
import {
  MATCH_TOLERANCE,
  downscaleDataUrl,
  loadProfile,
  loadRecords,
  makeCode,
  saveRecord,
} from './farmerStore.js';
import {
  bankableTonnes,
  reposeVerdict,
  reverseProof,
} from '../proofMath.js';
import { useSharedAudit, type PhotoState } from '../components/proof/SharedAuditContext.js';
import {
  PhotoGateBanner,
} from '../components/proof/ProofBlocks.js';
import {
  BookmarkPlus,
  Camera,
  Upload,
  X,
  ArrowRight,
  RotateCcw,
  Printer,
  Download,
  RefreshCw,
  ShieldCheck,
  Receipt,
} from 'lucide-react';

interface FarmerNewAuditTabProps {
  warehouses: Warehouse[];
  onViewRecords: () => void;
}

type Phase = 'photo' | 'adjust' | 'working' | 'result';

// Quiet progress — photograph, adjust, checking, finding.
const STAGES = ['Photograph', 'Adjust', 'Checking', 'Finding'];
const STAGE_HINT = [
  'Add one honest photograph',
  'Describe the pile, then check',
  'Checking your image…',
  'Here is what the pile holds',
];

// Calibrated starting points live in SharedAuditContext (SHARED_DEFAULTS) so the
// proof tabs always see the same pile — the system never auto-measures.

const coneVolume = (h: number, d: number) =>
  Number((((1 / 3) * Math.PI * Math.pow(d / 2, 2) * h)).toFixed(1));

const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_PREVIEW_DIM = 1600;

const ANALYSIS_STEPS = [
  'Reading the shape of the pile',
  'Weighing light, surface and fill',
  'Remembering the season it slept through',
  'Settling the density, gently',
  'Finding where the truth rests',
];
const STEP_MS = 620;

// Deterministic demo fallback — used ONLY when the calculation engine is unreachable.
// Central value derives from the auditor's own live volume so it never contradicts
// the Measure screen; nothing here is random.
const demoFallback = (volumeM3: number, declaredTonnes: number): EstimationResult => {
  const central = Number((volumeM3 * 0.844).toFixed(1));
  const low = Number((central * 0.965).toFixed(1));
  const high = Number((central * 1.035).toFixed(1));
  const over = declaredTonnes - high;
  return {
    centralEstimateTonnes: central,
    rangeLowTonnes: low,
    rangeHighTonnes: high,
    confidencePercent: 91,
    volumeM3,
    effectiveDensity: 0.844,
    status: 'review',
    discrepancyTonnes: over > 0 ? Number(over.toFixed(1)) : 0,
    discrepancyPercent: over > 0 ? Number(((over / declaredTonnes) * 100).toFixed(1)) : 0,
    explanatoryReason:
      'Demonstration estimate: the calculation engine was unreachable, so this run uses the fixed demo calibration against your measured volume. Re-run when connected for a live season-calibrated estimate.',
    auditRecommendation:
      'Re-measure pile height and base footprint with a gauge rod, confirm moisture with a meter reading, and re-run the audit when connectivity is restored.',
  };
};

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Real-photo check runs in the background while the farmer waits on the
// progress screen. Never blocks: 'ai' and 'inconclusive' continue to a
// limited UNVERIFIED result; 'unchecked' (timeout/offline) proceeds with an
// honest note so the demo survives bad connectivity.
const AI_CHECK_TIMEOUT_MS = 10000;

async function detectPhotoAi(p: PhotoState, timeoutMs: number): Promise<PhotoVerdict> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('/api/ai-detect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dataUrl: p.dataUrl, filename: p.name }),
      signal: ctrl.signal,
    });
    if (!res.ok) return 'unchecked';
    const data = (await res.json()) as {
      primary?: { label?: unknown; probability_ai?: unknown };
      cross?: { label?: unknown; probability_ai?: unknown };
    };
    const findings = [data?.primary, data?.cross].filter(
      (f): f is { label?: unknown; probability_ai?: unknown } =>
        !!f && typeof f.label === 'string',
    );
    if (findings.some((f) => f.label === 'ai')) return 'ai';
    if (findings.length === 0) return 'unchecked';
    // A high-but-below-threshold AI score is disagreement, not proof of real.
    const top = Math.max(
      ...findings.map((f) => (typeof f.probability_ai === 'number' ? f.probability_ai : 0)),
    );
    if (top >= 0.4) return 'inconclusive';
    return 'real';
  } catch {
    return 'unchecked';
  } finally {
    clearTimeout(timer);
  }
}

function downscaleImage(
  dataUrl: string,
  mime: string
): Promise<{ dataUrl: string; sizeKB: number; width: number; height: number; meanLuma: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, MAX_PREVIEW_DIM / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas not supported on this device.');
        ctx.drawImage(img, 0, 0, w, h);
        const out = canvas.toDataURL(mime === 'image/png' ? 'image/png' : 'image/jpeg', 0.85);
        const sizeKB = Math.round((out.length * 0.75) / 1024);
        resolve({
          dataUrl: out,
          sizeKB,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          meanLuma: sampleMeanLuma(ctx, w, h),
        });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Could not decode that image file.'));
    img.src = dataUrl;
  });
}

// Mean luminance sampled on a sparse grid — fast even on 1600px frames.
// Feeds the MEASURE-stage exposure verdict (balanced / under / over).
function sampleMeanLuma(ctx: CanvasRenderingContext2D, w: number, h: number): number {
  try {
    const data = ctx.getImageData(0, 0, w, h).data;
    let sum = 0;
    let n = 0;
    const stride = 16 * 4;
    for (let i = 0; i < data.length; i += stride) {
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      n += 1;
    }
    return n > 0 ? Math.round(sum / n) : 128;
  } catch {
    return 128;
  }
}

const exposureVerdict = (meanLuma: number): { label: string; ok: boolean } => {
  if (meanLuma < 60) return { label: 'Underexposed', ok: false };
  if (meanLuma > 200) return { label: 'Overexposed', ok: false };
  return { label: 'Balanced', ok: true };
};

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}

export const FarmerNewAuditTab: React.FC<FarmerNewAuditTabProps> = ({
  warehouses,
  onViewRecords,
}) => {
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [phase, setPhase] = useState<Phase>('idle');
  // Shared pile: photo, gates, geometry and claim live here so the
  // Reverse / Geometry / Bankable tabs always see the same audit.
  const {
    photo, setPhoto,
    photoQuality, clearPhoto, refreshPhotoGate,
    heightMeters, setHeightMeters,
    baseDiameterMeters, setBaseDiameterMeters,
    grainType, setGrainType,
    season, setSeason,
    humidityPercent, setHumidityPercent,
    compaction, setCompaction,
    storageDays, setStorageDays,
    declaredText, setDeclaredText,
    declaredTouched, setDeclaredTouched,
  } = useSharedAudit();
  const liveVolume = coneVolume(heightMeters, baseDiameterMeters);
  const [receiptPhoto, setReceiptPhoto] = useState<PhotoState | null>(null);
  const [runDeclared, setRunDeclared] = useState<number>(0);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);
  const parsedDeclared = parseFloat(declaredText);
  const [showChooser, setShowChooser] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<number>(0);
  const [activeStep, setActiveStep] = useState<number>(-1);
  const [estimationResult, setEstimationResult] = useState<EstimationResult | null>(null);
  const [usedFallback, setUsedFallback] = useState<boolean>(false);
  // Farmer Records save — the single save action on this screen.
  const [isSavingFarmer, setIsSavingFarmer] = useState<boolean>(false);
  const [savedFarmerCode, setSavedFarmerCode] = useState<string | null>(null);
  const [savedVerifyId, setSavedVerifyId] = useState<string | null>(null);
  const [savedQr, setSavedQr] = useState<string | null>(null);

  // QR for the saved server record — generated once the id exists.
  useEffect(() => {
    let alive = true;
    setSavedQr(null);
    if (!savedVerifyId) return;
    (async () => {
      const { qrDataUrl, verifyUrl } = await import('./qr.js');
      const url = await qrDataUrl(verifyUrl(savedVerifyId));
      if (alive) setSavedQr(url);
    })();
    return () => {
      alive = false;
    };
  }, [savedVerifyId]);
  const [farmerSaveMsg, setFarmerSaveMsg] = useState<string | null>(null);
  // Pipeline progress: quality → real-photo check → estimate.
  const [workStage, setWorkStage] = useState<'quality' | 'aicheck' | 'estimate'>('quality');
  const [checkerNote, setCheckerNote] = useState<string | null>(null);
  // Pipeline AI verdict, used by exports (context detection no longer runs here).
  const [aiVerdict, setAiVerdict] = useState<PhotoVerdict | null>(null);
  const [loadingSample, setLoadingSample] = useState<boolean>(false);

  // Camera capture state
  const [cameraOpen, setCameraOpen] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStarting, setCameraStarting] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const runTokenRef = useRef<number>(0);

  const warehouse: Warehouse | undefined =
    warehouses.find((w) => w.id === warehouseId) || warehouses[0];

  // Default to the first warehouse once the registry loads; keep selection otherwise.
  // When the facility itself changes, adopt its primary grain (auditor can override).
  const prevWhIdRef = useRef<string>('');
  useEffect(() => {
    if (!warehouseId && warehouses.length > 0) {
      setWarehouseId(warehouses[0].id);
    }
    if (warehouseId && warehouseId !== prevWhIdRef.current) {
      prevWhIdRef.current = warehouseId;
      const wh = warehouses.find((w) => w.id === warehouseId);
      if (wh?.grainTypes[0]) setGrainType(wh.grainTypes[0] as GrainType);
      if (typeof wh?.currentDeclaredTonnes === 'number') {
        setDeclaredText(String(wh.currentDeclaredTonnes));
        setDeclaredTouched(false);
      }
      // New facility = new audit: never carry evidence, inputs, or results across facilities.
      clearPhoto();
      setReceiptPhoto(null);
      setEstimationResult(null);
      setSavedFarmerCode(null);
      setFarmerSaveMsg(null);
      setCheckerNote(null);
      setAiVerdict(null);
      setWorkStage('quality');
      setRunDeclared(0);
      setCompletedSteps(0);
      setActiveStep(-1);
      setErrorMsg(null);
      setShowChooser(false);
      setPhase('photo');
    }
  }, [warehouses, warehouseId]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  // Never leak the camera stream.
  useEffect(() => {
    return () => {
      runTokenRef.current += 1;
      stopCamera();
    };
  }, []);

  const resetWorkflow = () => {
    runTokenRef.current += 1;
    stopCamera();
    setCameraOpen(false);
    setCameraError(null);
    clearPhoto();
    setPhase('photo');
    setWorkStage('quality');
    setCheckerNote(null);
    setAiVerdict(null);
    setShowChooser(false);
    setErrorMsg(null);
    setCompletedSteps(0);
    setActiveStep(-1);
    setEstimationResult(null);
    setUsedFallback(false);
    setIsSavingFarmer(false);
    setReceiptPhoto(null);
    setDeclaredTouched(false);
    setRunDeclared(0);
    if (warehouse) setDeclaredText(String(warehouse.currentDeclaredTonnes));
  };

  // Shared image intake — grain evidence and receipt evidence go through the
  // same validation, size cap, and downscale pipeline.
  const validateImageFile = (file: File): string | null => {
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    if (!ACCEPTED_MIME.includes(file.type) || !ACCEPTED_EXT.includes(ext)) {
      return `“${file.name}” is not a supported image. Please choose a JPG, JPEG, PNG, or WebP file.`;
    }
    if (file.size > MAX_FILE_BYTES) {
      return `“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 15 MB. Please compress the image or capture at a lower resolution.`;
    }
    return null;
  };

  const processImageFile = async (
    file: File
  ): Promise<Omit<PhotoState, 'name' | 'source'>> => {
    const raw = await readFileAsDataURL(file);
    return downscaleImage(raw, file.type);
  };

  const handleFileSelected = async (file: File | undefined) => {
    setErrorMsg(null);
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) {
      setErrorMsg(problem);
      return;
    }
    try {
      const processed = await processImageFile(file);
      const next = { ...processed, name: file.name, source: 'upload' as const };
      setPhoto(next);
      setShowChooser(false);
      setErrorMsg(null);
      setPhase('adjust');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not process that image. Try a different file.');
    }
  };

  const handleReceiptSelected = async (file: File | undefined) => {
    setErrorMsg(null);
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) {
      setErrorMsg(problem);
      return;
    }
    try {
      const processed = await processImageFile(file);
      setReceiptPhoto({ ...processed, name: file.name, source: 'upload' });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not process that receipt image. Try a different file.');
    }
  };

  // One-click sample evidence — stage-demo insurance. Fetches real bytes so the
  // quality readout and downscale run on actual pixels; falls back to the CDN
  // URL directly on degraded networks.
  const useSamplePhoto = async () => {
    if (loadingSample) return;
    setErrorMsg(null);
    setLoadingSample(true);
    try {
      const res = await fetch(SAMPLE_GRAIN_IMAGES.wheat_pile, { mode: 'cors' });
      if (!res.ok) throw new Error('sample fetch failed');
      const blob = await res.blob();
      const file = new File([blob], 'sample-wheat-pile.jpg', { type: blob.type || 'image/jpeg' });
      const problem = validateImageFile(file);
      if (problem) throw new Error(problem);
      const processed = await processImageFile(file);
      const next = { ...processed, name: 'sample-wheat-pile.jpg', source: 'upload' as const };
      setPhoto(next);
      setErrorMsg(null);
      setPhase('adjust');
    } catch {
      const fallback = {
        dataUrl: SAMPLE_GRAIN_IMAGES.wheat_pile,
        name: 'sample-wheat-pile.jpg',
        source: 'upload' as const,
        sizeKB: 0,
        width: 1200,
        height: 800,
        meanLuma: 128,
      };
      setPhoto(fallback);
      setErrorMsg(null);
      setPhase('adjust');
    } finally {
      setLoadingSample(false);
      setShowChooser(false);
    }
  };

  const openCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Live camera is not supported in this browser. Please use “Upload from Device”.');
      return;
    }
    setCameraStarting(true);
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch {
      setCameraError(
        'Camera permission was denied or no camera is available. Allow camera access, or use “Upload from Device” instead.'
      );
    } finally {
      setCameraStarting(false);
    }
  };

  const captureFromCamera = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setCameraError('Camera is not ready yet — hold on a second and try again.');
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, MAX_PREVIEW_DIM / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('capture failed');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const sizeKB = Math.round((dataUrl.length * 0.75) / 1024);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const luma = sampleMeanLuma(ctx, canvas.width, canvas.height);
      const next = {
        dataUrl,
        name: `capture-${stamp}.jpg`,
        source: 'camera' as const,
        sizeKB,
        width: video.videoWidth,
        height: video.videoHeight,
        meanLuma: luma,
      };
      setPhoto(next);
      stopCamera();
      setCameraOpen(false);
      setShowChooser(false);
      setErrorMsg(null);
      setPhase('adjust');
    } catch {
      setCameraError('Could not capture a frame on this device. Try “Upload from Device”.');
    }
  };

  // The single Check action on the adjust screen.
  const handleCheckClick = () => {
    if (!photo) return;
    const declared = parseFloat(declaredText);
    if (!Number.isFinite(declared) || declared <= 0) {
      setErrorMsg('Enter the declared stock in tonnes (a number above 0) — read it off the paper receipt.');
      return;
    }
    setErrorMsg(null);
    void startPipeline(photo);
  };

  // One pipeline, triggered by the Check button: quality → real-photo
  // check → estimate. The farmer waits on a single progress screen until
  // the result appears automatically.
  const startPipeline = async (next: PhotoState) => {
    if (!warehouse) return;
    const token = ++runTokenRef.current;
    const isStale = () => token !== runTokenRef.current;

    setErrorMsg(null);
    const declared = parseFloat(declaredText);
    if (!Number.isFinite(declared) || declared <= 0) {
      setErrorMsg('Enter the declared stock in tonnes (a number above 0) — read it off the paper receipt.');
      setPhase('adjust');
      return;
    }
    setUsedFallback(false);
    setRunDeclared(declared);
    setEstimationResult(null);
    setSavedFarmerCode(null);
    setFarmerSaveMsg(null);
    setCheckerNote(null);
    setAiVerdict(null);
    setCompletedSteps(0);
    setActiveStep(-1);
    setPhase('working');
    setWorkStage('quality');

    // 1. Photo quality — fast, local, advisory only (never blocks).
    await refreshPhotoGate(next);
    if (isStale()) return;
    setWorkStage('aicheck');

    // 2. Real-photo check — awaited, never blocks. 'ai' and 'inconclusive'
    // continue to a limited UNVERIFIED result; 'unchecked' stays honest.
    const verdict = await detectPhotoAi(next, AI_CHECK_TIMEOUT_MS);
    if (isStale()) return;
    setAiVerdict(verdict);
    if (verdict === 'unchecked') {
      setCheckerNote('Photo checker unreachable — this reading is unchecked.');
    }
    setWorkStage('estimate');

    // 3. Estimate — staged animation with the real engine underneath.
    const geometry: GeometryInputs = {
      pileType: 'cone',
      heightMeters,
      baseDiameterMeters,
      calculatedVolumeM3: liveVolume,
      measurementMethod: 'visual_estimate',
    };
    const context: ContextInputs = {
      grainType,
      season,
      humidityPercent,
      compaction,
      storageDays,
    };

    // Hit the real calculation engine in parallel with the staged animation.
    const estimatePromise = previewEstimate(geometry, context, declared);

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    for (let i = 0; i < ANALYSIS_STEPS.length; i += 1) {
      if (isStale()) return;
      setActiveStep(i);
      if (!reduceMotion) await delay(STEP_MS);
      if (isStale()) return;
      setCompletedSteps(i + 1);
    }

    let result: EstimationResult;
    try {
      result = await estimatePromise;
    } catch {
      result = demoFallback(liveVolume, declared);
      if (!isStale()) setUsedFallback(true);
    }
    if (isStale()) return;
    setEstimationResult(result);
    setActiveStep(-1);
    setPhase('result');
  };

  const handleSaveToRecords = async () => {
    if (!warehouse || !photo || !estimationResult || isSavingFarmer) return;
    setIsSavingFarmer(true);
    setFarmerSaveMsg(null);
    try {
      const profile = loadProfile();
      const central = estimationResult.centralEstimateTonnes;
      const verdict: PhotoVerdict = aiVerdict ?? 'unchecked';
      const unverified = verdict === 'ai' || verdict === 'inconclusive';
      const match = unverified
        ? null
        : runDeclared > 0 && Math.abs(central - runDeclared) / runDeclared <= MATCH_TOLERANCE;
      const code = makeCode(loadRecords());
      let recordPhoto: string | null = photo.dataUrl;
      try {
        recordPhoto = await downscaleDataUrl(photo.dataUrl, 1024);
      } catch {
        /* keep the original frame */
      }
      // Server record first — its id is what the QR verifies. Local save
      // always happens, even if the server is unreachable (QR pending).
      let verificationId: string | null = null;
      try {
        const saved = await submitFarmerCheck({
          farmerName: profile.name || 'Name not set',
          storageName: profile.storageName || 'Storage not set',
          location: [profile.village, profile.district].filter(Boolean).join(', '),
          grainType,
          grainName: GRAIN_BULK_DENSITIES[grainType]?.name || grainType,
          declaredTonnes: Number(runDeclared.toFixed(1)),
          estCentral: central,
          estLow: estimationResult.rangeLowTonnes,
          estHigh: estimationResult.rangeHighTonnes,
          volumeM3: estimationResult.volumeM3,
          match,
          photoVerdict: verdict,
          checkerNote,
          photoDataUrl: recordPhoto,
          heightM: heightMeters,
          diameterM: baseDiameterMeters,
        });
        verificationId = saved.id;
      } catch {
        setFarmerSaveMsg('Saved on this device, but the verification code is pending — reconnect and save again to get your QR.');
      }
      saveRecord({
        code,
        createdAt: new Date().toISOString(),
        declaredTonnes: Number(runDeclared.toFixed(1)),
        grainType,
        grainName: GRAIN_BULK_DENSITIES[grainType]?.name || grainType,
        estCentral: central,
        estLow: estimationResult.rangeLowTonnes,
        estHigh: estimationResult.rangeHighTonnes,
        volumeM3: estimationResult.volumeM3,
        match,
        photoVerdict: verdict,
        checkerNote,
        verificationId,
        photoDataUrl: recordPhoto,
        heightM: heightMeters,
        diameterM: baseDiameterMeters,
        farmerName: profile.name || 'Name not set',
        storageName: profile.storageName || 'Storage not set',
        source: 'engine',
      });
      setSavedFarmerCode(code);
      setSavedVerifyId(verificationId);
    } catch (err: any) {
      setFarmerSaveMsg(err?.message || 'Could not save to your records. Try again.');
    } finally {
      setIsSavingFarmer(false);
    }
  };

  const handleExportCSV = () => {
    if (!warehouse || !estimationResult) return;
    const diff = estimationResult.centralEstimateTonnes - runDeclared;
    const rev = reverseProof(runDeclared, baseDiameterMeters, heightMeters, {
      grainType, season, humidityPercent, compaction, storageDays,
    });
    const geo = reposeVerdict(heightMeters, baseDiameterMeters);
    const bank = bankableTonnes(
      estimationResult.rangeLowTonnes, estimationResult.confidencePercent, humidityPercent, true,
    );
    const rows = [
      ['StockProof New Audit Report', new Date().toISOString()],
      ['Warehouse', warehouse.name],
      ['Code', warehouse.code],
      ['Location', `${warehouse.district}, ${warehouse.state}`],
      ['Receipt', warehouse.receiptNumber],
      ['Grain', grainLabel()],
      ['Pile geometry', `cone h ${heightMeters.toFixed(1)} m, base ${baseDiameterMeters.toFixed(1)} m (visual estimate)`],
      ['Repose angle (deg)', geo.deg.toFixed(1)],
      ['Repose band', `${geo.min}-${geo.max}`],
      ['Physics verdict', geo.violation ? 'PHYSICS VIOLATION' : 'GEOMETRY POSSIBLE'],
      ['Season curve', SEASON_PROFILES[season].name],
      ['Moisture (%)', humidityPercent.toFixed(1)],
      ['Compaction', compaction],
      ['Storage days', String(storageDays)],
      ['Declared (T)', runDeclared.toFixed(1)],
      ['Declared source', declaredTouched ? 'manual entry' : 'registry value'],
      ['Receipt photo attached', receiptPhoto ? 'yes' : 'no'],
      ['Photo quality', photoQuality ? (photoQuality.ok ? 'FULL PILE VISIBLE' : `NOT SUITABLE: ${photoQuality.reasons.join('; ')}`) : 'not checked'],
      ['AI-image primary', aiVerdict === 'real' ? 'passed — looks real' : aiVerdict === 'ai' ? 'FLAGGED as AI-generated' : aiVerdict === 'inconclusive' ? 'inconclusive — detectors disagree' : 'checker unavailable at audit time'],
      ['AI-image cross-check', aiVerdict === 'real' ? 'passed — looks real' : aiVerdict === 'ai' ? 'FLAGGED as AI-generated' : aiVerdict === 'inconclusive' ? 'inconclusive — detectors disagree' : 'checker unavailable at audit time'],
      ['Estimated (T)', estimationResult.centralEstimateTonnes.toFixed(1)],
      ['Range Low (T)', estimationResult.rangeLowTonnes.toFixed(1)],
      ['Range High (T)', estimationResult.rangeHighTonnes.toFixed(1)],
      ['Reverse required volume (m3)', rev.requiredVolumeM3.toFixed(1)],
      ['Reverse required height (m)', rev.requiredHeightM.toFixed(1)],
      ['Reverse verdict', rev.supported ? 'CLAIM SUPPORTED' : 'CLAIM NOT SUPPORTED'],
      ['Bankable tonnes (STOCKPROOF internal)', bank.bankableTonnes.toFixed(1)],
      ['Bankable haircut (%)', bank.haircutPct.toFixed(1)],
      ['Difference (T)', diff.toFixed(1)],
      ['Confidence (%)', String(estimationResult.confidencePercent)],
      ['Status', estimationResult.status],
      ['Volume (m3)', estimationResult.volumeM3.toFixed(1)],
      ['Effective density (t/m3)', estimationResult.effectiveDensity.toFixed(3)],
      ['Checked by', loadProfile().name || 'Farmer'],
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stockproof-audit-${warehouse.code}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handlePrintReport = () => {
    if (!warehouse || !photo || !estimationResult) return;
    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) {
      setErrorMsg('Pop-up blocker stopped the report window. Allow pop-ups, then try Export again.');
      return;
    }
    const diff = estimationResult.centralEstimateTonnes - runDeclared;
    const revP = reverseProof(runDeclared, baseDiameterMeters, heightMeters, {
      grainType, season, humidityPercent, compaction, storageDays,
    });
    const geoP = reposeVerdict(heightMeters, baseDiameterMeters);
    const bankP = bankableTonnes(
      estimationResult.rangeLowTonnes, estimationResult.confidencePercent, humidityPercent, true,
    );
    popup.document.write(`<!doctype html>
<html><head><title>StockProof Audit Report — ${warehouse.code}</title>
<style>
body{font-family:Georgia,serif;color:#2B2016;max-width:720px;margin:32px auto;padding:0 24px}
.mono{font-family:'Courier New',monospace;font-size:12px}
h1{font-size:28px;margin:4px 0 0}.hero{font-size:56px;font-weight:bold;margin:8px 0}
table{width:100%;border-collapse:collapse;margin:16px 0;font-family:'Courier New',monospace;font-size:13px}
td{border:1px solid #ccc;padding:8px 10px}.label{color:#777;text-transform:uppercase;font-size:11px}
img{max-width:100%;border:1px solid #ccc;margin:12px 0}
.footer{margin-top:24px;border-top:1px solid #ccc;padding-top:12px}
</style></head><body>
<div class="mono" style="color:#B98A2E;letter-spacing:2px">STOCKPROOF · FIELD AUDIT REPORT</div>
<h1>${warehouse.name}</h1>
<div class="mono">${warehouse.code} · ${warehouse.district}, ${warehouse.state} · Receipt ${warehouse.receiptNumber}</div>
<div class="label mono">Estimated Stock</div>
<div class="hero">${estimationResult.centralEstimateTonnes.toFixed(1)} T</div>
<table>
<tr><td class="label">Declared Stock</td><td>${runDeclared.toFixed(1)} T (${declaredTouched ? 'manual entry' : 'registry value'})</td></tr>
<tr><td class="label">Estimated Stock</td><td>${estimationResult.centralEstimateTonnes.toFixed(1)} T</td></tr>
<tr><td class="label">Difference</td><td>${diff > 0 ? '+' : ''}${diff.toFixed(1)} T</td></tr>
<tr><td class="label">Confidence</td><td>${estimationResult.confidencePercent}%</td></tr>
<tr><td class="label">Status</td><td>${estimationResult.status.toUpperCase().replace('_', ' ')}</td></tr>
<tr><td class="label">Grain</td><td>${grainLabel()}</td></tr>
<tr><td class="label">Pile geometry</td><td>Cone h ${heightMeters.toFixed(1)} m, base ${baseDiameterMeters.toFixed(1)} m (visual estimate)</td></tr>
<tr><td class="label">Season / moisture</td><td>${SEASON_PROFILES[season].name} · ${humidityPercent.toFixed(1)}% · ${compaction} compaction · ${storageDays} days</td></tr>
<tr><td class="label">Volume</td><td>${estimationResult.volumeM3.toFixed(1)} m³</td></tr>
<tr><td class="label">Effective density</td><td>${estimationResult.effectiveDensity.toFixed(3)} t/m³</td></tr>
<tr><td class="label">Reverse proof</td><td>${runDeclared.toFixed(1)}T needs ${revP.requiredVolumeM3.toFixed(0)} m³ / ${revP.requiredHeightM.toFixed(1)}m height vs measured ${heightMeters.toFixed(1)}m — ${revP.supported ? 'SUPPORTED' : 'NOT SUPPORTED'}</td></tr>
<tr><td class="label">Physics</td><td>${geoP.deg.toFixed(1)}° vs ${geoP.min}-${geoP.max}° — ${geoP.violation ? 'PHYSICS VIOLATION' : 'POSSIBLE'}</td></tr>
<tr><td class="label">Bankable (internal)</td><td>${bankP.bankableTonnes.toFixed(1)} T (haircut ${bankP.haircutPct.toFixed(1)}%)</td></tr>
<tr><td class="label">AI-image primary</td><td>${aiVerdict === 'real' ? 'passed — looks real' : aiVerdict === 'ai' ? 'FLAGGED as AI-generated' : aiVerdict === 'inconclusive' ? 'inconclusive — detectors disagree' : 'checker unavailable at audit time'}</td></tr>
<tr><td class="label">AI-image cross-check</td><td>${aiVerdict === 'real' ? 'passed — looks real' : aiVerdict === 'ai' ? 'FLAGGED as AI-generated' : aiVerdict === 'inconclusive' ? 'inconclusive — detectors disagree' : 'checker unavailable at audit time'}</td></tr>
</table>
<div class="label mono">Visual Evidence</div>
<img src="${photo.dataUrl}" alt="Audit evidence" />
<p><strong>Audit reasoning:</strong> ${estimationResult.explanatoryReason}</p>
<p><strong>Recommendation:</strong> ${estimationResult.auditRecommendation}</p>
<div class="footer mono">Checked by ${loadProfile().name || 'Farmer'} · ${new Date().toLocaleString()} · The system supports the farmer — it does not replace a physical check.</div>
</body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const grainLabel = () => GRAIN_BULK_DENSITIES[grainType]?.name || grainType;

  // Quiet position in the walk: photograph(0) → adjust(1) → checking(2) → finding(3).
  const stageIndex =
    phase === 'adjust' ? 1 : phase === 'working' ? 2 : phase === 'result' ? 3 : 0;

  if (warehouses.length === 0) {
    return (
      <div className="washi-sheet p-10 text-center">
        <p className="serif-reading text-xl text-[#2A2118]">Preparing your bench…</p>
        <p className="text-sm text-[#6B5F4F] mt-2">The registry is still waking up. This will only take a moment.</p>
      </div>
    );
  }

  const declared = warehouse?.currentDeclaredTonnes ?? 0;
  const diff = estimationResult ? estimationResult.centralEstimateTonnes - runDeclared : 0;
  const verdictTone =
    !estimationResult || Math.abs(diff) < 0.5
      ? { dot: '#4A6B4F', word: 'Within range', sentence: 'Sits comfortably within the expected range' }
      : diff < 0
      ? { dot: '#9C4A42', word: 'Below declared', sentence: 'Reads lighter than what was declared' }
      : { dot: '#A87F2A', word: 'Above declared', sentence: 'Reads a little heavier than declared' };

  return (
    <div className="washi-page -m-4 sm:-m-6 lg:-m-8 px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Quiet walk — a hairline, not a dashboard */}
      <div className="flex items-center justify-between gap-4">
        <p className="eyebrow-quiet">
          {STAGES[stageIndex]} · {String(stageIndex + 1)} of {STAGES.length}
        </p>
        <p className="eyebrow-quiet hidden sm:block">{STAGE_HINT[stageIndex]}</p>
      </div>
      <div className="h-px bg-[rgba(42,33,24,0.12)] relative overflow-hidden rounded-full">
        <div
          className="absolute inset-y-0 left-0 bg-[#2A2118] transition-all duration-700 ease-out rounded-full"
          style={{ width: `${((stageIndex + 1) / STAGES.length) * 100}%` }}
        />
      </div>

      {/* Where we are */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <div className="max-w-xl">
          <h1 className="serif-reading text-[#2A2118] text-3xl sm:text-4xl">
            {phase === 'result' ? 'What the pile holds' : phase === 'working' ? 'Checking your image…' : phase === 'adjust' ? 'Describe your pile' : 'Photograph the pile'}
          </h1>
          <p className="text-[15px] leading-relaxed text-[#6B5F4F] mt-2">
            {phase === 'result'
              ? `A careful reading of ${warehouse?.name || 'this store'}, held against its paper receipt.`
              : phase === 'working'
              ? 'Your photo is being checked and read — stay on this screen a moment.'
              : phase === 'adjust'
              ? 'Your eye completes what the camera cannot — shape, season, and the way grain settles.'
              : `Add one honest photograph — the check begins from there.`}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-[#6B5F4F] shrink-0">
          <span className="eyebrow-quiet">Store</span>
          <select
            value={warehouse?.id}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="bg-[#FFFEFA] border border-[rgba(42,33,24,0.16)] rounded-[10px] px-3 py-2 text-xs text-[#2A2118] focus:outline-none focus:border-[#A87F2A] max-w-60 cursor-pointer"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} · {w.name} ({w.currentDeclaredTonnes.toFixed(0)} T)
              </option>
            ))}
          </select>
        </label>
      </div>

      {errorMsg && (
        <div className="washi-sheet px-4 py-3 flex items-start gap-3 washi-enter" role="alert">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#9C4A42] shrink-0" />
          <span className="text-sm leading-relaxed text-[#2A2118]">{errorMsg}</span>
        </div>
      )}

      {/* --- PHASE: PHOTO — big upload card --- */}
      {phase === 'photo' && !photo && (
        <div className="washi-sheet px-6 py-10 sm:px-12 sm:py-14 text-center washi-enter">
          <p className="eyebrow-quiet">One photograph · {warehouse?.code} · {declared.toFixed(0)} T on paper</p>
          <h2 className="serif-reading text-3xl sm:text-4xl text-[#2A2118] mt-3 max-w-md mx-auto">
            Photograph the pile, just as it rests
          </h2>
          <p className="text-[15px] leading-relaxed text-[#6B5F4F] mt-3 max-w-md mx-auto">
            Stand back until the whole mound breathes inside the frame. Morning light is kindest — no flash, no hurry.
          </p>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFileSelected(e.dataTransfer.files?.[0]);
            }}
            className="mt-8 mx-auto block w-full max-w-md washi-well px-6 py-8 text-center cursor-pointer transition-all hover:border-[#A87F2A]/50 hover:bg-[#EFE7D4]/70 group"
          >
            <span className="mx-auto w-11 h-11 rounded-full bg-[#FFFEFA] border border-[rgba(42,33,24,0.14)] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Upload className="w-5 h-5 text-[#A87F2A]" />
            </span>
            <span className="block text-[15px] text-[#2A2118]">Drop your photo here, or <span className="underline underline-offset-4 decoration-[#A87F2A]/50">browse</span></span>
            <span className="block text-xs text-[#8A7D68] mt-1.5 font-mono">JPG · PNG · WebP, up to 15 MB</span>
            <span className="block text-[11px] text-[#8A7D68]/80 mt-1.5">Photos may be checked by external AI services to confirm they are real.</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              handleFileSelected(e.target.files?.[0]);
              e.target.value = '';
            }}
          />

          <div className="mt-4 flex items-center justify-center gap-5 text-sm">
            <button
              type="button"
              onClick={() => {
                setShowChooser(false);
                openCamera();
              }}
              className="inline-flex items-center gap-1.5 text-[#2A2118] underline underline-offset-4 decoration-[rgba(42,33,24,0.25)] hover:decoration-[#A87F2A] transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4 text-[#A87F2A]" />
              <span>Use camera</span>
            </button>
            <span className="text-[#8A7D68]">·</span>
            <button
              type="button"
              onClick={useSamplePhoto}
              disabled={loadingSample}
              className="inline-flex items-center gap-1.5 text-[#6B5F4F] hover:text-[#2A2118] transition-colors cursor-pointer disabled:opacity-50"
            >
              {loadingSample ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : null}
              <span className="underline underline-offset-4 decoration-[rgba(42,33,24,0.2)]">{loadingSample ? 'Fetching…' : 'Try a sample pile'}</span>
            </button>
          </div>

          <p className="text-xs text-[#8A7D68] mt-7">
            Add your pile photo — you'll describe the pile and check it on the next step.
          </p>
        </div>
      )}

      {/* Photo on file — swap it or remove it */}
      {phase === 'photo' && photo && (
        <div className="washi-sheet p-3 flex items-center gap-3 washi-enter">
          <SafeImage src={photo.dataUrl} alt="Your pile" className="w-16 h-16 rounded-[10px] object-cover border border-[rgba(42,33,24,0.14)] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[#2A2118] truncate">{photo.source === 'camera' ? 'Fresh from the field' : photo.name}</p>
            <p className="font-mono text-[11px] text-[#4A6B4F]">photo ready — describe the pile below, or swap it</p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="font-mono text-[11px] text-[#2A2118] underline underline-offset-2 shrink-0 cursor-pointer"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={() => {
              clearPhoto();
              setErrorMsg(null);
            }}
            className="font-mono text-[11px] text-[#8A7D68] hover:text-[#9C4A42] underline underline-offset-2 shrink-0 cursor-pointer"
          >
            Remove
          </button>
        </div>
      )}

      {/* --- PHASE: ADJUST — shape, grain, season, paper, then Check --- */}
      {phase === 'adjust' && warehouse && (
        <div className="washi-enter">
        <div className="washi-sheet overflow-hidden">
          {/* Small keepsake of the photo — you never lose sight of what you saw */}
          {photo && (
          <div className="flex items-center gap-4 px-5 sm:px-7 pt-5 sm:pt-6">
            <SafeImage src={photo.dataUrl} alt="Your pile" className="w-16 h-16 rounded-[10px] object-cover border border-[rgba(42,33,24,0.14)] shrink-0" />
            <div className="min-w-0">
              <p className="serif-reading text-lg text-[#2A2118] leading-snug">This light will do nicely.</p>
              {(() => {
                const exposure = exposureVerdict(photo.meanLuma);
                const longEdge = Math.max(photo.width, photo.height);
                return (
                  <p className="font-mono text-[11px] text-[#8A7D68] mt-0.5">
                    {photo.width} × {photo.height} · {exposure.label.toLowerCase()} · {photo.sizeKB} KB
                    {longEdge < 800 ? ' · a little soft — the range will breathe wider' : ''}
                  </p>
                );
              })()}
            </div>
            <p className="ml-auto font-mono text-[11px] text-[#8A7D68] hidden sm:block text-right leading-relaxed">
              {liveVolume} m³<br />alive
            </p>
          </div>
          )}
          {/* Camera-section gate: quality readout, right where you describe */}
          <div className="px-5 sm:px-7 pt-4 space-y-3">
            <PhotoGateBanner quality={photoQuality} />
          </div>

          {/* Shape */}
          <div className="px-5 sm:px-7 pt-7">
            <p className="eyebrow-quiet">The shape of the pile</p>
            <p className="serif-reading text-xl text-[#2A2118] mt-1">How tall, how wide — in your own steps</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-5">
              <div>
                <div className="flex justify-between items-baseline mb-2.5">
                  <span className="text-sm text-[#6B5F4F]">Height at the crown</span>
                  <span className="font-mono text-sm text-[#2A2118]">{heightMeters.toFixed(1)} m</span>
                </div>
                <input
                  type="range" min="1.5" max="8.0" step="0.1" value={heightMeters}
                  onChange={(e) => setHeightMeters(parseFloat(e.target.value))}
                  className="washi-range"
                  aria-label="Pile height in meters"
                />
                <div className="flex justify-between font-mono text-[10px] text-[#8A7D68] mt-1.5">
                  <span>1.5</span><span>8.0</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-baseline mb-2.5">
                  <span className="text-sm text-[#6B5F4F]">Footprint across</span>
                  <span className="font-mono text-sm text-[#2A2118]">{baseDiameterMeters.toFixed(1)} m</span>
                </div>
                <input
                  type="range" min="5.0" max="22.0" step="0.1" value={baseDiameterMeters}
                  onChange={(e) => setBaseDiameterMeters(parseFloat(e.target.value))}
                  className="washi-range"
                  aria-label="Pile base diameter in meters"
                />
                <div className="flex justify-between font-mono text-[10px] text-[#8A7D68] mt-1.5">
                  <span>5.0</span><span>22.0</span>
                </div>
              </div>
            </div>
            <p className="font-mono text-[11px] text-[#8A7D68] mt-4">
              ≈ {liveVolume} m³ · {grainLabel()} rests at {GRAIN_BULK_DENSITIES[grainType]?.density.toFixed(3)} t/m³. A gauge rod on site tightens this further.
            </p>
          </div>

          <div className="mx-5 sm:mx-7 my-7 h-px bg-[rgba(42,33,24,0.1)]" />
          <div className="px-5 sm:px-7 space-y-7">
              <div>
                <p className="eyebrow-quiet">What grain is sleeping here</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {warehouse.grainTypes.map((g) => (
                    <button
                      key={g} type="button" onClick={() => setGrainType(g as GrainType)}
                      className={`touch-target px-4 py-2 rounded-full border text-sm transition-all cursor-pointer ${
                        grainType === g
                          ? 'bg-[#2A2118] text-[#F6F1E7] border-[#2A2118]'
                          : 'bg-transparent text-[#6B5F4F] border-[rgba(42,33,24,0.18)] hover:border-[#2A2118]/40'
                      }`}
                    >
                      {GRAIN_BULK_DENSITIES[g as GrainType]?.name || g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="eyebrow-quiet">Which season it slept through</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                  {SEASON_ORDER.map((s) => {
                    const p = SEASON_PROFILES[s];
                    const active = season === s;
                    return (
                      <button
                        key={s} type="button" onClick={() => setSeason(s)}
                        className={`touch-target px-3.5 py-3 rounded-[10px] text-left border transition-all cursor-pointer ${
                          active
                            ? 'bg-[#EFE7D4] border-[#A87F2A]/60'
                            : 'bg-transparent border-[rgba(42,33,24,0.12)] hover:border-[rgba(42,33,24,0.3)]'
                        }`}
                      >
                        <div className="text-sm text-[#2A2118]">{p.name}</div>
                        <div className="text-xs text-[#8A7D68] mt-0.5">{p.storageHint}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between items-baseline mb-2.5">
                    <span className="text-sm text-[#6B5F4F]">Moisture by meter</span>
                    <span className="font-mono text-sm text-[#2A2118]">{humidityPercent.toFixed(1)}%</span>
                  </div>
                  <input
                    type="range" min="8.0" max="20.0" step="0.2" value={humidityPercent}
                    onChange={(e) => setHumidityPercent(parseFloat(e.target.value))}
                    className="washi-range"
                    aria-label="Moisture percent"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-baseline mb-2.5">
                    <span className="text-sm text-[#6B5F4F]">Days at rest</span>
                    <span className="font-mono text-sm text-[#2A2118]">{storageDays} days</span>
                  </div>
                  <input
                    type="range" min="1" max="120" step="1" value={storageDays}
                    onChange={(e) => setStorageDays(parseInt(e.target.value))}
                    className="washi-range"
                    aria-label="Storage duration in days"
                  />
                </div>
              </div>

              <div>
                <p className="eyebrow-quiet">How tightly it has settled</p>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {([
                    { id: 'low', label: 'Freshly poured', sub: 'loose' },
                    { id: 'medium', label: 'Settled', sub: 'natural' },
                    { id: 'high', label: 'Deep & pressed', sub: 'dense' },
                  ] as { id: CompactionLevel; label: string; sub: string }[]).map((c) => (
                    <button
                      key={c.id} type="button" onClick={() => setCompaction(c.id)}
                      className={`touch-target px-2 py-2.5 rounded-[10px] border transition-all cursor-pointer text-center ${
                        compaction === c.id
                          ? 'bg-[#2A2118] text-[#F6F1E7] border-[#2A2118]'
                          : 'bg-transparent border-[rgba(42,33,24,0.14)] hover:border-[rgba(42,33,24,0.32)]'
                      }`}
                    >
                      <span className="block text-[13px] leading-tight">{c.label}</span>
                      <span className={`block font-mono text-[10px] mt-0.5 ${compaction === c.id ? 'opacity-60' : 'text-[#8A7D68]'}`}>{c.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
          </div>

          <div className="mx-5 sm:mx-7 my-7 h-px bg-[rgba(42,33,24,0.1)]" />

          {/* The paper side of the truth */}
          <div className="px-5 sm:px-7 pb-6 sm:pb-7">
            <div className="flex items-baseline justify-between gap-3">
              <p className="eyebrow-quiet">What the paper claims</p>
              <p className="font-mono text-[11px] text-[#8A7D68]">{declaredTouched ? 'your hand' : 'from registry'}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-5 mt-4">
              <div className="sm:col-span-3">
                <label htmlFor="declared-tonnes" className="serif-reading text-xl text-[#2A2118] block">
                  Read it off the receipt
                </label>
                <div className="flex items-baseline gap-2 mt-2 border-b border-[rgba(42,33,24,0.2)] focus-within:border-[#2A2118] transition-colors pb-2">
                  <input
                    id="declared-tonnes"
                    type="number"
                    min="0"
                    step="0.1"
                    inputMode="decimal"
                    value={declaredText}
                    onChange={(e) => {
                      setDeclaredText(e.target.value);
                      setDeclaredTouched(true);
                    }}
                    className="w-full bg-transparent text-4xl serif-reading text-[#2A2118] focus:outline-none placeholder:text-[#8A7D68]/50"
                    placeholder={warehouse.currentDeclaredTonnes.toFixed(1)}
                  />
                  <span className="font-mono text-sm text-[#8A7D68]">tonnes</span>
                </div>
                <p className="font-mono text-[11px] text-[#8A7D68] mt-2">
                  Registry holds {warehouse.currentDeclaredTonnes.toFixed(1)} T · this store can carry {warehouse.capacityTonnes.toFixed(0)} T
                </p>
                {Number.isFinite(parsedDeclared) && parsedDeclared > warehouse.capacityTonnes && (
                  <p className="text-xs text-[#9C4A42] mt-2">
                    That is more than the store can hold — worth a second glance at the receipt.
                  </p>
                )}
              </div>
              <div className="sm:col-span-2">
                <p className="eyebrow-quiet">The receipt itself, if you like</p>
                {receiptPhoto ? (
                  <div className="flex items-center gap-3 washi-well p-2.5 mt-3">
                    <SafeImage src={receiptPhoto.dataUrl} alt="Declared receipt" className="w-14 h-14 rounded-[8px] object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#2A2118] truncate">{receiptPhoto.name}</p>
                      <p className="font-mono text-[11px] text-[#4A6B4F]">kept with this reading</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReceiptPhoto(null)}
                      className="font-mono text-[11px] text-[#8A7D68] hover:text-[#9C4A42] underline underline-offset-2 shrink-0 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => receiptInputRef.current?.click()}
                      className="touch-target mt-3 w-full px-4 py-3 border border-dashed border-[rgba(42,33,24,0.25)] hover:border-[#A87F2A]/60 rounded-[10px] text-sm text-[#6B5F4F] hover:text-[#2A2118] inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Receipt className="w-4 h-4 text-[#A87F2A]" />
                      <span>Photograph the receipt</span>
                    </button>
                    <input
                      ref={receiptInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        handleReceiptSelected(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </>
                )}
                <p className="text-xs text-[#8A7D68] mt-2 leading-relaxed">
                  Entirely optional. The reading never waits for it.
                </p>
              </div>
            </div>
          </div>
        </div>

          {/* Check — the single step forward */}
          <div className="px-5 sm:px-7 pb-6 sm:pb-7 pt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setPhase('photo')}
              className="touch-target px-4 py-2.5 text-sm text-[#6B5F4F] hover:text-[#2A2118] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>← Back to photo</span>
            </button>
            <button
              type="button"
              onClick={handleCheckClick}
              className="touch-target px-7 py-3.5 bg-[#2A2118] hover:bg-[#3A2E20] text-[#F6F1E7] text-sm font-bold rounded-full inline-flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_8px_24px_-8px_rgba(42,33,24,0.5)]"
            >
              <span>Check My Stock</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* --- WORKING — one progress screen until the result appears --- */}
      {phase === 'working' && photo && (
        <div className="washi-sheet overflow-hidden washi-enter">
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="relative bg-[#221A12] p-2 sm:p-3 min-h-64">
              <SafeImage src={photo.dataUrl} alt="Your pile, being checked" className="w-full h-full min-h-64 max-h-[380px] object-cover rounded-[8px] opacity-90 washi-veil" />
              <div className="absolute inset-2 sm:inset-3 rounded-[8px] bg-[#F6F1E7]/10 backdrop-blur-[1px]" />
            </div>
            <div className="px-6 sm:px-8 py-7 sm:py-9 flex flex-col justify-center">
              <p className="eyebrow-quiet">{warehouse?.code} · {warehouse?.receiptNumber}</p>
              <h2 className="serif-reading text-2xl sm:text-[28px] text-[#2A2118] mt-2">
                Checking your image…
              </h2>
              <div className="mt-5 h-[2px] bg-[rgba(42,33,24,0.1)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#2A2118] rounded-full transition-all duration-500"
                  style={{
                    width: workStage === 'quality' ? '12%' : workStage === 'aicheck' ? '32%' : `${32 + (completedSteps / ANALYSIS_STEPS.length) * 68}%`,
                  }}
                />
              </div>
              <div className="mt-4 space-y-2.5">
                {/* 1. Photo quality — fast, local, advisory */}
                <p className="text-[13px] text-[#2A2118]">
                  <span className="inline-block w-5 font-mono text-[11px]">✓</span>
                  Photo received
                  {photoQuality && !photoQuality.ok && (
                    <span className="block text-xs text-[#8A7D68] mt-0.5 ml-5">
                      {photoQuality.reasons.join(' · ')}
                    </span>
                  )}
                </p>
                {/* 2. Real-photo check */}
                {workStage === 'quality' ? (
                  <p className="text-[13px] text-[#8A7D68]/45">
                    <span className="inline-block w-5 font-mono text-[11px]">·</span>
                    Checking this photo is real…
                  </p>
                ) : workStage === 'aicheck' ? (
                  <p className="text-[13px] text-[#2A2118]">
                    <span className="inline-block w-5 font-mono text-[11px] animate-pulse">—</span>
                    Checking this photo is real…
                  </p>
                ) : (
                  <p className="text-[13px] text-[#2A2118]">
                    <span className="inline-block w-5 font-mono text-[11px]">
                      {aiVerdict === 'ai' || aiVerdict === 'inconclusive' ? '!' : '✓'}
                    </span>
                    {aiVerdict === 'ai'
                      ? 'Photo flagged as AI-made — result will be marked unverified'
                      : aiVerdict === 'inconclusive'
                      ? 'Photo check inconclusive — result will be marked unverified'
                      : 'Photo looks real'}
                    {checkerNote && (
                      <span className="block text-xs text-[#A87F2A] mt-0.5 ml-5">{checkerNote}</span>
                    )}
                  </p>
                )}
                {/* 3. Estimate steps */}
                {workStage === 'estimate' && ANALYSIS_STEPS.map((label, i) => {
                  const done = i < completedSteps;
                  const active = i === activeStep;
                  return (
                    <p
                      key={label}
                      className={`text-[13px] transition-all duration-300 ${done ? 'text-[#8A7D68]' : active ? 'text-[#2A2118]' : 'text-[#8A7D68]/45'}`}
                    >
                      <span className="inline-block w-5 font-mono text-[11px]">{done ? '✓' : active ? '—' : '·'}</span>
                      {label}{active ? '…' : ''}
                    </p>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  runTokenRef.current += 1;
                  setPhase('adjust');
                  setWorkStage('quality');
                  setCheckerNote(null);
                }}
                className="mt-6 self-start text-sm text-[#8A7D68] hover:text-[#9C4A42] underline underline-offset-4 transition-colors cursor-pointer"
              >
                Stop — back to details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- PHASE: RESULT --- */}
      {phase === 'result' && estimationResult && photo && warehouse && (
        <div className="washi-enter-slow space-y-0">
          {usedFallback && (
            <div className="washi-sheet px-4 py-3 mb-5 flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#A87F2A] shrink-0" />
              <span className="text-sm text-[#2A2118]">We could not reach the calculation engine, so this is a gentle demo reading from your own volume. Re-read when you are back online.</span>
            </div>
          )}

          {/* The finding — what was analyzed → discovered */}
          <div className="washi-sheet px-6 sm:px-10 pt-8 sm:pt-10 pb-8 text-center overflow-hidden">
            <p className="eyebrow-quiet">{warehouse.code} · {warehouse.receiptNumber} · {SEASON_PROFILES[season].name}</p>
            {(aiVerdict === 'ai' || aiVerdict === 'inconclusive') ? (
              <>
                <p className="mt-3 inline-flex items-center gap-2 text-[13px] font-bold text-white bg-[#9C4A42] px-4 py-2 rounded-full">
                  <span>⚠️ UNVERIFIED</span>
                </p>
                <h2 className="serif-reading text-[#2A2118] text-[26px] sm:text-3xl mt-3">
                  This image could not be confirmed as genuine and should not be used as audit evidence.
                </h2>
                <p className="font-mono text-sm text-[#2A2118] mt-4">
                  Your receipt says {runDeclared.toFixed(1)} T
                </p>
                <p className="font-mono text-xs text-[#8A7D68]/70 line-through mt-2">
                  estimated {estimationResult.centralEstimateTonnes.toFixed(1)} T
                  ({estimationResult.rangeLowTonnes.toFixed(1)}–{estimationResult.rangeHighTonnes.toFixed(1)} T)
                </p>
                <p className="font-mono text-[11px] text-[#8A7D68] mt-1">
                  untrusted estimate — not evidence
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 inline-flex items-center gap-2 text-[13px] text-[#6B5F4F]">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: verdictTone.dot }} />
                  {verdictTone.word} · {estimationResult.confidencePercent}% sure
                </p>
                <h2 className="serif-reading text-[#2A2118] text-[26px] sm:text-3xl mt-2">
                  {verdictTone.sentence}
                </h2>
                <div className="flex items-baseline justify-center gap-2 mt-4">
                  <span className="serif-reading text-[#2A2118] text-6xl sm:text-7xl leading-none">
                    {estimationResult.centralEstimateTonnes.toFixed(1)}
                  </span>
                  <span className="font-mono text-sm text-[#8A7D68]">tonnes</span>
                </div>
                <p className="font-mono text-xs text-[#8A7D68] mt-3">
                  likely between {estimationResult.rangeLowTonnes.toFixed(1)} and {estimationResult.rangeHighTonnes.toFixed(1)} T
                </p>
              </>
            )}

            {/* Why it matters — the quiet ledger */}
            <div className="max-w-md mx-auto mt-7 pt-6 border-t border-[rgba(42,33,24,0.12)] grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="eyebrow-quiet">On paper</p>
                <p className="font-mono text-[15px] text-[#2A2118] mt-1">{runDeclared.toFixed(1)} T</p>
              </div>
              <div>
                <p className="eyebrow-quiet">Difference</p>
                {(aiVerdict === 'ai' || aiVerdict === 'inconclusive') ? (
                  <p className="font-mono text-[15px] mt-1 text-[#8A7D68]/70">withheld</p>
                ) : (
                  <p className="font-mono text-[15px] mt-1" style={{ color: Math.abs(diff) < 0.5 ? '#4A6B4F' : diff < 0 ? '#9C4A42' : '#A87F2A' }}>
                    {diff > 0 ? '+' : ''}{diff.toFixed(1)} T
                  </p>
                )}
              </div>
              <div>
                <p className="eyebrow-quiet">Volume seen</p>
                <p className="font-mono text-[15px] text-[#2A2118] mt-1">{estimationResult.volumeM3.toFixed(0)} m³</p>
              </div>
            </div>
            <p className="text-xs text-[#8A7D68] mt-4">
              {(aiVerdict === 'ai' || aiVerdict === 'inconclusive')
                ? `Paper says ${runDeclared.toFixed(1)} T (${declaredTouched ? 'your hand' : 'registry'}). The pile could not be verified — no estimate counts as evidence.`
                : `Paper says ${runDeclared.toFixed(1)} T (${declaredTouched ? 'your hand' : 'registry'}). The pile suggests ${estimationResult.centralEstimateTonnes.toFixed(1)} T.`}
            </p>

          {/* Full breakdown lives in the dedicated tabs */}
          <div className="mt-8 washi-sheet px-5 py-4 text-center">
            <p className="text-sm text-[#2A2118]">Want the full breakdown of this reading?</p>
            <p className="font-mono text-[11px] text-[#8A7D68] mt-1">
              See the Reverse Proof, Geometry and Bankable tabs — same pile, full detail.
            </p>
          </div>

          {/* What was analyzed — the pile, large and clear */}
          <div className="mt-8 text-left">
            <p className="eyebrow-quiet mb-2">Whole pile → geometry → calculation</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <figure>
              <div className="rounded-[12px] overflow-hidden border border-[rgba(42,33,24,0.12)] bg-[#221A12] p-1.5">
                <SafeImage src={photo.dataUrl} alt="The pile you photographed" className="w-full h-72 sm:h-80 object-cover rounded-[8px]" />
              </div>
              <figcaption className="font-mono text-[11px] text-[#8A7D68] mt-2">The pile · {photo.sizeKB} KB · {photo.width}×{photo.height}</figcaption>
            </figure>
            <figure>
              {receiptPhoto ? (
                <>
                  <div className="rounded-[12px] overflow-hidden border border-[rgba(42,33,24,0.12)] bg-[#FFFEFA] p-1.5">
                    <SafeImage src={receiptPhoto.dataUrl} alt="The paper receipt" className="w-full h-52 object-cover rounded-[8px]" />
                  </div>
                  <figcaption className="font-mono text-[11px] text-[#8A7D68] mt-2">The paper · kept together</figcaption>
                </>
              ) : (
                <div className="rounded-[12px] border border-dashed border-[rgba(42,33,24,0.2)] h-52 flex items-center justify-center px-6 text-center">
                  <p className="text-sm text-[#8A7D68] leading-relaxed">No receipt photo — the reading stands on the pile alone, against {runDeclared.toFixed(1)} T {declaredTouched ? 'in your hand' : 'in the registry'}.</p>
                </div>
              )}
            </figure>
          </div>
          </div>

          {/* Why it matters — in plain words */}
          <div className="text-left mt-8 space-y-4">
            <p className="text-[15px] leading-relaxed text-[#2A2118]">{estimationResult.explanatoryReason}</p>
            <div className="flex items-start gap-2.5 pt-4 border-t border-[rgba(42,33,24,0.12)]">
              <ShieldCheck className="w-4 h-4 text-[#A87F2A] shrink-0 mt-0.5" />
              <p className="text-sm leading-relaxed text-[#6B5F4F]">{estimationResult.auditRecommendation}</p>
            </div>
            <details className="group">
              <summary className="font-mono text-[11px] text-[#8A7D68] hover:text-[#2A2118] cursor-pointer list-none underline underline-offset-4 decoration-[rgba(42,33,24,0.2)]">
                How this number was found
              </summary>
              <dl className="mt-3 space-y-1.5 text-[13px]">
                {[
                  [`${grainLabel()}`, `${estimationResult.volumeM3.toFixed(1)} m³ at ${estimationResult.effectiveDensity.toFixed(3)} t/m³`],
                  [`${SEASON_PROFILES[season].name}`, `${humidityPercent.toFixed(1)}% · ${compaction} · ${storageDays} days`],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3">
                    <dt className="text-[#6B5F4F]">{k}</dt>
                    <dd className="font-mono text-xs text-[#2A2118] text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </div>
          </div>

          {/* What next — calm, unhurried */}
          <div className="mt-6">
          {savedFarmerCode && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-[12px] px-5 py-4 mb-4 text-center space-y-2">
              <p className="text-sm text-[#2A2118]">✅ Saved to your records.</p>
              <p className="font-mono text-2xl font-bold tracking-widest text-[#2A2118]">{savedFarmerCode}</p>
              {savedVerifyId ? (
                <div className="pt-1 space-y-2">
                  {savedQr ? (
                    <img src={savedQr} alt="Verification QR code" className="mx-auto w-40 h-40 rounded-lg border border-[#3D3226]/15 bg-white p-1" />
                  ) : (
                    <p className="font-mono text-[11px] text-[#8A7D68]">Preparing QR…</p>
                  )}
                  <p className="font-mono text-[11px] text-[#2A2118] break-all">{savedVerifyId}</p>
                  <p className="text-xs text-[#2B2016]/60">
                    Scan to verify this check against the true stored record — an edited report can't fake it.
                  </p>
                </div>
              ) : (
                <p className="font-mono text-[11px] text-[#A87F2A]">
                  Verification QR pending — reconnect and save again to get it.
                </p>
              )}
              <button
                type="button"
                onClick={onViewRecords}
                className="touch-target text-sm text-[#2A2118] underline underline-offset-4 decoration-[#4A6B4F]/50 cursor-pointer"
              >
                See it in Records
              </button>
            </div>
          )}
          {farmerSaveMsg && (
            <div className="bg-red-50 border border-[#B5574F]/40 rounded-[12px] px-5 py-3 mb-4 text-sm text-[#B23A32]">
              {farmerSaveMsg}
            </div>
          )}
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            <button
              type="button"
              onClick={handleSaveToRecords}
              disabled={isSavingFarmer}
              title="Save this completed audit to your Records"
              className="touch-target flex-1 px-6 py-3.5 bg-[#2A2118] hover:bg-[#3A2E20] text-[#F6F1E7] text-sm font-bold rounded-full inline-flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_8px_24px_-8px_rgba(42,33,24,0.5)] disabled:opacity-50"
            >
              {isSavingFarmer ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BookmarkPlus className="w-4 h-4" />}
              <span>{isSavingFarmer ? 'Saving…' : 'Save to Records'}</span>
            </button>
            <div className="flex items-center justify-center gap-5">
                <button
                  type="button"
                  onClick={handlePrintReport}
                  className="touch-target inline-flex items-center gap-1.5 text-sm text-[#6B5F4F] hover:text-[#2A2118] underline underline-offset-4 decoration-[rgba(42,33,24,0.2)] transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  title="Download audit as CSV"
                  className="touch-target inline-flex items-center gap-1.5 text-sm text-[#6B5F4F] hover:text-[#2A2118] underline underline-offset-4 decoration-[rgba(42,33,24,0.2)] transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>CSV</span>
                </button>
              </div>
            </div>
          <button
            type="button"
            onClick={resetWorkflow}
            className="mx-auto mt-5 touch-target px-5 py-2.5 text-sm text-[#8A7D68] hover:text-[#2A2118] inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Begin another pile</span>
          </button>
          </div>
        </div>
      )}

      {/* --- Camera — held gently --- */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2A2118]/60 backdrop-blur-sm washi-veil">
          <div className="washi-sheet overflow-hidden max-w-lg w-full washi-enter">
            <div className="px-5 py-3.5 border-b border-[rgba(42,33,24,0.12)] flex items-center justify-between">
              <span className="eyebrow-quiet">
                Camera
              </span>
              <button
                type="button"
                onClick={() => { stopCamera(); setCameraOpen(false); }}
                className="text-[#6B5F4F] hover:text-[#2A2118] cursor-pointer transition-colors"
                aria-label="Close camera"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {cameraError ? (
                <div className="washi-well px-4 py-3.5 text-sm text-[#2A2118] leading-relaxed">
                  {cameraError}
                </div>
              ) : (
                <div className="relative rounded-[10px] overflow-hidden bg-[#221A12] aspect-4/3">
                  <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                  {cameraStarting && (
                    <div className="absolute inset-0 flex items-center justify-center text-[#F6F1E7] text-sm gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Waking the camera…</span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2.5">
                {!cameraError && (
                  <button
                    type="button"
                    onClick={captureFromCamera}
                    disabled={cameraStarting}
                    className="touch-target flex-1 px-5 py-3 bg-[#2A2118] hover:bg-[#3A2E20] text-[#F6F1E7] text-sm rounded-full inline-flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Keep this frame</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { stopCamera(); setCameraOpen(false); }}
                  className="touch-target px-4 py-3 text-sm text-[#6B5F4F] hover:text-[#2A2118] transition-colors cursor-pointer"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};
