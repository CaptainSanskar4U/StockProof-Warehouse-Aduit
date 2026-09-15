import React from 'react';
import { motion } from 'motion/react';
import { SectionHead } from './SectionHead.js';

const VECTORS = [
  {
    id: '01',
    title: 'Hollow-Core Stacking',
    body: 'Bags stacked neatly around empty drums, boxes, or inverted pallets. From the doorway the pile looks full. A doorway photo confirms the boundary, but the center is hollow air.',
    defense: 'STOCKPROOF defense: frustum slope detection + core-sample trigger when volume-to-tonnage ratio breaks conic repose.',
  },
  {
    id: '02',
    title: 'Moisture & Evaporative Inflation',
    body: 'Grain received at 18–19% moisture to inflate weighbridge tickets. Over 45 days in hot storage, water evaporates to 12%, shedding tonnes while paper receipts stay unchanged.',
    defense: 'STOCKPROOF defense: hygroscopic moisture curve penalizing water weight above certified safe thresholds.',
  },
  {
    id: '03',
    title: 'Double-Pledged Phantom Receipts',
    body: 'A single 100-tonne heap pledged to three regional banks. With no physical reconciliation between lenders, the same grain backs three concurrent credit lines.',
    defense: 'STOCKPROOF defense: centralized receipt ledger with spatial telemetry and cross-institution deduplication.',
  },
];

export const FraudVectors: React.FC = () => {
  return (
    <section className="space-y-8 border-t border-[#2B2016]/10 pt-14">
      <SectionHead
        eyebrow="THE FRAUD VECTORS"
        title={<>How commodity collateral <span className="italic">disappears</span></>}
        lede="Grain fraud is rarely sophisticated finance. It relies on physical blind spots, paper velocity, and the labor required to weigh 500 tonnes of loose grain."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {VECTORS.map((v, i) => (
          <motion.div
            key={v.id}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10% 0px' }}
            transition={{ duration: 0.7, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -4 }}
            className="bg-white border border-[#3D3226]/10 rounded-xl p-6 space-y-3 shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:border-[#3D3226]/25 hover:shadow-[0_12px_32px_rgba(0,0,0,0.1)] transition-shadow"
          >
            <div className="w-10 h-10 rounded bg-[#2B2016] flex items-center justify-center text-white font-mono font-bold">
              {v.id}
            </div>
            <h3 className="text-lg font-instrument-serif text-[#3D3226]">{v.title}</h3>
            <p className="text-xs sm:text-sm text-[#2B2016]/70 leading-relaxed">{v.body}</p>
            <div className="pt-2 text-[11px] font-mono text-[#B98A2E] leading-relaxed">{v.defense}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
