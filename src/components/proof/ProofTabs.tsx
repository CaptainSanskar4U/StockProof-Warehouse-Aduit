import React, { useMemo, useState } from 'react';
import type { GrainType, Season } from '../../types.js';
import { GRAIN_BULK_DENSITIES } from '../../constants.js';
import { SEASON_PROFILES, SEASON_ORDER } from '../../seasonProfiles.js';
import {
  bankableTonnes,
  coneVolumeM3,
  getEffectiveDensity,
  reposeVerdict,
  reverseProof,
  reposeDeg,
} from '../../proofMath.js';
import {
  BankableBlock,
  PhysicsCheckBlock,
  ReverseProofBlock,
} from './ProofBlocks.js';
import { useSharedAudit } from './SharedAuditContext.js';
import { SafeImage } from '../SafeImage.js';

function GrainRow({ value, onChange }: { value: GrainType; onChange: (g: GrainType) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(GRAIN_BULK_DENSITIES) as GrainType[]).slice(0, 6).map((g) => (
        <button
          key={g}
          type="button"
          onClick={() => onChange(g)}
          className={`touch-target px-3 py-1.5 rounded-full border text-xs cursor-pointer ${
            value === g ? 'bg-[var(--ink)] text-[var(--ink-inverse)] border-[var(--ink)]' : 'border-[var(--hairline)] text-[var(--ink-soft)]'
          }`}
        >
          {GRAIN_BULK_DENSITIES[g].name}
        </button>
      ))}
    </div>
  );
}

function SeasonRow({ value, onChange }: { value: Season; onChange: (s: Season) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {SEASON_ORDER.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={`touch-target px-3 py-2 rounded-[10px] border text-left cursor-pointer ${
            value === s ? 'bg-[var(--well)] border-[var(--gold-line)]' : 'border-[var(--hairline-soft)]'
          }`}
        >
          <span className="block text-xs text-[var(--ink)]">{SEASON_PROFILES[s].name}</span>
        </button>
      ))}
    </div>
  );
}

/** Small reminder of the shared pile — same photo New Audit holds. */
function SharedPileNote() {
  const { photo, declaredText } = useSharedAudit();
  const declared = parseFloat(declaredText);
  return (
    <div className="washi-sheet px-5 py-4 flex items-center gap-4">
      {photo ? (
        <SafeImage src={photo.dataUrl} alt="Shared pile" className="w-14 h-14 rounded-[10px] object-cover border border-[var(--hairline)] shrink-0" />
      ) : (
        <div className="w-14 h-14 rounded-[10px] border border-dashed border-[var(--hairline-strong)] shrink-0 flex items-center justify-center">
          <span className="font-mono text-[10px] text-[var(--ink-faint)]">no photo</span>
        </div>
      )}
      <div className="min-w-0">
        <p className="eyebrow-quiet">Same pile as New Audit</p>
        <p className="text-sm text-[var(--ink)] truncate">
          {photo ? photo.name : 'Upload a photo in New Audit first — sliders below still work for what-if.'}
          {Number.isFinite(declared) && declared > 0 ? ` · claimed ${declared.toFixed(1)}T` : ''}
        </p>
      </div>
    </div>
  );
}

export const ReverseTab: React.FC = () => {
  const p = useSharedAudit();
  const declared = parseFloat(p.declaredText) || 0;
  const proof = useMemo(
    () =>
      reverseProof(declared, p.baseDiameterMeters, p.heightMeters, {
        grainType: p.grainType, season: p.season, humidityPercent: p.humidityPercent,
        compaction: p.compaction, storageDays: p.storageDays,
      }),
    [declared, p.baseDiameterMeters, p.heightMeters, p.grainType, p.season, p.humidityPercent, p.compaction, p.storageDays],
  );
  const verdict = useMemo(() => reposeVerdict(proof.requiredHeightM, p.baseDiameterMeters), [proof, p.baseDiameterMeters]);
  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <SharedPileNote />
      <div className="washi-sheet px-5 py-5 space-y-4">
        <p className="eyebrow-quiet">Reverse proof · start from the claim</p>
        <label className="block">
          <span className="text-sm text-[var(--ink-soft)]">Declared claim (tonnes) — same as New Audit</span>
          <input type="number" value={p.declaredText} onChange={(e) => { p.setDeclaredText(e.target.value); p.setDeclaredTouched(true); }}
            className="mt-1 w-full bg-transparent serif-reading text-4xl text-[var(--ink)] focus:outline-none border-b border-[var(--hairline)] pb-1" />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block"><span className="text-xs text-[var(--ink-soft)]">Base diameter {p.baseDiameterMeters.toFixed(1)}m</span>
            <input type="range" min={5} max={22} step={0.1} value={p.baseDiameterMeters} onChange={(e) => p.setBaseDiameterMeters(parseFloat(e.target.value))} className="washi-range" /></label>
          <label className="block"><span className="text-xs text-[var(--ink-soft)]">Measured height {p.heightMeters.toFixed(1)}m</span>
            <input type="range" min={1.5} max={8} step={0.1} value={p.heightMeters} onChange={(e) => p.setHeightMeters(parseFloat(e.target.value))} className="washi-range" /></label>
        </div>
        <GrainRow value={p.grainType} onChange={p.setGrainType} />
        <SeasonRow value={p.season} onChange={p.setSeason} />
      </div>
      <ReverseProofBlock proof={proof} />
      <PhysicsCheckBlock verdict={verdict} requiredDeg={reposeDeg(proof.requiredHeightM, p.baseDiameterMeters)} />
    </div>
  );
};

export const GeometryTab: React.FC = () => {
  const p = useSharedAudit();
  const v = useMemo(() => reposeVerdict(p.heightMeters, p.baseDiameterMeters), [p.heightMeters, p.baseDiameterMeters]);
  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <SharedPileNote />
      <div className="washi-sheet px-5 py-5 space-y-4">
        <p className="eyebrow-quiet">Impossible geometry · pure pile math, same pile</p>
        <label className="block"><span className="text-xs text-[var(--ink-soft)]">Height {p.heightMeters.toFixed(1)}m</span>
          <input type="range" min={1.5} max={8} step={0.1} value={p.heightMeters} onChange={(e) => p.setHeightMeters(parseFloat(e.target.value))} className="washi-range" /></label>
        <label className="block"><span className="text-xs text-[var(--ink-soft)]">Diameter {p.baseDiameterMeters.toFixed(1)}m</span>
          <input type="range" min={5} max={22} step={0.1} value={p.baseDiameterMeters} onChange={(e) => p.setBaseDiameterMeters(parseFloat(e.target.value))} className="washi-range" /></label>
        <p className="font-mono text-[11px] text-[var(--ink-faint)]">volume ≈ {coneVolumeM3(p.heightMeters, p.baseDiameterMeters)} m³ · angle atan(2h/d)</p>
      </div>
      <PhysicsCheckBlock verdict={v} />
    </div>
  );
};

export const BankableTab: React.FC = () => {
  const p = useSharedAudit();
  const [price, setPrice] = useState(26000);
  const declared = parseFloat(p.declaredText) || 0;
  const density = useMemo(
    () => getEffectiveDensity({ grainType: p.grainType, season: p.season, humidityPercent: p.humidityPercent, compaction: p.compaction, storageDays: p.storageDays }),
    [p.grainType, p.season, p.humidityPercent, p.compaction, p.storageDays],
  );
  const central = coneVolumeM3(p.heightMeters, p.baseDiameterMeters) * density;
  const low = central * 0.94;
  const high = central * 1.06;
  const b = useMemo(() => bankableTonnes(low, 86, p.humidityPercent, true), [low, p.humidityPercent]);
  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <SharedPileNote />
      <div className="washi-sheet px-5 py-5 space-y-4">
        <p className="eyebrow-quiet">Bankable tonnes · lending-safe number, same pile</p>
        <GrainRow value={p.grainType} onChange={p.setGrainType} />
        <SeasonRow value={p.season} onChange={p.setSeason} />
        <label className="block"><span className="text-xs text-[var(--ink-soft)]">Price ₹/tonne (optional)</span>
          <input type="number" value={price} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
            className="mt-1 w-full bg-transparent font-mono text-lg text-[var(--ink)] border-b border-[var(--hairline)] focus:outline-none" /></label>
      </div>
      <BankableBlock bankable={b} claimed={declared} rangeLow={low} rangeHigh={high} pricePerTonne={price} />
    </div>
  );
};
