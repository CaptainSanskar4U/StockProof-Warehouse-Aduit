import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Warehouse, Verification, Season, FarmerCheck } from '../types.js';
import { fetchFarmerChecksByFarmer } from '../services/api.js';
import { StatusChip } from './StatusChip.js';
import { RangeBar } from './RangeBar.js';
import { SafeImage } from './SafeImage.js';
import { SEASON_PROFILES } from '../seasonProfiles.js';
import { authenticityOf, isUnverifiedRecord, UNVERIFIED_HEADLINE } from '../lib/verify.js';
import { 
  X, 
  Play, 
  Clock, 
  MapPin, 
  Calendar, 
  FileText, 
  Building2, 
  User, 
  Layers, 
  Scale, 
  History, 
  ChevronRight,
  ShieldAlert
} from 'lucide-react';

interface WarehouseDetailModalProps {
  warehouse: Warehouse | null;
  onClose: () => void;
  onStartVerification: (warehouse: Warehouse) => void;
}

export const WarehouseDetailModal: React.FC<WarehouseDetailModalProps> = ({
  warehouse,
  onClose,
  onStartVerification,
}) => {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [selectedRun, setSelectedRun] = useState<Verification | null>(null);
  // Farmer self-check history — READ-ONLY background context, keyed by
  // borrower name. Never a feed, never writable from here.
  const [farmerChecks, setFarmerChecks] = useState<FarmerCheck[]>([]);
  const [farmerHistoryOpen, setFarmerHistoryOpen] = useState<boolean>(false);
  const [farmerHistoryLoaded, setFarmerHistoryLoaded] = useState<boolean>(false);

  useEffect(() => {
    if (warehouse) {
      setIsLoadingHistory(true);
      setFarmerChecks([]);
      setFarmerHistoryLoaded(false);
      setFarmerHistoryOpen(false);
      fetch(`/api/verifications?warehouseId=${warehouse.id}`)
        .then((res) => res.json())
        .then((data) => {
          setVerifications(data);
          if (data.length > 0) {
            setSelectedRun(data[0]);
          } else {
            setSelectedRun(null);
          }
        })
        .catch((err) => console.error('Error fetching verification history:', err))
        .finally(() => setIsLoadingHistory(false));
    }
  }, [warehouse]);

  if (!warehouse) return null;

  const loadFarmerHistory = () => {
    setFarmerHistoryOpen((open) => {
      const next = !open;
      if (next && !farmerHistoryLoaded && warehouse.borrowerName) {
        fetchFarmerChecksByFarmer(warehouse.borrowerName)
          .then((data) => {
            setFarmerChecks(data);
            setFarmerHistoryLoaded(true);
          })
          .catch((err) => console.error('Error fetching farmer self-check history:', err));
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[var(--overlay)] backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="bg-[var(--sheet)] border border-[var(--hairline)] rounded-2xl max-w-4xl w-full max-h-[92dvh] flex flex-col shadow-[0_24px_64px_rgba(43,32,22,0.25)] overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--hairline)] bg-[var(--well)] flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest text-[var(--gold)] uppercase">
                WAREHOUSE PROFILE & COLLATERAL RECORD
              </span>
              <span className="text-xs font-mono text-[var(--ink-soft)]">/ {warehouse.code}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-instrument-serif text-[var(--ink-2)] mt-0.5">
              {warehouse.name}
            </h2>
            <div className="flex items-center gap-2 text-xs font-mono text-[var(--ink-soft)] mt-1">
              <MapPin className="w-3.5 h-3.5 text-[var(--gold)]" />
              <span>{warehouse.location}, {warehouse.district}, {warehouse.state}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <StatusChip status={warehouse.status} size="md" />
            <button
              onClick={onClose}
              className="p-1.5 text-[var(--ink-soft)] hover:text-[var(--ink-2)] rounded hover:bg-[var(--ink-2)]/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Top Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[var(--well)] p-4 rounded-xl border border-[var(--hairline)] text-xs font-mono">
            <div>
              <span className="text-[var(--ink-soft)] block text-[10px] uppercase">DECLARED STOCK</span>
              <div className="text-lg font-display font-bold text-[var(--ink-2)] mt-0.5">
                {warehouse.currentDeclaredTonnes.toFixed(1)} T
              </div>
              <span className="text-[10px] text-[var(--ink-soft)]">Cap: {warehouse.capacityTonnes} T</span>
            </div>

            <div>
              <span className="text-[var(--ink-soft)] block text-[10px] uppercase">WAREHOUSE RECEIPT</span>
              <div className="text-sm font-bold text-[var(--gold)] mt-0.5 truncate">
                {warehouse.receiptNumber}
              </div>
              <span className="text-[10px] text-[var(--ink-soft)]">Issued: {warehouse.receiptIssueDate}</span>
            </div>

            <div>
              <span className="text-[var(--ink-soft)] block text-[10px] uppercase">LENDING BANK / LOAN</span>
              <div className="text-sm font-bold text-[var(--ink-2)] mt-0.5 truncate">
                {warehouse.lendingBank}
              </div>
              <span className="text-[10px] text-[var(--ink-soft)]">Ref: {warehouse.loanReference}</span>
            </div>

            <div>
              <span className="text-[var(--ink-soft)] block text-[10px] uppercase">PLEDGING BORROWER</span>
              <div className="text-sm font-bold text-[var(--ink-2)] mt-0.5 truncate">
                {warehouse.borrowerName}
              </div>
              <span className="text-[10px] text-[var(--ink-soft)]">Crops: {warehouse.grainTypes.join(', ').toUpperCase()}</span>
            </div>
          </div>

          {/* Primary Action Callout: Run New Verification */}
          <div className="bg-[var(--gold-tint-bg)] border border-[var(--gold-line)] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-mono text-[var(--gold)] uppercase tracking-wider font-semibold">
                <ShieldAlert className="w-4 h-4" />
                <span>Field Audit Verification</span>
              </div>
              <p className="text-xs text-[var(--ink-soft)]">
                Launch physical volume capture, confirm grain compaction & moisture parameters to produce defensible stock bounds.
              </p>
            </div>

            <button
              onClick={() => {
                onClose();
                onStartVerification(warehouse);
              }}
              className="px-5 py-2.5 bg-[var(--ink)] hover:bg-[var(--ink-2)] text-[var(--ink-inverse)] font-mono font-bold text-xs uppercase tracking-wider rounded-full flex items-center gap-2 transition-colors cursor-pointer shrink-0 shadow-lg"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run New Verification</span>
            </button>
          </div>

          {/* Verification History Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono tracking-wider text-[var(--ink-soft)] uppercase">
                <History className="w-4 h-4 text-[var(--gold)]" />
                <span>Physical Audit History ({verifications.length} runs recorded)</span>
              </div>
            </div>

            {isLoadingHistory ? (
              <div className="p-8 text-center text-xs font-mono text-[var(--ink-soft)]">
                Loading audit logs...
              </div>
            ) : verifications.length === 0 ? (
              <div className="bg-[var(--well)] border border-[var(--hairline)] rounded p-8 text-center text-xs font-mono text-[var(--ink-soft)] space-y-2">
                <p className="text-[var(--ink-2)] font-medium">No verifications recorded yet</p>
                <p>Run the first physical optical audit above to establish defensible baseline bounds.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Past runs list */}
                <div className="space-y-2 md:col-span-1">
                  {verifications.map((run) => (
                    <div
                      key={run.id}
                      onClick={() => setSelectedRun(run)}
                      className={`p-3 rounded-xl border text-xs font-mono cursor-pointer transition-all ${
                        selectedRun?.id === run.id
                          ? 'bg-[var(--sheet)] border-[var(--gold)] text-[var(--ink-2)] shadow-sm'
                          : 'bg-[var(--sheet)] border-[var(--hairline)] text-[var(--ink-soft)] hover:border-[var(--ink-2)]/25'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-[var(--ink-soft)]">
                          {new Date(run.timestamp).toLocaleDateString()}
                        </span>
                        <StatusChip status={run.status} size="sm" />
                      </div>
                      <div className={`font-bold ${isUnverifiedRecord({ authenticity: authenticityOf(run.photoVerdict) }) ? 'text-[var(--ink-faint)] line-through' : 'text-[var(--ink-2)]'}`}>
                        {run.estimate.rangeLow.toFixed(1)}–{run.estimate.rangeHigh.toFixed(1)} T
                      </div>
                      {isUnverifiedRecord({ authenticity: authenticityOf(run.photoVerdict) }) && (
                        <div className="text-[10px] font-mono text-[var(--danger-ink)] mt-0.5">
                          untrusted estimate — not evidence
                        </div>
                      )}
                      <div className="text-[10px] text-[var(--ink-soft)] mt-1 flex justify-between">
                        <span>Receipt: {run.declaredAtTimeOfRun} T</span>
                        <span>{run.estimate.confidencePercent}% conf.</span>
                      </div>
                      <div className="text-[10px] font-mono mt-1 flex flex-wrap gap-1">
                        <span className="bg-[var(--ink)] text-[var(--gold-bright)] px-1.5 py-0.5 rounded uppercase">
                          {(run.context as { season?: Season }).season ? SEASON_PROFILES[(run.context as { season?: Season }).season as Season]?.short : 'Rabi'}
                        </span>
                        <span className="bg-[var(--well)] border border-[var(--hairline)] px-1.5 py-0.5 rounded uppercase text-[var(--ink-soft)]">
                          {run.mediaType === 'video-frame' ? 'Video frame' : 'Photo'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Selected Run Details View */}
                {selectedRun && (
                  <div className="md:col-span-2 bg-[var(--well)] border border-[var(--hairline)] rounded-xl p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] pb-3">
                      <div>
                        <span className="text-[10px] font-mono text-[var(--ink-soft)] uppercase block">
                          SELECTED AUDIT RUN / {selectedRun.id}
                        </span>
                        <div className="text-xs font-mono text-[var(--ink-2)]">
                          Conducted by {selectedRun.runBy.name} ({selectedRun.runBy.role})
                        </div>
                      </div>
                      <StatusChip status={selectedRun.status} size="md" />
                    </div>

                    {/* Photo + Range Comparison */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                      <div className="aspect-16/9 rounded overflow-hidden border border-[var(--hairline)] bg-[var(--matte)] relative">
                        <SafeImage
                          src={selectedRun.photoUrl}
                          alt="Verification run capture"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-2 left-2 flex gap-1.5 text-[10px] font-mono">
                          <span className="bg-[var(--overlay-soft)] text-[var(--gold-bright)] px-2 py-0.5 rounded border border-[var(--gold-line)] uppercase">
                            {(selectedRun.context as { season?: Season }).season ? SEASON_PROFILES[(selectedRun.context as { season?: Season }).season as Season]?.name : 'Rabi (Winter)'}
                          </span>
                          <span className="bg-[var(--overlay-soft)] text-[var(--oncard-dim)] px-2 py-0.5 rounded border border-[var(--oncard-line)] uppercase">
                            {selectedRun.mediaType === 'video-frame' ? 'Video frame' : 'Photo'}{selectedRun.referenceScale && selectedRun.referenceScale !== 'none' ? ` · ${selectedRun.referenceScale}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <span className="text-[10px] font-mono text-[var(--ink-soft)] uppercase block">
                            DECLARED VS ESTIMATED RANGE
                          </span>
                          {(() => {
                            const unverified = isUnverifiedRecord({ authenticity: authenticityOf(selectedRun.photoVerdict) });
                            if (unverified) {
                              return (
                                <>
                                  <div className="mt-1 rounded-[10px] border border-[var(--danger-line)] bg-[var(--danger-bg)] px-3 py-2">
                                    <p className="text-xs font-bold text-[var(--danger-ink)] leading-snug">{UNVERIFIED_HEADLINE}</p>
                                  </div>
                                  <div className="text-xl font-display font-extrabold text-[var(--ink-faint)] line-through mt-1">
                                    {selectedRun.estimate.rangeLow} – {selectedRun.estimate.rangeHigh} T
                                  </div>
                                  <div className="text-[10px] font-mono text-[var(--danger-ink)]">
                                    untrusted estimate — not evidence
                                  </div>
                                </>
                              );
                            }
                            return (
                              <div className="text-xl font-display font-extrabold text-[var(--gold)] mt-0.5">
                                {selectedRun.estimate.rangeLow} – {selectedRun.estimate.rangeHigh} T
                              </div>
                            );
                          })()}
                          <div className="text-xs font-mono text-[var(--ink-soft)]">
                            Declared Receipt: <strong className="text-[var(--ink-2)]">{selectedRun.declaredAtTimeOfRun} T</strong>
                          </div>
                        </div>

                        <RangeBar
                          rangeLow={selectedRun.estimate.rangeLow}
                          rangeHigh={selectedRun.estimate.rangeHigh}
                          declared={selectedRun.declaredAtTimeOfRun}
                          showLabels={false}
                        />
                      </div>
                    </div>

                    {/* Explanatory text */}
                    <div className="p-3 rounded bg-[var(--sheet)] border border-[var(--hairline)] text-xs space-y-1">
                      <div className="text-[10px] font-mono text-[var(--gold)] uppercase tracking-wider font-semibold">
                        AUDITOR NOTE & EXPLANATION
                      </div>
                      <p className="text-[var(--ink-soft)] leading-relaxed">
                        {selectedRun.explanatoryReason}
                      </p>
                    </div>

                    {/* Recommendation */}
                    <div className="text-xs font-mono text-[var(--ink-soft)]">
                      <strong className="text-[var(--ink-2)]">Recommendation:</strong> {selectedRun.auditRecommendation}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Farmer self-check history — read-only background context.
              Lookup-triggered only; never a feed, never writable. */}
          <div className="border border-[#3D3226]/10 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={loadFarmerHistory}
              className="w-full px-4 py-3 bg-[#F5F0E8] hover:bg-[#EFE7D4] flex items-center justify-between gap-3 cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-2 text-xs font-mono tracking-wider text-[#2B2016]/60 uppercase">
                <User className="w-4 h-4 text-[#B98A2E]" />
                <span>Farmer self-check history — {warehouse.borrowerName}</span>
              </span>
              <span className="text-xs font-mono text-[#2B2016]/55">{farmerHistoryOpen ? '▾' : '▸'}</span>
            </button>
            {farmerHistoryOpen && (
              <div className="p-4 bg-white space-y-2">
                <p className="text-[11px] font-mono text-[#2B2016]/55">
                  Background context only — self-checks by the farmer. Read-only; not part of the official audit record.
                </p>
                {farmerChecks.length === 0 ? (
                  <p className="text-xs font-mono text-[#2B2016]/55 py-2">
                    {farmerHistoryLoaded ? 'No self-checks recorded under this name.' : 'Loading…'}
                  </p>
                ) : (
                  farmerChecks.map((c) => {
                    const unverified = c.photoVerdict === 'ai' || c.photoVerdict === 'inconclusive';
                    return (
                      <div key={c.id} className="border border-[#3D3226]/10 rounded-lg px-3 py-2.5 text-xs font-mono">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[#3D3226]">{c.id}</span>
                          <span className="text-[#2B2016]/55">{new Date(c.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="mt-1 text-[#2B2016]/70">
                          Declared {c.declaredTonnes} T
                          {unverified ? (
                            <span className="text-[#8A7D68]/80"> · <span className="line-through">estimate withheld</span> · untrusted — not evidence</span>
                          ) : (
                            <span> · estimated {c.estLow}–{c.estHigh} T</span>
                          )}
                        </div>
                        <div className="mt-1.5">
                          {unverified ? (
                            <span className="bg-[#8A7D68]/15 text-[#6B5F4F] px-2 py-0.5 rounded-full font-bold">⚠️ UNVERIFIED ({c.photoVerdict})</span>
                          ) : c.match ? (
                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">✅ match</span>
                          ) : (
                            <span className="bg-red-100 text-[#B23A32] px-2 py-0.5 rounded-full font-bold">🚨 discrepancy</span>
                          )}
                          {c.photoVerdict === 'unchecked' && (
                            <span className="ml-2 text-[#A87F2A]">authenticity unchecked</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--hairline)] bg-[var(--well)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--ink-2)]/10 hover:bg-[var(--ink-2)]/15 text-[var(--ink-2)] font-mono text-xs uppercase tracking-wider rounded-full transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};

