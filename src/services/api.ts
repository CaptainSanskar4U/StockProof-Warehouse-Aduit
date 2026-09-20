import { 
  Warehouse, 
  Verification, 
  ReviewItem, 
  PortfolioSummary, 
  EstimationResult, 
  GeometryInputs, 
  ContextInputs 
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

export async function fetchVerifications(warehouseId?: string): Promise<Verification[]> {
  const url = warehouseId ? `${API_BASE}/verifications?warehouseId=${warehouseId}` : `${API_BASE}/verifications`;
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
  const res = await fetch(`${API_BASE}/season-profiles`);
  if (!res.ok) throw new Error(`Failed to load season profiles (${res.status})`);
  return res.json();
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
