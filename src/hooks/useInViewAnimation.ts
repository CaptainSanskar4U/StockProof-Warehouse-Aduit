import { useEffect, useRef, useState } from 'react';

/**
 * Minimal IntersectionObserver hook — triggers once.
 * Used as fallback alongside motion/react whileInView.
 * threshold 0.1, fires once, returns [ref, inView].
 */
export function useInViewAnimation<T extends HTMLElement = HTMLDivElement>(threshold = 0.1) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setInView(true);
            obs.disconnect();
          }
        });
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, inView };
}

export const fadeUpClass = (inView: boolean) => (inView ? 'animate-fade-in-up' : 'opacity-0');
