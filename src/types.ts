export type GrainType = 'wheat' | 'rice' | 'maize' | 'soybean' | 'pulses' | 'barley';

export type CompactionLevel = 'low' | 'medium' | 'high';

export type Season = 'kharif' | 'rabi' | 'zaid';

export type VerificationStatus = 'consistent' | 'review' | 'high_priority';

export type ReviewStatus = 'open' | 'resolved' | 'escalated';

export type ReviewPriority = 'routine' | 'medium' | 'urgent';

export interface GrainDensityProfile {
  name: string;
  bulkDensity: number; // tonnes per cubic meter
  optimalMoisture: number; // % standard moisture content
  description: string;
}

export interface GeometryInputs {
  pileType: 'cone' | 'frustum';
  heightMeters: number;
  baseDiameterMeters: number;
  topDiameterMeters?: number; // for frustum
  calculatedVolumeM3: number;
  measurementMethod: 'ar_marker' | 'manual_gauge' | 'laser_assisted' | 'visual_estimate';
}

export interface ContextInputs {
  grainType: GrainType;
  season: Season;
  humidityPercent: number; // 0-100%
  compaction: CompactionLevel;
  storageDays: number;
  temperatureCelsius?: number;
}

export interface EstimationResult {
  centralEstimateTonnes: number;
  rangeLowTonnes: number;
  rangeHighTonnes: number;
  confidencePercent: number;
  volumeM3: number;
  effectiveDensity: number;
  status: VerificationStatus;
  discrepancyTonnes: number;
  discrepancyPercent: number;
  explanatoryReason: string;
  auditRecommendation: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  location: string;
  district: string;
  state: string;
  grainTypes: GrainType[];
  currentDeclaredTonnes: number;
  capacityTonnes: number;
  receiptNumber: string;
  receiptIssueDate: string;
  loanReference: string;
  lendingBank: string;
  borrowerName: string;
  lastVerifiedDate: string | null;
  status: VerificationStatus;
  pilePhotoUrl?: string;
}

export type AgentType = 'bank' | 'government';

export type GovScheme = 'Public Distribution System' | 'Buffer Stock' | 'Other';

export interface BankAuditFields {
  farmerName?: string;
  loanRef?: string;
  warehouseName?: string;
}

export interface GovAuditFields {
  warehouseRef?: string;
  region?: string;
  scheme?: GovScheme;
}

export interface PhotoVerdictFinding {
  label: string;
  probability_ai: number;
  probability_real: number;
  confidence: number;
  raw_score: number;
  backend: string;
  filename?: string;
}

/** Photo-authenticity verdict, stored explicitly — never merged into match. */
export type PhotoAuthenticity = 'real' | 'ai' | 'inconclusive' | 'unchecked';

/**
 * Server-stored QR record. The QR points here — never to a file.
 * match: boolean | null, where null = UNVERIFIED.
 * No phone numbers, ever.
 */
export interface GovCheck {
  id: string;
  createdAt: string;
  inspectorName: string;
  location: string;
  storageName?: string;
  declaredTonnes: number;
  estCentral: number;
  estLow: number;
  estHigh: number;
  volumeM3: number;
  match: boolean | null;
  authenticity: PhotoAuthenticity;
  checkerNote?: string;
  photoDataUrl?: string;
  verificationId?: string;
  agentType?: AgentType;
  scheme?: GovScheme;
}

export interface Verification {
  id: string;
  warehouseId: string;
  timestamp: string;
  photoUrl: string;
  mediaType?: 'photo' | 'video-frame';
  referenceScale?: string;
  receiptPhotoUrl?: string;
  declaredSource?: 'registry' | 'manual';
  agentType?: AgentType;
  bank?: BankAuditFields;
  gov?: GovAuditFields;
  photoVerdict?: {
    primary?: PhotoVerdictFinding | null;
    cross?: PhotoVerdictFinding | null;
  };
  geometry: GeometryInputs;
  context: ContextInputs;
  estimate: {
    centralTonnes: number;
    rangeLow: number;
    rangeHigh: number;
    confidencePercent: number;
    effectiveDensity: number;
    volumeM3: number;
  };
  declaredAtTimeOfRun: number;
  discrepancyTonnes: number;
  status: VerificationStatus;
  explanatoryReason: string;
  auditRecommendation: string;
  runBy: {
    id: string;
    name: string;
    role: string;
  };
}

export interface ReviewItem {
  id: string;
  verificationId: string;
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  grainType: GrainType;
  season?: Season;
  priority: ReviewPriority;
  assignedTo: string;
  status: ReviewStatus;
  declaredTonnes: number;
  estimatedRange: [number, number];
  discrepancyTonnes: number;
  confidencePercent: number;
  notes: string[];
  createdAt: string;
  resolvedAt?: string;
  resolutionType?: 'stock_confirmed_physical' | 'shortfall_verified' | 're_audit_ordered' | 'false_positive_recalculated';
}

export interface PortfolioSummary {
  totalWarehouses: number;
  totalDeclaredTonnes: number;
  totalLoanExposureCr: number; // in Crores / standard currency
  tonnageAtRisk: number;
  flaggedCount: number;
  consistentCount: number;
  reviewRequiredCount: number;
  highPriorityCount: number;
  openReviewsCount: number;
}

export type UserRole = 'auditor' | 'risk_officer';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  designation: string;
  organization: string;
  badge: string;
}

export type InspectorType = 'bank' | 'government';

export interface InspectorBankProfile {
  bankName?: string;
  employeeName?: string;
  employeeId?: string;
  idCardDetails?: string;
  contact?: string;
  email?: string;
  region?: string;
  photoDataUrl?: string;
  documentDataUrl?: string;
  documentName?: string;
}

export interface InspectorGovProfile {
  department?: string;
  inspectorName?: string;
  govId?: string;
  designation?: string;
  cardDetails?: string;
  contact?: string;
  email?: string;
  region?: string;
  photoDataUrl?: string;
  documentDataUrl?: string;
  documentName?: string;
}

export interface InspectorProfile {
  inspectorType: InspectorType;
  displayName?: string;
  bank?: InspectorBankProfile;
  gov?: InspectorGovProfile;
  updatedAt?: string;
}

/**
 * Farmer self-check verdict. 'unchecked' means the detector never answered and
 * is never merged into 'real' — an unverified photo is not a genuine photo.
 */
export type PhotoVerdict = 'real' | 'ai' | 'inconclusive' | 'unchecked';

/**
 * Farmer self-check — namespaced store, separate from the Inspector's
 * verifications registry. Written by the Farmer Panel, verified by QR.
 * Read-only for Inspectors (farmer-history lookup only).
 */
export interface FarmerCheck {
  id: string; // fc-<random>, unique per audit, never reused
  createdAt: string; // ISO timestamp
  farmerName: string;
  storageName: string;
  /** Village + district snapshot (public verification shows this, never phone). */
  location: string;
  grainType: GrainType;
  grainName: string;
  declaredTonnes: number;
  estCentral: number;
  estLow: number;
  estHigh: number;
  volumeM3: number;
  /** null = UNVERIFIED (photo not confirmed genuine) */
  match: boolean | null;
  photoVerdict: PhotoVerdict;
  checkerNote: string | null;
  photoDataUrl: string | null;
  heightM: number;
  diameterM: number;
}
