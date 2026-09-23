import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { CompactionLevel, GrainType, Season } from '../../types.js';
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
    const postOne = async (url: string): Promise<DetectFinding | null> => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dataUrl: p.dataUrl, filename: p.name }),
        signal: ctrl.signal,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as Record<string, unknown>;
      if (typeof data.probability_ai !== 'number' || typeof data.label !== 'string') return null;
      return {
        label: data.label,
        probability_ai: data.probability_ai,
        probability_real: typeof data.probability_real === 'number' ? data.probability_real : 1 - data.probability_ai,
        confidence: typeof data.confidence === 'number' ? data.confidence : 0.5,
        raw_score: typeof data.raw_score === 'number' ? data.raw_score : 0,
        backend: typeof data.backend === 'string' ? data.backend : 'unknown',
        filename: typeof data.filename === 'string' ? data.filename : undefined,
      };
    };
    try {
      const [primary, cross] = await Promise.all([
        postOne('/api/ai-detect'),
        postOne('/api/ai-detect-crosscheck'),
      ]);
      if (token !== detectToken.current) return;
      setDetectPrimary(primary);
      setDetectCross(cross);
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
    }),
    [photo, photoQuality, clearPhoto, refreshPhotoGate,
      detectPrimary, detectCross, detectPending, runDetection,
      heightMeters, baseDiameterMeters, grainType, season, humidityPercent,
      compaction, storageDays, declaredText, declaredTouched, priceText, setPhoto],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSharedAudit(): SharedAudit {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSharedAudit must be used inside SharedAuditProvider');
  return v;
}
