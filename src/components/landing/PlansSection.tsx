import React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { SectionHead } from './SectionHead.js';

interface Props {
  onEnterConsole: () => void;
  onOpenPhysics: () => void;
}

export const PlansSection: React.FC<Props> = ({ onEnterConsole, onOpenPhysics }) => {
  return (
    <section className="w-full bg-white text-[#3D3226] rounded-[32px] md:rounded-[40px] px-6 py-14 md:py-20 shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
      <div className="max-w-5xl mx-auto">
        <SectionHead
          align="center"
          eyebrow="DEPLOYMENT"
          title={<>Start with one heap, <span className="italic">scale to portfolio.</span></>}
          lede="No black-box scoring. Every run ships with optical bounds, season correction, and a signature-ready audit note."
        />

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Dark card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10% 0px' }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -4 }}
            className="rounded-[28px] bg-[#2B2016] text-[#F6FCFF] p-7 md:p-8 flex flex-col justify-between shadow-[0_1px_2px_0_rgba(43,32,22,0.1),0_4px_4px_0_rgba(43,32,22,0.09),0_9px_6px_0_rgba(43,32,22,0.05)]"
          >
            <div className="space-y-4">
              <h3 className="text-[22px] font-medium">Portfolio</h3>
              <p className="text-sm text-[#E0EBF0]/80 leading-relaxed">Continuous watch across all pledged warehouses. Same crew, same standards.</p>
              <div>
                <div className="text-2xl font-semibold text-[#F6FCFF]">Up to 12 sites</div>
                <div className="font-mono text-[11px] uppercase tracking-widest text-[#E0EBF0]/60 mt-1">Monthly re-verification</div>
              </div>
              <ul className="space-y-2 text-sm text-[#E0EBF0]/85">
                {['Monthly optical re-verification', 'Cross-bank deduplication ledger', 'Priority review queue + export'].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 text-[#D9A441]" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <button
                onClick={onEnterConsole}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-white text-[#2B2016] rounded-full px-6 py-3 text-sm font-medium hover:bg-white/90 transition-colors cursor-pointer shadow-[0_1px_2px_0_rgba(43,32,22,0.1),0_4px_4px_0_rgba(43,32,22,0.09)]"
              >
                <span>Start a verification</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onOpenPhysics}
                className="flex-1 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium border border-white/25 text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                How it works
              </button>
            </div>
          </motion.div>

          {/* Light card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10% 0px' }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -4 }}
            className="rounded-[28px] bg-white border border-[#3D3226]/10 p-7 md:p-8 flex flex-col justify-between shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
          >
            <div className="space-y-4">
              <h3 className="text-[22px] font-medium text-[#3D3226]">Pilot</h3>
              <p className="text-sm text-[#2B2016]/70 leading-relaxed">One warehouse, one dated optical record. Fixed scope, fixed timeline.</p>
              <div>
                <div className="text-2xl font-semibold text-[#3D3226]">1 site</div>
                <div className="font-mono text-[11px] uppercase tracking-widest text-[#2B2016]/50 mt-1">Record in 48 hours</div>
              </div>
              <ul className="space-y-2 text-sm text-[#2B2016]/80">
                {['Cone / frustum volume lock', 'Moisture + compaction correction', 'One-page defensible report'].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 text-[#3D3226]" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-7">
              <button
                onClick={onEnterConsole}
                className="w-full inline-flex items-center justify-center gap-2 bg-white text-[#3D3226] rounded-full px-6 py-3 text-sm font-medium border border-[#3D3226]/10 hover:border-[#3D3226]/25 transition-colors cursor-pointer shadow-[0_0_0_0.5px_rgba(0,0,0,0.05),0_4px_30px_rgba(0,0,0,0.08)]"
              >
                <span>Start a verification</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
