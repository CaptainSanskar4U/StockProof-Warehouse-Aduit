import React, { useState } from 'react';
import { motion } from 'motion/react';
import { GRAIN_BULK_DENSITIES } from '../../constants.js';
import { SEASON_PROFILES, SEASON_ORDER } from '../../seasonProfiles.js';
import type { GrainType, Season } from '../../types.js';
import { SectionHead } from './SectionHead.js';

export const AgronomicMatrix: React.FC = () => {
  const [selectedCrop, setSelectedCrop] = useState<GrainType>('wheat');
  const [demoMoisture, setDemoMoisture] = useState<number>(12.8);
  const [demoCompaction, setDemoCompaction] = useState<'low' | 'medium' | 'high'>('medium');
  const [demoSeason, setDemoSeason] = useState<Season>('kharif');

  const sampleVolume = 100;
  const demoDays = 25;
  const baseDensity = GRAIN_BULK_DENSITIES[selectedCrop].density;
  const seasonP = SEASON_PROFILES[demoSeason];
  const moistureAdj = 1 + (demoMoisture - 12.0) * 0.008;
  const seasonAir = 1 + seasonP.moistureBiasPct * 0.003;
  const compactionBase = demoCompaction === 'low' ? 0.94 : demoCompaction === 'high' ? 1.06 : 1.0;
  const durationAdj = Math.min((demoDays / 30) * seasonP.settleRatePer30d, seasonP.maxConsolidation);
  const central = Number((sampleVolume * baseDensity * moistureAdj * seasonAir * (compactionBase + seasonP.compactionBias + durationAdj)).toFixed(1));
  const low = Number((central * 0.965).toFixed(1));
  const high = Number((central * 1.035).toFixed(1));

  // Same 100 m³ under all three curves — the twist in one glance
  const allSeasonCentrals = SEASON_ORDER.map((s) => {
    const p = SEASON_PROFILES[s];
    const air = 1 + p.moistureBiasPct * 0.003;
    const dur = Math.min((demoDays / 30) * p.settleRatePer30d, p.maxConsolidation);
    return { season: s, central: Number((sampleVolume * baseDensity * moistureAdj * air * (compactionBase + p.compactionBias + dur)).toFixed(1)) };
  });

  return (
    <section className="space-y-8 border-t border-[#2B2016]/10 pt-14">
      <SectionHead
        eyebrow="PHYSICAL REASONING"
        title={<>Volume ≠ Weight: <span className="italic">test the physics</span></>}
        lede="A 100 m³ heap of feed barley weighs 62 tonnes. The same 100 m³ of chana dal weighs 80 tonnes — and the same wheat heap weighs differently in Kharif vs Zaid. Select a crop and season to see why no fixed factor survives the field."
      />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-10% 0px' }}
        transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="bg-white border border-[#3D3226]/10 rounded-2xl p-5 sm:p-7 space-y-6 shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {(Object.keys(GRAIN_BULK_DENSITIES) as GrainType[]).map((crop) => {
            const info = GRAIN_BULK_DENSITIES[crop];
            const active = selectedCrop === crop;
            return (
              <button
                key={crop}
                type="button"
                onClick={() => setSelectedCrop(crop)}
                className={`p-3 rounded-xl text-left border transition-all cursor-pointer font-mono text-xs ${
                  active
                    ? 'bg-[#2B2016] border-[#2B2016] text-white'
                    : 'bg-[#F5F0E8] border-[#3D3226]/10 text-[#2B2016]/60 hover:border-[#3D3226]/30'
                }`}
              >
                <div className="font-bold text-sm truncate">{info.name.split(' ')[0]}</div>
                <div className={`text-[10px] mt-0.5 ${active ? 'text-[#D9A441]' : 'text-[#B98A2E]'}`}>{info.density.toFixed(2)} t/m³</div>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-[#2B2016]/10 text-xs font-mono">
          <div className="space-y-2 md:col-span-1">
            <span className="text-[#2B2016]/50 block">Season calibration curve:</span>
            <div className="grid grid-cols-3 gap-1.5">
              {SEASON_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setDemoSeason(s)}
                  className={`py-1.5 px-2 rounded-lg border uppercase text-[11px] transition-colors cursor-pointer ${
                    demoSeason === s
                      ? 'bg-[#2B2016] text-white font-bold border-[#2B2016]'
                      : 'bg-[#F5F0E8] text-[#2B2016]/60 border-[#3D3226]/10 hover:text-[#3D3226]'
                  }`}
                >
                  {SEASON_PROFILES[s].short}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-[#2B2016]/50 block">
              {SEASON_PROFILES[demoSeason].storageHint}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-[#2B2016]/50">Moisture Content:</span>
              <span className="text-[#3D3226] font-bold">{demoMoisture.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="8.0"
              max="18.0"
              step="0.2"
              value={demoMoisture}
              onChange={(e) => setDemoMoisture(parseFloat(e.target.value))}
              className="w-full accent-[#2B2016] bg-[#2B2016]/10 h-2 rounded cursor-pointer"
              aria-label="Moisture content"
            />
            <div className="flex justify-between text-[10px] text-[#2B2016]/50">
              <span>8% (Dry)</span>
              <span className="text-[#2F7A3D]">Safe Max: {GRAIN_BULK_DENSITIES[selectedCrop].safeMoistureMax}%</span>
              <span>18% (Damp)</span>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[#2B2016]/50 block">Compaction Factor:</span>
            <div className="grid grid-cols-3 gap-1.5">
              {(['low', 'medium', 'high'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setDemoCompaction(lvl)}
                  className={`py-1.5 px-2 rounded-lg border uppercase text-[11px] transition-colors cursor-pointer ${
                    demoCompaction === lvl
                      ? 'bg-[#2B2016] text-white font-bold border-[#2B2016]'
                      : 'bg-[#F5F0E8] text-[#2B2016]/60 border-[#3D3226]/10 hover:text-[#3D3226]'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-[#2B2016]/50 block">
              {demoCompaction === 'low' ? 'Loose dumped (×0.94)' : demoCompaction === 'high' ? 'Deep packed >60d (×1.06)' : 'Standard settled (×1.0)'} + {SEASON_PROFILES[demoSeason].short} curve
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#2B2016] p-3.5 rounded-xl flex flex-col justify-between md:col-span-1">
            <div>
              <span className="text-[10px] text-[#D9A441] uppercase tracking-wider font-semibold block">
                DEFENSIBLE TONNAGE (100 m³ · {SEASON_PROFILES[demoSeason].short.toUpperCase()})
              </span>
              <div className="text-2xl font-display font-extrabold text-white mt-1">
                {low} – {high} T
              </div>
            </div>
            <div className="text-[11px] text-[#E0EBF0]/60 mt-2">
              Central: <strong className="text-white">{central} T</strong> (±3.5% bound)
            </div>
          </div>
          <div className="md:col-span-2 bg-[#F5F0E8] border border-[#3D3226]/10 rounded-xl p-3.5 text-xs font-mono">
            <span className="text-[10px] text-[#B98A2E] uppercase tracking-wider font-semibold block mb-2">
              SAME 100 m³ PILE · ALL THREE SEASONS
            </span>
            <div className="grid grid-cols-3 gap-2">
              {allSeasonCentrals.map(({ season, central: c }) => (
                <button
                  key={season}
                  type="button"
                  onClick={() => setDemoSeason(season)}
                  className={`p-2.5 rounded-lg border text-left cursor-pointer transition-colors ${
                    demoSeason === season ? 'bg-[#2B2016] border-[#2B2016] text-white' : 'bg-white border-[#3D3226]/10 text-[#2B2016]/60 hover:border-[#3D3226]/30'
                  }`}
                >
                  <div className="text-[11px] font-bold uppercase">{SEASON_PROFILES[season].short}</div>
                  <div className="text-base font-display font-extrabold mt-0.5">{c} T</div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#2B2016]/55 mt-2 leading-relaxed">
              Identical geometry, {allSeasonCentrals[0]?.central} T (Kharif) vs {allSeasonCentrals[2]?.central} T (Zaid). Fixed multipliers cannot explain the field — season curves can.
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
};
