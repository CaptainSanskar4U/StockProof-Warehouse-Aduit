import React from 'react';

interface RangeBarProps {
  rangeLow: number;
  rangeHigh: number;
  declared: number;
  unit?: string;
  showLabels?: boolean;
}

export const RangeBar: React.FC<RangeBarProps> = ({
  rangeLow,
  rangeHigh,
  declared,
  unit = 'T',
  showLabels = true,
}) => {
  // Compute bounds with padding for visual comfort
  const minVal = Math.min(rangeLow, declared) * 0.88;
  const maxVal = Math.max(rangeHigh, declared) * 1.12;
  const totalSpan = maxVal - minVal || 1;

  const leftPercent = Math.max(0, Math.min(100, ((rangeLow - minVal) / totalSpan) * 100));
  const widthPercent = Math.max(4, Math.min(100 - leftPercent, ((rangeHigh - rangeLow) / totalSpan) * 100));
  const declaredPercent = Math.max(2, Math.min(98, ((declared - minVal) / totalSpan) * 100));

  const isConsistent = declared >= rangeLow && declared <= rangeHigh;
  const isOverDeclared = declared > rangeHigh;

  return (
    <div className="w-full select-none">
      {showLabels && (
        <div className="flex items-center justify-between text-xs font-mono text-[var(--ink-soft)] mb-1.5">
          <span>{minVal.toFixed(0)} {unit}</span>
          <span className="text-[var(--ink-2)] font-medium">
            Physical Range: {rangeLow.toFixed(1)} – {rangeHigh.toFixed(1)} {unit}
          </span>
          <span>{maxVal.toFixed(0)} {unit}</span>
        </div>
      )}

      {/* Bar container */}
      <div className="relative h-6 bg-[var(--well)] rounded border border-[var(--hairline)] overflow-visible my-3">
        {/* Background track ticks */}
        <div className="absolute inset-0 flex justify-between px-2 items-center pointer-events-none opacity-40">
          <div className="w-px h-2 bg-[var(--hairline-strong)]" />
          <div className="w-px h-2 bg-[var(--hairline-strong)]" />
          <div className="w-px h-2 bg-[var(--hairline-strong)]" />
          <div className="w-px h-2 bg-[var(--hairline-strong)]" />
          <div className="w-px h-2 bg-[var(--hairline-strong)]" />
        </div>

        {/* Estimated Range Span */}
        <div
          className={`absolute top-0 bottom-0 rounded-sm border ${
            isConsistent
              ? 'bg-[var(--success-bg)] border-[var(--success-line)]'
              : 'bg-[var(--gold-wash)] border-[var(--gold-line)]'
          }`}
          style={{
            left: `${leftPercent}%`,
            width: `${widthPercent}%`,
          }}
        />

        {/* Declared Value Marker Pin */}
        <div
          className="absolute -top-2.5 -bottom-2.5 w-1 z-10 flex flex-col items-center pointer-events-none transition-all duration-300"
          style={{ left: `${declaredPercent}%` }}
        >
          {/* Top pin head */}
          <div
            className={`w-3.5 h-3.5 rotate-45 rounded-xs shadow-md border-2 border-white ${
              isConsistent
                ? 'bg-[var(--moss-solid)]'
                : isOverDeclared
                ? 'bg-[var(--danger)] ring-2 ring-[var(--danger-line)]'
                : 'bg-[var(--gold)]'
            }`}
          />
          {/* Vertical line through bar */}
          <div
            className={`w-0.5 flex-1 ${
              isConsistent ? 'bg-[var(--moss-solid)]' : isOverDeclared ? 'bg-[var(--danger)]' : 'bg-[var(--gold)]'
            }`}
          />
        </div>
      </div>

      {/* Legend / comparison callout */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-3 h-2 rounded-xs bg-[var(--gold-wash)] border border-[var(--gold-line)] inline-block" />
          <span className="text-[var(--ink-soft)] font-mono">Estimated Bound ({rangeLow.toFixed(1)}–{rangeHigh.toFixed(1)} {unit})</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rotate-45 inline-block ${
              isConsistent ? 'bg-[var(--moss-solid)]' : isOverDeclared ? 'bg-[var(--danger)]' : 'bg-[var(--gold)]'
            }`}
          />
          <span className="font-mono text-[var(--ink-2)]">
            Declared Receipt: <strong className={isConsistent ? 'text-[var(--success-ink)]' : isOverDeclared ? 'text-[var(--danger-ink)]' : 'text-[var(--gold)]'}>{declared.toFixed(1)} {unit}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
