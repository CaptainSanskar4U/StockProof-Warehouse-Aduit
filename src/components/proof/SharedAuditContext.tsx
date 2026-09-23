import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { CompactionLevel, GrainType, Season } from '../../types.js';
import {
  evaluateAiSuspicion,
  evaluatePhotoQuality,
  laplacianVariance,
  type AiSuspicion,
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

/** Ultra ensemble verdict from the local Python sidecar (null = unavailable → heuristic fallback). */
export interface UltraScore {
  probability_ai: number;
  label: string;
  backend: string;
}

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
  photoAi: AiSuspicion | null;
  ultraScore: UltraScore | null;
  ultraPending: boolean;
  clearPhoto: () => void;
  refreshProofGates: (p: PhotoState, fileName: string) => Promise<void>;
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
  const [photoAi, setPhotoAi] = useState<AiSuspicion | null>(null);
  const [ultraScore, setUltraScore] = useState<UltraScore | null>(null);
  const [ultraPending, setUltraPending] = useState(false);
  const ultraToken = useRef(0);
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

  const refreshProofGates = useCallback(async (p: PhotoState, fileName: string) => {
    const blur = await measureBlurVariance(p.dataUrl);
    setPhotoQuality(
      evaluatePhotoQuality({ width: p.width, height: p.height, sizeKB: p.sizeKB, meanLuma: p.meanLuma, blurVariance: blur }),
    );
    setPhotoAi(
      evaluateAiSuspicion({ fileName, width: p.width, height: p.height, sizeKB: p.sizeKB, meanLuma: p.meanLuma, blurVariance: blur }),
    );
    // Ultra ensemble in background — never blocks. Stale responses are dropped
    // when the auditor has already moved to another photo.
    const token = ++ultraToken.current;
    setUltraScore(null);
    setUltraPending(true);
    try {
      const res = await fetch('/api/ai-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: p.dataUrl }),
      });
      if (!res.ok) return; // detector unavailable -> heuristic banner stays
      const data = (await res.json()) as { probability_ai?: number; label?: string; backend?: string };
      if (token !== ultraToken.current) return;
      if (typeof data.probability_ai === 'number') {
        setUltraScore({
          probability_ai: data.probability_ai,
          label: typeof data.label === 'string' ? data.label : 'unknown',
          backend: typeof data.backend === 'string' ? data.backend : 'ultra',
        });
      }
    } catch {
      // Offline / detector warming up — heuristic warning already shown.
    } finally {
      if (token === ultraToken.current) setUltraPending(false);
    }
  }, []);

  const setPhoto = useCallback((p: PhotoState | null) => {
    setPhotoState(p);
    if (!p) {
      ultraToken.current += 1;
      setPhotoQuality(null);
      setPhotoAi(null);
      setUltraScore(null);
      setUltraPending(false);
    }
  }, []);

  const clearPhoto = useCallback(() => {
    setPhotoState(null);
    ultraToken.current += 1;
    setPhotoQuality(null);
    setPhotoAi(null);
    setUltraScore(null);
    setUltraPending(false);
  }, []);

  const value = useMemo(
    () => ({
      photo, setPhoto, photoQuality, photoAi, ultraScore, ultraPending, clearPhoto, refreshProofGates,
      heightMeters, setHeightMeters, baseDiameterMeters, setBaseDiameterMeters,
      grainType, setGrainType, season, setSeason, humidityPercent, setHumidityPercent,
      compaction, setCompaction, storageDays, setStorageDays,
      declaredText, setDeclaredText, declaredTouched, setDeclaredTouched,
      priceText, setPriceText,
    }),
    [photo, photoQuality, photoAi, ultraScore, ultraPending, clearPhoto, refreshProofGates,
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
