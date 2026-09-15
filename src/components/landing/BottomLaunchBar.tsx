import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface Props {
  onEnterConsole: () => void;
}

export const BottomLaunchBar: React.FC<Props> = ({ onEnterConsole }) => {
  const [hidden, setHidden] = useState(false);

  // Slip away on scroll-down so it never covers the Partner CTA; return on scroll-up.
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y > 600 && y > last + 4) setHidden(true);
      else if (y < last - 4) setHidden(false);
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: hidden ? 0 : 1, y: hidden ? 24 : 0 }}
      transition={{ duration: 0.5, delay: hidden ? 0 : 1.2, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 ${hidden ? 'pointer-events-none' : ''}`}
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center gap-4 bg-white rounded-full pl-6 pr-2 py-2 shadow-[0_1px_2px_0_rgba(43,32,22,0.1),0_4px_12px_0_rgba(43,32,22,0.12),0_12px_32px_0_rgba(43,32,22,0.12)] border border-black/5">
        <span className="font-instrument-serif text-2xl font-semibold text-[#2B2016] leading-none">S</span>
        <button
          onClick={onEnterConsole}
          className="bg-[#2B2016] hover:bg-[#3D3226] text-white rounded-full px-6 py-2.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
        >
          Open the console
        </button>
      </div>
    </motion.div>
  );
};
