import type { GrainType, PhotoVerdict } from '../types.js';

/**
 * Farmer-only local storage. Namespaced (sp_farmer_*) and fully offline —
 * completely separate from anything the Inspector Console uses.
 */

export interface FarmerProfile {
  name: string;
  phone: string;
  village: string;
  district: string;
  storageName: string;
  storageLocation: string;
  photoDataUrl: string | null;
}

export interface FarmerRecord {
  /** Short verification code, e.g. SP-7F3K9 — unique per record. */
  code: string;
  createdAt: string; // ISO timestamp
  declaredTonnes: number;
  grainType: GrainType;
  grainName: string;
  estCentral: number;
  estLow: number;
  estHigh: number;
  volumeM3: number;
  /** null = UNVERIFIED (photo not confirmed genuine) */
  match: boolean | null;
  /** Explicit authenticity state — 'unchecked' is never merged into 'real'. */
  photoVerdict: PhotoVerdict;
  checkerNote: string | null;
  /** Server id backing the QR; null until the server confirms the save. */
  verificationId: string | null;
  photoDataUrl: string | null;
  heightM: number;
  diameterM: number;
  farmerName: string;
  storageName: string;
  source: 'simple-check' | 'engine';
}

const PROFILE_KEY = 'sp_farmer_profile_v1';
const RECORDS_KEY = 'sp_farmer_records_v1';

export const EMPTY_PROFILE: FarmerProfile = {
  name: '',
  phone: '',
  village: '',
  district: '',
  storageName: '',
  storageLocation: '',
  photoDataUrl: null,
};

/** Demo profile — pre-filled so the page never opens empty in the demo. */
export const DEMO_PROFILE: FarmerProfile = {
  name: 'Ramesh Kumar',
  phone: '+91 98765 43210',
  village: 'Karnal',
  district: 'Karnal',
  storageName: 'Karnal Agro Terminal — Shed 3',
  storageLocation: 'G.T. Road, Karnal',
  photoDataUrl: null,
};

/** Within ±15% of declared → match. Shared by every farmer check. */
export const MATCH_TOLERANCE = 0.15;

export function loadProfile(): FarmerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...DEMO_PROFILE };
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ...DEMO_PROFILE };
    }
    const merged = { ...EMPTY_PROFILE, ...(parsed as Partial<FarmerProfile>) };
    // A profile with no name reads as a blank form. Fall back to the demo
    // identity so the panel always shows a complete farmer.
    if (!merged.name?.trim()) return { ...DEMO_PROFILE };
    return merged;
  } catch {
    return { ...DEMO_PROFILE };
  }
}

export function saveProfile(p: FarmerProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    /* private mode / quota exceeded — the session still works in memory */
  }
}

export function profileComplete(p: FarmerProfile): boolean {
  return p.name.trim().length > 0;
}

export function loadRecords(): FarmerRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const arr = parsed.filter((r): r is FarmerRecord => typeof r === 'object' && r !== null);
    // Backfill fields added after earlier saves.
    for (const r of arr) {
      if (r.photoVerdict === undefined) r.photoVerdict = 'unchecked';
      if (r.checkerNote === undefined) r.checkerNote = null;
      if (r.verificationId === undefined) r.verificationId = null;
    }
    return arr.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  } catch {
    return [];
  }
}

function persistRecords(records: FarmerRecord[]): void {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {
    /* private mode / quota exceeded — records stay in memory for this session */
  }
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function makeCode(existing: FarmerRecord[]): string {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    let suffix = '';
    for (let i = 0; i < 5; i += 1) {
      suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    const code = `SP-${suffix}`;
    if (!existing.some((r) => r.code === code)) return code;
  }
  return `SP-${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

export function saveRecord(record: FarmerRecord): FarmerRecord[] {
  const records = loadRecords();
  records.unshift(record);
  persistRecords(records);
  return records;
}

export function findRecordByCode(code: string): FarmerRecord | null {
  const needle = code.trim().toUpperCase();
  if (!needle) return null;
  return loadRecords().find((r) => (r.code ?? '').toUpperCase() === needle) ?? null;
}

/** Downscale an image file to a small JPEG data URL for local record storage. */
export function photoFileToDataUrl(file: File, maxDim = 1024): Promise<string> {  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('That file is not a photo. Please choose a JPG or PNG image.'));
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      reject(new Error('That photo is too big. Please choose one under 15 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('This device cannot process photos.');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Could not read that photo.'));
        }
      };
      img.onerror = () => reject(new Error('Could not read that photo. Try a JPG or PNG.'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Could not read that photo. Try again.'));
    reader.readAsDataURL(file);
  });
}

/** Downscale an existing data-URL image (e.g. a New Audit frame) for record storage. */
export function downscaleDataUrl(dataUrl: string, maxDim = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('This device cannot process photos.');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Could not process that photo.'));
      }
    };
    img.onerror = () => reject(new Error('Could not read that photo.'));
    img.src = dataUrl;
  });
}
