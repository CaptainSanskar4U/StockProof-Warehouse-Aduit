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

export interface Verification {
  id: string;
  warehouseId: string;
  timestamp: string;
  photoUrl: string;
  mediaType?: 'photo' | 'video-frame';
  referenceScale?: string;
  receiptPhotoUrl?: string;
  declaredSource?: 'registry' | 'manual';
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
