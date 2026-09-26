import React, { useState } from 'react';
import { Warehouse, PortfolioSummary, Verification } from '../types.js';
import { NewAuditTab } from './NewAuditTab.js';
import { BankableTab, GeometryTab, ReverseTab } from './proof/ProofTabs.js';
import { SharedAuditProvider } from './proof/SharedAuditContext.js';
import { InspectorDashboard } from './InspectorDashboard.js';
import { AuditRecordsTab } from './AuditRecordsTab.js';
import { RecordDetailModal } from './RecordDetailModal.js';
import {
  Camera,
  LayoutGrid,
  FlipHorizontal2,
  Ruler,
  PiggyBank,
  Landmark,
  ClipboardCheck
} from 'lucide-react';

interface DashboardViewProps {
  warehouses: Warehouse[];
  summary: PortfolioSummary | null;
  currentAuditor: { id: string; name: string; role: string };
  onSelectWarehouse: (warehouse: Warehouse) => void;
  onStartVerification: (warehouse: Warehouse) => void;
  onOpenReport: () => void;
  onOpenReviewQueue: () => void;
  onNavigateToOverview?: () => void;
  onVerificationSaved: (verification: Verification) => void;
  isLoading: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  warehouses,
  summary,
  currentAuditor,
  onSelectWarehouse,
  onStartVerification,
  onOpenReport,
  onOpenReviewQueue,
  onNavigateToOverview,
  onVerificationSaved,
  isLoading,
}) => {
  // Inspector Panel inner tabs: Dashboard → New Audit → Bank Checks → Government Audit → Reverse Proof → Geometry → Bankable.
  // Profile lives in the top bar beside Audit Report. Warehouse Portfolio UI removed
  // (data preserved in store for New Audit dropdown + summaries).
  type InspectorTab = 'dashboard' | 'new-audit' | 'bank-checks' | 'gov-audit' | 'reverse' | 'geometry' | 'bankable';
  const [activeTab, setActiveTab] = useState<InspectorTab>('dashboard');
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const [selectedRecord, setSelectedRecord] = useState<Verification | null>(null);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top breadcrumb navigation back to overview */}
      {onNavigateToOverview && (
        <div className="flex items-center justify-between text-xs font-mono border-b border-[var(--hairline)] pb-2">
          <button
            onClick={onNavigateToOverview}
            className="text-[var(--ink-soft)] hover:text-[var(--gold)] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>←</span>
            <span>Product Overview & Agronomic Thesis</span>
          </button>
          <span className="text-[10px] text-[var(--ink-soft)] tracking-widest uppercase">
            Inspector Panel
          </span>
        </div>
      )}

      {/* Inspector Panel tabs — Dashboard first, Bank Checks replaces Review Queue, Portfolio removed, Profile at top */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[var(--hairline)] pb-2.5">
        {([
          { id: 'dashboard', label: 'DASHBOARD', Icon: LayoutGrid },
          { id: 'new-audit', label: 'NEW AUDIT', Icon: Camera },
          { id: 'bank-checks', label: 'BANK CHECKS', Icon: ClipboardCheck },
          { id: 'gov-audit', label: 'GOVERNMENT AUDIT', Icon: Landmark },
          { id: 'reverse', label: 'REVERSE PROOF', Icon: FlipHorizontal2 },
          { id: 'geometry', label: 'GEOMETRY', Icon: Ruler },
          { id: 'bankable', label: 'BANKABLE', Icon: PiggyBank },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`touch-target px-4 py-2 rounded-full text-xs font-mono tracking-wider flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === id
                ? 'bg-[var(--ink)] text-[var(--ink-inverse)] font-bold shadow-xs'
                : 'text-[var(--ink-soft)] hover:text-[var(--ink-2)] bg-[var(--sheet)] border border-[var(--hairline)]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <SharedAuditProvider>
      {activeTab === 'dashboard' ? (
        <InspectorDashboard
          refreshKey={auditRefreshKey}
          onOpenRecord={(v) => setSelectedRecord(v)}
          onGoToBank={() => setActiveTab('bank-checks')}
          onGoToGov={() => setActiveTab('gov-audit')}
        />
      ) : activeTab === 'new-audit' ? (
        <NewAuditTab
          warehouses={warehouses}
          currentAuditor={currentAuditor}
          onVerificationSaved={(v) => { setAuditRefreshKey((k) => k + 1); onVerificationSaved(v); }}
        />
      ) : activeTab === 'bank-checks' ? (
        <AuditRecordsTab agentType="bank" refreshKey={auditRefreshKey} onOpenRecord={(v) => setSelectedRecord(v)} />
      ) : activeTab === 'gov-audit' ? (
        <AuditRecordsTab agentType="government" refreshKey={auditRefreshKey} onOpenRecord={(v) => setSelectedRecord(v)} />
      ) : activeTab === 'reverse' ? (
        <ReverseTab />
      ) : activeTab === 'geometry' ? (
        <GeometryTab />
      ) : activeTab === 'bankable' ? (
        <BankableTab />
      ) : (
        <InspectorDashboard refreshKey={auditRefreshKey} onOpenRecord={(v) => setSelectedRecord(v)} />
      )}
      {selectedRecord && (
        <RecordDetailModal
          record={selectedRecord}
          warehouse={warehouses.find((w) => w.id === selectedRecord.warehouseId)}
          onClose={() => setSelectedRecord(null)}
        />
      )}
      </SharedAuditProvider>
    </div>
  );
};
