import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  Play,
  ChevronDown
} from 'lucide-react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { Marquee } from './landing/Marquee.js';
import { SpecimenCard } from './landing/SpecimenCard.js';
import { FraudVectors } from './landing/FraudVectors.js';
import { ImpactQuote } from './landing/ImpactQuote.js';
import { AgronomicMatrix } from './landing/AgronomicMatrix.js';
import { PlansSection } from './landing/PlansSection.js';
import { AuditTestimonials } from './landing/AuditTestimonials.js';
import { CaseStudies } from './landing/CaseStudies.js';
import { PartnerCTA } from './landing/PartnerCTA.js';
import { LandingFooter } from './landing/LandingFooter.js';
import { BottomLaunchBar } from './landing/BottomLaunchBar.js';
import { useLenis, scrollToId } from '../hooks/useLenis.js';
import { SAMPLE_GRAIN_IMAGES } from '../constants.js';

interface LandingPageViewProps {
  onEnterConsole: () => void;
  onStartSampleVerification: () => void;
  onOpenPhysics: () => void;
  onOpenReviews?: () => void;
  onOpenReports?: () => void;
}

const HERO_VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_204103_f607742e-09da-4cf5-bb06-4e67b0a531de.mp4';
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Masked line reveal for the headline — award-style entrance. */
const LineReveal: React.FC<{ children: React.ReactNode; delay: number; reduce: boolean }> = ({
  children,
  delay,
  reduce,
}) => (
  <span className="block overflow-hidden pb-[0.1em] -mb-[0.1em]">
    <motion.span
      className="block"
      initial={reduce ? { opacity: 0 } : { y: '110%' }}
      animate={reduce ? { opacity: 1 } : { y: '0%' }}
      transition={{ duration: 1, delay, ease: EASE }}
    >
      {children}
    </motion.span>
  </span>
);

const FadeItem: React.FC<{ children: React.ReactNode; delay: number; reduce: boolean; y?: number }> = ({
  children,
  delay,
  reduce,
  y = 18,
}) => (
  <motion.div
    initial={{ opacity: 0, y: reduce ? 0 : y }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.8, delay, ease: EASE }}
  >
    {children}
  </motion.div>
);

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onEnterConsole,
  onStartSampleVerification,
  onOpenPhysics,
  onOpenReviews,
  onOpenReports,
}) => {
  useLenis(true);
  const reduce = useReducedMotion() ?? false;

  // Video delivery state: still paints instantly, clip fades in when ready.
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  // Scroll-linked parallax for the hero.
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const mediaY = useTransform(scrollYProgress, [0, 1], ['0%', '12%']);
  const contentY = useTransform(scrollYProgress, [0, 0.8], [0, 80]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const scrollToExplore = () => scrollToId('deep-audit-matrix');

  const handleReviews = onOpenReviews || onEnterConsole;
  const handleReports = onOpenReports || onEnterConsole;

  return (
    <div className="w-full bg-white text-[#2B2016] font-sans selection:bg-[#D9A441]/30 selection:text-[#2B2016]">
      {/* ========================================================= */}
      {/* FULLSCREEN HERO — centered, no navbar                     */}
      {/* ========================================================= */}
      <section ref={heroRef} className="relative w-full min-h-[100svh] overflow-hidden flex flex-col">
        {/* Layered background: still (instant) -> video (fades in) -> grade -> melt */}
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none bg-[#15110D]">
          <motion.div style={reduce ? undefined : { y: mediaY }} className="absolute inset-0">
            <motion.img
              src={SAMPLE_GRAIN_IMAGES.wheat_pile}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover contrast-[1.06] saturate-[1.08]"
              initial={reduce ? false : { scale: 1.08 }}
              animate={{ scale: 1 }}
              transition={{ duration: 8, ease: 'easeOut' }}
            />
            {!videoFailed && (
              <video
                autoPlay
                loop
                muted
                playsInline
                disablePictureInPicture
                preload="auto"
                poster={SAMPLE_GRAIN_IMAGES.wheat_pile}
                onCanPlay={() => setVideoReady(true)}
                onError={() => setVideoFailed(true)}
                className={`absolute inset-0 w-full h-full object-cover contrast-[1.06] saturate-[1.08] transition-opacity duration-1000 ${
                  videoReady ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <source src={HERO_VIDEO} type="video/mp4" />
              </video>
            )}
          </motion.div>
          {/* Cinematic contrast + white melt into the page below */}
          <div className="absolute inset-0 bg-black/25" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#FAF8F3] via-transparent to-black/15" />
        </div>

        {/* Centered content */}
        <motion.div
          style={reduce ? undefined : { y: contentY, opacity: contentOpacity }}
          className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-24 text-center"
        >
          {/* Specimen Tag */}
          <FadeItem delay={0.1} reduce={reduce}>
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[#D9A441] font-mono text-[11px] uppercase tracking-widest mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D9A441] animate-pulse" />
              <span>Warehouse receipt checker</span>
            </div>
          </FadeItem>

          {/* Main Heading in Instrument Serif */}
          <h1 className="display-hero font-instrument-serif text-white max-w-5xl">
            <LineReveal delay={0.25} reduce={reduce}>
              <>Is the grain</>
            </LineReveal>
            <LineReveal delay={0.4} reduce={reduce}>
              <><span className="italic font-instrument-serif">really</span> there?</>
            </LineReveal>
          </h1>

          {/* Subtext */}
          <FadeItem delay={0.7} reduce={reduce}>
            <p className="mt-4 md:mt-5 text-white/75 text-sm md:text-base font-light max-w-xl leading-relaxed">
              Farmers borrow money against grain stored in warehouses.
              Sometimes the paper says 100 tonnes and the heap is smaller.
              Stockproof checks a phone photo of the heap against the paper —
              before the bank lends.
            </p>
          </FadeItem>

          {/* Buttons Row */}
          <FadeItem delay={0.85} reduce={reduce}>
            <div className="mt-5 md:mt-6 flex flex-col sm:flex-row items-center gap-4">
              <motion.button
                onClick={onEnterConsole}
                whileHover={reduce ? undefined : { scale: 1.03 }}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                className="w-full sm:w-auto bg-white hover:bg-white/90 text-black rounded-full px-7 py-3 text-sm font-medium flex items-center justify-center gap-2 group transition-colors duration-200 cursor-pointer shadow-lg"
              >
                <span>Open the console</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
              </motion.button>

              <motion.button
                onClick={onOpenPhysics}
                whileHover={reduce ? undefined : { scale: 1.03 }}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                className="w-full sm:w-auto transparent border border-white/40 hover:border-white/60 hover:bg-white/10 text-white rounded-full px-7 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors duration-200 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>See how it works</span>
              </motion.button>
            </div>
          </FadeItem>

          {/* Live Ticker Strip */}
          <FadeItem delay={1.0} reduce={reduce}>
            <div className="mt-8 sm:mt-12 inline-flex items-center gap-2 sm:gap-3 px-4 py-2 rounded-lg bg-black/60 backdrop-blur-md border border-white/15 text-xs font-mono text-[#C0B7AB]">
              <span className="text-[#D9A441] font-bold">CASE SPECIMEN:</span>
              <span className="truncate max-w-[200px] sm:max-w-none">Karnal Agro Terminal (WR-88219)</span>
              <span className="text-white/30 hidden sm:inline">|</span>
              <span className="hidden sm:inline text-[#E5736B]">100T on paper vs 84.2–89.4T in the shed</span>
              <button
                onClick={onStartSampleVerification}
                className="text-[#D9A441] underline hover:text-[#E8B75A] ml-1 cursor-pointer"
              >
                Check this heap
              </button>
            </div>
          </FadeItem>
        </motion.div>

        {/* Minimal scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.2, ease: EASE }}
          className="relative z-10 pb-6 flex justify-center"
        >
          <button
            onClick={scrollToExplore}
            aria-label="Scroll to explore"
            className="flex flex-col items-center gap-1.5 text-[#2B2016]/60 hover:text-[#2B2016] transition-colors cursor-pointer"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.25em]">Scroll</span>
            <ChevronDown className="w-4 h-4 animate-bounce" />
          </button>
        </motion.div>
      </section>

      {/* ========================================================= */}
      {/* WHITE LANDING FLOW                                        */}
      {/* ========================================================= */}
      <Marquee />

      <div id="deep-audit-matrix" className="max-w-[1200px] mx-auto px-6 py-20 md:py-28 space-y-20 md:space-y-28">
        <SpecimenCard onStartSampleVerification={onStartSampleVerification} />
        <CaseStudies />
        <FraudVectors />
        <ImpactQuote />
        <AgronomicMatrix />
      </div>

      <div className="w-full bg-white px-6 pb-6">
        <PlansSection onEnterConsole={onEnterConsole} onOpenPhysics={onOpenPhysics} />
      </div>

      <AuditTestimonials />
      <PartnerCTA onEnterConsole={onEnterConsole} />
      <LandingFooter
        onEnterConsole={onEnterConsole}
        onOpenPhysics={onOpenPhysics}
        onOpenReviews={handleReviews}
        onOpenReports={handleReports}
      />

      <BottomLaunchBar onEnterConsole={onEnterConsole} />
    </div>
  );
};
