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
        <p className="font-mono text-[11px] text-[#8A7D68]">{proof.declaredTonnes.toFixed(1)}T CLAIMED</p>
        <p className="serif-reading text-2xl text-[#2A2118] mt-1">needs {proof.requiredVolumeM3.toFixed(0)} m³</p>
        <p className="font-mono text-xs text-[#6B5F4F] mt-1">↓</p>
        <p className="serif-reading text-2xl text-[#2A2118]">needs {proof.requiredHeightM.toFixed(1)}m height</p>
        <p className="font-mono text-xs text-[#6B5F4F] mt-1">measured {proof.measuredHeightM.toFixed(1)}m · gap {proof.heightGapM > 0 ? '+' : ''}{proof.heightGapM.toFixed(1)}m</p>
        <p
          className={`mt-3 px-4 py-2 rounded-full font-mono text-xs font-bold ${
            proof.supported ? 'bg-[#4A6B4F] text-white' : 'bg-[#9C4A42] text-white'
          }`}
        >
          {proof.supported ? 'CLAIM SUPPORTED' : 'CLAIM NOT SUPPORTED'}
        </p>
        <p className="font-mono text-[11px] text-[#8A7D68] mt-2">ρ {proof.effectiveDensity.toFixed(3)} t/m³ · same physics as estimate</p>
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
        <p className="serif-reading text-3xl text-[#2A2118]">{verdict.deg.toFixed(1)}°</p>
        <p className="font-mono text-[11px] text-[#8A7D68] mt-1">grain stands at {verdict.min}–{verdict.max}°</p>
        {requiredDeg != null && (
          <p className="font-mono text-[11px] text-[#8A7D68] mt-1">claim would need {requiredDeg.toFixed(1)}°</p>
        )}
        <p
          className={`mt-3 px-4 py-2 rounded-full font-mono text-xs font-bold ${
            verdict.violation ? 'bg-[#9C4A42] text-white' : 'bg-[#4A6B4F] text-white'
          }`}
        >
          {verdict.violation ? 'PHYSICS VIOLATION' : 'GEOMETRY POSSIBLE'}
        </p>
        <p className="text-xs text-[#6B5F4F] mt-2 leading-relaxed max-w-md">{verdict.label}</p>
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
      <p className="serif-reading text-4xl text-[#2A2118] mt-2">{bankable.bankableTonnes.toFixed(1)}T</p>
      <p className="font-mono text-[11px] text-[#8A7D68] mt-1">
        claimed {claimed.toFixed(1)}T · estimated {rangeLow.toFixed(1)}–{rangeHigh.toFixed(1)}T · haircut {bankable.haircutPct.toFixed(1)}%
      </p>
      <p className="font-mono text-[11px] text-[#8A7D68] mt-1">{bankable.breakdown.join(' · ')}</p>
      {value != null && (
        <p className="font-mono text-xs text-[#2A2118] mt-2">Defensible collateral value: ₹{value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
      )}
      <p className="text-[11px] text-[#8A7D68] mt-2">Conservative quantity for internal lending-risk assessment. Not an official banking formula.</p>
    </div>
  );
};

export const PhotoGateBanner: React.FC<{ quality: PhotoQuality | null }> = ({ quality }) => {
  if (!quality) return null;
  if (quality.ok) {
    return (
      <div className="washi-sheet px-4 py-3 flex items-start gap-3">
        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#4A6B4F] shrink-0" />
        <p className="text-sm text-[#2A2118]"><strong>✅ FULL PILE VISIBLE</strong> — good frame, you can proceed.</p>
      </div>
    );
  }
  return (
    <div className="washi-sheet px-4 py-3 flex items-start gap-3 border-[#9C4A42]/40">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#9C4A42] shrink-0" />
      <div>
        <p className="text-sm text-[#2A2118]"><strong>PHOTO NOT SUITABLE</strong> — capture the entire grain pile from farther away. Make sure the full pile is visible in one frame.</p>
        <ul className="text-xs text-[#6B5F4F] mt-1.5 space-y-0.5">
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
          <span className="w-1.5 h-1.5 rounded-full bg-[#A87F2A] shrink-0 animate-pulse" />
          <p className="font-mono text-[11px] text-[#8A7D68]">AI detectors reading this photo (ultra + sentry)… you can continue meanwhile.</p>
        </div>
      );
    }
    return (
      <div className="washi-sheet px-4 py-3 flex items-center gap-3 border-dashed">
        <span className="w-1.5 h-1.5 rounded-full bg-[#8A7D68] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[11px] text-[#8A7D68]">AI detectors unavailable — start them with `aidetect api`. Audit continues.</p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 font-mono text-[11px] px-3 py-1.5 rounded-full border border-[rgba(42,33,24,0.2)] hover:bg-[rgba(42,33,24,0.06)] transition-colors cursor-pointer"
          >
            Retry
          </button>
        )}
      </div>
    );
  }
  const rows = [primary, cross].filter((r): r is DetectFinding => !!r);
  const aiVotes = rows.filter((r) => r.label === 'ai').length;
  const tone =
    aiVotes === rows.length && rows.length > 0
      ? { bg: 'bg-[#9C4A42] text-white', word: 'LIKELY AI-GENERATED', dot: '#9C4A42' }
      : aiVotes === 0
        ? { bg: 'bg-[#4A6B4F] text-white', word: 'LIKELY REAL', dot: '#4A6B4F' }
        : { bg: 'bg-[#A87F2A] text-white', word: 'UNCERTAIN · BACKENDS DISAGREE', dot: '#A87F2A' };
  return (
    <div className="washi-sheet px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tone.dot }} />
        <p className="eyebrow-quiet">AI-image report · ultra + sentry cross-check</p>
        <span className={`ml-auto px-3 py-1 rounded-full font-mono text-[11px] font-bold ${tone.bg}`}>{tone.word}</span>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full font-mono text-[11px] text-[#2A2118]">
          <thead>
            <tr className="text-left text-[#8A7D68]">
              <th className="pr-3 py-1 font-normal">Backend</th>
              <th className="pr-3 py-1 font-normal">Label</th>
              <th className="pr-3 py-1 font-normal">AI Prob</th>
              <th className="pr-3 py-1 font-normal">Real Prob</th>
              <th className="py-1 font-normal">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.backend} className="border-t border-[rgba(42,33,24,0.1)]">
                <td className="pr-3 py-1.5">{r.backend}</td>
                <td className="pr-3 py-1.5 font-bold">{r.label === 'ai' ? 'AI' : 'REAL'}</td>
                <td className="pr-3 py-1.5">{r.probability_ai.toFixed(3)}</td>
                <td className="pr-3 py-1.5">{r.probability_real.toFixed(3)}</td>
                <td className="py-1.5">{r.confidence.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pending && <p className="font-mono text-[11px] text-[#8A7D68] mt-2 animate-pulse">Cross-check still reading…</p>}
      <p className="font-mono text-[11px] text-[#8A7D68] mt-2">AI image detection is probabilistic. Treat the output as one signal, not as proof.</p>
    </div>
  );
};

