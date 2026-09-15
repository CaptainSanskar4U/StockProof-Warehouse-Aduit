import React, { useRef, useState, useCallback } from 'react';
import { ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { SAMPLE_GRAIN_IMAGES } from '../../constants.js';

interface Props {
  onEnterConsole: () => void;
}

// GIF/thumbnail pool — the marquee images array (Marquee.tsx is text-only,
// so the shared grain image set in constants.ts is the source of truth).
const TRAIL_IMAGES = Object.values(SAMPLE_GRAIN_IMAGES);

const AVATAR_URL =
  'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&fit=crop';

const SPAWN_MIN_GAP_MS = 80;
const FADE_MS = 1000;
const MAX_ALIVE = 12;

interface Trail {
  id: number;
  x: number;
  y: number;
  src: string;
  rotation: number;
}

const TrailItem: React.FC<{ trail: Trail; onDone: (id: number) => void }> = ({ trail, onDone }) => (
  <motion.div
    aria-hidden="true"
    className="absolute w-24 h-32 md:w-28 md:h-36 rounded-xl overflow-hidden border border-[#3D3226]/10 shadow-[0_16px_40px_rgba(43,32,22,0.22)] pointer-events-none bg-[#F5F0E8] will-change-transform"
    style={{ left: trail.x, top: trail.y }}
    initial={{ opacity: 1, scale: 1, x: '-50%', y: '-50%', rotate: trail.rotation }}
    animate={{ opacity: 0, scale: 0.6, x: '-50%', y: '-50%', rotate: trail.rotation }}
    transition={{ duration: FADE_MS / 1000, ease: 'easeOut' }}
    onAnimationComplete={() => onDone(trail.id)}
  >
    <img src={trail.src} alt="" aria-hidden="true" loading="lazy" className="w-full h-full object-cover" />
  </motion.div>
);

export const PartnerCTA: React.FC<Props> = ({ onEnterConsole }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSpawnRef = useRef(0);
  const idRef = useRef(0);
  const imgIdxRef = useRef(0);
  const [trails, setTrails] = useState<Trail[]>([]);
  const reduce = useReducedMotion() ?? false;

  const removeTrail = useCallback((id: number) => {
    setTrails((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleMove = useCallback(
    (e: React.MouseEvent) => {
      if (reduce) return;
      const now = performance.now();
      if (now - lastSpawnRef.current < SPAWN_MIN_GAP_MS) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      lastSpawnRef.current = now;
      idRef.current += 1;
      const src = TRAIL_IMAGES[imgIdxRef.current % TRAIL_IMAGES.length];
      imgIdxRef.current += 1;
      const trail: Trail = {
        id: idRef.current,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        src,
        rotation: Math.random() * 20 - 10,
      };
      // Bounded array + animation-driven removal = rAF-style cleanup, no DOM leak.
      setTrails((prev) => [...prev.slice(-(MAX_ALIVE - 1)), trail]);
    },
    [reduce],
  );

  const handleLeave = useCallback(() => {
    setTrails([]);
  }, []);

  return (
    <section className="w-full bg-white px-6 py-12">
      <div
        ref={containerRef}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        className="relative max-w-7xl mx-auto bg-white rounded-[40px] border border-[#3D3226]/10 shadow-[0_4px_30px_rgba(0,0,0,0.08)] overflow-hidden py-48 px-6 text-center"
      >
        {/* Mouse-trail spawn layer */}
        {!reduce && (
          <div aria-hidden="true" className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            {trails.map((t) => (
              <TrailItem key={t.id} trail={t} onDone={removeTrail} />
            ))}
          </div>
        )}

        {/* Centered content — always on top */}
        <div className="relative z-10">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="font-pp-mondwest text-[48px] md:text-[64px] lg:text-[80px] leading-[1.02] text-[#0D212C] mb-12"
          >
            Partner with StockProof
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="flex justify-center"
          >
            <button
              onClick={onEnterConsole}
              className="group inline-flex items-center gap-3 bg-[#2B2016] text-white rounded-full pl-2 pr-7 py-2 text-sm font-medium hover:bg-[#3D3226] transition-colors cursor-pointer shadow-[0_1px_2px_0_rgba(43,32,22,0.1),0_4px_4px_0_rgba(43,32,22,0.09),0_9px_6px_0_rgba(43,32,22,0.05),0_17px_7px_0_rgba(43,32,22,0.01)]"
            >
              <img
                src={AVATAR_URL}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="w-10 h-10 rounded-full object-cover"
              />
              <span>Go to Console</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
