import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Reveal } from './Reveal.js';

interface T {
  quote: string;
  name: string;
  initials: string;
  role: string;
}

const DATA: T[] = [
  {
    quote: 'Our Karnal file went from disputed to disbursed in nine days. The range note answered every question the credit committee asked.',
    name: 'Meera Kulkarni',
    initials: 'MK',
    role: 'Field Inspector · Apex Agri Audit, Karnal belt',
  },
  {
    quote: 'Moisture correction alone stopped an ₹11 lakh over-pledge on our Indore file. The bounds were honest — no false precision.',
    name: 'Arjun Mehta',
    initials: 'AM',
    role: 'VP Agri Credit · State Lender, MP',
  },
  {
    quote: 'Same heap, different season, different tonnage — that one screen ended three arguments in our Kota review meeting.',
    name: 'Vikram Rajput',
    initials: 'VR',
    role: 'Commodity Inspector · Rajasthan',
  },
  {
    quote: 'Our inspectors actually use the offline record in silo dead-zones. It works where the network does not.',
    name: 'Lakshmi Nair',
    initials: 'LN',
    role: 'FPO Manager · Malwa Soya Collective',
  },
  {
    quote: 'Two phantom heaps our weighbridge missed entirely. The photo check caught what the paper never would.',
    name: 'R. Kannan',
    initials: 'RK',
    role: 'Head of Audit · Rural Bank, Tamil Nadu',
  },
];

const QUOTE_PATH = 'M10 8c-3 1-5 3.5-5 7v1h5v-6H7.5C8 9 9 8.5 10 8.2V8zm9 0c-3 1-5 3.5-5 7v1h5v-6h-2.5c.5-1 1.5-1.5 2.5-1.8V8z';

export const AuditTestimonials: React.FC = () => {
  const tripled = [...DATA, ...DATA, ...DATA];
  const [index, setIndex] = useState(DATA.length); // start in middle copy for loop feel
  const [paused, setPaused] = useState(false);
  const [offset, setOffset] = useState(451.5);
  const firstCardRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    const el = firstCardRef.current;
    if (el) setOffset(el.offsetWidth + 24);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setIndex((prev) => {
        const next = prev + 1;
        // wrap inside tripled range to fake infinite
        if (next >= DATA.length * 2) return DATA.length;
        return next;
      });
    }, 3000);
    return () => clearInterval(id);
  }, [paused]);

  const prev = () => setIndex((p) => (p <= 0 ? DATA.length : p - 1));
  const next = () => setIndex((p) => (p >= DATA.length * 2 ? DATA.length : p + 1));

  return (
    <section
      className="w-full bg-white text-[#3D3226] py-20"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="max-w-[1200px] mx-auto px-6">
        <Reveal>
          <div className="md:max-w-4xl md:ml-auto flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
            <h2 className="text-[32px] md:text-[40px] lg:text-[44px] leading-[1.1] tracking-tight text-[#3D3226]">
              What field <span className="font-instrument-serif italic">auditors</span> say
            </h2>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs uppercase tracking-widest text-[#2B2016]/60">Notes from demo field runs</span>
            </div>
          </div>
        </Reveal>

        <div className="h-[2px] bg-[#3D3226]/10 rounded-full overflow-hidden mb-6">
          <motion.div
            className="h-full bg-[#2B2016] rounded-full"
            animate={{ width: `${(((index % DATA.length) + DATA.length) % DATA.length + 1) / DATA.length * 100}%` }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        <div ref={viewportRef} className="overflow-hidden">
          <motion.div
            className="flex gap-6 cursor-grab active:cursor-grabbing"
            animate={{ x: -index * offset }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.12}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60) next();
              else if (info.offset.x > 60) prev();
            }}
          >
            {tripled.map((t, i) => (
              <div
                key={`${t.name}-${i}`}
                ref={i === 0 ? firstCardRef : undefined}
                className="shrink-0 w-[calc(100vw-48px)] md:w-[427.5px] bg-white rounded-[32px] md:rounded-[40px] shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-[#3D3226]/5 px-6 md:pl-10 md:pr-12 py-8 flex flex-col justify-between min-h-[300px]"
              >
                <div className="space-y-4">
                  <svg viewBox="0 0 24 16" className="w-8 h-6 fill-[#3D3226]/15" aria-hidden="true">
                    <path d={QUOTE_PATH} />
                  </svg>
                  <p className="text-base text-[#3D3226] leading-relaxed">“{t.quote}”</p>
                </div>
                <div className="mt-6 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#2B2016] text-[#D9A441] font-instrument-serif italic text-lg flex items-center justify-center shrink-0" aria-hidden="true">
                    {t.initials}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-[#3D3226]">{t.name}</div>
                    <div className="text-xs text-[#2B2016]/60 font-mono mt-0.5">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        <div className="mt-8 flex items-center gap-3">
          <button
            onClick={prev}
            aria-label="Previous testimonial"
            className="w-12 h-12 rounded-full border border-[#3D3226]/20 flex items-center justify-center hover:bg-[#3D3226] hover:text-white transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            aria-label="Next testimonial"
            className="w-12 h-12 rounded-full border border-[#3D3226]/20 flex items-center justify-center hover:bg-[#3D3226] hover:text-white transition-colors cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <span className="ml-2 font-mono text-xs text-[#2B2016]/50">
            {(index % DATA.length) + 1} / {DATA.length}
          </span>
        </div>
      </div>
    </section>
  );
};
