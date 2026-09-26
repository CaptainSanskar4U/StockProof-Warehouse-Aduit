import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { AgentType, CompactionLevel, GrainType, GovScheme, Season } from '../../types.js';
import {
  evaluatePhotoQuality,
  laplacianVariance,
  type PhotoQuality,
} from '../../proofMath.js';

/** One pile photo shared by New Audit + all proof tabs. */
export interface PhotoState {
  dataUrl: string;
  name: string;
  source: 'upload' | 'camera';
  sizeKB: number;
  width: number;
  height: number;
  meanLuma: number;
}

/** One backend verdict, exactly their DetectionResult shape
 * (aidetector/types.py) + optional filename. Primary = ultra,
 * cross-check = sentry-convnext-small. */
export interface DetectFinding {
  label: string;
  probability_ai: number;
  probability_real: number;
  confidence: number;
  raw_score: number;
  backend: string;
  filename?: string;
}

// Their detectors + the deployed HF path answer one image at a time —
// never hang the camera tab: abort stale reads, 150s cap per photo.
const DETECT_TIMEOUT_MS = 150000;

export const SHARED_DEFAULTS = {
  heightM: 3.8,
  diameterM: 10.5,
  grain: 'wheat' as GrainType,
  season: 'rabi' as Season,
  humidity: 12.8,
  compaction: 'medium' as CompactionLevel,
  storageDays: 25,
};

// Offline blur estimate: 64px thumb, Laplacian variance. Higher = sharper.
function measureBlurVariance(dataUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const S = 64;
        const canvas = document.createElement('canvas');
        canvas.width = S;
        canvas.height = S;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(0);
        ctx.drawImage(img, 0, 0, S, S);
        const px = ctx.getImageData(0, 0, S, S).data;
        const gray: number[] = new Array(S * S);
        for (let i = 0; i < S * S; i += 1) {
          gray[i] = 0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2];
        }
        resolve(laplacianVariance(gray, S, S));
      } catch {
        resolve(0);
      }
    };
    img.onerror = () => resolve(0);
    img.src = dataUrl;
  });
}

interface SharedAudit {
  photo: PhotoState | null;
  setPhoto: (p: PhotoState | null) => void;
  photoQuality: PhotoQuality | null;
  detectPrimary: DetectFinding | null;
  detectCross: DetectFinding | null;
  detectPending: boolean;
  clearPhoto: () => void;
  refreshPhotoGate: (p: PhotoState) => Promise<void>;
  runDetection: (p: PhotoState) => Promise<void>;
  heightMeters: number;
  setHeightMeters: (v: number) => void;
  baseDiameterMeters: number;
  setBaseDiameterMeters: (v: number) => void;
  grainType: GrainType;
  setGrainType: (v: GrainType) => void;
  season: Season;
  setSeason: (v: Season) => void;
  humidityPercent: number;
  setHumidityPercent: (v: number) => void;
  compaction: CompactionLevel;
  setCompaction: (v: CompactionLevel) => void;
  storageDays: number;
  setStorageDays: (v: number) => void;
  declaredText: string;
  setDeclaredText: (v: string) => void;
  declaredTouched: boolean;
  setDeclaredTouched: (v: boolean) => void;
  priceText: string;
  setPriceText: (v: string) => void;
  agentType: AgentType;
  setAgentType: (v: AgentType) => void;
  farmerName: string;
  setFarmerName: (v: string) => void;
  loanRef: string;
  setLoanRef: (v: string) => void;
  bankWarehouseName: string;
  setBankWarehouseName: (v: string) => void;
  govWarehouseRef: string;
  setGovWarehouseRef: (v: string) => void;
  govRegion: string;
  setGovRegion: (v: string) => void;
  govScheme: GovScheme;
  setGovScheme: (v: GovScheme) => void;
}

const Ctx = createContext<SharedAudit | null>(null);

export function SharedAuditProvider({ children }: { children: React.ReactNode }) {
  const [photo, setPhotoState] = useState<PhotoState | null>(null);
  const [photoQuality, setPhotoQuality] = useState<PhotoQuality | null>(null);
  const [detectPrimary, setDetectPrimary] = useState<DetectFinding | null>(null);
  const [detectCross, setDetectCross] = useState<DetectFinding | null>(null);
  const [detectPending, setDetectPending] = useState(false);
  const detectToken = useRef(0);
  const detectCtrl = useRef<AbortController | null>(null);
  const [heightMeters, setHeightMeters] = useState(SHARED_DEFAULTS.heightM);
  const [baseDiameterMeters, setBaseDiameterMeters] = useState(SHARED_DEFAULTS.diameterM);
  const [grainType, setGrainType] = useState<GrainType>(SHARED_DEFAULTS.grain);
  const [season, setSeason] = useState<Season>(SHARED_DEFAULTS.season);
  const [humidityPercent, setHumidityPercent] = useState(SHARED_DEFAULTS.humidity);
  const [compaction, setCompaction] = useState<CompactionLevel>(SHARED_DEFAULTS.compaction);
  const [storageDays, setStorageDays] = useState(SHARED_DEFAULTS.storageDays);
  const [declaredText, setDeclaredText] = useState('');
  const [declaredTouched, setDeclaredTouched] = useState(false);
  const [priceText, setPriceText] = useState('');
  const [agentType, setAgentType] = useState<AgentType>('bank');
  const [farmerName, setFarmerName] = useState('');
  const [loanRef, setLoanRef] = useState('');
  const [bankWarehouseName, setBankWarehouseName] = useState('');
  const [govWarehouseRef, setGovWarehouseRef] = useState('');
  const [govRegion, setGovRegion] = useState('');
  const [govScheme, setGovScheme] = useState<GovScheme>('Public Distribution System');

  const refreshPhotoGate = useCallback(async (p: PhotoState) => {
    const blur = await measureBlurVariance(p.dataUrl);
    setPhotoQuality(
      evaluatePhotoQuality({ width: p.width, height: p.height, sizeKB: p.sizeKB, meanLuma: p.meanLuma, blurVariance: blur }),
    );
  }, []);

  // Score the pile photo with the AI detectors. Sends JSON (dataUrl) so the
  // same endpoint works locally (their ultra/sentry sidecars) and on Vercel
  // (HuggingFace serverless). Stale photos abort. Never blocks the audit.
  const runDetection = useCallback(async (p: PhotoState) => {
    detectCtrl.current?.abort();
    const ctrl = new AbortController();
    detectCtrl.current = ctrl;
    const token = ++detectToken.current;
    setDetectPrimary(null);
    setDetectCross(null);
    setDetectPending(true);
    const timer = setTimeout(() => ctrl.abort(), DETECT_TIMEOUT_MS);
    const parseFinding = (data: unknown): DetectFinding | null => {
      const d = data as Record<string, unknown>;
      if (typeof d?.probability_ai !== 'number' || typeof d?.label !== 'string') return null;
      return {
        label: d.label,
        probability_ai: d.probability_ai,
        probability_real: typeof d.probability_real === 'number' ? d.probability_real : 1 - d.probability_ai,
        confidence: typeof d.confidence === 'number' ? d.confidence : 0.5,
        raw_score: typeof d.raw_score === 'number' ? d.raw_score : 0,
        backend: typeof d.backend === 'string' ? d.backend : 'unknown',
        filename: typeof d.filename === 'string' ? d.filename : undefined,
      };
    };
    try {
      // One call returns {primary, cross} — primary + cross-check backends.
      const res = await fetch('/api/ai-detect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dataUrl: p.dataUrl, filename: p.name }),
        signal: ctrl.signal,
      });
      if (token !== detectToken.current) return;
      if (!res.ok) return;
      const data = (await res.json()) as { primary?: unknown; cross?: unknown };
      setDetectPrimary(parseFinding(data.primary));
      setDetectCross(parseFinding(data.cross));
    } catch {
      // Timeout / offline / warming up — card shows unavailable + Retry.
    } finally {
      clearTimeout(timer);
      if (token === detectToken.current) setDetectPending(false);
    }
  }, []);

  const setPhoto = useCallback((p: PhotoState | null) => {
    setPhotoState(p);
    if (!p) {
      detectCtrl.current?.abort();
      detectToken.current += 1;
      setPhotoQuality(null);
      setDetectPrimary(null);
      setDetectCross(null);
      setDetectPending(false);
    }
  }, []);

  const clearPhoto = useCallback(() => {
    setPhotoState(null);
    detectCtrl.current?.abort();
    detectToken.current += 1;
    setPhotoQuality(null);
    setDetectPrimary(null);
    setDetectCross(null);
    setDetectPending(false);
  }, []);

  const value = useMemo(
    () => ({
      photo, setPhoto, photoQuality, clearPhoto, refreshPhotoGate,
      detectPrimary, detectCross, detectPending, runDetection,
      heightMeters, setHeightMeters, baseDiameterMeters, setBaseDiameterMeters,
      grainType, setGrainType, season, setSeason, humidityPercent, setHumidityPercent,
      compaction, setCompaction, storageDays, setStorageDays,
      declaredText, setDeclaredText, declaredTouched, setDeclaredTouched,
      priceText, setPriceText,
      agentType, setAgentType,
      farmerName, setFarmerName, loanRef, setLoanRef, bankWarehouseName, setBankWarehouseName,
      govWarehouseRef, setGovWarehouseRef, govRegion, setGovRegion, govScheme, setGovScheme,
    }),
    [photo, photoQuality, clearPhoto, refreshPhotoGate,
      detectPrimary, detectCross, detectPending, runDetection,
      heightMeters, baseDiameterMeters, grainType, season, humidityPercent,
      compaction, storageDays, declaredText, declaredTouched, priceText, setPhoto,
      agentType, farmerName, loanRef, bankWarehouseName, govWarehouseRef, govRegion, govScheme],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSharedAudit(): SharedAudit {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSharedAudit must be used inside SharedAuditProvider');
  return v;
}
