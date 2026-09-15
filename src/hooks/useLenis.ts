import { useEffect } from 'react';
import Lenis from 'lenis';

let lenis: Lenis | null = null;

export function getLenis(): Lenis | null {
  return lenis;
}

/** Smooth-scroll to an element id via Lenis, with native fallback. */
export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  if (lenis) {
    lenis.scrollTo(el, { duration: 1.4 });
  } else {
    el.scrollIntoView({ behavior: 'smooth' });
  }
}

/** Mount buttery smooth scrolling. Auto-disabled for reduced-motion. */
export function useLenis(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    let raf = 0;
    const loop = (time: number) => {
      lenis?.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis?.destroy();
      lenis = null;
    };
  }, [enabled]);
}
