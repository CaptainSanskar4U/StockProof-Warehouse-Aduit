import React from 'react';
import { Reveal } from './Reveal.js';

export const Eyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <span
    className={`font-mono text-[11px] uppercase tracking-[0.2em] text-[#2B2016]/50 block ${className}`}
  >
    {children}
  </span>
);

interface SectionHeadProps {
  eyebrow: string;
  title: React.ReactNode;
  lede?: string;
  align?: 'left' | 'center';
}

/** Shared editorial section header — one rhythm across the whole page. */
export const SectionHead: React.FC<SectionHeadProps> = ({
  eyebrow,
  title,
  lede,
  align = 'left',
}) => (
  <Reveal>
    <div
      className={`max-w-3xl space-y-3 flex flex-col ${
        align === 'center' ? 'mx-auto text-center items-center' : ''
      }`}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="display-section leading-[1.1] tracking-tight font-instrument-serif text-[#3D3226]">
        {title}
      </h2>
      {lede && (
        <p className="text-sm md:text-base text-[#2B2016]/70 leading-relaxed">{lede}</p>
      )}
    </div>
  </Reveal>
);
