import React, { useState, useRef, useEffect } from 'react';
import {
  Warehouse,
  Verification,
  EstimationResult,
  GeometryInputs,
  ContextInputs,
  GrainType,
  Season,
  CompactionLevel,
} from '../types.js';
import { SEASON_PROFILES, SEASON_ORDER } from '../seasonProfiles.js';
import { GRAIN_BULK_DENSITIES, SAMPLE_GRAIN_IMAGES } from '../constants.js';
import { SafeImage } from './SafeImage.js';
import { previewEstimate, submitVerification, fetchInspectorProfile, fetchGovChecksByVerification, postGovCheck, type GovCheckInput } from '../services/api.js';
import type { GovCheck } from '../types.js';
import { buildVerifyUrl, govCheckInputFromVerification } from '../lib/verify.js';
import QRCode from 'qrcode';
import {
  bankableTonnes,
  reposeDeg,
  reposeVerdict,
  reverseProof,
} from '../proofMath.js';
import { useSharedAudit, type PhotoState } from './proof/SharedAuditContext.js';
import {
  BankableBlock,
  DetectReportCard,
  PhotoGateBanner,
  PhysicsCheckBlock,
  ReverseProofBlock,
} from './proof/ProofBlocks.js';
import {
  Camera,
  Upload,
  X,
  Check,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Printer,
  Download,
  RefreshCw,
  ShieldCheck,
  Receipt,
} from 'lucide-react';

interface NewAuditTabProps {
  warehouses: Warehouse[];
  currentAuditor: { id: string; name: string; role: string };
  onVerificationSaved: (v: Verification) => void;
}

type Phase = 'idle' | 'preview' | 'measure' | 'analyzing' | 'result';

// Quiet progress — kept in code as five human moments, shown as a hairline.
const STAGES = ['Photograph', 'Confirm', 'Describe', 'Reading', 'Finding'];
const STAGE_HINT = [
  'Begin with the pile itself',
  'Make sure it is the right frame',
  'Tell us what the photo cannot',
  'Give it a moment',
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

export const NewAuditTab: React.FC<NewAuditTabProps> = ({
  warehouses,
  currentAuditor,
  onVerificationSaved,
}) => {
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [phase, setPhase] = useState<Phase>('idle');
  // Shared pile: photo, gates, geometry and claim live here so the
  // Reverse / Geometry / Bankable tabs always see the same audit.
  const {
    photo, setPhoto,
    photoQuality, clearPhoto, refreshPhotoGate,
    detectPrimary, detectCross, detectPending, runDetection,
    heightMeters, setHeightMeters,
    baseDiameterMeters, setBaseDiameterMeters,
    grainType, setGrainType,
    season, setSeason,
    humidityPercent, setHumidityPercent,
    compaction, setCompaction,
    storageDays, setStorageDays,
    declaredText, setDeclaredText,
    declaredTouched, setDeclaredTouched,
    priceText, setPriceText,
    agentType, setAgentType,
    farmerName, setFarmerName,
    loanRef, setLoanRef,
    bankWarehouseName, setBankWarehouseName,
    govWarehouseRef, setGovWarehouseRef,
    govRegion, setGovRegion,
    govScheme, setGovScheme,
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
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedVerification, setSavedVerification] = useState<Verification | null>(null);
  const [loadingSample, setLoadingSample] = useState<boolean>(false);
  // Permanent QR record (server-stored gov-check). One QR per audit, minted after confirm.
  const [govCheck, setGovCheck] = useState<GovCheck | null>(null);
  const [govCheckPending, setGovCheckPending] = useState<boolean>(false);
  const [govCheckError, setGovCheckError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const govInputRef = useRef<GovCheckInput | null>(null);

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
      setSavedVerification(null);
      setGovCheck(null);
      setQrDataUrl(null);
      setGovCheckError(null);
      setGovCheckPending(false);
      govInputRef.current = null;
      setRunDeclared(0);
      setCompletedSteps(0);
      setActiveStep(-1);
      setErrorMsg(null);
      setShowChooser(false);
      setPhase('idle');
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

  // Reuse saved inspector profile: default the audit context to the inspector's type once.
  const profileAppliedRef = useRef(false);
  useEffect(() => {
    if (profileAppliedRef.current) return;
    profileAppliedRef.current = true;
    fetchInspectorProfile()
      .then((p) => {
        if (!p) return;
        setAgentType(p.inspectorType === 'government' ? 'government' : 'bank');
      })
      .catch(() => {});
  }, []);

  const resetWorkflow = () => {
    runTokenRef.current += 1;
    stopCamera();
    setCameraOpen(false);
    setCameraError(null);
    clearPhoto();
    setPhase('idle');
    setShowChooser(false);
    setErrorMsg(null);
    setCompletedSteps(0);
    setActiveStep(-1);
    setEstimationResult(null);
    setUsedFallback(false);
    setIsSaving(false);
    setSavedVerification(null);
    setGovCheck(null);
    setQrDataUrl(null);
    setGovCheckError(null);
    setGovCheckPending(false);
    govInputRef.current = null;
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
      setPhase('preview');
      setShowChooser(false);
      void refreshPhotoGate(next); void runDetection(next);
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
      void refreshPhotoGate(next); void runDetection(next);
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
      void refreshPhotoGate(fallback); void runDetection(fallback);
    } finally {
      setLoadingSample(false);
      setPhase('preview');
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
      setPhase('preview');
      setShowChooser(false);
      setErrorMsg(null);
      void refreshPhotoGate(next); void runDetection(next);
    } catch {
      setCameraError('Could not capture a frame on this device. Try “Upload from Device”.');
    }
  };

  const runAnalysis = async () => {
    if (!warehouse || !photo || phase === 'analyzing') return;
    const token = ++runTokenRef.current;
    const isStale = () => token !== runTokenRef.current;

    setErrorMsg(null);
    const declared = parseFloat(declaredText);
    if (!Number.isFinite(declared) || declared <= 0) {
      setErrorMsg('Enter the declared stock in tonnes (a number above 0) — read it off the paper receipt.');
      return;
    }
    setUsedFallback(false);
    setRunDeclared(declared);
    setPhase('analyzing');
    setCompletedSteps(0);
    setActiveStep(0);

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

  const handleSaveAudit = async () => {
    if (!warehouse || !photo || !estimationResult || isSaving) return;
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const saved = await submitVerification({
        warehouseId: warehouse.id,
        photoUrl: photo.dataUrl,
        mediaType: 'photo',
        referenceScale: 'none',
        geometry: {
          pileType: 'cone',
          heightMeters,
          baseDiameterMeters,
          calculatedVolumeM3: liveVolume,
          measurementMethod: 'visual_estimate',
        },
        context: {
          grainType,
          season,
          humidityPercent,
          compaction,
          storageDays,
        },
        declaredTonnes: runDeclared,
        receiptPhotoUrl: receiptPhoto?.dataUrl,
        declaredSource: declaredTouched ? 'manual' : 'registry',
        runBy: currentAuditor,
        agentType,
        photoVerdict: {
          primary: detectPrimary,
          cross: detectCross,
        },
        bank: agentType === 'bank' ? {
          farmerName: farmerName.trim() || undefined,
          loanRef: loanRef.trim() || undefined,
          warehouseName: (bankWarehouseName.trim() || warehouse.name).slice(0, 160) || undefined,
        } : undefined,
        gov: agentType === 'government' ? {
          warehouseRef: (govWarehouseRef.trim() || warehouse.code).slice(0, 160) || undefined,
          region: (govRegion.trim() || `${warehouse.district}, ${warehouse.state}`).slice(0, 160) || undefined,
          scheme: govScheme,
        } : undefined,
      });
      setSavedVerification(saved);
      onVerificationSaved(saved);
      // Mint the permanent QR record for every saved audit (bank + government).
      // The QR points at the server-stored result — never at a file.
      const govInput: GovCheckInput = {
        inspectorName: (agentType === 'bank'
          ? farmerName.trim() || currentAuditor.name
          : currentAuditor.name).slice(0, 120),
        location: (agentType === 'government'
          ? govRegion.trim() || (warehouse ? `${warehouse.district}, ${warehouse.state}` : '')
          : warehouse ? `${warehouse.district}, ${warehouse.state}` : '').slice(0, 200),
        storageName: warehouse?.name,
        declaredTonnes: runDeclared,
        estCentral: estimationResult.centralEstimateTonnes,
        estLow: estimationResult.rangeLowTonnes,
        estHigh: estimationResult.rangeHighTonnes,
        volumeM3: estimationResult.volumeM3,
        status: estimationResult.status,
        checkerNote: estimationResult.auditRecommendation,
        photoDataUrl: photo.dataUrl,
        photoVerdict: { primary: detectPrimary, cross: detectCross },
        verificationId: saved.id,
        agentType,
        scheme: agentType === 'government' ? govScheme : undefined,
      };
      govInputRef.current = govInput;
      setGovCheck(null);
      setQrDataUrl(null);
      setGovCheckError(null);
      setGovCheckPending(true);
      try {
        const record = await postGovCheck(govInput);
        setGovCheck(record);
        try {
          setQrDataUrl(await QRCode.toDataURL(buildVerifyUrl(record.id), { width: 220, margin: 1 }));
        } catch {
          setGovCheckError('QR image failed to render — the stored record is safe; retry to regenerate it.');
        }
      } catch (err: any) {
        setGovCheckError(err?.message || 'QR record save failed — verification is kept; retry for the QR.');
      } finally {
        setGovCheckPending(false);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not save this audit to the registry. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const retryGovCheck = async () => {
    const input = govInputRef.current;
    if (!input) return;
    setGovCheckError(null);
    setGovCheckPending(true);
    try {
      const record = await postGovCheck(input);
      setGovCheck(record);
      try {
        setQrDataUrl(await QRCode.toDataURL(buildVerifyUrl(record.id), { width: 220, margin: 1 }));
      } catch {
        setGovCheckError('QR image failed to render — the stored record is safe; retry to regenerate it.');
      }
    } catch (err: any) {
      setGovCheckError(err?.message || 'QR record save failed — retry when connected.');
    } finally {
      setGovCheckPending(false);
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
    const isGov = agentType === 'government';
    const reportTitle = isGov ? 'Public Stock Audit Report' : 'Collateral Stock Verification Report';
    const rows = [
      [reportTitle, new Date().toISOString()],
      ['Verify URL (true stored result)', govCheck ? buildVerifyUrl(govCheck.id) : 'No QR record minted yet — record the reading first'],
      ['Agent type', isGov ? 'Government Agent' : 'Bank Agent'],
      ...(isGov
        ? [
          ['Warehouse ID', govWarehouseRef.trim() || warehouse.code],
          ['Region', govRegion.trim() || `${warehouse.district}, ${warehouse.state}`],
          ['Scheme', govScheme],
        ] as string[][]
        : [
          ['Farmer name', farmerName.trim() || warehouse.borrowerName || ''],
          ['Loan / reference ID', loanRef.trim() || warehouse.loanReference || ''],
          ['Warehouse', bankWarehouseName.trim() || warehouse.name],
        ] as string[][]),
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
      ['AI-image primary', detectPrimary ? `${detectPrimary.label} (AI ${detectPrimary.probability_ai.toFixed(3)} / real ${detectPrimary.probability_real.toFixed(3)} / conf ${detectPrimary.confidence.toFixed(3)})` : (detectPending ? 'reading…' : 'detector unavailable')],
      ['AI-image cross-check', detectCross ? `${detectCross.label} (AI ${detectCross.probability_ai.toFixed(3)} / real ${detectCross.probability_real.toFixed(3)} / conf ${detectCross.confidence.toFixed(3)})` : (detectPending ? 'reading…' : 'detector unavailable')],
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
      ['Auditor', `${currentAuditor.name} (${currentAuditor.role})`],
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

  const handlePrintReport = async () => {
    if (!warehouse || !photo || !estimationResult) return;
    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) {
      setErrorMsg('Pop-up blocker stopped the report window. Allow pop-ups, then try Export again.');
      return;
    }
    // QR for the printed report: reuse the minted record, else look up or mint one now.
    let qrBlock = '';
    try {
      let gcId = govCheck?.id || '';
      if (!gcId && savedVerification) {
        try {
          const found = await fetchGovChecksByVerification(savedVerification.id);
          if (found && found.length > 0) gcId = found[0].id;
        } catch { gcId = ''; }
      }
      if (!gcId && savedVerification) {
        const minted = await postGovCheck(govCheckInputFromVerification(savedVerification, warehouse));
        gcId = minted.id;
        setGovCheck(minted);
      }
      if (gcId) {
        const img = await QRCode.toDataURL(buildVerifyUrl(gcId), { width: 220, margin: 1 });
        qrBlock = `<div class="label mono">Verification QR · scans to the true stored result</div>`
          + `<img src="${img}" alt="Verify ${gcId}" style="max-width:180px" />`
          + `<div class="mono">${buildVerifyUrl(gcId)}</div>`;
      }
    } catch {
      qrBlock = '';
    }
    const diff = estimationResult.centralEstimateTonnes - runDeclared;
    const revP = reverseProof(runDeclared, baseDiameterMeters, heightMeters, {
      grainType, season, humidityPercent, compaction, storageDays,
    });
    const geoP = reposeVerdict(heightMeters, baseDiameterMeters);
    const bankP = bankableTonnes(
      estimationResult.rangeLowTonnes, estimationResult.confidencePercent, humidityPercent, true,
    );
    const isGovPrint = agentType === 'government';
    const printTitle = isGovPrint ? 'Public Stock Audit Report' : 'Collateral Stock Verification Report';
    const printSub = isGovPrint
      ? `Government audit · ${(govWarehouseRef.trim() || warehouse.code)} · ${govRegion.trim() || `${warehouse.district}, ${warehouse.state}`} · Scheme: ${govScheme}`
      : `Collateral verification${farmerName.trim() ? ` · Farmer: ${farmerName.trim()}` : ''}${loanRef.trim() ? ` · Loan ref: ${loanRef.trim()}` : ''}`;
    popup.document.write(`<!doctype html>
<html><head><title>${printTitle} — ${warehouse.code}</title>
<style>
body{font-family:Georgia,serif;color:#2B2016;max-width:720px;margin:32px auto;padding:0 24px}
.mono{font-family:'Courier New',monospace;font-size:12px}
h1{font-size:28px;margin:4px 0 0}.hero{font-size:56px;font-weight:bold;margin:8px 0}
table{width:100%;border-collapse:collapse;margin:16px 0;font-family:'Courier New',monospace;font-size:13px}
td{border:1px solid #ccc;padding:8px 10px}.label{color:#777;text-transform:uppercase;font-size:11px}
img{max-width:100%;border:1px solid #ccc;margin:12px 0}
.footer{margin-top:24px;border-top:1px solid #ccc;padding-top:12px}
</style></head><body>
<div class="mono" style="color:#B98A2E;letter-spacing:2px">STOCKPROOF · ${printTitle.toUpperCase()}</div>
<div class="mono" style="margin-top:4px">${printSub}</div>
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
<tr><td class="label">AI-image primary</td><td>${detectPrimary ? `${detectPrimary.label} (AI ${detectPrimary.probability_ai.toFixed(3)})` : 'detector unavailable'}</td></tr>
<tr><td class="label">AI-image cross-check</td><td>${detectCross ? `${detectCross.label} (AI ${detectCross.probability_ai.toFixed(3)})` : 'detector unavailable'}</td></tr>
</table>
<div class="label mono">Visual Evidence</div>
<img src="${photo.dataUrl}" alt="Audit evidence" />
${qrBlock}
<p><strong>Audit reasoning:</strong> ${estimationResult.explanatoryReason}</p>
<p><strong>Recommendation:</strong> ${estimationResult.auditRecommendation}</p>
<div class="footer mono">Run by ${currentAuditor.name} · ${new Date().toLocaleString()} · The system supports the auditor — it does not replace the physical audit.</div>
</body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const grainLabel = () => GRAIN_BULK_DENSITIES[grainType]?.name || grainType;

  // Quiet position in the walk: photograph(0) → confirm(1) → describe(2) → reading(3) → finding(4).
  const stageIndex =
    phase === 'preview'
      ? 1
      : phase === 'measure'
      ? 2
      : phase === 'analyzing'
      ? 3
      : phase === 'result'
      ? 4
      : 0;

  if (warehouses.length === 0) {
    return (
      <div className="washi-sheet p-10 text-center">
        <p className="serif-reading text-xl text-[var(--ink)]">Preparing your bench…</p>
        <p className="text-sm text-[var(--ink-soft)] mt-2">The registry is still waking up. This will only take a moment.</p>
      </div>
    );
  }

  const declared = warehouse?.currentDeclaredTonnes ?? 0;
  const diff = estimationResult ? estimationResult.centralEstimateTonnes - runDeclared : 0;
  const verdictTone =
    !estimationResult || Math.abs(diff) < 0.5
      ? { dot: 'var(--moss)', word: 'Within range', sentence: 'Sits comfortably within the expected range' }
      : diff < 0
      ? { dot: 'var(--danger)', word: 'Below declared', sentence: 'Reads lighter than what was declared' }
      : { dot: 'var(--gold)', word: 'Above declared', sentence: 'Reads a little heavier than declared' };

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
      <div className="h-px bg-[var(--hairline-soft)] relative overflow-hidden rounded-full">
        <div
          className="absolute inset-y-0 left-0 bg-[var(--ink)] transition-all duration-700 ease-out rounded-full"
          style={{ width: `${((stageIndex + 1) / STAGES.length) * 100}%` }}
        />
      </div>

      {/* Where we are */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <div className="max-w-xl">
          <h1 className="serif-reading text-[var(--ink)] text-3xl sm:text-4xl">
            {phase === 'result' ? 'What the pile holds' : phase === 'analyzing' ? 'Reading your photo' : phase === 'measure' ? 'Tell us what the photo cannot' : photo ? 'Is this the right frame?' : 'Begin with the pile itself'}
          </h1>
          <p className="text-[15px] leading-relaxed text-[var(--ink-soft)] mt-2">
            {phase === 'result'
              ? `A careful reading of ${warehouse?.name || 'this store'}, held against its paper receipt.`
              : phase === 'measure'
              ? 'Your eye completes what the camera cannot — shape, season, and the way grain settles.'
              : photo
              ? 'Look closely. If the whole pile breathes inside the frame, we can begin.'
              : `For ${warehouse?.name || 'this warehouse'} — one honest photograph is enough to start.`}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-[var(--ink-soft)] shrink-0">
          <span className="eyebrow-quiet">Store</span>
          <select
            value={warehouse?.id}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="bg-[var(--sheet)] border border-[var(--hairline)] rounded-[10px] px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--gold-deep)] max-w-60 cursor-pointer"
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
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--clay)] shrink-0" />
          <span className="text-sm leading-relaxed text-[var(--ink)]">{errorMsg}</span>
        </div>
      )}

      {/* --- AGENT SELECTION — who is this audit for? (Inspector Panel split) --- */}
      <div className="washi-sheet px-5 sm:px-6 py-5 washi-enter">
        <p className="eyebrow-quiet">Who is this audit for?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          <button
            type="button"
            onClick={() => setAgentType('bank')}
            className={`touch-target px-4 py-3 rounded-[10px] border text-left transition-all cursor-pointer ${
              agentType === 'bank'
                ? 'bg-[var(--card-ink-bg)] text-[var(--paper)] border-[var(--ink)]'
                : 'bg-transparent border-[var(--hairline)] hover:border-[var(--hairline-strong)]'
            }`}
          >
            <span className="block text-sm">🏦 Bank Agent</span>
            <span className={`block text-xs mt-0.5 ${agentType === 'bank' ? 'opacity-70' : 'text-[var(--ink-faint)]'}`}>Collateral verification · saves to Bank Checks</span>
          </button>
          <button
            type="button"
            onClick={() => setAgentType('government')}
            className={`touch-target px-4 py-3 rounded-[10px] border text-left transition-all cursor-pointer ${
              agentType === 'government'
                ? 'bg-[var(--card-ink-bg)] text-[var(--paper)] border-[var(--ink)]'
                : 'bg-transparent border-[var(--hairline)] hover:border-[var(--hairline-strong)]'
            }`}
          >
            <span className="block text-sm">🏛️ Government Agent</span>
            <span className={`block text-xs mt-0.5 ${agentType === 'government' ? 'opacity-70' : 'text-[var(--ink-faint)]'}`}>Public stock audit · saves to Government Audit</span>
          </button>
        </div>
        {agentType === 'bank' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <label className="block">
              <span className="text-xs text-[var(--ink-soft)]">Farmer name (optional)</span>
              <input
                type="text"
                value={farmerName}
                onChange={(e) => setFarmerName(e.target.value)}
                placeholder="e.g. Ramesh Patel"
                className="mt-1 w-full bg-transparent border-b border-[var(--hairline)] focus:outline-none focus:border-[var(--ink)] text-sm py-1.5"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--ink-soft)]">Loan / reference ID (optional)</span>
              <input
                type="text"
                value={loanRef}
                onChange={(e) => setLoanRef(e.target.value)}
                placeholder="e.g. AGRI-LN-772901"
                className="mt-1 w-full bg-transparent border-b border-[var(--hairline)] focus:outline-none focus:border-[var(--ink)] text-sm py-1.5"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--ink-soft)]">Warehouse name/location (optional)</span>
              <input
                type="text"
                value={bankWarehouseName}
                onChange={(e) => setBankWarehouseName(e.target.value)}
                placeholder={warehouse?.name || 'Warehouse'}
                className="mt-1 w-full bg-transparent border-b border-[var(--hairline)] focus:outline-none focus:border-[var(--ink)] text-sm py-1.5"
              />
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <label className="block">
              <span className="text-xs text-[var(--ink-soft)]">Warehouse ID (optional)</span>
              <input
                type="text"
                value={govWarehouseRef}
                onChange={(e) => setGovWarehouseRef(e.target.value)}
                placeholder={warehouse?.code || 'WH ID'}
                className="mt-1 w-full bg-transparent border-b border-[var(--hairline)] focus:outline-none focus:border-[var(--ink)] text-sm py-1.5"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--ink-soft)]">Region (optional)</span>
              <input
                type="text"
                value={govRegion}
                onChange={(e) => setGovRegion(e.target.value)}
                placeholder={warehouse ? `${warehouse.district}, ${warehouse.state}` : 'Region'}
                className="mt-1 w-full bg-transparent border-b border-[var(--hairline)] focus:outline-none focus:border-[var(--ink)] text-sm py-1.5"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--ink-soft)]">Scheme / purpose</span>
              <select
                value={govScheme}
                onChange={(e) => setGovScheme(e.target.value as 'Public Distribution System' | 'Buffer Stock' | 'Other')}
                className="mt-1 w-full bg-transparent border-b border-[var(--hairline)] focus:outline-none focus:border-[var(--ink)] text-sm py-1.5 cursor-pointer"
              >
                <option value="Public Distribution System">Public Distribution System</option>
                <option value="Buffer Stock">Buffer Stock</option>
                <option value="Other">Other</option>
              </select>
            </label>
          </div>
        )}
      </div>

      {/* --- PHASE: IDLE — big upload card --- */}
      {phase === 'idle' && (
        <div className="washi-sheet px-6 py-10 sm:px-12 sm:py-14 text-center washi-enter">
          <p className="eyebrow-quiet">One photograph · {warehouse?.code} · {declared.toFixed(0)} T on paper</p>
          <h2 className="serif-reading text-3xl sm:text-4xl text-[var(--ink)] mt-3 max-w-md mx-auto">
            Photograph the pile, just as it rests
          </h2>
          <p className="text-[15px] leading-relaxed text-[var(--ink-soft)] mt-3 max-w-md mx-auto">
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
            className="mt-8 mx-auto block w-full max-w-md washi-well px-6 py-8 text-center cursor-pointer transition-all hover:border-[var(--gold-line)] hover:bg-[var(--wash-strong)] group"
          >
            <span className="mx-auto w-11 h-11 rounded-full bg-[var(--sheet)] border border-[var(--hairline)] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Upload className="w-5 h-5 text-[var(--gold-deep)]" />
            </span>
            <span className="block text-[15px] text-[var(--ink)]">Drop your photo here, or <span className="underline underline-offset-4 decoration-[var(--gold-line)]">browse</span></span>
            <span className="block text-xs text-[var(--ink-faint)] mt-1.5 font-mono">JPG · PNG · WebP, up to 15 MB</span>
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
              className="inline-flex items-center gap-1.5 text-[var(--ink)] underline underline-offset-4 decoration-[var(--hairline-strong)] hover:decoration-[var(--gold-deep)] transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4 text-[var(--gold-deep)]" />
              <span>Use camera</span>
            </button>
            <span className="text-[var(--ink-faint)]">·</span>
            <button
              type="button"
              onClick={useSamplePhoto}
              disabled={loadingSample}
              className="inline-flex items-center gap-1.5 text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors cursor-pointer disabled:opacity-50"
            >
              {loadingSample ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : null}
              <span className="underline underline-offset-4 decoration-[var(--hairline)]">{loadingSample ? 'Fetching…' : 'Try a sample pile'}</span>
            </button>
          </div>

          <p className="text-xs text-[var(--ink-faint)] mt-7">
            Nothing is measured until you ask. Your photo stays with you.
          </p>
        </div>
      )}

      {/* --- PREVIEW — is this the right frame? --- */}
      {phase === 'preview' && photo && (
        <div className="washi-enter space-y-4">
          <figure className="washi-sheet overflow-hidden">
            <div className="bg-[var(--matte)] p-2 sm:p-3">
              <SafeImage src={photo.dataUrl} alt="The grain pile, as photographed" className="w-full max-h-[440px] object-contain rounded-[8px]" />
            </div>
            <figcaption className="flex flex-wrap items-baseline justify-between gap-2 px-5 sm:px-6 py-4">
              <span className="serif-reading text-lg text-[var(--ink)] italic">“{photo.source === 'camera' ? 'Fresh from the field' : photo.name}”</span>
              <span className="font-mono text-[11px] text-[var(--ink-faint)]">{photo.width} × {photo.height} · {photo.sizeKB} KB</span>
            </figcaption>
          </figure>
          <PhotoGateBanner quality={photoQuality} />
          <DetectReportCard
            primary={detectPrimary}
            cross={detectCross}
            pending={detectPending}
            onRetry={() => photo && void runDetection(photo)}
          />
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-5">
            <button
              type="button"
              onClick={resetWorkflow}
              className="touch-target px-4 py-2.5 text-sm text-[var(--ink-soft)] hover:text-[var(--danger-ink)] inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Choose another</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setPhase('measure');
              }}
              className="touch-target px-7 py-3 bg-[var(--ink)] hover:bg-[var(--ink-hover)] text-[var(--paper)] text-sm rounded-full inline-flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[var(--pill-shadow)]"
            >
              <span>Yes, describe this pile</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* --- PHASE: MEASURE (02) + QUALIFY (03) + UNDERSTAND (04) --- */}
      {phase === 'measure' && photo && warehouse && (
        <div className="washi-enter">
        <div className="washi-sheet overflow-hidden">
          {/* Small keepsake of the photo — you never lose sight of what you saw */}
          <div className="flex items-center gap-4 px-5 sm:px-7 pt-5 sm:pt-6">
            <SafeImage src={photo.dataUrl} alt="Your pile" className="w-16 h-16 rounded-[10px] object-cover border border-[var(--hairline)] shrink-0" />
            <div className="min-w-0">
              <p className="serif-reading text-lg text-[var(--ink)] leading-snug">This light will do nicely.</p>
              {(() => {
                const exposure = exposureVerdict(photo.meanLuma);
                const longEdge = Math.max(photo.width, photo.height);
                return (
                  <p className="font-mono text-[11px] text-[var(--ink-faint)] mt-0.5">
                    {photo.width} × {photo.height} · {exposure.label.toLowerCase()} · {photo.sizeKB} KB
                    {longEdge < 800 ? ' · a little soft — the range will breathe wider' : ''}
                  </p>
                );
              })()}
            </div>
            <p className="ml-auto font-mono text-[11px] text-[var(--ink-faint)] hidden sm:block text-right leading-relaxed">
              {liveVolume} m³<br />alive
            </p>
          </div>
          {/* Camera-section gate: same verdict as preview, right where you measure */}
          <div className="px-5 sm:px-7 pt-4 space-y-3">
            <PhotoGateBanner quality={photoQuality} />
          </div>

          {/* Shape */}
          <div className="px-5 sm:px-7 pt-7">
            <p className="eyebrow-quiet">The shape of the pile</p>
            <p className="serif-reading text-xl text-[var(--ink)] mt-1">How tall, how wide — in your own steps</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-5">
              <div>
                <div className="flex justify-between items-baseline mb-2.5">
                  <span className="text-sm text-[var(--ink-soft)]">Height at the crown</span>
                  <span className="font-mono text-sm text-[var(--ink)]">{heightMeters.toFixed(1)} m</span>
                </div>
                <input
                  type="range" min="1.5" max="8.0" step="0.1" value={heightMeters}
                  onChange={(e) => setHeightMeters(parseFloat(e.target.value))}
                  className="washi-range"
                  aria-label="Pile height in meters"
                />
                <div className="flex justify-between font-mono text-[10px] text-[var(--ink-faint)] mt-1.5">
                  <span>1.5</span><span>8.0</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-baseline mb-2.5">
                  <span className="text-sm text-[var(--ink-soft)]">Footprint across</span>
                  <span className="font-mono text-sm text-[var(--ink)]">{baseDiameterMeters.toFixed(1)} m</span>
                </div>
                <input
                  type="range" min="5.0" max="22.0" step="0.1" value={baseDiameterMeters}
                  onChange={(e) => setBaseDiameterMeters(parseFloat(e.target.value))}
                  className="washi-range"
                  aria-label="Pile base diameter in meters"
                />
                <div className="flex justify-between font-mono text-[10px] text-[var(--ink-faint)] mt-1.5">
                  <span>5.0</span><span>22.0</span>
                </div>
              </div>
            </div>
            <p className="font-mono text-[11px] text-[var(--ink-faint)] mt-4">
              ≈ {liveVolume} m³ · {grainLabel()} rests at {GRAIN_BULK_DENSITIES[grainType]?.density.toFixed(3)} t/m³. A gauge rod on site tightens this further.
            </p>
          </div>

          <div className="mx-5 sm:mx-7 my-7 h-px bg-[var(--wash)]" />
          <div className="px-5 sm:px-7 space-y-7">
              <div>
                <p className="eyebrow-quiet">What grain is sleeping here</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {warehouse.grainTypes.map((g) => (
                    <button
                      key={g} type="button" onClick={() => setGrainType(g as GrainType)}
                      className={`touch-target px-4 py-2 rounded-full border text-sm transition-all cursor-pointer ${
                        grainType === g
                          ? 'bg-[var(--card-ink-bg)] text-[var(--paper)] border-[var(--ink)]'
                          : 'bg-transparent text-[var(--ink-soft)] border-[var(--hairline)] hover:border-[var(--hairline-strong)]'
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
                            ? 'bg-[var(--well)] border-[var(--gold-line)]'
                            : 'bg-transparent border-[var(--hairline-soft)] hover:border-[var(--hairline-strong)]'
                        }`}
                      >
                        <div className="text-sm text-[var(--ink)]">{p.name}</div>
                        <div className="text-xs text-[var(--ink-faint)] mt-0.5">{p.storageHint}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between items-baseline mb-2.5">
                    <span className="text-sm text-[var(--ink-soft)]">Moisture by meter</span>
                    <span className="font-mono text-sm text-[var(--ink)]">{humidityPercent.toFixed(1)}%</span>
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
                    <span className="text-sm text-[var(--ink-soft)]">Days at rest</span>
                    <span className="font-mono text-sm text-[var(--ink)]">{storageDays} days</span>
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
                          ? 'bg-[var(--card-ink-bg)] text-[var(--paper)] border-[var(--ink)]'
                          : 'bg-transparent border-[var(--hairline)] hover:border-[var(--hairline-strong)]'
                      }`}
                    >
                      <span className="block text-[13px] leading-tight">{c.label}</span>
                      <span className={`block font-mono text-[10px] mt-0.5 ${compaction === c.id ? 'opacity-60' : 'text-[var(--ink-faint)]'}`}>{c.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
          </div>

          <div className="mx-5 sm:mx-7 my-7 h-px bg-[var(--wash)]" />

          {/* The paper side of the truth */}
          <div className="px-5 sm:px-7 pb-6 sm:pb-7">
            <div className="flex items-baseline justify-between gap-3">
              <p className="eyebrow-quiet">What the paper claims</p>
              <p className="font-mono text-[11px] text-[var(--ink-faint)]">{declaredTouched ? 'your hand' : 'from registry'}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-5 mt-4">
              <div className="sm:col-span-3">
                <label htmlFor="declared-tonnes" className="serif-reading text-xl text-[var(--ink)] block">
                  Read it off the receipt
                </label>
                <div className="flex items-baseline gap-2 mt-2 border-b border-[var(--hairline)] focus-within:border-[var(--ink)] transition-colors pb-2">
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
                    className="w-full bg-transparent text-4xl serif-reading text-[var(--ink)] focus:outline-none placeholder:text-[var(--ink-faint)]"
                    placeholder={warehouse.currentDeclaredTonnes.toFixed(1)}
                  />
                  <span className="font-mono text-sm text-[var(--ink-faint)]">tonnes</span>
                </div>
                <p className="font-mono text-[11px] text-[var(--ink-faint)] mt-2">
                  Registry holds {warehouse.currentDeclaredTonnes.toFixed(1)} T · this store can carry {warehouse.capacityTonnes.toFixed(0)} T
                </p>
                {Number.isFinite(parsedDeclared) && parsedDeclared > warehouse.capacityTonnes && (
                  <p className="text-xs text-[var(--danger-ink)] mt-2">
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
                      <p className="text-xs text-[var(--ink)] truncate">{receiptPhoto.name}</p>
                      <p className="font-mono text-[11px] text-[var(--moss)]">kept with this reading</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReceiptPhoto(null)}
                      className="font-mono text-[11px] text-[var(--ink-faint)] hover:text-[var(--danger-ink)] underline underline-offset-2 shrink-0 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => receiptInputRef.current?.click()}
                      className="touch-target mt-3 w-full px-4 py-3 border border-dashed border-[var(--hairline-strong)] hover:border-[var(--gold-line)] rounded-[10px] text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Receipt className="w-4 h-4 text-[var(--gold-deep)]" />
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
                <p className="text-xs text-[var(--ink-faint)] mt-2 leading-relaxed">
                  Entirely optional. The reading never waits for it.
                </p>
              </div>
            </div>
          </div>
        </div>

          {/* Step gently forward */}
          <div className="pt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setPhase('preview')}
              className="touch-target px-4 py-2.5 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to the photo</span>
            </button>
            <button
              type="button"
              onClick={runAnalysis}
              className="touch-target px-7 py-3 bg-[var(--ink)] hover:bg-[var(--ink-hover)] text-[var(--paper)] text-sm rounded-full inline-flex items-center gap-2 transition-all cursor-pointer shadow-[var(--pill-shadow)]"
            >
              <span>Read the stock</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* --- READING — give it a moment --- */}
      {phase === 'analyzing' && photo && (
        <div className="washi-sheet overflow-hidden washi-enter">
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="relative bg-[var(--matte)] p-2 sm:p-3 min-h-64">
              <SafeImage src={photo.dataUrl} alt="Your pile, being read" className="w-full h-full min-h-64 max-h-[380px] object-cover rounded-[8px] opacity-90 washi-veil" />
              <div className="absolute inset-2 sm:inset-3 rounded-[8px] bg-[var(--oncard-wash)] backdrop-blur-[1px]" />
            </div>
            <div className="px-6 sm:px-8 py-7 sm:py-9 flex flex-col justify-center">
              <p className="eyebrow-quiet">{warehouse?.code} · {warehouse?.receiptNumber}</p>
              <h2 className="serif-reading text-2xl sm:text-[28px] text-[var(--ink)] mt-2 min-h-[2.5em]">
                {activeStep >= 0 && ANALYSIS_STEPS[activeStep] ? `${ANALYSIS_STEPS[activeStep]}…` : 'Reading your photo…'}
              </h2>
              <div className="mt-5 h-[2px] bg-[var(--wash)] rounded-full overflow-hidden">
                <div className="h-full bg-[var(--ink)] rounded-full transition-all duration-500" style={{ width: `${(completedSteps / ANALYSIS_STEPS.length) * 100}%` }} />
              </div>
              <div className="mt-4 space-y-1.5">
                {ANALYSIS_STEPS.map((label, i) => {
                  const done = i < completedSteps;
                  const active = i === activeStep;
                  return (
                    <p
                      key={label}
                      className={`text-[13px] transition-all duration-300 ${done ? 'text-[var(--ink-faint)]' : active ? 'text-[var(--ink)]' : 'text-[var(--ink-faint)]'}`}
                    >
                      <span className="inline-block w-5 font-mono text-[11px]">{done ? '·' : active ? '—' : '·'}</span>
                      {label}
                    </p>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- PHASE: RESULT --- */}
      {phase === 'result' && estimationResult && photo && warehouse && (
        <div className="washi-enter-slow space-y-0">
          {usedFallback && (
            <div className="washi-sheet px-4 py-3 mb-5 flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--gold-deep)] shrink-0" />
              <span className="text-sm text-[var(--ink)]">We could not reach the calculation engine, so this is a gentle demo reading from your own volume. Re-read when you are back online.</span>
            </div>
          )}

          {/* The finding — what was analyzed → discovered */}
          <div className="washi-sheet px-6 sm:px-10 pt-8 sm:pt-10 pb-8 text-center overflow-hidden">
            <p className="eyebrow-quiet">{warehouse.code} · {warehouse.receiptNumber} · {SEASON_PROFILES[season].name}</p>
            <p className="mt-3 inline-flex items-center gap-2 text-[13px] text-[var(--ink-soft)]">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: verdictTone.dot }} />
              {verdictTone.word} · {estimationResult.confidencePercent}% sure
            </p>
            <h2 className="serif-reading text-[var(--ink)] text-[26px] sm:text-3xl mt-2">
              {verdictTone.sentence}
            </h2>
            <div className="flex items-baseline justify-center gap-2 mt-4">
              <span className="serif-reading text-[var(--ink)] text-6xl sm:text-7xl leading-none">
                {estimationResult.centralEstimateTonnes.toFixed(1)}
              </span>
              <span className="font-mono text-sm text-[var(--ink-faint)]">tonnes</span>
            </div>
            <p className="font-mono text-xs text-[var(--ink-faint)] mt-3">
              likely between {estimationResult.rangeLowTonnes.toFixed(1)} and {estimationResult.rangeHighTonnes.toFixed(1)} T
            </p>

            {/* Why it matters — the quiet ledger */}
            <div className="max-w-md mx-auto mt-7 pt-6 border-t border-[var(--hairline-soft)] grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="eyebrow-quiet">On paper</p>
                <p className="font-mono text-[15px] text-[var(--ink)] mt-1">{runDeclared.toFixed(1)} T</p>
              </div>
              <div>
                <p className="eyebrow-quiet">Difference</p>
                <p className="font-mono text-[15px] mt-1" style={{ color: Math.abs(diff) < 0.5 ? 'var(--success-ink)' : diff < 0 ? 'var(--danger-ink)' : 'var(--gold)' }}>
                  {diff > 0 ? '+' : ''}{diff.toFixed(1)} T
                </p>
              </div>
              <div>
                <p className="eyebrow-quiet">Volume seen</p>
                <p className="font-mono text-[15px] text-[var(--ink)] mt-1">{estimationResult.volumeM3.toFixed(0)} m³</p>
              </div>
            </div>
            <p className="text-xs text-[var(--ink-faint)] mt-4">
              Paper says {runDeclared.toFixed(1)} T ({declaredTouched ? 'your hand' : 'registry'}). The pile suggests {estimationResult.centralEstimateTonnes.toFixed(1)} T.
            </p>

          {/* Proof chain — reverse → physics → bankable (same math, one story) */}
          {(() => {
            const rev = reverseProof(runDeclared, baseDiameterMeters, heightMeters, {
              grainType, season, humidityPercent, compaction, storageDays,
            });
            const geo = reposeVerdict(heightMeters, baseDiameterMeters);
            const reqDeg = reposeDeg(rev.requiredHeightM, baseDiameterMeters);
            const bank = bankableTonnes(
              estimationResult.rangeLowTonnes, estimationResult.confidencePercent, humidityPercent, true,
            );
            const price = parseFloat(priceText);
            return (
              <div className="mt-8 space-y-4 text-left">
                <div className="text-center font-mono text-[11px] text-[var(--ink-faint)]">
                  {runDeclared.toFixed(1)}T CLAIMED · {bank.bankableTonnes.toFixed(1)}T DEFENSIBLE ·{' '}
                  <span className={rev.supported ? 'text-[var(--success-ink)]' : 'text-[var(--danger-ink)]'}>
                    {rev.supported ? 'CLAIM SUPPORTED' : 'CLAIM NOT SUPPORTED'}
                  </span>
                </div>
                <ReverseProofBlock proof={rev} />
                <PhysicsCheckBlock verdict={geo} requiredDeg={reqDeg} />
                <div className="washi-sheet px-5 py-4">
                  <label className="block">
                    <span className="eyebrow-quiet">Price ₹/tonne (optional — for collateral value)</span>
                    <input
                      type="number" min="0" inputMode="numeric" value={priceText}
                      onChange={(e) => setPriceText(e.target.value)}
                      placeholder="e.g. 26000"
                      className="mt-1 w-full bg-transparent font-mono text-lg text-[var(--ink)] border-b border-[var(--hairline)] focus:outline-none pb-1"
                    />
                  </label>
                </div>
                <BankableBlock
                  bankable={bank}
                  claimed={runDeclared}
                  rangeLow={estimationResult.rangeLowTonnes}
                  rangeHigh={estimationResult.rangeHighTonnes}
                  pricePerTonne={Number.isFinite(price) && price > 0 ? price : undefined}
                />
              </div>
            );
          })()}

          {/* What was analyzed — the pile, large and clear */}
          <div className="mt-8 text-left">
            <p className="eyebrow-quiet mb-2">Whole pile → geometry → calculation</p>
            <div className="space-y-3 mb-4">
              <DetectReportCard
                primary={detectPrimary}
                cross={detectCross}
                pending={detectPending}
                onRetry={() => photo && void runDetection(photo)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <figure>
              <div className="rounded-[12px] overflow-hidden border border-[var(--hairline-soft)] bg-[var(--matte)] p-1.5">
                <SafeImage src={photo.dataUrl} alt="The pile you photographed" className="w-full h-72 sm:h-80 object-cover rounded-[8px]" />
              </div>
              <figcaption className="font-mono text-[11px] text-[var(--ink-faint)] mt-2">The pile · {photo.sizeKB} KB · {photo.width}×{photo.height}</figcaption>
            </figure>
            <figure>
              {receiptPhoto ? (
                <>
                  <div className="rounded-[12px] overflow-hidden border border-[var(--hairline-soft)] bg-[var(--sheet)] p-1.5">
                    <SafeImage src={receiptPhoto.dataUrl} alt="The paper receipt" className="w-full h-52 object-cover rounded-[8px]" />
                  </div>
                  <figcaption className="font-mono text-[11px] text-[var(--ink-faint)] mt-2">The paper · kept together</figcaption>
                </>
              ) : (
                <div className="rounded-[12px] border border-dashed border-[var(--hairline)] h-52 flex items-center justify-center px-6 text-center">
                  <p className="text-sm text-[var(--ink-faint)] leading-relaxed">No receipt photo — the reading stands on the pile alone, against {runDeclared.toFixed(1)} T {declaredTouched ? 'in your hand' : 'in the registry'}.</p>
                </div>
              )}
            </figure>
          </div>
          </div>

          {/* Why it matters — in plain words */}
          <div className="text-left mt-8 space-y-4">
            <p className="text-[15px] leading-relaxed text-[var(--ink)]">{estimationResult.explanatoryReason}</p>
            <div className="flex items-start gap-2.5 pt-4 border-t border-[var(--hairline-soft)]">
              <ShieldCheck className="w-4 h-4 text-[var(--gold-deep)] shrink-0 mt-0.5" />
              <p className="text-sm leading-relaxed text-[var(--ink-soft)]">{estimationResult.auditRecommendation}</p>
            </div>
            <details className="group">
              <summary className="font-mono text-[11px] text-[var(--ink-faint)] hover:text-[var(--ink)] cursor-pointer list-none underline underline-offset-4 decoration-[var(--hairline)]">
                How this number was found
              </summary>
              <dl className="mt-3 space-y-1.5 text-[13px]">
                {[
                  [`${grainLabel()}`, `${estimationResult.volumeM3.toFixed(1)} m³ at ${estimationResult.effectiveDensity.toFixed(3)} t/m³`],
                  [`${SEASON_PROFILES[season].name}`, `${humidityPercent.toFixed(1)}% · ${compaction} · ${storageDays} days`],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3">
                    <dt className="text-[var(--ink-soft)]">{k}</dt>
                    <dd className="font-mono text-xs text-[var(--ink)] text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </div>
          </div>

          {/* What next — calm, unhurried */}
          <div className="mt-6">
          {savedVerification ? (
            <div className="space-y-3">
              <div className="washi-sheet px-5 py-4 flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--moss)] shrink-0" />
                <p className="text-sm leading-relaxed text-[var(--ink)]">
                  Recorded as {savedVerification.id}. It now appears under {savedVerification.agentType === 'government' ? 'Government Audit' : 'Bank Checks'}.
                </p>
              </div>
              <div className="washi-sheet px-5 py-4">
                <p className="eyebrow-quiet">Verification QR · points at the stored record</p>
                {govCheckPending && (
                  <p className="text-sm text-[var(--ink-soft)] mt-2">Minting the permanent record…</p>
                )}
                {!govCheckPending && govCheck && qrDataUrl && (
                  <div className="flex items-center gap-4 mt-3">
                    <img src={qrDataUrl} alt={`Verify ${govCheck.id}`} className="w-[110px] h-[110px] rounded-[8px] border border-[var(--hairline)] bg-white shrink-0" />
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-[var(--ink)]">{govCheck.id}</p>
                      <p className="font-mono text-[11px] text-[var(--ink-faint)] mt-1 break-all">{buildVerifyUrl(govCheck.id)}</p>
                      <p className="text-xs text-[var(--ink-soft)] mt-1">Scanning opens the true stored result — a report can never fake what this points to.</p>
                    </div>
                  </div>
                )}
                {!govCheckPending && govCheckError && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <p className="text-sm text-[var(--danger-ink)]">QR pending — {govCheckError}</p>
                    <button
                      type="button"
                      onClick={retryGovCheck}
                      className="touch-target px-4 py-2 text-xs bg-[var(--ink)] text-[var(--ink-inverse)] rounded-full cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              <button
                type="button"
                onClick={handleSaveAudit}
                disabled={isSaving}
                className="touch-target flex-1 px-6 py-3.5 bg-[var(--ink)] hover:bg-[var(--ink-hover)] text-[var(--paper)] text-sm rounded-full inline-flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[var(--pill-shadow)] disabled:opacity-50"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>{isSaving ? 'Recording…' : 'Record This Reading'}</span>
              </button>
              <div className="flex items-center justify-center gap-5">
                <button
                  type="button"
                  onClick={handlePrintReport}
                  className="touch-target inline-flex items-center gap-1.5 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] underline underline-offset-4 decoration-[var(--hairline)] transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  title="Download audit as CSV"
                  className="touch-target inline-flex items-center gap-1.5 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] underline underline-offset-4 decoration-[var(--hairline)] transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>CSV</span>
                </button>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={resetWorkflow}
            className="mx-auto mt-5 touch-target px-5 py-2.5 text-sm text-[var(--ink-faint)] hover:text-[var(--ink)] inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Begin another pile</span>
          </button>
          </div>
        </div>
      )}

      {/* --- Camera — held gently --- */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--overlay)] backdrop-blur-sm washi-veil">
          <div className="washi-sheet overflow-hidden max-w-lg w-full washi-enter">
            <div className="px-5 py-3.5 border-b border-[var(--hairline-soft)] flex items-center justify-between">
              <span className="eyebrow-quiet">
                Camera
              </span>
              <button
                type="button"
                onClick={() => { stopCamera(); setCameraOpen(false); }}
                className="text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer transition-colors"
                aria-label="Close camera"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {cameraError ? (
                <div className="washi-well px-4 py-3.5 text-sm text-[var(--ink)] leading-relaxed">
                  {cameraError}
                </div>
              ) : (
                <div className="relative rounded-[10px] overflow-hidden bg-[var(--matte)] aspect-4/3">
                  <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                  {cameraStarting && (
                    <div className="absolute inset-0 flex items-center justify-center text-[var(--paper)] text-sm gap-2">
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
                    className="touch-target flex-1 px-5 py-3 bg-[var(--ink)] hover:bg-[var(--ink-hover)] text-[var(--paper)] text-sm rounded-full inline-flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Keep this frame</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { stopCamera(); setCameraOpen(false); }}
                  className="touch-target px-4 py-3 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors cursor-pointer"
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
