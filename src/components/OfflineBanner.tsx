import React from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface OfflineBannerProps {
  isSimulatedOffline: boolean;
  onToggleSimulatedOffline: () => void;
  pendingSyncCount?: number;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  isSimulatedOffline,
  onToggleSimulatedOffline,
  pendingSyncCount = 0,
}) => {
  return (
    <div
      className={`w-full text-xs font-mono border-b transition-colors px-4 py-2 flex flex-wrap items-center justify-between gap-3 ${
        isSimulatedOffline
          ? 'bg-[var(--warn-bg)] text-[var(--gold-ink-deep)] border-[var(--gold-line)]'
          : 'bg-[var(--sheet)] text-[var(--ink-soft)] border-[var(--hairline)]'
      }`}
    >
      <div className="flex items-center gap-2">
        {isSimulatedOffline ? (
          <>
            <WifiOff className="w-3.5 h-3.5 text-[var(--gold)]" />
            <span className="font-medium text-[var(--ink-2)]">
              Field mode: poor signal
            </span>
            <span className="hidden sm:inline text-[var(--ink-soft)]">
              — records are kept on this device and sync when connected
            </span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-[var(--moss-solid)]" />
            <Wifi className="w-3.5 h-3.5 text-[var(--success-ink)]" />
            <span>Central registry: online</span>
          </>
        )}

        {pendingSyncCount > 0 && (
          <span className="bg-[var(--sheet)] border border-[var(--gold-line)] text-[var(--gold-ink)] px-1.5 py-0.5 rounded-full text-[10px]">
            {pendingSyncCount} cached run{pendingSyncCount > 1 ? 's' : ''} awaiting sync
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSimulatedOffline}
          type="button"
          className="hover:underline underline-offset-2 flex items-center gap-1.5 text-[11px] text-[var(--ink-soft)] hover:text-[var(--ink)]"
          title="Toggle realistic remote warehouse connectivity simulation"
        >
          <RefreshCw className="w-3 h-3" />
          <span>{isSimulatedOffline ? 'Restore connection' : 'Simulate poor signal'}</span>
        </button>
      </div>
    </div>
  );
};
