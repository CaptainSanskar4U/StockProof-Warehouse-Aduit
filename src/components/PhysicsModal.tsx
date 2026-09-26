import React from 'react';
import { motion } from 'motion/react';
import { X, Scale, Layers, Droplets, Clock, ShieldCheck, HelpCircle, Leaf } from 'lucide-react';
import { GRAIN_BULK_DENSITIES, COMPACTION_MULTIPLIERS } from '../constants.js';
import { SEASON_PROFILES, SEASON_ORDER } from '../seasonProfiles.js';

interface PhysicsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PhysicsModal: React.FC<PhysicsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--overlay)] backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="bg-[var(--sheet)] border border-[var(--hairline)] rounded-2xl max-w-2xl w-full max-h-[90dvh] flex flex-col shadow-[0_24px_64px_rgba(43,32,22,0.25)] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--hairline)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Scale className="w-5 h-5 text-[var(--gold)]" />
            <div>
              <span className="text-[10px] font-mono tracking-widest text-[var(--ink-soft)] uppercase block">
                MATHEMATICAL FOUNDATION
              </span>
              <h3 className="text-lg font-instrument-serif text-[var(--ink-2)]">
                The Physics: Why Volume ≠ Weight
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--ink-soft)] hover:text-[var(--ink-2)] rounded hover:bg-[var(--wash)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-6 text-sm text-[var(--ink-soft)]">
          {/* Core Principle Callout */}
          <div className="bg-[var(--gold-tint-bg)] border border-[var(--gold-line)] p-4 rounded-xl text-xs space-y-1.5">
            <div className="flex items-center gap-2 text-[var(--gold)] font-mono uppercase tracking-wider font-semibold">
              <ShieldCheck className="w-4 h-4" />
              Core Principle & Golden Rule
            </div>
            <p className="text-[var(--ink-2)] font-medium text-sm">
              "The system supports the auditor — it does not replace the physical audit."
            </p>
            <p className="text-[var(--ink-soft)]">
              Two piles of grain that look identical in a photograph — identical height, identical footprint — can have very different actual tonnage. A naive fill-level formula is mathematically invalid. STOCKPROOF calculates defensible ranges based on empirical agronomic modifiers.
            </p>
          </div>

          {/* Section 1: Geometry to Volume */}
          <div>
            <div className="flex items-center gap-2 text-xs font-mono tracking-wider text-[var(--gold)] uppercase mb-2">
              <Layers className="w-4 h-4" />
              1. Physical Pile Geometry (m³)
            </div>
            <p className="text-xs text-[var(--ink-soft)] mb-3">
              Bulk grain poured in floor warehouses forms conical piles determined by the crop's natural angle of repose (~28° to 34°).
            </p>
            <div className="bg-[var(--well)] p-3 rounded border border-[var(--hairline)] font-mono text-xs text-[var(--ink-2)] flex flex-col gap-1">
              <div><strong>Conical Heap:</strong> V = (1/3) · π · r² · h</div>
              <div><strong>Truncated Frustum:</strong> V = (1/3) · π · h · (r₁² + r₁·r₂ + r₂²)</div>
            </div>
          </div>

          {/* Section 2: Standard Bulk Density Table */}
          <div>
            <div className="flex items-center gap-2 text-xs font-mono tracking-wider text-[var(--gold)] uppercase mb-2">
              <Scale className="w-4 h-4" />
              2. Standard Agronomic Bulk Densities (t/m³)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
              {Object.entries(GRAIN_BULK_DENSITIES).map(([key, data]) => (
                <div key={key} className="bg-[var(--well)] p-2.5 rounded border border-[var(--hairline)]">
                  <div className="text-[var(--ink-soft)]">{data.name}</div>
                  <div className="text-[var(--ink-2)] font-bold text-sm">{data.density.toFixed(3)} t/m³</div>
                  <div className="text-[10px] text-[var(--ink-soft)]">Base Moisture: {data.safeMoistureMax}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Context Adjustments */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono tracking-wider text-[var(--gold)] uppercase">
              <Droplets className="w-4 h-4" />
              3. Environmental & Storage Modifiers
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-[var(--well)] rounded border border-[var(--hairline)]">
                <strong className="text-[var(--ink-2)] block mb-1">Moisture / Humidity Curve:</strong>
                <p className="text-[var(--ink-soft)]">
                  Grain absorbs water hygroscopically. Each +1% moisture above baseline adds ~0.75% effective weight per m³ up to 18%, beyond which grain swells and respire, capping density. Drier grain (&lt;11%) is lighter.
                </p>
              </div>

              <div className="p-3 bg-[var(--well)] rounded border border-[var(--hairline)]">
                <strong className="text-[var(--ink-2)] block mb-1">Compaction Multiplier:</strong>
                <p className="text-[var(--ink-soft)]">
                  Aerated/Dumped: ×0.94 | Settled Medium: ×1.00 | Mechanically tamped/deep base: ×1.06
                </p>
              </div>

              <div className="p-3 bg-[var(--well)] rounded border border-[var(--hairline)]">
                <strong className="text-[var(--ink-2)] block mb-1">Storage Duration Creep (season-aware):</strong>
                <p className="text-[var(--ink-soft)]">
                  Piles stored under steady hydrostatic grain weight consolidate over time — but the rate is not fixed. Humid Kharif grain settles ~1.4% per 30 days (cap +5.0%), Rabi ~1.1% (cap +4.0%), hot dry Zaid only ~0.8% (cap +3.2%).
                </p>
              </div>

              <div className="p-3 bg-[var(--card-ink-bg)] rounded border border-[var(--card-ink-bg)]">
                <strong className="text-[var(--oncard-gold)] block mb-2 font-mono text-[11px] uppercase tracking-wider">Season calibration — same fill, different tonnage:</strong>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {SEASON_ORDER.map((s) => {
                    const p = SEASON_PROFILES[s];
                    return (
                      <div key={s} className="bg-[var(--oncard-wash)] border border-[var(--oncard-line)] rounded p-2.5">
                        <div className="text-[var(--paper)] text-xs font-mono font-bold uppercase">{p.name}</div>
                        <div className="text-[var(--oncard-faint)] text-[10px] font-mono mt-0.5">{p.harvestWindow}</div>
                        <div className="text-[var(--oncard)] text-[11px] mt-1.5 leading-snug">{p.storageHint}</div>
                        <div className="text-[var(--oncard-gold)] text-[10px] font-mono mt-1.5">
                          Typical {p.typicalHumidity[0]}–{p.typicalHumidity[1]}% · {(p.settleRatePer30d * 100).toFixed(1)}%/30d
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[var(--oncard-dim)] text-[11px] mt-2 leading-relaxed">
                  A 110 m³ wheat pile at 12.8% reads heaviest under Kharif, lightest under Zaid. Readings outside the season band widen the range and lower confidence.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Range & Confidence */}
          <div>
            <div className="flex items-center gap-2 text-xs font-mono tracking-wider text-[var(--gold)] uppercase mb-2">
              <HelpCircle className="w-4 h-4" />
              4. Range + Confidence vs False Precision
            </div>
            <p className="text-xs text-[var(--ink-soft)]">
              STOCKPROOF strictly computes a ±3.2% to ±6.5% uncertainty envelope. If a warehouse receipt states 100 T and the physical envelope is 84–90 T with 94% confidence, it triggers an audit priority—never an accusation of guilt, but a procedural necessity before loan disbursement.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[var(--hairline)] bg-[var(--well)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--ink)] hover:bg-[var(--ink-2)] text-[var(--ink-inverse)] font-bold rounded-full text-xs tracking-wider uppercase transition-colors"
          >
            Understood
          </button>
        </div>
      </motion.div>
    </div>
  );
};
