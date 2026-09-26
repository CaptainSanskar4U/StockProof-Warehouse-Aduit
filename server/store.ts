import fs from 'fs';
import path from 'path';
import { Warehouse, Verification, ReviewItem, PortfolioSummary, GrainType, FarmerCheck } from '../src/types.js';

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
  {
    id: 'wh-003',
    name: 'Kota Chambal Agro Vault',
    code: 'KOT-CHM-09',
    location: 'RIICO Industrial Area, Phase II',
    district: 'Kota',
    state: 'Rajasthan',
    grainTypes: ['pulses', 'wheat'],
    currentDeclaredTonnes: 142.0,
    capacityTonnes: 220.0,
    receiptNumber: 'WR-2026-78103',
    receiptIssueDate: '2026-08-12',
    loanReference: 'ICICI-RL-10294',
    lendingBank: 'ICICI Bank Agri Finance',
    borrowerName: 'Hadoti Pulse Aggregators LLP',
    lastVerifiedDate: '2026-09-08T16:45:00Z',
    status: 'review', // 3.8T difference near boundary
    pilePhotoUrl: SAMPLE_GRAIN_IMAGES.pulses_pile,
  },
  {
    id: 'wh-004',
    name: 'Nizamabad Paddy Depot A',
    code: 'NZB-PDY-02',
    location: 'Armoor Road Logistics Park',
    district: 'Nizamabad',
    state: 'Telangana',
    grainTypes: ['rice'],
    currentDeclaredTonnes: 220.0,
    capacityTonnes: 350.0,
    receiptNumber: 'WR-2026-64119',
    receiptIssueDate: '2026-08-05',
    loanReference: 'NABARD-REF-8812',
    lendingBank: 'NABARD Rural Development Banking',
    borrowerName: 'Telangana Rice Milling Consortium',
    lastVerifiedDate: '2026-09-11T09:30:00Z',
    status: 'consistent',
    pilePhotoUrl: SAMPLE_GRAIN_IMAGES.rice_pile,
  },
  {
    id: 'wh-005',
    name: 'Davangere Maize Hub',
    code: 'DVG-MZE-05',
    location: 'APMC Yard, Harihar Highway',
    district: 'Davangere',
    state: 'Karnataka',
    grainTypes: ['maize'],
    currentDeclaredTonnes: 160.0,
    capacityTonnes: 280.0,
    receiptNumber: 'WR-2026-55102',
    receiptIssueDate: '2026-08-01',
    loanReference: 'PNB-COMMOD-4401',
    lendingBank: 'Punjab National Bank',
    borrowerName: 'Cauvery Feed & Starch Products',
    lastVerifiedDate: '2026-09-06T13:00:00Z',
    status: 'high_priority', // Significant over-declaration flagged
    pilePhotoUrl: SAMPLE_GRAIN_IMAGES.maize_pile,
  },
  {
    id: 'wh-006',
    name: 'Ludhiana GT Bulk Logistics',
    code: 'LDH-LOG-11',
    location: 'Sahnewal Dry Port Corridor',
    district: 'Ludhiana',
    state: 'Punjab',
    grainTypes: ['wheat', 'barley'],
    currentDeclaredTonnes: 210.0,
    capacityTonnes: 400.0,
    receiptNumber: 'WR-2026-99201',
    receiptIssueDate: '2026-08-28',
    loanReference: 'AXIS-AGRI-5928',
    lendingBank: 'Axis Bank Agri Portfolio',
    borrowerName: 'Doaba Grain Logistics Pvt Ltd',
    lastVerifiedDate: '2026-09-13T10:00:00Z',
    status: 'consistent',
    pilePhotoUrl: SAMPLE_GRAIN_IMAGES.silo_interior,
  },
  {
    id: 'wh-007',
    name: 'Bhopal Agro Silo Complex',
    code: 'BPL-SIL-03',
    location: 'Mandideep Industrial Belt',
    district: 'Bhopal',
    state: 'Madhya Pradesh',
    grainTypes: ['wheat', 'pulses'],
    currentDeclaredTonnes: 125.0,
    capacityTonnes: 200.0,
    receiptNumber: 'WR-2026-44192',
    receiptIssueDate: '2026-08-15',
    loanReference: 'BOB-AG-30219',
    lendingBank: 'Bank of Baroda',
    borrowerName: 'Vindhya Commodities Corp',
    lastVerifiedDate: '2026-09-04T15:20:00Z',
    status: 'review',
    pilePhotoUrl: SAMPLE_GRAIN_IMAGES.wheat_pile,
  },
  {
    id: 'wh-008',
    name: 'Warangal Grain Terminal 2',
    code: 'WGL-TRM-07',
    location: 'Enumamula Grain Market',
    district: 'Warangal',
    state: 'Telangana',
    grainTypes: ['rice', 'maize'],
    currentDeclaredTonnes: 175.0,
    capacityTonnes: 250.0,
    receiptNumber: 'WR-2026-72814',
    receiptIssueDate: '2026-08-22',
    loanReference: 'CANARA-AG-6019',
    lendingBank: 'Canara Bank Rural Branch',
    borrowerName: 'Kakatiya Agri Infrastructure FPO',
    lastVerifiedDate: '2026-09-09T12:10:00Z',
    status: 'consistent',
    pilePhotoUrl: SAMPLE_GRAIN_IMAGES.rice_pile,
  }
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
    explanatoryReason: 'Estimated range 84.2–89.4 T accounts for 110 m³ pile volume, Wheat bulk density (0.77 t/m³), medium compaction, Kharif season curve, and 12.8% moisture content over 25 days storage. Declared receipt of 100 T exceeds upper boundary by 10.6 T (+10.6%).',
    auditRecommendation: 'Review required before next loan disbursement. Recommend immediate on-site physical core sampling and laser depth re-verification.',
    runBy: {
      id: 'aud-01',
      name: 'Priya Sharma',
      role: 'Senior Field Auditor (North Zone)',
    },
  },
  {
    id: 'ver-102',
    warehouseId: 'wh-003',
    timestamp: '2026-09-08T16:45:00Z',
    photoUrl: SAMPLE_GRAIN_IMAGES.pulses_pile,
    geometry: {
      pileType: 'cone',
      heightMeters: 4.4,
      baseDiameterMeters: 12.2,
      calculatedVolumeM3: 171.4,
      measurementMethod: 'ar_marker',
    },
    context: {
      grainType: 'pulses',
      season: 'rabi',
      humidityPercent: 11.2,
      compaction: 'medium',
      storageDays: 27,
    },
    estimate: {
      centralTonnes: 137.8,
      rangeLow: 133.7,
      rangeHigh: 141.9,
      confidencePercent: 93,
      effectiveDensity: 0.804,
      volumeM3: 171.4,
    },
    declaredAtTimeOfRun: 142.0,
    discrepancyTonnes: 0.1,
    status: 'review',
    explanatoryReason: 'Estimated range 133.7–141.9 T accounts for 171 m³ pile volume, Pulses bulk density (0.80 t/m³), medium compaction, Rabi season curve, and 11.2% moisture over 27 days storage. Declared receipt of 142 T is near the upper bound (+0.1 T difference).',
    auditRecommendation: 'Procedural check recommended. Verify moisture calibration and confirm whether recent consolidation has occurred.',
    runBy: {
      id: 'aud-02',
      name: 'Vikram Rajput',
      role: 'Agri Commodity Inspector',
    },
  },
  {
    id: 'ver-103',
    warehouseId: 'wh-005',
    timestamp: '2026-09-06T13:00:00Z',
    photoUrl: SAMPLE_GRAIN_IMAGES.maize_pile,
    geometry: {
      pileType: 'cone',
      heightMeters: 4.8,
      baseDiameterMeters: 12.0,
      calculatedVolumeM3: 180.9,
      measurementMethod: 'visual_estimate',
    },
    context: {
      grainType: 'maize',
      season: 'kharif',
      humidityPercent: 14.5,
      compaction: 'low',
      storageDays: 36,
    },
    estimate: {
      centralTonnes: 128.4,
      rangeLow: 120.7,
      rangeHigh: 136.1,
      confidencePercent: 84,
      effectiveDensity: 0.710,
      volumeM3: 180.9,
    },
    declaredAtTimeOfRun: 160.0,
    discrepancyTonnes: 23.9,
    status: 'high_priority',
    explanatoryReason: 'Estimated range 120.7–136.1 T accounts for 181 m³ pile volume, Maize bulk density (0.72 t/m³), aerated pile, Kharif season curve, and 14.5% moisture content over 36 days storage. Declared receipt of 160 T exceeds upper boundary by 23.9 T (+14.9%).',
    auditRecommendation: 'High priority mismatch. Notify lending bank credit committee to freeze pledge release until complete physical survey is completed.',
    runBy: {
      id: 'aud-03',
      name: 'K. Ramesh',
      role: 'South Zone Collateral Auditor',
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
  {
    id: 'rev-02',
    verificationId: 'ver-105',
    warehouseId: 'wh-005',
    warehouseName: 'Davangere Maize Hub',
    warehouseLocation: 'Davangere, Karnataka',
    grainType: 'maize',
    season: 'kharif',
    priority: 'urgent',
    assignedTo: 'Nandini Swaminathan (Credit Lead)',
    status: 'open',
    declaredTonnes: 160.0,
    estimatedRange: [120.7, 136.1],
    discrepancyTonnes: 23.9,
    confidencePercent: 84,
    notes: [
      'Substantial volume gap flagged. Pile height measurement was visual; scheduled calibrated laser verification for Sept 15.',
      'Lending bank PNB informed to hold second tranche disbursement pending audit resolution.',
    ],
    createdAt: '2026-09-06T14:10:00Z',
  },
  {
    id: 'rev-03',
    verificationId: 'ver-102',
    warehouseId: 'wh-003',
    warehouseName: 'Kota Chambal Agro Vault',
    warehouseLocation: 'Kota, Rajasthan',
    grainType: 'pulses',
    season: 'rabi',
    priority: 'routine',
    assignedTo: 'Priya Sharma (Field Auditor)',
    status: 'open',
    declaredTonnes: 142.0,
    estimatedRange: [133.7, 141.9],
    discrepancyTonnes: 0.1,
    confidencePercent: 93,
    notes: [
      'Minor boundary variance (+0.1 T above high estimate). Re-checked moisture meter calibration; likely within standard sampling tolerance.',
    ],
    createdAt: '2026-09-08T17:00:00Z',
  },
  {
    id: 'rev-04',
    verificationId: 'ver-099',
    warehouseId: 'wh-007',
    warehouseName: 'Bhopal Agro Silo Complex',
    warehouseLocation: 'Bhopal, Madhya Pradesh',
    grainType: 'wheat',
    season: 'rabi',
    priority: 'medium',
    assignedTo: 'Arjun Mehta (Risk VP)',
    status: 'resolved',
    declaredTonnes: 125.0,
    estimatedRange: [118.0, 126.5],
    discrepancyTonnes: 0,
    confidencePercent: 92,
    notes: [
      'Boundary check completed. Operator provided certified weighbridge tare slips from harvest intake. Stock confirmed within acceptable variance.',
    ],
    createdAt: '2026-09-04T16:00:00Z',
    resolvedAt: '2026-09-05T11:30:00Z',
    resolutionType: 'stock_confirmed_physical',
  }
];

export interface StorageData {
  warehouses: Warehouse[];
  verifications: Verification[];
  reviews: ReviewItem[];
  farmerChecks: FarmerCheck[];
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
          if (!Array.isArray(parsed.farmerChecks)) {
            parsed.farmerChecks = [];
          }
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
      farmerChecks: [],
    };
    this.saveData(defaultData);
    return defaultData;
  }

  /** Backfill season + media fields for records saved before season-aware calibration. */
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
    }
    for (const r of parsed.reviews) {
      const rRec = r as unknown as Record<string, unknown>;
      if (!rRec['season']) {
        const linked = parsed.verifications.find(ver => ver.id === r.verificationId);
        rRec['season'] = (linked?.context as unknown as Record<string, unknown>)?.['season'] || 'rabi';
        mutated = true;
      }
    }
    if (mutated) {
      this.saveData(parsed);
    }
    return parsed;
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

  public getVerifications(warehouseId?: string): Verification[] {
    if (warehouseId) {
      return this.data.verifications
        .filter(v => v.warehouseId === warehouseId)
        .sort((a, b) => (new Date(b.timestamp).getTime() || 0) - (new Date(a.timestamp).getTime() || 0));
    }
    return [...this.data.verifications].sort((a, b) => (new Date(b.timestamp).getTime() || 0) - (new Date(a.timestamp).getTime() || 0));
  }

  /** Latest verification per warehouse — powers the console's declared-vs-estimated cards. */
  public getLatestVerificationPerWarehouse(): Record<string, Verification> {
    const sorted = [...this.data.verifications].sort(
      (a, b) => (new Date(b.timestamp).getTime() || 0) - (new Date(a.timestamp).getTime() || 0)
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

  // ---- Farmer self-checks (namespaced; never part of Inspector queues) ----

  public addFarmerCheck(check: FarmerCheck): FarmerCheck {
    this.data.farmerChecks.unshift(check);
    this.saveData(this.data);
    return check;
  }

  public getFarmerCheckById(id: string): FarmerCheck | undefined {
    return this.data.farmerChecks.find(c => c.id === id);
  }

  /** Read-only farmer history, exact name match (case-insensitive). */
  public getFarmerChecksByFarmer(name: string): FarmerCheck[] {
    const needle = name.trim().toLowerCase();
    if (!needle) return [];
    return this.data.farmerChecks
      .filter(c => c.farmerName.trim().toLowerCase() === needle)
      .sort((a, b) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0));
  }

  public getReviews(): ReviewItem[] {    return [...this.data.reviews].sort((a, b) => {
      // Open items first, then sort by priority (urgent > medium > routine)
      if (a.status === 'open' && b.status !== 'open') return -1;
      if (a.status !== 'open' && b.status === 'open') return 1;
      const prioOrder: Record<string, number> = { urgent: 0, medium: 1, routine: 2 };
      const diff = (prioOrder[a.priority] ?? 2) - (prioOrder[b.priority] ?? 2);
      if (diff !== 0) return diff;
      return (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0);
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
    // Demo reset restores the Inspector seed data but NEVER wipes farmer
    // self-checks — QR verification links must keep resolving.
    const farmerChecks = this.data.farmerChecks;
    this.data = {
      warehouses: INITIAL_WAREHOUSES,
      verifications: INITIAL_VERIFICATIONS,
      reviews: INITIAL_REVIEWS,
      farmerChecks,
    };
    this.saveData(this.data);
    return this.data;
  }
}

export const store = new StorageManager();
