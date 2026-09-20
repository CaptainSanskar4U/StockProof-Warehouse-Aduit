import React, { useState, useEffect } from 'react';
import { Warehouse, PortfolioSummary, UserRole, Verification, Season } from '../types.js';
import { StatusChip } from './StatusChip.js';
import { MetricCard } from './MetricCard.js';
import { NewAuditTab } from './NewAuditTab.js';
import { SEASON_PROFILES } from '../seasonProfiles.js';
import { 
  Building2, 
  MapPin, 
  Calendar, 
  FileText, 
  Search, 
  Filter, 
  Play, 
  ChevronRight, 
  AlertOctagon, 
  AlertTriangle, 
  CheckCircle2, 
  Scale, 
  Layers, 
  FileSpreadsheet,
  Plus,
  Camera,
  LayoutGrid
} from 'lucide-react';

interface DashboardViewProps {
  warehouses: Warehouse[];
  summary: PortfolioSummary | null;
  currentRole: UserRole;
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
  currentRole,
  currentAuditor,
  onSelectWarehouse,
  onStartVerification,
  onOpenReport,
  onOpenReviewQueue,
  onNavigateToOverview,
  onVerificationSaved,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState<'new-audit' | 'portfolio'>('new-audit');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedSeasonFilter, setSelectedSeasonFilter] = useState<string>('all');
  const [latestMap, setLatestMap] = useState<Record<string, Verification>>({});

  useEffect(() => {
    fetch('/api/verifications/latest')
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => setLatestMap(data || {}))
      .catch(() => setLatestMap({}));
  }, [warehouses.length]);

  const getLatest = (warehouseId: string): Verification | undefined => latestMap[warehouseId];

  const overAmount = (w: Warehouse): number => {
    const latest = getLatest(w.id);
    if (!latest) return -9999;
    if (w.currentDeclaredTonnes > latest.estimate.rangeHigh) {
      return w.currentDeclaredTonnes - latest.estimate.rangeHigh;
    }
    if (w.currentDeclaredTonnes < latest.estimate.rangeLow) {
      return -0.5; // under-declared sorts below over-declared but above unverified
    }
    return 0;
  };

  // Filter warehouses based on status, season curve, and search query
  const filteredWarehouses = warehouses
    .filter((w) => {
      if (selectedStatusFilter !== 'all' && w.status !== selectedStatusFilter) {
        return false;
      }
      if (selectedSeasonFilter !== 'all') {
        const s = (getLatest(w.id)?.context as { season?: Season } | undefined)?.season;
        if (s !== selectedSeasonFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          w.name.toLowerCase().includes(q) ||
          w.code.toLowerCase().includes(q) ||
          w.district.toLowerCase().includes(q) ||
          w.state.toLowerCase().includes(q) ||
          w.receiptNumber.toLowerCase().includes(q) ||
          w.grainTypes.some((g) => g.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => {
      // Console triage: riskiest collateral first — catch overstatement before the visit
      const order: Record<string, number> = { high_priority: 0, review: 1, consistent: 2 };
      const diff = (order[a.status] ?? 3) - (order[b.status] ?? 3);
      if (diff !== 0) return diff;
      return overAmount(b) - overAmount(a);
    });

  const highPriorityCount = warehouses.filter((w) => w.status === 'high_priority').length;
  const reviewRequiredCount = warehouses.filter((w) => w.status === 'review').length;
  const consistentCount = warehouses.filter((w) => w.status === 'consistent').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top breadcrumb navigation back to overview */}
      {onNavigateToOverview && (
        <div className="flex items-center justify-between text-xs font-mono border-b border-[#3D3226]/10 pb-2">
          <button
            onClick={onNavigateToOverview}
            className="text-[#2B2016]/55 hover:text-[#B98A2E] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>←</span>
            <span>Product Overview & Agronomic Thesis</span>
          </button>
          <span className="text-[10px] text-[#2B2016]/55 tracking-widest uppercase">
            Live Console Mode
          </span>
        </div>
      )}

      {/* Console tabs — New Audit is the default landing tab */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[#3D3226]/10 pb-2.5">
        <button
          type="button"
          onClick={() => setActiveTab('new-audit')}
          className={`touch-target px-4 py-2 rounded-full text-xs font-mono tracking-wider flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'new-audit'
              ? 'bg-[#2B2016] text-white font-bold shadow-xs'
              : 'text-[#2B2016]/55 hover:text-[#3D3226] bg-white border border-[#3D3226]/10'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>NEW AUDIT</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('portfolio')}
          className={`touch-target px-4 py-2 rounded-full text-xs font-mono tracking-wider flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'portfolio'
              ? 'bg-[#2B2016] text-white font-bold shadow-xs'
              : 'text-[#2B2016]/55 hover:text-[#3D3226] bg-white border border-[#3D3226]/10'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>WAREHOUSE PORTFOLIO</span>
        </button>
      </div>

      {activeTab === 'new-audit' ? (
        <NewAuditTab
          warehouses={warehouses}
          currentAuditor={currentAuditor}
          onVerificationSaved={onVerificationSaved}
        />
      ) : (
      <>

      {/* Portfolio Risk Banner (Enhanced for Credit / Risk Officer) */}
      {currentRole === 'risk_officer' && summary && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-[#B98A2E] uppercase block">
                CREDIT & COLLATERAL OVERSIGHT
              </span>
              <h1 className="display-console font-instrument-serif text-[#3D3226] mt-0.5">
                Warehouse Receipt Collateral Book
              </h1>
            </div>

            <button
              onClick={onOpenReport}
              className="px-3.5 py-2 bg-white hover:bg-[#F5F0E8] border border-[#3D3226]/10 text-[#3D3226] font-mono text-xs rounded flex items-center gap-2 transition-colors cursor-pointer w-fit"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#B98A2E]" />
              <span>Export Collateral Ledger</span>
            </button>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <MetricCard
              label="TOTAL LOAN EXPOSURE"
              value={`₹${summary.totalLoanExposureCr}`}
              unit="Cr"
              subtitle={`${summary.totalDeclaredTonnes} Tonnes total collateral pledged`}
              accentColor="neutral"
            />
            <MetricCard
              label="TONNAGE AT RISK"
              value={summary.tonnageAtRisk}
              unit="T"
              subtitle={`${summary.flaggedCount} facilities require verification`}
              accentColor={summary.tonnageAtRisk > 0 ? 'red' : 'green'}
            />
            <MetricCard
              label="HIGH PRIORITY MISMATCHES"
              value={summary.highPriorityCount}
              subtitle="Declared > Physical Bound by >5%"
              accentColor={summary.highPriorityCount > 0 ? 'red' : 'green'}
              badge={
                summary.highPriorityCount > 0 ? (
                  <span className="w-2 h-2 rounded-full bg-[#B5574F]" />
                ) : undefined
              }
            />
            <MetricCard
              label="ACTIVE REVIEW ACTIONS"
              value={summary.openReviewsCount}
              subtitle="Pending auditor re-measurement"
              accentColor={summary.openReviewsCount > 0 ? 'gold' : 'green'}
            />
          </div>
        </div>
      )}

      {/* Field Auditor Context Header */}
      {currentRole === 'auditor' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#3D3226]/10 pb-4">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-[#B98A2E] uppercase block">
                Warehouse collateral cross-check
              </span>
              <h1 className="display-console font-instrument-serif text-[#3D3226] mt-0.5">
                Assigned Grain Warehouses
              </h1>
              <p className="text-xs font-mono text-[#2B2016]/55 mt-1">
                Declared receipts checked against photo-based physical ranges — riskiest first.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onOpenReviewQueue}
                className="px-3.5 py-2 bg-white hover:bg-[#F5F0E8] border border-[#3D3226]/10 text-[#3D3226] font-mono text-xs rounded flex items-center gap-2 transition-colors cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4 text-[#B98A2E]" />
                <span>Review Queue ({summary?.openReviewsCount || 0})</span>
              </button>
            </div>
          </div>
          {summary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs font-mono">
              <div className="bg-white border border-[#3D3226]/10 rounded-lg px-3 py-2">
                <span className="text-[10px] text-[#2B2016]/55 uppercase block">Pledged collateral</span>
                <strong className="text-[#3D3226] text-sm">{summary.totalDeclaredTonnes} T · ₹{summary.totalLoanExposureCr} Cr</strong>
              </div>
              <div className="bg-white border border-[#B5574F]/25 rounded-lg px-3 py-2">
                <span className="text-[10px] text-[#B23A32] uppercase block">Tonnage at risk</span>
                <strong className="text-[#B23A32] text-sm">{summary.tonnageAtRisk} T across {summary.flaggedCount} sites</strong>
              </div>
              <div className="bg-white border border-[#3D3226]/10 rounded-lg px-3 py-2">
                <span className="text-[10px] text-[#2B2016]/55 uppercase block">High priority</span>
                <strong className="text-[#3D3226] text-sm">{summary.highPriorityCount} over-declared</strong>
              </div>
              <div className="bg-white border border-[#3D3226]/10 rounded-lg px-3 py-2">
                <span className="text-[10px] text-[#2B2016]/55 uppercase block">Open reviews</span>
                <strong className="text-[#3D3226] text-sm">{summary.openReviewsCount} pending re-measure</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="flex flex-col gap-3 bg-white p-3 rounded-xl border border-[#3D3226]/10">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#2B2016]/55 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by facility name, district, receipt number, or grain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#F5F0E8] border border-[#3D3226]/10 rounded pl-9 pr-3 py-2 text-xs font-mono text-[#3D3226] placeholder-[#2B2016]/40 focus:outline-none focus:border-[#B98A2E]"
            />
          </div>

          {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-mono pb-1 md:pb-0">
          <button
            onClick={() => setSelectedStatusFilter('all')}
            className={`touch-target px-3 py-1.5 rounded transition-colors whitespace-nowrap cursor-pointer ${
              selectedStatusFilter === 'all'
                ? 'bg-[#2B2016] text-white font-bold'
                : 'text-[#2B2016]/55 hover:text-[#3D3226] bg-[#F5F0E8] border border-[#3D3226]/10'
            }`}
          >
            All ({warehouses.length})
          </button>

          <button
            onClick={() => setSelectedStatusFilter('high_priority')}
            className={`touch-target px-3 py-1.5 rounded transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              selectedStatusFilter === 'high_priority'
                ? 'bg-[#B5574F] text-white font-bold'
                : 'text-[#B23A32] hover:text-[#3D3226] bg-[#F5F0E8] border border-[#B5574F]/30'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#B5574F]" />
            <span>High Priority ({highPriorityCount})</span>
          </button>

          <button
            onClick={() => setSelectedStatusFilter('review')}
            className={`touch-target px-3 py-1.5 rounded transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              selectedStatusFilter === 'review'
                ? 'bg-[#2B2016] text-white font-bold'
                : 'text-[#B98A2E] hover:text-[#3D3226] bg-[#F5F0E8] border border-[#B98A2E]/30'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#2B2016]" />
            <span>Review ({reviewRequiredCount})</span>
          </button>

          <button
            onClick={() => setSelectedStatusFilter('consistent')}
            className={`touch-target px-3 py-1.5 rounded transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              selectedStatusFilter === 'consistent'
                ? 'bg-[#4C8B5A] text-white font-bold'
                : 'text-[#2F7A3D] hover:text-[#3D3226] bg-[#F5F0E8] border border-[#4C8B5A]/30'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#4C8B5A]" />
            <span>Consistent ({consistentCount})</span>
          </button>
        </div>
        </div>
        {/* Season curve filter — same photo reads differently by season */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono border-t border-[#3D3226]/10 pt-2.5">
          <span className="text-[#2B2016]/55 uppercase tracking-wider mr-1">Season curve:</span>
          {['all', 'kharif', 'rabi', 'zaid'].map((s) => (
            <button
              key={s}
              onClick={() => setSelectedSeasonFilter(s)}
              className={`touch-target px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
                selectedSeasonFilter === s
                  ? 'bg-[#2B2016] text-white border-[#2B2016] font-bold'
                  : 'bg-[#F5F0E8] text-[#2B2016]/60 border-[#3D3226]/10 hover:border-[#3D3226]/30'
              }`}
            >
              {s === 'all' ? 'All seasons' : SEASON_PROFILES[s as Season].name}
            </button>
          ))}
          <span className="text-[#2B2016]/45 ml-1">Sorted riskiest first.</span>
        </div>
      </div>

      {/* Warehouse Cards Grid */}
      {isLoading ? (
        <div className="bg-white border border-[#3D3226]/10 rounded-xl p-16 text-center text-xs font-mono text-[#2B2016]/55">
          <span className="inline-block animate-spin mr-2">⟳</span>
          Loading warehouse collateral records...
        </div>
      ) : filteredWarehouses.length === 0 ? (
        <div className="bg-white border border-[#3D3226]/10 rounded-xl p-16 text-center text-xs font-mono text-[#2B2016]/55 space-y-2">
          <p className="text-[#3D3226] font-medium text-sm">No warehouses found</p>
          <p>Try adjusting your search query or status filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] gap-4">
          {filteredWarehouses.map((w) => (
            <div
              key={w.id}
              className="bg-white border border-[#3D3226]/10 hover:border-[#3D3226]/30 rounded-lg p-4 sm:p-5 flex flex-col justify-between transition-colors group"
            >
              {/* Card Header */}
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <span className="text-[10px] font-mono tracking-widest text-[#2B2016]/55 uppercase block">
                      {w.code} • {w.district}, {w.state}
                    </span>
                    <h3
                      onClick={() => onSelectWarehouse(w)}
                      className="text-base sm:text-lg font-display font-bold text-[#3D3226] group-hover:text-[#B98A2E] transition-colors cursor-pointer mt-0.5 line-clamp-1"
                    >
                      {w.name}
                    </h3>
                  </div>
                  <StatusChip status={w.status} size="sm" />
                </div>

                {/* Crops and Receipt reference */}
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#2B2016]/55 my-3">
                  <span className="bg-[#F5F0E8] px-2 py-0.5 rounded border border-[#3D3226]/10 uppercase text-[#3D3226]">
                    {w.grainTypes.join(', ')}
                  </span>
                  <span>Receipt: <strong className="text-[#B98A2E]">{w.receiptNumber}</strong></span>
                  <span>• Bank: <strong className="text-[#2B2016]/70">{w.lendingBank.split(' ')[0]}</strong></span>
                </div>
              </div>

              {/* Declared vs season-calibrated physical range */}
              <div className="bg-[#F5F0E8] p-3.5 rounded-lg border border-[#3D3226]/10 my-2">
                {(() => {
                  const latest = getLatest(w.id);
                  if (!latest) {
                    return (
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-mono text-[#2B2016]/55 uppercase block">
                            DECLARED RECEIPT STOCK
                          </span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-2xl font-display font-bold text-[#3D3226]">
                              {w.currentDeclaredTonnes.toFixed(1)}
                            </span>
                            <span className="text-xs font-mono text-[#2B2016]/55">T</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-mono text-[#B98A2E] uppercase block">
                            No photo check yet
                          </span>
                          <div className="text-[11px] font-mono text-[#2B2016]/55 mt-1">
                            Run photo/video check
                          </div>
                        </div>
                      </div>
                    );
                  }
                  const seasonId = (latest.context as { season?: Season }).season || 'rabi';
                  const over = w.currentDeclaredTonnes - latest.estimate.rangeHigh;
                  const under = latest.estimate.rangeLow - w.currentDeclaredTonnes;
                  const verdict = over > 0 ? `+${over.toFixed(1)}T over physical bound` : under > 0 ? `${under.toFixed(1)}T under bound` : 'Inside physical bounds';
                  return (
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-mono text-[#2B2016]/55 uppercase block">
                            DECLARED RECEIPT
                          </span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-2xl font-display font-bold text-[#3D3226]">
                              {w.currentDeclaredTonnes.toFixed(1)}
                            </span>
                            <span className="text-xs font-mono text-[#2B2016]/55">T</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-mono text-[#2B2016]/55 uppercase block">
                            Estimated actual · {SEASON_PROFILES[seasonId]?.short || seasonId} curve
                          </span>
                          <div className="text-sm font-mono font-bold text-[#3D3226] mt-0.5">
                            {latest.estimate.rangeLow.toFixed(1)}–{latest.estimate.rangeHigh.toFixed(1)} T
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                        <span className={`font-bold ${over > 0 ? 'text-[#B23A32]' : under > 0 ? 'text-[#B98A2E]' : 'text-[#2F7A3D]'}`}>
                          {verdict} · {latest.estimate.confidencePercent}% conf
                        </span>
                        <span className="text-[#2B2016]/55">
                          {latest.mediaType === 'video-frame' ? 'Video frame' : 'Photo'} · {latest.estimate.volumeM3.toFixed(0)} m³
                        </span>
                      </div>
                      {/* Mini range bar */}
                      <div className="relative h-2 rounded bg-white border border-[#3D3226]/10 overflow-hidden">
                        {(() => {
                          const lo = Math.min(latest.estimate.rangeLow, w.currentDeclaredTonnes);
                          const hi = Math.max(latest.estimate.rangeHigh, w.currentDeclaredTonnes);
                          const span = hi - lo || 1;
                          const left = ((latest.estimate.rangeLow - lo) / span) * 100;
                          const width = ((latest.estimate.rangeHigh - latest.estimate.rangeLow) / span) * 100;
                          const pin = ((w.currentDeclaredTonnes - lo) / span) * 100;
                          return (
                            <>
                              <div className="absolute top-0 bottom-0 bg-[#B98A2E]/30 border-x border-[#B98A2E]/50" style={{ left: `${left}%`, width: `${Math.max(6, width)}%` }} />
                              <div className={`absolute top-0 bottom-0 w-0.5 ${over > 0 ? 'bg-[#B5574F]' : 'bg-emerald-600'}`} style={{ left: `${pin}%` }} />
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()}

                {/* Subtext info */}
                <div className="flex items-center justify-between text-[11px] font-mono text-[#2B2016]/55 pt-2 mt-2 border-t border-[#3D3226]/10">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-[#B98A2E]" />
                    <span>Last audited: {w.lastVerifiedDate ? new Date(w.lastVerifiedDate).toLocaleDateString() : 'Not verified'}</span>
                  </div>
                  <span className="text-[#2B2016]/55 truncate max-w-40">
                    {w.borrowerName}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelectWarehouse(w)}
                  className="text-xs font-mono text-[#2B2016]/55 hover:text-[#3D3226] flex items-center gap-1 transition-colors cursor-pointer py-1.5"
                >
                  <span>History & Logs</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => onStartVerification(w)}
                  className="px-3.5 py-1.5 bg-[#2B2016] hover:bg-[#3D3226] text-white font-mono font-bold text-xs uppercase tracking-wider rounded-full flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Verify Stock</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}
    </div>
  );
};
