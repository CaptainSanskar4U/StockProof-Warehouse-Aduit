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
          ? 'bg-amber-50 text-[#5A3E0A] border-[#B98A2E]/40'
          : 'bg-white text-[#2B2016]/60 border-[#3D3226]/10'
      }`}
    >
      <div className="flex items-center gap-2">
        {isSimulatedOffline ? (
          <>
            <WifiOff className="w-3.5 h-3.5 text-[#B98A2E]" />
            <span className="font-medium text-[#3D3226]">
              Field mode: poor signal
            </span>
            <span className="hidden sm:inline text-[#2B2016]/55">
              — records are kept on this device and sync when connected
            </span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <Wifi className="w-3.5 h-3.5 text-emerald-600" />
            <span>Central registry: online</span>
          </>
        )}

        {pendingSyncCount > 0 && (
          <span className="bg-white border border-[#B98A2E]/50 text-[#7A5A1A] px-1.5 py-0.5 rounded-full text-[10px]">
            {pendingSyncCount} cached run{pendingSyncCount > 1 ? 's' : ''} awaiting sync
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSimulatedOffline}
          type="button"
          className="hover:underline underline-offset-2 flex items-center gap-1.5 text-[11px] text-[#2B2016]/55 hover:text-[#2B2016]"
          title="Toggle realistic remote warehouse connectivity simulation"
        >
          <RefreshCw className="w-3 h-3" />
          <span>{isSimulatedOffline ? 'Restore connection' : 'Simulate poor signal'}</span>
        </button>
      </div>
    </div>
  );
};
