import React from 'react';

const ITEMS = [
  { label: 'WHEAT 0.77 t/m³', serif: false },
  { label: 'defensible bounds', serif: true },
  { label: 'PADDY 0.75 t/m³', serif: false },
  { label: 'no phantom stock', serif: true },
  { label: 'MAIZE 0.72 t/m³', serif: false },
  { label: 'optical ground-truth', serif: true },
  { label: 'SOYBEAN 0.77 t/m³', serif: false },
  { label: 'FAO / USDA reference tables', serif: true },
  { label: 'PULSES 0.80 t/m³', serif: false },
  { label: '±3.5% envelopes', serif: true },
  { label: 'BARLEY 0.62 t/m³', serif: false },
  { label: 'auditor-first', serif: true },
];

export const Marquee: React.FC = () => {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div className="w-full border-y border-[#2B2016]/10 bg-white py-4 overflow-hidden marquee-paused">
      <div className="mask-fade-x w-full overflow-hidden">
        <div className="animate-marquee flex w-max items-center gap-8 pr-8">
          {row.map((item, i) => (
            <span key={i} className="flex items-center gap-8 whitespace-nowrap">
              <span
                className={
                  item.serif
                    ? 'font-instrument-serif italic text-[#B98A2E] text-base md:text-lg'
                    : 'font-mono text-[11px] md:text-xs tracking-[0.18em] text-[#2B2016]/55 uppercase'
                }
              >
                {item.label}
              </span>
              <span className="h-1 w-1 rounded-full bg-[#2B2016]/15" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
