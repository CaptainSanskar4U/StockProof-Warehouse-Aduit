import React from 'react';
import type { ReverseProof, ReposeVerdict, BankableResult, PhotoQuality } from '../../proofMath.js';
import type { DetectFinding } from './SharedAuditContext.js';

/* Shared visual language: washi sheet, quiet eyebrow, serif numbers. */

export const ReverseProofBlock: React.FC<{ proof: ReverseProof | null }> = ({ proof }) => {
  if (!proof || !(proof.declaredTonnes > 0)) return null;
  return (
    <div className="washi-sheet px-5 sm:px-6 py-5 washi-enter">
      <p className="eyebrow-quiet">Reverse proof · what the claim demands</p>
      <div className="mt-3 flex flex-col items-center text-center">
        <p className="font-mono text-[11px] text-[var(--ink-faint)]">{proof.declaredTonnes.toFixed(1)}T CLAIMED</p>
        <p className="serif-reading text-2xl text-[var(--ink)] mt-1">needs {proof.requiredVolumeM3.toFixed(0)} m³</p>
        <p className="font-mono text-xs text-[var(--ink-soft)] mt-1">↓</p>
        <p className="serif-reading text-2xl text-[var(--ink)]">needs {proof.requiredHeightM.toFixed(1)}m height</p>
        <p className="font-mono text-xs text-[var(--ink-soft)] mt-1">measured {proof.measuredHeightM.toFixed(1)}m · gap {proof.heightGapM > 0 ? '+' : ''}{proof.heightGapM.toFixed(1)}m</p>
        <p
          className={`mt-3 px-4 py-2 rounded-full font-mono text-xs font-bold ${
            proof.supported ? 'bg-[var(--moss-solid)] text-[var(--on-moss)]' : 'bg-[var(--clay-solid)] text-[var(--on-clay)]'
          }`}
        >
          {proof.supported ? 'CLAIM SUPPORTED' : 'CLAIM NOT SUPPORTED'}
        </p>
        <p className="font-mono text-[11px] text-[var(--ink-faint)] mt-2">ρ {proof.effectiveDensity.toFixed(3)} t/m³ · same physics as estimate</p>
      </div>
    </div>
  );
};

export const PhysicsCheckBlock: React.FC<{ verdict: ReposeVerdict | null; requiredDeg?: number | null }> = ({
  verdict,
  requiredDeg,
}) => {
  if (!verdict) return null;
  return (
    <div className="washi-sheet px-5 sm:px-6 py-5 washi-enter">
      <p className="eyebrow-quiet">Physics check · angle of repose</p>
      <div className="mt-3 flex flex-col items-center text-center">
        <p className="serif-reading text-3xl text-[var(--ink)]">{verdict.deg.toFixed(1)}°</p>
        <p className="font-mono text-[11px] text-[var(--ink-faint)] mt-1">grain stands at {verdict.min}–{verdict.max}°</p>
        {requiredDeg != null && (
          <p className="font-mono text-[11px] text-[var(--ink-faint)] mt-1">claim would need {requiredDeg.toFixed(1)}°</p>
        )}
        <p
          className={`mt-3 px-4 py-2 rounded-full font-mono text-xs font-bold ${
            verdict.violation ? 'bg-[var(--clay-solid)] text-[var(--on-clay)]' : 'bg-[var(--moss-solid)] text-[var(--on-moss)]'
          }`}
        >
          {verdict.violation ? 'PHYSICS VIOLATION' : 'GEOMETRY POSSIBLE'}
        </p>
        <p className="text-xs text-[var(--ink-soft)] mt-2 leading-relaxed max-w-md">{verdict.label}</p>
      </div>
    </div>
  );
};

export const BankableBlock: React.FC<{
  bankable: BankableResult | null;
  claimed: number;
  rangeLow: number;
  rangeHigh: number;
  pricePerTonne?: number;
}> = ({ bankable, claimed, rangeLow, rangeHigh, pricePerTonne }) => {
  if (!bankable) return null;
  const value = pricePerTonne && pricePerTonne > 0 ? bankable.bankableTonnes * pricePerTonne : null;
  return (
    <div className="washi-sheet px-5 sm:px-6 py-5 washi-enter text-center">
      <p className="eyebrow-quiet">Stockproof bankable tonnes · internal risk use only</p>
      <p className="serif-reading text-4xl text-[var(--ink)] mt-2">{bankable.bankableTonnes.toFixed(1)}T</p>
      <p className="font-mono text-[11px] text-[var(--ink-faint)] mt-1">
        claimed {claimed.toFixed(1)}T · estimated {rangeLow.toFixed(1)}–{rangeHigh.toFixed(1)}T · haircut {bankable.haircutPct.toFixed(1)}%
      </p>
      <p className="font-mono text-[11px] text-[var(--ink-faint)] mt-1">{bankable.breakdown.join(' · ')}</p>
      {value != null && (
        <p className="font-mono text-xs text-[var(--ink)] mt-2">Defensible collateral value: ₹{value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
      )}
      <p className="text-[11px] text-[var(--ink-faint)] mt-2">Conservative quantity for internal lending-risk assessment. Not an official banking formula.</p>
    </div>
  );
};

export const PhotoGateBanner: React.FC<{ quality: PhotoQuality | null }> = ({ quality }) => {
  if (!quality) return null;
  if (quality.ok) {
    return (
      <div className="washi-sheet px-4 py-3 flex items-start gap-3">
        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--moss)] shrink-0" />
        <p className="text-sm text-[var(--ink)]"><strong>✅ FULL PILE VISIBLE</strong> — good frame, you can proceed.</p>
      </div>
    );
  }
  return (
    <div className="washi-sheet px-4 py-3 flex items-start gap-3 border-[var(--danger-line)]">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--danger)] shrink-0" />
      <div>
        <p className="text-sm text-[var(--ink)]"><strong>PHOTO NOT SUITABLE</strong> — capture the entire grain pile from farther away. Make sure the full pile is visible in one frame.</p>
        <ul className="text-xs text-[var(--ink-soft)] mt-1.5 space-y-0.5">
          {quality.reasons.map((r) => (
            <li key={r}>· {r}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

/* AI-image report — their table, their words. Primary ultra + sentry
 * cross-check, exactly their DetectionResult fields. Agreement decides:
 * both ai -> strong warning, split -> uncertain, both real -> likely real. */
export const DetectReportCard: React.FC<{
  primary: DetectFinding | null;
  cross: DetectFinding | null;
  pending: boolean;
  onRetry?: () => void;
}> = ({ primary, cross, pending, onRetry }) => {
  if (!primary && !cross) {
    if (pending) {
      return (
        <div className="washi-sheet px-4 py-3 flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold-deep)] shrink-0 animate-pulse" />
          <p className="font-mono text-[11px] text-[var(--ink-faint)]">AI detectors reading this photo… you can continue meanwhile.</p>
        </div>
      );
    }
    return (
      <div className="washi-sheet px-4 py-3 flex items-center gap-3 border-dashed">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-faint)] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[11px] text-[var(--ink-faint)]">AI detector unavailable right now — retry, or continue the audit without it.</p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 font-mono text-[11px] px-3 py-1.5 rounded-full border border-[var(--hairline)] hover:bg-[var(--wash)] transition-colors cursor-pointer"
          >
            Retry
          </button>
        )}
      </div>
    );
  }
  const rows = [primary, cross].filter((r): r is DetectFinding => !!r);
  const aiVotes = rows.filter((r) => r.label === 'ai').length;
  const bothAi = rows.length > 0 && aiVotes === rows.length;
  const bothReal = rows.length > 0 && aiVotes === 0;
  const pct = Math.round(Math.max(...rows.map((r) => (bothAi ? r.probability_ai : r.probability_real))) * 100);
  const tone = bothAi
    ? { bg: 'bg-[var(--clay-solid)] text-[var(--on-clay)]', text: `This image is AI-generated (${pct}% sure)`, dot: 'var(--danger)' }
    : bothReal
      ? { bg: 'bg-[var(--moss-solid)] text-[var(--on-moss)]', text: `This image looks real (${pct}% sure)`, dot: 'var(--moss)' }
      : { bg: 'bg-[var(--gold-wash)] text-[var(--gold-ink)]', text: 'Inconclusive — detectors disagree', dot: 'var(--gold)' };
  return (
    <div className="washi-sheet px-4 py-3 flex items-center gap-3">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tone.dot }} />
      <p className={`font-mono text-[12px] font-bold ${tone.bg} px-3 py-1.5 rounded-full`}>{tone.text}</p>
      {pending && <span className="font-mono text-[11px] text-[var(--ink-faint)] animate-pulse ml-auto">cross-check…</span>}
    </div>
  );
};

