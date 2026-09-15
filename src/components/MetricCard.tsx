import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  accentColor?: 'gold' | 'green' | 'red' | 'neutral';
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  subtitle,
  badge,
  accentColor = 'neutral',
  className = '',
}) => {
  const accentClasses = {
    gold: 'text-[#B98A2E]',
    green: 'text-emerald-700',
    red: 'text-red-700',
    neutral: 'text-[#3D3226]',
  }[accentColor];

  return (
    <div
      className={`bg-white border border-[#3D3226]/10 rounded-lg p-4 relative flex flex-col justify-between ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-mono tracking-widest text-[#2B2016]/55 uppercase select-none">
          {label}
        </span>
        {badge}
      </div>

      <div className="flex items-baseline gap-1.5 my-1">
        <span className={`text-2xl sm:text-3xl font-instrument-serif tracking-tight ${accentClasses}`}>
          {value}
        </span>
        {unit && (
          <span className="text-xs sm:text-sm font-mono text-[#2B2016]/55 font-normal">
            {unit}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="text-xs text-[#2B2016]/60 mt-1 line-clamp-1">
          {subtitle}
        </p>
      )}
    </div>
  );
};
