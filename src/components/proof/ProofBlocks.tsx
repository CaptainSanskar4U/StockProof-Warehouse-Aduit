import React from 'react';
import type { ReverseProof, ReposeVerdict, BankableResult, PhotoQuality, AiSuspicion } from '../../proofMath.js';
import type { UltraScore } from './SharedAuditContext.js';

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

export const AiWarningBanner: React.FC<{ ai: AiSuspicion | null }> = ({ ai }) => {
  if (!ai || !ai.suspect) return null;
  return (
    <div className="washi-well px-4 py-3 flex items-start gap-3">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#A87F2A] shrink-0" />
      <div>
        <p className="text-sm text-[#2A2118]"><strong>⚠️ Possible digitally created image ({ai.score}/100).</strong> Please confirm on-site. You can continue — this is a heuristic hint only, not proof.</p>
        {ai.reasons.length > 0 && <p className="font-mono text-[11px] text-[#8A7D68] mt-1">{ai.reasons.join(' · ')}</p>}
      </div>
    </div>
  );
};

/** Ultra ensemble verdict — the strong model. Warning only, never blocks.
 * Always visible once a photo exists: checking → verdict → unavailable.
 * `ai` is the offline heuristic fallback so the card never goes blank. */
export const UltraScoreCard: React.FC<{
  score: UltraScore | null;
  pending: boolean;
  ai?: AiSuspicion | null;
  onRetry?: () => void;
}> = ({ score, pending, ai, onRetry }) => {
  if (!score) {
    if (pending) {
      return (
        <div className="washi-sheet px-4 py-3 flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[#A87F2A] shrink-0 animate-pulse" />
          <p className="font-mono text-[11px] text-[#8A7D68]">🛰️ AI detector reading this photo (up to ~1 min on field CPU)… you can continue meanwhile.</p>
        </div>
      );
    }
    // Detector offline — never hide. Show heuristic state so the user knows the check ran.
    const heuristicBit =
      ai && ai.suspect
        ? `Heuristic: suspicious (${ai.score}/100 — ${ai.reasons.slice(0, 2).join(' · ')})`
        : ai
          ? `Heuristic: no AI traces (${ai.score}/100)`
          : 'Heuristic only';
    return (
      <div className="washi-sheet px-4 py-3 flex items-center gap-3 border-dashed">
        <span className="w-1.5 h-1.5 rounded-full bg-[#8A7D68] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[11px] text-[#8A7D68]">
            🛰️ AI detector warming up / unavailable — {heuristicBit}. Audit continues.
          </p>
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
  const pct = Math.round(score.probability_ai * 100);
  // Verdict follows the backend label (its own calibrated threshold), NOT the
  // raw pct: model scores don't live on a 0-100 ruler, so 15% AI can mean AI.
  // Strength comes from confidence in the predicted class.
  const isAi = score.label === 'ai';
  const strong = score.confidence >= 0.75;
  const tone = isAi
    ? strong
      ? { bg: 'bg-[#9C4A42] text-white', word: 'LIKELY AI-GENERATED', dot: '#9C4A42' }
      : { bg: 'bg-[#A87F2A] text-white', word: 'UNCERTAIN · LEANING AI', dot: '#A87F2A' }
    : strong
      ? { bg: 'bg-[#4A6B4F] text-white', word: 'LIKELY REAL', dot: '#4A6B4F' }
      : { bg: 'bg-[#A87F2A] text-white', word: 'UNCERTAIN · LEANING REAL', dot: '#A87F2A' };
  return (
    <div className="washi-sheet px-5 py-4 flex items-center gap-4">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tone.dot }} />
      <div className="flex-1 min-w-0">
        <p className="eyebrow-quiet">AI-detector · {score.backend}</p>
        <p className="mt-1 flex items-baseline gap-2 flex-wrap">
          <span className="serif-reading text-3xl text-[#2A2118]">{pct}% AI</span>
          <span className={`px-3 py-1 rounded-full font-mono text-[11px] font-bold ${tone.bg}`}>{tone.word}</span>
        </p>
        <p className="font-mono text-[11px] text-[#8A7D68] mt-1">Signal only, not proof · calibrated threshold {score.threshold} · audit continues either way</p>
      </div>
    </div>
  );
};
