import React, { useEffect, useState } from 'react';
import { Verification } from '../types.js';
import { fetchVerifications } from '../services/api.js';
import { StatusChip } from './StatusChip.js';
import { authenticityOf, isUnverifiedRecord } from '../lib/verify.js';

interface InspectorDashboardProps {
  onOpenRecord?: (verification: Verification) => void;
  onGoToBank?: () => void;
  onGoToGov?: () => void;
  refreshKey?: number;
}

function Section({
  title,
  subtitle,
  accent,
  audits,
  onOpenRecord,
  onViewAll,
  emptyHint,
}: {
  title: string;
  subtitle: string;
  accent: string;
  audits: Verification[];
  onOpenRecord?: (v: Verification) => void;
  onViewAll?: () => void;
  emptyHint: string;
}) {
  const match = audits.filter((a) => a.status === 'consistent').length;
  const discrepancy = audits.filter((a) => a.status !== 'consistent').length;
  const recent = audits.slice(0, 5);
  const flagged = audits.filter((a) => a.status !== 'consistent').slice(0, 5);

  return (
    <section className="washi-sheet px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow-quiet">{subtitle}</p>
          <h3 className="serif-reading text-xl text-[var(--ink)] mt-1">
            <span style={{ color: accent }}>●</span> {title}
          </h3>
        </div>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="touch-target px-3 py-1.5 text-xs border border-[var(--hairline)] rounded-full hover:border-[var(--hairline-strong)] cursor-pointer shrink-0"
          >
            View all →
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className="bg-[var(--sheet)] border border-[var(--hairline-soft)] rounded-[10px] px-3 py-2.5 text-center">
          <p className="font-mono text-[10px] text-[var(--ink-faint)] uppercase">Records</p>
          <p className="serif-reading text-2xl text-[var(--ink)]">{audits.length}</p>
        </div>
        <div className="bg-[var(--sheet)] border border-[var(--hairline-soft)] rounded-[10px] px-3 py-2.5 text-center">
          <p className="font-mono text-[10px] text-[var(--ink-faint)] uppercase">Match</p>
          <p className="serif-reading text-2xl text-[var(--moss)]">{match}</p>
        </div>
        <div className="bg-[var(--sheet)] border border-[var(--hairline-soft)] rounded-[10px] px-3 py-2.5 text-center">
          <p className="font-mono text-[10px] text-[var(--ink-faint)] uppercase">Flagged</p>
          <p className="serif-reading text-2xl text-[var(--danger-ink)]">{discrepancy}</p>
        </div>
      </div>

      <p className="eyebrow-quiet mt-5">Recent · {recent.length}</p>
      <div className="mt-2 space-y-2">
        {recent.length === 0 && <p className="text-sm text-[var(--ink-faint)]">{emptyHint}</p>}
        {recent.map((a) => {
          const unverified = isUnverifiedRecord({ authenticity: authenticityOf(a.photoVerdict) });
          return (
          <button
            key={a.id}
            type="button"
            onClick={() => onOpenRecord?.(a)}
            className="w-full text-left flex items-center justify-between gap-3 border-b border-[var(--hairline-soft)] pb-2 cursor-pointer hover:opacity-80"
          >
            <span>
              <span className="font-mono text-[10px] text-[var(--ink-faint)] block">
                {new Date(a.timestamp).toLocaleDateString()} · {a.id}{unverified ? ' · UNVERIFIED' : ''}
              </span>
              <span className={`text-sm ${unverified ? 'text-[var(--ink-faint)] line-through' : 'text-[var(--ink)]'}`}>
                {a.declaredAtTimeOfRun.toFixed(1)}T declared → {a.estimate.centralTonnes.toFixed(1)}T est
              </span>
              {unverified && (
                <span className="font-mono text-[10px] text-[var(--danger-ink)] block">untrusted estimate — not evidence</span>
              )}
            </span>
            <StatusChip status={a.status} />
          </button>
          );
        })}
      </div>

      {flagged.length > 0 && (
        <>
          <p className="eyebrow-quiet mt-5">Needs review · {flagged.length}</p>
          <div className="mt-2 space-y-2">
            {flagged.map((a) => {
              const unverified = isUnverifiedRecord({ authenticity: authenticityOf(a.photoVerdict) });
              return (
              <button
                key={a.id}
                type="button"
                onClick={() => onOpenRecord?.(a)}
                className="w-full text-left flex items-center justify-between gap-3 border-b border-[var(--hairline-soft)] pb-2 cursor-pointer hover:opacity-80"
              >
                <span className={`text-sm ${unverified ? 'text-[var(--ink-faint)] line-through' : 'text-[var(--ink)]'}`}>
                  {a.warehouseId} · Δ {a.discrepancyTonnes.toFixed(1)}T{unverified ? ' · UNVERIFIED' : ''}
                </span>
                <StatusChip status={a.status} />
              </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

export const InspectorDashboard: React.FC<InspectorDashboardProps> = ({
  onOpenRecord,
  onGoToBank,
  onGoToGov,
  refreshKey,
}) => {
  const [bank, setBank] = useState<Verification[]>([]);
  const [gov, setGov] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([fetchVerifications(undefined, 'bank'), fetchVerifications(undefined, 'government')])
      .then(([b, g]) => {
        if (!alive) return;
        setBank(b || []);
        setGov(g || []);
      })
      .catch(() => {
        if (!alive) return;
        setBank([]);
        setGov([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="washi-sheet p-8 text-center">
        <p className="serif-reading text-lg text-[var(--ink)]">Loading Inspector Panel…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <p className="eyebrow-quiet">Inspector Panel · home</p>
        <h2 className="serif-reading text-2xl sm:text-3xl text-[var(--ink)] mt-1">Bank and Government, separately</h2>
        <p className="text-sm text-[var(--ink-soft)] mt-1">Two independent record streams from one store. Nothing is mixed.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Section
          title="Bank Records"
          subtitle="🏦 Collateral verifications"
          accent="var(--gold)"
          audits={bank}
          onOpenRecord={onOpenRecord}
          onViewAll={onGoToBank}
          emptyHint="No bank audits yet — run a New Audit as Bank Agent."
        />
        <Section
          title="Government Records"
          subtitle="🏛️ Public stock audits"
          accent="var(--moss)"
          audits={gov}
          onOpenRecord={onOpenRecord}
          onViewAll={onGoToGov}
          emptyHint="No government audits yet — run a New Audit as Government Agent."
        />
      </div>
    </div>
  );
};
