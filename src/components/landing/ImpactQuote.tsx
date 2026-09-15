import React, { useRef } from 'react';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import { motion, useScroll, useTransform } from 'motion/react';
import { SAMPLE_GRAIN_IMAGES } from '../../constants.js';

export const ImpactQuote: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const imgY = useTransform(scrollYProgress, [0, 1], [-36, 36]);

  return (
    <section ref={ref} className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10% 0px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="border border-[#3D3226]/10 rounded-2xl bg-[#F5F0E8] p-6 sm:p-10 flex flex-col justify-center space-y-4"
        >
          <div className="flex items-center gap-2.5 font-mono text-[11px] text-[#B98A2E] uppercase tracking-[0.2em] font-bold">
            <ShieldCheck className="w-5 h-5" />
            <span>The Core Operating Mandate</span>
          </div>
          <blockquote className="text-2xl sm:text-3xl font-instrument-serif text-[#3D3226] leading-snug">
            “The system supports the auditor — it does <span className="italic">not</span> replace the physical audit.”
          </blockquote>
          <p className="text-sm sm:text-base text-[#2B2016]/70 max-w-3xl leading-relaxed">
            No optical model can smell sour fermentation, detect gravel beneath a tarp, or replace the judgment of a certified inspector. STOCKPROOF triages auditor time toward statistical outliers.
          </p>
          <div className="pt-4 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs text-[#2B2016]/60">
            {['Honest uncertainty envelopes', 'Neutral priority, not accusations', 'Offline-first for silo dead-zones'].map((t) => (
              <div key={t} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2F7A3D]" />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10% 0px' }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-2xl overflow-hidden border border-[#3D3226]/10 min-h-[280px] lg:min-h-full"
        >
          <motion.img
            src={SAMPLE_GRAIN_IMAGES.silo_interior}
            alt="Inside a grain silo"
            loading="lazy"
            style={{ y: imgY }}
            className="absolute inset-0 w-full h-[120%] object-cover scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between font-mono text-[11px]">
            <span className="bg-black/70 border border-white/15 text-[#F3EFE7] px-2.5 py-1 rounded">FIELD RECORD — SILO 04, SANGRUR</span>
            <span className="bg-[#D9A441] text-[#1F1912] font-bold px-2.5 py-1 rounded">AUDITOR-VERIFIED BOUNDS</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
