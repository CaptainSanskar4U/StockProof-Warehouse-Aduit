import React from 'react';
import { motion } from 'motion/react';
import { SAMPLE_GRAIN_IMAGES } from '../../constants.js';
import { SafeImage } from '../SafeImage.js';
import { SectionHead } from './SectionHead.js';

const CASES = [
  {
    name: 'Karnal Terminal · WR-2026-88219',
    serif: 'The 100-tonne receipt that weighed 86',
    desc: 'Declared 100T against 84.2–89.4T physical bounds (Kharif curve, 94% confidence). Pledge release frozen before a ₹26 lakh exposure.',
    img: SAMPLE_GRAIN_IMAGES.wheat_pile,
    alt: 'Measured wheat heap at Karnal terminal',
  },
  {
    name: 'Indore Oilseed Belt · WR-2026-90412',
    serif: 'Four soybean sheds, one honest ledger',
    desc: 'Intake checks across 4 bagged-soybean sheds — moisture-corrected bounds in under 20 minutes per shed, no weighbridge queue.',
    img: SAMPLE_GRAIN_IMAGES.soybean_pile,
    alt: 'Bagged soybean stock inside a secured warehouse shed',
  },
  {
    name: 'Sangrur Paddy Cluster · WR-2026-64119',
    serif: 'One ledger across paddy, wheat and pulses',
    desc: 'Portfolio view across three commodities — every receipt tied to a dated optical record, zero double-pledged lots.',
    img: SAMPLE_GRAIN_IMAGES.rice_pile,
    alt: 'Paddy stock at Sangrur cluster',
  },
];

export const CaseStudies: React.FC = () => {
  return (
    <section className="w-full bg-white text-[#2B2016] px-6 py-20 md:py-28">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-12">
          <SectionHead
            eyebrow="FIELD RECORDS"
            title={<>Verified heaps, <span className="italic">not slideware.</span></>}
          />
        </div>

        <div className="flex flex-col gap-16 md:gap-20">
          {CASES.map((c) => (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10% 0px' }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="ml-20 md:ml-28 mb-4">
                <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#2B2016]/50">{c.name}</div>
                <h3 className="font-instrument-serif font-semibold text-2xl md:text-3xl text-[#2B2016] mt-1">{c.serif}</h3>
                <p className="text-sm md:text-base text-[#2B2016]/70 mt-1 max-w-xl leading-relaxed">{c.desc}</p>
              </div>
              <div className="overflow-hidden rounded-2xl shadow-lg border border-black/5 group">
                <motion.div
                  initial={{ scale: 1.06 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  <SafeImage
                    src={c.img}
                    alt={c.alt}
                    loading="lazy"
                    className="w-full h-[280px] md:h-[460px] object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  />
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
