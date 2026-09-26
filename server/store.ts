import fs from 'fs';
import path from 'path';
import { Warehouse, Verification, ReviewItem, PortfolioSummary, GrainType, InspectorProfile, GovCheck, FarmerCheck } from '../src/types.js';

// Vercel serverless filesystem is read-only except /tmp — use it when deployed.
const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', 'stockproof-data')
  : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'storage.json');

// Expired CDN photo ID replaced by a verified warehouse-sacks photograph.
const DEAD_SOYBEAN_URL = 'photo-1511497584788-87676104235f';

// High-fidelity, royalty-free warehouse grain pile reference imagery
export const SAMPLE_GRAIN_IMAGES = {
  wheat_pile: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=1200&q=80',
  rice_pile: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1200&q=80',
  maize_pile: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=1200&q=80',
  soybean_pile: 'https://images.unsplash.com/photo-1569718974246-7b898eae87d3?auto=format&fit=crop&w=1200&q=80',
  pulses_pile: 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?auto=format&fit=crop&w=1200&q=80',
  silo_interior: 'https://images.unsplash.com/photo-1595246140625-573b715d11dc?auto=format&fit=crop&w=1200&q=80',
};

export const INITIAL_WAREHOUSES: Warehouse[] = [
  {
    id: 'wh-001',
    name: 'Karnal Central Agro Terminal',
    code: 'KRN-SILO-01',
    location: 'Sector 4, GT Road Industrial Hub',
    district: 'Karnal',
    state: 'Haryana',
    grainTypes: ['wheat'],
    currentDeclaredTonnes: 100.0,
    capacityTonnes: 250.0,
    receiptNumber: 'WR-2026-88219',
    receiptIssueDate: '2026-08-18',
    loanReference: 'AGRI-LN-772901',
    lendingBank: 'State Bank of India (Agri Division)',
    borrowerName: 'Shivalik Agritech FPO Ltd.',
    lastVerifiedDate: '2026-09-12T14:30:00Z',
    status: 'high_priority', // Declared 100 T, but estimated range is ~84-90 T -> High priority shortfall
    pilePhotoUrl: SAMPLE_GRAIN_IMAGES.wheat_pile,
  },
  {
    id: 'wh-002',
    name: 'Indore Mandi Grain Reserve',
    code: 'IND-AGRI-04',
    location: 'Laxmibai Nagar Mandi Complex',
    district: 'Indore',
    state: 'Madhya Pradesh',
    grainTypes: ['soybean', 'wheat'],
    currentDeclaredTonnes: 185.0,
    capacityTonnes: 300.0,
    receiptNumber: 'WR-2026-90412',
    receiptIssueDate: '2026-08-25',
    loanReference: 'HDFC-AG-49910',
    lendingBank: 'HDFC Bank Rural Credit',
    borrowerName: 'Malwa Soya Traders & Processors',
    lastVerifiedDate: '2026-09-10T11:15:00Z',
    status: 'consistent',
    pilePhotoUrl: SAMPLE_GRAIN_IMAGES.soybean_pile,
  },
];

export const INITIAL_VERIFICATIONS: Verification[] = [
  {
    id: 'ver-101',
    warehouseId: 'wh-001',
    timestamp: '2026-09-12T14:30:00Z',
    photoUrl: SAMPLE_GRAIN_IMAGES.wheat_pile,
    geometry: {
      pileType: 'cone',
      heightMeters: 3.8,
      baseDiameterMeters: 10.5,
      calculatedVolumeM3: 109.7,
      measurementMethod: 'laser_assisted',
    },
    context: {
      grainType: 'wheat',
      season: 'kharif',
      humidityPercent: 12.8,
      compaction: 'medium',
      storageDays: 25,
    },
    estimate: {
      centralTonnes: 86.8,
      rangeLow: 84.2,
      rangeHigh: 89.4,
      confidencePercent: 94,
      effectiveDensity: 0.791,
      volumeM3: 109.7,
    },
    declaredAtTimeOfRun: 100.0,
    discrepancyTonnes: 10.6,
    status: 'high_priority',
    agentType: 'bank',
    bank: {
      farmerName: 'Shivalik Agritech FPO Ltd.',
      loanRef: 'AGRI-LN-772901',
      warehouseName: 'Karnal Central Agro Terminal',
    },
    explanatoryReason: 'Estimated range 84.2–89.4 T accounts for 110 m³ pile volume, Wheat bulk density (0.77 t/m³), medium compaction, Kharif season curve, and 12.8% moisture content over 25 days storage. Declared receipt of 100 T exceeds upper boundary by 10.6 T (+10.6%).',
    auditRecommendation: 'Review required before next loan disbursement. Recommend immediate on-site physical core sampling and laser depth re-verification.',
    runBy: {
      id: 'aud-01',
      name: 'Priya Sharma',
      role: 'Senior Field Auditor (North Zone)',
    },
  },
  {
    id: 'ver-104',
    warehouseId: 'wh-002',
    timestamp: '2026-09-10T11:15:00Z',
    photoUrl: SAMPLE_GRAIN_IMAGES.soybean_pile,
    geometry: {
      pileType: 'cone',
      heightMeters: 5.2,
      baseDiameterMeters: 13.5,
      calculatedVolumeM3: 248.0,
      measurementMethod: 'laser_assisted',
    },
    context: {
      grainType: 'soybean',
      season: 'rabi',
      humidityPercent: 11.8,
      compaction: 'high',
      storageDays: 16,
    },
    estimate: {
      centralTonnes: 186.2,
      rangeLow: 180.6,
      rangeHigh: 191.8,
      confidencePercent: 96,
      effectiveDensity: 0.751,
      volumeM3: 248.0,
    },
    declaredAtTimeOfRun: 185.0,
    discrepancyTonnes: 0,
    status: 'consistent',
    agentType: 'government',
    gov: {
      warehouseRef: 'IND-AGRI-04',
      region: 'Indore, Madhya Pradesh',
      scheme: 'Buffer Stock',
    },
    explanatoryReason: 'Estimated range 180.6–191.8 T accounts for 248 m³ pile volume, Soybean bulk density (0.77 t/m³), dense compaction, Rabi season curve, and 11.8% moisture over 16 days storage. Declared receipt of 185 T falls comfortably within the physical confidence bounds.',
    auditRecommendation: 'Declared stock aligns with physical geometry and grain density parameters. Routine audit schedule maintained.',
    runBy: {
      id: 'aud-01',
      name: 'Priya Sharma',
      role: 'Senior Field Auditor (North Zone)',
    },
  },
];

export const INITIAL_REVIEWS: ReviewItem[] = [
  {
    id: 'rev-01',
    verificationId: 'ver-101',
    warehouseId: 'wh-001',
    warehouseName: 'Karnal Central Agro Terminal',
    warehouseLocation: 'Karnal, Haryana',
    grainType: 'wheat',
    season: 'kharif',
    priority: 'urgent',
    assignedTo: 'Arjun Mehta (Risk VP)',
    status: 'open',
    declaredTonnes: 100.0,
    estimatedRange: [84.2, 89.4],
    discrepancyTonnes: 10.6,
    confidencePercent: 94,
    notes: [
      'Preliminary discrepancy of 10.6 T detected. Borrower Shivalik Agritech FPO notified for secondary weighment.',
      'Auditor Priya Sharma requested physical coring to test for internal hollow stacking or moisture variance.',
    ],
    createdAt: '2026-09-12T15:00:00Z',
  },
];

export interface StorageData {
  warehouses: Warehouse[];
  verifications: Verification[];
  reviews: ReviewItem[];
  profile?: InspectorProfile | null;
  govChecks?: GovCheck[];
  /** Farmer self-checks. Namespaced — never part of Inspector queues. */
  farmerChecks?: FarmerCheck[];
}

/**
 * Demo inspector identity, seeded in code.
 *
 * data/storage.json is gitignored, so a profile written there exists only on the
 * machine that saved it — a deployed instance would still show the generic
 * "Field Inspector". Seeding here means the demo identity is present on a fresh
 * clone, on Vercel, and after a demo reset. Remove this before a real launch.
 *
 * No phone numbers: `contact` stays empty so the identity can never leak into a
 * public verification record.
 */
export const DEMO_PROFILE: InspectorProfile = {
  inspectorType: 'government',
  displayName: 'Ramesh Patel',
  bank: {
    bankName: 'Nashik District Co-operative Bank',
    employeeName: 'Sunita Desai',
    employeeId: 'EMP-2291',
    idCardDetails: 'Aadhaar ending 4417 · Maharashtra State Co-operative Credit Card',
    contact: undefined,
    email: 'sunita.desi@nashikdcb.in',
    region: 'Nashik, Maharashtra',
  },
  gov: {
    department: 'District Food & Civil Supplies Department, Nashik',
    inspectorName: 'Ramesh Patel',
    govId: 'GOV-NSK-0417',
    designation: 'Senior Stock Inspector',
    cardDetails: 'Government Photo ID ending 0417 · Divisional Supply Office, Nashik',
    contact: undefined,
    email: 'ramesh.patel@foodsup.nashik.gov.in',
    region: 'Nashik, Maharashtra',
  },
};

/**
 * Merge a profile branch field-by-field.
 *
 * Both the Express route and the serverless function always send a bank and gov
 * object, so a partial save arrives as a full object whose untouched fields are
 * `undefined`. A plain `?? previous` on the whole branch would therefore discard
 * the saved values, so undefined incoming fields must be dropped individually.
 */
export function mergeProfileBranch<T extends object>(prev: T | undefined, next: T | undefined): T | undefined {
  if (!prev && !next) return undefined;
  const defined = Object.entries(next || {}).filter(([, v]) => v !== undefined);
  return { ...(prev || {}), ...Object.fromEntries(defined) } as T;
}

class StorageManager {
  private data: StorageData;

  constructor() {
    this.ensureDataDir();
    this.data = this.loadData();
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadData(): StorageData {
    try {
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(fileContent);
        if (parsed.warehouses && parsed.verifications && parsed.reviews) {
          return this.migrateLegacyData(parsed);
        }
      }
    } catch (err) {
      console.warn('Failed to load storage.json, initializing fresh store:', err);
    }

    const defaultData: StorageData = {
      warehouses: INITIAL_WAREHOUSES,
      verifications: INITIAL_VERIFICATIONS,
      reviews: INITIAL_REVIEWS,
      profile: JSON.parse(JSON.stringify(DEMO_PROFILE)),
      govChecks: [],
      farmerChecks: [],
    };
    this.saveData(defaultData);
    return defaultData;
  }

  /** Backfill season + media + agentType fields for records saved before agent-aware Inspector Panel. */
  private migrateLegacyData(parsed: StorageData): StorageData {
    let mutated = false;
    // Swap the expired soybean CDN photo for the verified replacement.
    for (const w of parsed.warehouses) {
      if (w.pilePhotoUrl && w.pilePhotoUrl.includes(DEAD_SOYBEAN_URL)) {
        w.pilePhotoUrl = SAMPLE_GRAIN_IMAGES.soybean_pile;
        mutated = true;
      }
    }
    for (const v of parsed.verifications) {
      if (v.photoUrl && v.photoUrl.includes(DEAD_SOYBEAN_URL)) {
        v.photoUrl = SAMPLE_GRAIN_IMAGES.soybean_pile;
        mutated = true;
      }
      const ctx = v.context as unknown as Record<string, unknown>;
      if (!ctx['season']) {
        ctx['season'] = 'rabi';
        mutated = true;
      }
      const vRec = v as unknown as Record<string, unknown>;
      if (!vRec['mediaType']) {
        vRec['mediaType'] = 'photo';
        mutated = true;
      }
      // Single-store migration: legacy audits predate agent split, default to bank so
      // Bank Checks keeps showing history and Dashboard counts stay correct.
      if (!vRec['agentType']) {
        vRec['agentType'] = 'bank';
        mutated = true;
      }
    }
    for (const r of parsed.reviews) {
      const rRec = r as unknown as Record<string, unknown>;
      if (!rRec['season']) {
        const linked = parsed.verifications.find(ver => ver.id === r.verificationId);
        rRec['season'] = (linked?.context as unknown as Record<string, unknown>)?.['season'] || 'rabi';
        mutated = true;
      }
    }
    // Profile field added later — default to null without overwriting a saved profile.
    if (!('profile' in parsed)) {
      (parsed as StorageData).profile = null;
      mutated = true;
    }
    // QR gov-checks must survive everything, including resets — never reseed them.
    if (!Array.isArray((parsed as StorageData).govChecks)) {
      (parsed as StorageData).govChecks = [];
      mutated = true;
    }
    // Farmer self-checks are QR-backed too — their ?verify= links must resolve.
    if (!Array.isArray((parsed as StorageData).farmerChecks)) {
      (parsed as StorageData).farmerChecks = [];
      mutated = true;
    }
    if (mutated) {
      this.saveData(parsed);
    }
    return parsed;
  }

  // ---- Farmer self-checks (namespaced; never part of Inspector queues) ----

  public addFarmerCheck(check: FarmerCheck): FarmerCheck {
    if (!Array.isArray(this.data.farmerChecks)) this.data.farmerChecks = [];
    this.data.farmerChecks.unshift(check);
    this.saveData(this.data);
    return check;
  }

  public getFarmerCheckById(id: string): FarmerCheck | undefined {
    return (this.data.farmerChecks || []).find((c) => c.id === id);
  }

  /** Read-only farmer history, exact name match (case-insensitive). Never a feed. */
  public getFarmerChecksByFarmer(name: string): FarmerCheck[] {
    const needle = name.trim().toLowerCase();
    if (!needle) return [];
    return (this.data.farmerChecks || [])
      .filter((c) => (c.farmerName || '').trim().toLowerCase() === needle)
      .sort((a, b) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0));
  }

  public addGovCheck(record: GovCheck): GovCheck {
    if (!Array.isArray(this.data.govChecks)) this.data.govChecks = [];
    this.data.govChecks.unshift(record);
    this.saveData(this.data);
    return record;
  }

  public getGovCheckById(id: string): GovCheck | undefined {
    return (this.data.govChecks || []).find((g) => g.id === id);
  }

  /** All QR records minted for one verification (newest first). */
  public getGovChecksByVerification(verificationId: string): GovCheck[] {
    return (this.data.govChecks || [])
      .filter((g) => g.verificationId === verificationId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /** Read-only history for official lookups — case-insensitive inspector-name match. */
  public getGovChecksByOfficial(name: string): GovCheck[] {
    const q = name.trim().toLowerCase();
    return (this.data.govChecks || [])
      .filter((g) => g.inspectorName.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getProfile(): InspectorProfile | null {
    return this.data.profile || null;
  }

  public saveProfile(profile: InspectorProfile): InspectorProfile {
    // Merge, do not replace. The bank and government branches are separate
    // identities sharing one record, so saving one must never wipe the other.
    const previous = this.data.profile || undefined;
    const clean: InspectorProfile = {
      inspectorType: profile.inspectorType === 'government' ? 'government' : 'bank',
      displayName: typeof profile.displayName === 'string' && profile.displayName.trim()
        ? profile.displayName.slice(0, 120)
        : previous?.displayName,
      bank: mergeProfileBranch(previous?.bank, profile.bank),
      gov: mergeProfileBranch(previous?.gov, profile.gov),
      updatedAt: new Date().toISOString(),
    };
    this.data.profile = clean;
    this.saveData(this.data);
    return clean;
  }

  private saveData(data: StorageData) {
    try {
      this.ensureDataDir();
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving storage.json:', err);
    }
  }

  public getWarehouses(): Warehouse[] {
    return this.data.warehouses;
  }

  public getWarehouseById(id: string): Warehouse | undefined {
    return this.data.warehouses.find(w => w.id === id);
  }

  public updateWarehouse(id: string, updates: Partial<Warehouse>): Warehouse | undefined {
    const idx = this.data.warehouses.findIndex(w => w.id === id);
    if (idx === -1) return undefined;
    this.data.warehouses[idx] = { ...this.data.warehouses[idx], ...updates };
    this.saveData(this.data);
    return this.data.warehouses[idx];
  }

  public getVerifications(warehouseId?: string, agentType?: string): Verification[] {
    let list = [...this.data.verifications];
    if (warehouseId) {
      list = list.filter(v => v.warehouseId === warehouseId);
    }
    if (agentType === 'bank' || agentType === 'government') {
      list = list.filter(v => (v.agentType || 'bank') === agentType);
    }
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /** Latest verification per warehouse — powers the console's declared-vs-estimated cards. */
  public getLatestVerificationPerWarehouse(): Record<string, Verification> {
    const sorted = [...this.data.verifications].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const latest: Record<string, Verification> = {};
    for (const v of sorted) {
      if (!latest[v.warehouseId]) {
        latest[v.warehouseId] = v;
      }
    }
    return latest;
  }

  public addVerification(verification: Verification): Verification {
    this.data.verifications.unshift(verification);

    // Update warehouse status and last verified date
    this.updateWarehouse(verification.warehouseId, {
      status: verification.status,
      lastVerifiedDate: verification.timestamp,
      pilePhotoUrl: verification.photoUrl || undefined,
    });

    // If verification requires review or is high priority, auto-register in review queue if not already open
    if (verification.status === 'high_priority' || verification.status === 'review') {
      const warehouse = this.getWarehouseById(verification.warehouseId);
      const newReview: ReviewItem = {
        id: `rev-${Date.now().toString().slice(-6)}`,
        verificationId: verification.id,
        warehouseId: verification.warehouseId,
        warehouseName: warehouse?.name || 'Warehouse',
        warehouseLocation: warehouse ? `${warehouse.district}, ${warehouse.state}` : 'Location',
        grainType: verification.context.grainType,
        season: (verification.context as { season?: ReviewItem['season'] }).season || 'rabi',
        priority: verification.status === 'high_priority' ? 'urgent' : 'medium',
        assignedTo: verification.status === 'high_priority' ? 'Arjun Mehta (Risk VP)' : 'Priya Sharma (Field Auditor)',
        status: 'open',
        declaredTonnes: verification.declaredAtTimeOfRun,
        estimatedRange: [verification.estimate.rangeLow, verification.estimate.rangeHigh],
        discrepancyTonnes: verification.discrepancyTonnes,
        confidencePercent: verification.estimate.confidencePercent,
        notes: [
          `Verification on ${new Date(verification.timestamp).toLocaleDateString()} resulted in ${verification.status === 'high_priority' ? 'HIGH PRIORITY discrepancy' : 'Review Required'}.`,
          verification.auditRecommendation,
        ],
        createdAt: new Date().toISOString(),
      };
      this.data.reviews.unshift(newReview);
    }

    this.saveData(this.data);
    return verification;
  }

  public getReviews(): ReviewItem[] {
    return [...this.data.reviews].sort((a, b) => {
      // Open items first, then sort by priority (urgent > medium > routine)
      if (a.status === 'open' && b.status !== 'open') return -1;
      if (a.status !== 'open' && b.status === 'open') return 1;
      const prioOrder: Record<string, number> = { urgent: 0, medium: 1, routine: 2 };
      const diff = (prioOrder[a.priority] ?? 2) - (prioOrder[b.priority] ?? 2);
      if (diff !== 0) return diff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  public updateReview(id: string, updates: Partial<ReviewItem>): ReviewItem | undefined {
    const idx = this.data.reviews.findIndex(r => r.id === id);
    if (idx === -1) return undefined;
    
    this.data.reviews[idx] = { ...this.data.reviews[idx], ...updates };

    // If review is resolved, check if warehouse status should be updated
    if (updates.status === 'resolved') {
      const rev = this.data.reviews[idx];
      const remainingOpenForWh = this.data.reviews.filter(r => r.warehouseId === rev.warehouseId && r.status === 'open' && r.id !== id);
      if (remainingOpenForWh.length === 0) {
        this.updateWarehouse(rev.warehouseId, { status: 'consistent' });
      }
    }

    this.saveData(this.data);
    return this.data.reviews[idx];
  }

  public getPortfolioSummary(): PortfolioSummary {
    const totalWarehouses = this.data.warehouses.length;
    let totalDeclaredTonnes = 0;
    let tonnageAtRisk = 0;
    let consistentCount = 0;
    let reviewRequiredCount = 0;
    let highPriorityCount = 0;

    for (const wh of this.data.warehouses) {
      totalDeclaredTonnes += wh.currentDeclaredTonnes;
      if (wh.status === 'consistent') {
        consistentCount++;
      } else if (wh.status === 'review') {
        reviewRequiredCount++;
        tonnageAtRisk += wh.currentDeclaredTonnes * 0.15; // estimated exposure
      } else if (wh.status === 'high_priority') {
        highPriorityCount++;
        tonnageAtRisk += wh.currentDeclaredTonnes; // full lot at risk
      }
    }

    const openReviewsCount = this.data.reviews.filter(r => r.status === 'open').length;
    // Standard commodity collateral value: ~₹25,000 to ₹35,000 per tonne (~₹0.003 Cr/T)
    const totalLoanExposureCr = Number(((totalDeclaredTonnes * 0.026)).toFixed(2));

    return {
      totalWarehouses,
      totalDeclaredTonnes: Number(totalDeclaredTonnes.toFixed(1)),
      totalLoanExposureCr,
      tonnageAtRisk: Number(tonnageAtRisk.toFixed(1)),
      flaggedCount: reviewRequiredCount + highPriorityCount,
      consistentCount,
      reviewRequiredCount,
      highPriorityCount,
      openReviewsCount,
    };
  }

  public resetToDefaults() {
    // QR gov-check records survive demo resets explicitly — they are permanent evidence.
    const preserved = Array.isArray(this.data.govChecks) ? this.data.govChecks : [];
    // Farmer self-checks are QR-backed as well - their verify links must keep resolving.
    const preservedFarmer = Array.isArray(this.data.farmerChecks) ? this.data.farmerChecks : [];
    this.data = {
      warehouses: INITIAL_WAREHOUSES,
      verifications: INITIAL_VERIFICATIONS,
      reviews: INITIAL_REVIEWS,
      profile: this.data.profile || null,
      govChecks: preserved,
      farmerChecks: preservedFarmer,
    };
    this.saveData(this.data);
    return this.data;
  }
}

export const store = new StorageManager();
