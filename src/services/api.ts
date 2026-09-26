import {
  Warehouse,
  Verification,
  ReviewItem,
  PortfolioSummary,
  EstimationResult,
  GeometryInputs,
  ContextInputs,
  AgentType,
  BankAuditFields,
  GovAuditFields,
  InspectorProfile,
  GovCheck,
  FarmerCheck,
  PhotoVerdict
} from '../types.js';

export const API_BASE = '/api';

export async function fetchWarehouses(status?: string, search?: string): Promise<Warehouse[]> {
  const params = new URLSearchParams();
  if (status && status !== 'all') params.append('status', status);
  if (search) params.append('search', search);

  const res = await fetch(`${API_BASE}/warehouses?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to load warehouses (${res.status})`);
  return res.json();
}

export async function fetchWarehouseById(id: string): Promise<Warehouse> {
  const res = await fetch(`${API_BASE}/warehouses/${id}`);
  if (!res.ok) throw new Error(`Warehouse not found (${res.status})`);
  return res.json();
}

export async function fetchVerifications(warehouseId?: string, agentType?: AgentType): Promise<Verification[]> {
  const params = new URLSearchParams();
  if (warehouseId) params.append('warehouseId', warehouseId);
  if (agentType) params.append('agentType', agentType);
  const qs = params.toString();
  const url = qs ? `${API_BASE}/verifications?${qs}` : `${API_BASE}/verifications`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load verifications (${res.status})`);
  return res.json();
}

export async function previewEstimate(
  geometry: GeometryInputs,
  context: ContextInputs,
  declaredTonnes: number
): Promise<EstimationResult> {
  const res = await fetch(`${API_BASE}/verifications/estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ geometry, context, declaredTonnes }),
  });
  if (!res.ok) throw new Error(`Estimation preview failed (${res.status})`);
  return res.json();
}

export async function submitVerification(payload: {
  warehouseId: string;
  photoUrl: string;
  mediaType?: 'photo' | 'video-frame';
  referenceScale?: string;
  receiptPhotoUrl?: string;
  declaredSource?: 'registry' | 'manual';
  geometry: GeometryInputs;
  context: ContextInputs;
  declaredTonnes: number;
  runBy?: { id: string; name: string; role: string };
  agentType?: AgentType;
  bank?: BankAuditFields;
  gov?: GovAuditFields;
  photoVerdict?: Verification['photoVerdict'];
}): Promise<Verification> {
  const res = await fetch(`${API_BASE}/verifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Verification submission failed (${res.status})`);
  }
  return res.json();
}

export async function fetchReviews(status?: string): Promise<ReviewItem[]> {
  const url = status && status !== 'all' ? `${API_BASE}/reviews?status=${status}` : `${API_BASE}/reviews`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load review queue (${res.status})`);
  return res.json();
}

export async function updateReviewItem(
  id: string,
  payload: {
    status?: 'open' | 'resolved' | 'escalated';
    note?: string;
    resolutionType?: string;
    priority?: string;
    assignedTo?: string;
  }
): Promise<ReviewItem> {
  const res = await fetch(`${API_BASE}/reviews/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update review item (${res.status})`);
  return res.json();
}

export async function fetchPortfolioSummary(): Promise<PortfolioSummary> {
  const res = await fetch(`${API_BASE}/portfolio-summary`);
  if (!res.ok) throw new Error(`Failed to load portfolio summary (${res.status})`);
  return res.json();
}

export async function fetchSeasonProfiles(): Promise<Record<string, any>> {
  // Served from /grain-profiles, which already returns `seasons`. Both the
  // Express route and the Vercel function expose the same payload, so there is
  // no need for a second serverless function just for this data.
  const res = await fetch(`${API_BASE}/grain-profiles`);
  if (!res.ok) throw new Error(`Failed to load season profiles (${res.status})`);
  const data = await res.json();
  return (data && typeof data === 'object' && 'seasons' in data ? data.seasons : data) as Record<string, any>;
}

export async function fetchLatestVerifications(): Promise<Record<string, Verification>> {
  const res = await fetch(`${API_BASE}/verifications/latest`);
  if (!res.ok) throw new Error(`Failed to load latest estimates (${res.status})`);
  return res.json();
}

export async function resetDemoData(): Promise<void> {
  const res = await fetch(`${API_BASE}/reset-demo`, { method: 'POST' });
  if (!res.ok) throw new Error(`Reset failed (${res.status})`);
}

export interface GovCheckInput {
  inspectorName: string;
  location: string;
  storageName?: string;
  declaredTonnes: number;
  estCentral: number;
  estLow: number;
  estHigh: number;
  volumeM3: number;
  status: string;
  checkerNote?: string;
  photoDataUrl?: string;
  photoVerdict?: Verification['photoVerdict'];
  verificationId?: string;
  agentType?: AgentType;
  scheme?: GovCheck['scheme'];
}

/** Mint a permanent QR record. Throws an honest error offline — caller shows QR pending + retry. */
export async function postGovCheck(input: GovCheckInput): Promise<GovCheck> {
  const res = await fetch(`${API_BASE}/gov-checks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Record save failed (${res.status})`);
  }
  return res.json();
}

export async function fetchGovCheck(id: string): Promise<GovCheck> {
  const res = await fetch(`${API_BASE}/gov-checks/${encodeURIComponent(id)}`);
  if (res.status === 404) throw new Error('Record not found');
  if (!res.ok) throw new Error(`Record read failed (${res.status})`);
  return res.json();
}

export async function fetchGovChecksByVerification(verificationId: string): Promise<GovCheck[]> {
  const res = await fetch(`${API_BASE}/gov-checks?verificationId=${encodeURIComponent(verificationId)}`);
  if (!res.ok) throw new Error(`Record read failed (${res.status})`);
  return res.json();
}

export async function fetchInspectorProfile(): Promise<InspectorProfile | null> {
  const res = await fetch(`${API_BASE}/inspector-profile`);
  if (!res.ok) throw new Error(`Failed to load profile (${res.status})`);
  const data = await res.json();
  return (data as InspectorProfile | null) || null;
}

export async function saveInspectorProfile(profile: InspectorProfile): Promise<InspectorProfile> {
  const res = await fetch(`${API_BASE}/inspector-profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Failed to save profile (${res.status})`);
  }
  return res.json();
}

// ---- Farmer self-checks (namespaced; QR-verified) ----

export interface FarmerCheckPayload {
  farmerName: string;
  storageName: string;
  location: string;
  grainType: FarmerCheck['grainType'];
  grainName: string;
  declaredTonnes: number;
  estCentral: number;
  estLow: number;
  estHigh: number;
  volumeM3: number;
  match: boolean | null;
  photoVerdict: PhotoVerdict;
  checkerNote: string | null;
  photoDataUrl: string | null;
  heightM: number;
  diameterM: number;
}

export async function submitFarmerCheck(payload: FarmerCheckPayload): Promise<FarmerCheck> {
  const res = await fetch(`${API_BASE}/farmer-checks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Check submission failed (${res.status})`);
  }
  return res.json();
}

export async function fetchFarmerCheckById(id: string): Promise<FarmerCheck> {
  const res = await fetch(`${API_BASE}/farmer-checks/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(res.status === 404 ? 'Check not found' : `Lookup failed (${res.status})`);
  return res.json();
}

/** Read-only farmer history for Inspector lookup context. Never a feed. */
export async function fetchFarmerChecksByFarmer(name: string): Promise<FarmerCheck[]> {
  const res = await fetch(`${API_BASE}/farmer-checks?farmer=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`Lookup failed (${res.status})`);
  return res.json();
}
