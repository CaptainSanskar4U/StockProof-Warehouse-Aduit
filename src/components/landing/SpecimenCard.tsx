import React from 'react';
import { Play, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { SAMPLE_GRAIN_IMAGES } from '../../constants.js';
import { SafeImage } from '../SafeImage.js';

interface Props {
  onStartSampleVerification: () => void;
}

export const SpecimenCard: React.FC<Props> = ({ onStartSampleVerification }) => {
  return (
    <section className="w-full">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-10% 0px' }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="bg-white border border-[#3D3226]/10 rounded-2xl overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
      >
        <div className="p-4 sm:p-5 border-b border-[#3D3226]/10 bg-[#F5F0E8] flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#B98A2E] uppercase tracking-wider font-bold">LIVE AUDIT SPECIMEN:</span>
            <span className="text-[#3D3226]">Karnal Central Agro Terminal</span>
            <span className="text-[#2B2016]/50">/ WR-2026-88219</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#2B2016]/50 uppercase">Loan Issued:</span>
            <span className="text-[#3D3226] font-bold">₹32.5 Lakh (State Bank of India)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#3D3226]/10">
          <div className="lg:col-span-6 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#2B2016]/50 uppercase tracking-wider">OPTICAL GROUND-TRUTH RECORD</span>
              <span className="text-[#2F7A3D] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Boundary confirmed by auditor</span>
              </span>
            </div>

            <div className="relative aspect-16/10 rounded-xl overflow-hidden border border-[#3D3226]/10 bg-black">
              <SafeImage
                src={SAMPLE_GRAIN_IMAGES.wheat_pile}
                alt="Wheat heap measured at Karnal terminal"
                loading="lazy"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30 pointer-events-none p-4 flex flex-col justify-between">
                <div className="self-start text-[10px] font-mono text-[#D9A441] bg-black/75 px-2.5 py-1 rounded border border-[#D9A441]/30">
                  ⌀ 10.5m • Apex: 3.8m • Vol: 109.7 m³
                </div>
                <div className="self-end text-[10px] font-mono text-[#F3EFE7] bg-black/75 px-2.5 py-1 rounded">
                  Crop: Milling Wheat (0.77 t/m³)
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono text-xs bg-[#F5F0E8] p-3 rounded-lg border border-[#3D3226]/10">
              <div>
                <span className="text-[10px] text-[#2B2016]/50 block">Moisture</span>
                <span className="text-[#3D3226] font-semibold">12.8%</span>
              </div>
              <div>
                <span className="text-[10px] text-[#2B2016]/50 block">Compaction</span>
                <span className="text-[#3D3226] font-semibold">Medium (×1.0)</span>
              </div>
              <div>
                <span className="text-[10px] text-[#2B2016]/50 block">Consolidation</span>
                <span className="text-[#3D3226] font-semibold">25 Days</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 p-5 sm:p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs font-mono text-[#2B2016]/50 uppercase tracking-wider">
                  DECLARED RECEIPT VS PHYSICAL BOUNDS
                </span>
                <span className="px-2.5 py-1 rounded-full bg-[#B5574F]/10 text-[#B23A32] border border-[#B5574F]/30 font-mono text-xs uppercase font-bold">
                  High Priority Review
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#F5F0E8] p-4 rounded-xl border border-[#3D3226]/10">
                  <span className="text-[10px] font-mono text-[#2B2016]/50 uppercase block">
                    DECLARED ON RECEIPT
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-display font-black text-[#3D3226]">100.0</span>
                    <span className="text-xs font-mono text-[#2B2016]/50">Tonnes</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#B23A32] block mt-1">
                    Unverified pledge claim
                  </span>
                </div>

                <div className="bg-[#2B2016] p-4 rounded-xl border border-[#2B2016]">
                  <span className="text-[10px] font-mono text-[#D9A441] uppercase font-semibold block">
                    PHYSICAL RANGE BOUNDS · KHARIF CURVE
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl sm:text-3xl font-display font-black text-[#F6FCFF]">84.2 – 89.4</span>
                    <span className="text-xs font-mono text-[#E0EBF0]/60">T</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#8FD0A0] block mt-1">
                    94% Confidence Envelope
                  </span>
                </div>
              </div>

              <div className="p-4 bg-[#F5F0E8] rounded-xl border border-[#3D3226]/10 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-[#B98A2E] font-mono uppercase font-bold text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>OVER-DECLARATION GAP: 10.6 TONNES (+10.6%)</span>
                </div>
                <p className="text-[#2B2016]/70 leading-relaxed">
                  Even under maximum allowable bulk packing and moisture tolerances, a 109.7 m³ conical pile of milling wheat cannot physically exceed 89.4 tonnes. The receipt claims 100 tonnes — a shortfall of roughly ₹2.8 lakh on a ₹26 lakh pledge.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-[#3D3226]/10 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-mono text-[#2B2016]/50">
                Freeze pledge release &amp; schedule core probe.
              </span>
              <button
                onClick={onStartSampleVerification}
                className="px-4 py-2 bg-[#2B2016] hover:bg-[#3D3226] text-white font-mono font-bold text-xs uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Test This Verification</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};
