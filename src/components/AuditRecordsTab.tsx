import React, { useEffect, useState } from 'react';
import { AgentType, Verification, Warehouse } from '../types.js';
import { fetchGovChecksByVerification, fetchVerifications, fetchWarehouses } from '../services/api.js';
import { StatusChip } from './StatusChip.js';
import { authenticityOf, buildVerifyUrl, isUnverifiedRecord } from '../lib/verify.js';

interface AuditRecordsTabProps {
  agentType: AgentType;
  refreshKey?: number;
  onOpenRecord?: (verification: Verification) => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatRecordedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  let hours = d.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hours}:${mins} ${ampm}`;
}

export const AuditRecordsTab: React.FC<AuditRecordsTabProps> = ({ agentType, refreshKey, onOpenRecord }) => {
  const [audits, setAudits] = useState<Verification[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const isGov = agentType === 'government';

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([fetchVerifications(undefined, agentType), fetchWarehouses()])
      .then(([list, whs]) => {
        if (!alive) return;
        setAudits(list || []);
        setWarehouses(whs || []);
      })
      .catch(() => {
        if (!alive) return;
        setAudits([]);
        setWarehouses([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [agentType, refreshKey]);

  const warehouseOf = (a: Verification): Warehouse | undefined =>
    warehouses.find((w) => w.id === a.warehouseId);

  const warehouseLabel = (a: Verification): string => {
    const w = warehouseOf(a);
    if (w) return `${w.name} · ${w.district}, ${w.state}`;
    return a.bank?.warehouseName || a.gov?.warehouseRef || a.warehouseId;
  };

  const personName = (a: Verification): string =>
    isGov
      ? a.gov?.warehouseRef || warehouseOf(a)?.code || a.warehouseId
      : a.bank?.farmerName?.trim() || 'Bank audit';

  // Official report (PDF via the print document). Routed to ?report=<id> so the
  // report owns the page and prints cleanly; the report itself fetches the
  // server-stored GovCheck, so the PDF and the scanned popup cannot disagree.
  const openOfficialReport = (a: Verification) => {
    const url = new URL(window.location.href);
    url.search = `?report=${encodeURIComponent(a.id)}`;
    url.hash = '';
    window.location.assign(url.toString());
  };

  const downloadReport = async (a: Verification) => {
    const title = isGov ? 'Public Stock Audit Report' : 'Collateral Stock Verification Report';
    // A CSV cannot be greyed out, so an untrusted estimate must SAY so in the
    // cell text. A screenshot of this file must never read as a real number.
    const authenticity = authenticityOf(a.photoVerdict);
    const unverified = isUnverifiedRecord({ authenticity });
    const UNTRUSTED = ' — untrusted estimate, not evidence';
    // Attach this reading's QR record id when one exists (best effort, never blocks download).
    let verifyId = '';
    try {
      const existing = await fetchGovChecksByVerification(a.id);
      if (existing && existing.length > 0) verifyId = existing[0].id;
    } catch {
      verifyId = '';
    }
    const extra = isGov
      ? [
        ['Warehouse ID', a.gov?.warehouseRef || a.warehouseId],
        ['Warehouse', warehouseLabel(a)],
        ['Region', a.gov?.region || ''],
        ['Scheme', a.gov?.scheme || ''],
      ]
      : [
        ['Person name', a.bank?.farmerName || ''],
        ['Loan / reference ID', a.bank?.loanRef || ''],
        ['Warehouse location', warehouseLabel(a)],
      ];
    const rows: string[][] = [
      [title, formatRecordedAt(a.timestamp)],
      ['Verify URL (true stored result)', verifyId ? buildVerifyUrl(verifyId) : 'No QR record minted yet — open the record to mint one'],
      ['Agent type', isGov ? 'Government Agent' : 'Bank Agent'],
      ...extra,
      ['Verification ID', a.id],
      ['Recorded', formatRecordedAt(a.timestamp)],
      ['Authenticity', authenticity],
      ...(unverified
        ? [['UNVERIFIED', `UNVERIFIED${UNTRUSTED} — this image could not be confirmed as genuine and should not be used as audit evidence.`]]
        : []),
      ['Declared (T)', a.declaredAtTimeOfRun.toFixed(1)],
      ['Estimated central (T)', a.estimate.centralTonnes.toFixed(1) + (unverified ? UNTRUSTED : '')],
      ['Range low (T)', a.estimate.rangeLow.toFixed(1) + (unverified ? UNTRUSTED : '')],
      ['Range high (T)', a.estimate.rangeHigh.toFixed(1) + (unverified ? UNTRUSTED : '')],
      ['Discrepancy (T)', a.discrepancyTonnes.toFixed(1)],
      ['Status', a.status],
      ['Confidence (%)', String(a.estimate.confidencePercent)],
      ['Volume (m3)', a.estimate.volumeM3.toFixed(1)],
      ['Effective density (t/m3)', a.estimate.effectiveDensity.toFixed(3)],
      ['Grain', a.context.grainType],
      ['Pile', `cone h ${a.geometry.heightMeters.toFixed(1)} m, base ${a.geometry.baseDiameterMeters.toFixed(1)} m`],
      ['Moisture (%)', a.context.humidityPercent.toFixed(1)],
      ['Compaction', a.context.compaction],
      ['Storage days', String(a.context.storageDays)],
      ['AI-image primary', a.photoVerdict?.primary ? `${a.photoVerdict.primary.label} (AI ${a.photoVerdict.primary.probability_ai.toFixed(3)})` : 'not recorded'],
      ['AI-image cross-check', a.photoVerdict?.cross ? `${a.photoVerdict.cross.label} (AI ${a.photoVerdict.cross.probability_ai.toFixed(3)})` : 'not recorded'],
      ['Auditor', `${a.runBy.name} (${a.runBy.role})`],
      ['Reason', a.explanatoryReason],
      ['Recommendation', a.auditRecommendation],
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const el = document.createElement('a');
    el.href = url;
    el.download = `${isGov ? 'gov-audit' : 'bank-check'}-${a.id}.csv`;
    document.body.appendChild(el);
    el.click();
    el.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="washi-sheet p-8 text-center">
        <p className="text-sm text-[var(--ink-soft)]">Loading {isGov ? 'Government Audit' : 'Bank Checks'}…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div>
        <p className="eyebrow-quiet">{isGov ? 'Government Audit · filtered view' : 'Bank Checks · filtered view'}</p>
        <h2 className="serif-reading text-2xl text-[var(--ink)] mt-1">{isGov ? '🏛️ Government audits' : '🏦 Bank checks'} · {audits.length}</h2>
        <p className="text-sm text-[var(--ink-soft)] mt-1">One store, filtered by agent type. Open a record for full detail, or download it.</p>
      </div>
      {audits.length === 0 && (
        <div className="washi-sheet px-5 py-8 text-center">
          <p className="text-sm text-[var(--ink-soft)]">No {isGov ? 'government' : 'bank'} records yet. Record a reading from New Audit as {isGov ? 'Government Agent' : 'Bank Agent'}.</p>
        </div>
      )}
      <div className="space-y-2.5">
        {audits.map((a) => {
          const unverified = isUnverifiedRecord({ authenticity: authenticityOf(a.photoVerdict) });
          return (
          <div key={a.id} className="washi-sheet px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="serif-reading text-lg text-[var(--ink)] leading-snug truncate">{personName(a)}{unverified ? ' · UNVERIFIED' : ''}</p>
              <p className="font-mono text-[11px] text-[var(--ink-faint)] mt-0.5">
                {!isGov && a.bank?.loanRef ? `Loan / Reference ID: ${a.bank.loanRef} · ` : ''}
                {isGov && a.gov?.scheme ? `${a.gov.scheme} · ` : ''}
                Warehouse: {warehouseLabel(a)}
              </p>
              <p className={`font-mono text-[11px] ${unverified ? 'text-[var(--ink-faint)] line-through' : 'text-[var(--ink-faint)]'}`}>
                Recorded: {formatRecordedAt(a.timestamp)} · {a.declaredAtTimeOfRun.toFixed(1)}T declared → {a.estimate.centralTonnes.toFixed(1)}T est
              </p>
              {unverified && (
                <p className="font-mono text-[11px] text-[var(--danger-ink)]">untrusted estimate — not evidence</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusChip status={a.status} />
              <button
                type="button"
                onClick={() => onOpenRecord?.(a)}
                className="touch-target px-3 py-1.5 text-xs border border-[var(--hairline)] rounded-full hover:border-[var(--hairline-strong)] cursor-pointer"
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => downloadReport(a)}
                title="Raw data export (CSV)"
                className="touch-target px-2.5 py-1.5 text-xs border border-[var(--hairline)] rounded-full hover:border-[var(--hairline-strong)] cursor-pointer"
              >
                CSV
              </button>
              <button
                type="button"
                onClick={() => openOfficialReport(a)}
                className="touch-target px-3 py-1.5 text-xs bg-[var(--card-ink-bg)] text-[var(--paper)] rounded-full cursor-pointer"
              >
                Download PDF
              </button>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
};
