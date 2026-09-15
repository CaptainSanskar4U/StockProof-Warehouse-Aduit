import React from 'react';
import { ArrowUpRight, ArrowRight } from 'lucide-react';

interface Props {
  onEnterConsole: () => void;
  onOpenPhysics: () => void;
  onOpenReviews: () => void;
  onOpenReports: () => void;
}

export const LandingFooter: React.FC<Props> = ({
  onEnterConsole,
  onOpenPhysics,
  onOpenReviews,
  onOpenReports,
}) => {
  const linkCls = 'text-base text-[#2B2016] hover:opacity-70 transition-opacity cursor-pointer text-left';

  return (
    <footer className="w-full bg-white text-[#2B2016] px-6 pt-6 pb-28">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8 py-12 border-t border-[#2B2016]/10">
          <div>
            <button
              onClick={onEnterConsole}
              className="inline-flex items-center gap-2 bg-[#2B2016] text-white rounded-full px-7 py-3 text-sm font-medium hover:bg-[#3D3226] transition-colors cursor-pointer shadow-[0_1px_2px_0_rgba(43,32,22,0.1),0_4px_4px_0_rgba(43,32,22,0.09)]"
            >
              <span>Start a verification</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="mt-4 font-mono text-xs text-[#2B2016]/50 max-w-[240px] leading-relaxed">
              Commodity collateral verification for banks, NBFCs, and field auditors.
            </p>
          </div>

          <div className="flex items-start gap-10">
            <ArrowUpRight className="w-5 h-5 mt-1 text-[#2B2016]/40" />
            <div className="flex flex-col gap-3">
              <button className={linkCls} onClick={onEnterConsole}>Audits</button>
              <button className={linkCls} onClick={onOpenReviews}>Discrepancies</button>
              <button className={linkCls} onClick={onOpenPhysics}>Physics</button>
            </div>
            <div className="flex flex-col gap-3">
              <button className={linkCls} onClick={onOpenReports}>Reports</button>
              <button className={linkCls} onClick={onOpenPhysics}>Density tables</button>
              <button className={linkCls} onClick={onEnterConsole}>Console</button>
            </div>
          </div>
        </div>

        <div className="flex flex-row justify-between items-center px-0 py-4 border-t border-[#2B2016]/10 text-sm text-[#2B2016]">
          <span>Stockproof Verification Systems</span>
          <span className="font-mono text-xs text-[#2B2016]/60">Karnal, India</span>
        </div>
      </div>
    </footer>
  );
};
