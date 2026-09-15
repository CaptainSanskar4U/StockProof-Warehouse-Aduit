import React from 'react';
import { UserRole, UserProfile } from '../types.js';
import { ShieldCheck, UserCheck, AlertOctagon, HelpCircle, RotateCcw, FileSpreadsheet } from 'lucide-react';

interface HeaderProps {
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  openReviewCount: number;
  currentView: 'overview' | 'dashboard' | 'reviews' | 'reports';
  onNavigate: (view: 'overview' | 'dashboard' | 'reviews' | 'reports') => void;
  onOpenPhysics: () => void;
  onResetDemo: () => void;
}

export const USERS: Record<UserRole, UserProfile> = {
  auditor: {
    id: 'aud-01',
    name: 'Priya Sharma',
    role: 'auditor',
    designation: 'Senior Commodity Field Inspector',
    organization: 'Apex Agri Audit Services',
    badge: 'FIELD AUDITOR',
  },
  risk_officer: {
    id: 'ro-101',
    name: 'Arjun Mehta',
    role: 'risk_officer',
    designation: 'VP Agricultural Credit & Fraud Risk',
    organization: 'National Rural Lending Consortium',
    badge: 'RISK OFFICER',
  },
};

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onSelectRole,
  openReviewCount,
  currentView,
  onNavigate,
  onOpenPhysics,
  onResetDemo,
}) => {
  const activeUser = USERS[currentRole];

  const tabClass = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-mono tracking-wider transition-colors cursor-pointer ${
      active
        ? 'bg-[#2B2016] text-white'
        : 'text-[#2B2016]/55 hover:text-[#3D3226]'
    }`;

  return (
    <header className="bg-white/95 backdrop-blur border-b border-[#3D3226]/10 sticky top-0 z-40">
      {/* Top Banner: The Golden Rule mandated in Section 2 */}
      <div className="bg-[#FAF5EB] border-b border-[#B98A2E]/25 px-4 py-1.5 flex items-center justify-between text-[11px] font-mono">
        <div className="flex items-center gap-2 text-[#2B2016]/60 truncate">
          <ShieldCheck className="w-3.5 h-3.5 text-[#B98A2E] shrink-0" />
          <span className="text-[#3D3226] font-medium">
            GOLDEN RULE:
          </span>
          <span className="truncate">
            The system supports the auditor — it does not replace the physical audit.
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenPhysics}
            className="text-[#B98A2E] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle className="w-3 h-3" />
            <span className="hidden sm:inline">Defensible Formula</span>
          </button>
          <span className="text-[#3D3226]/15">|</span>
          <button
            onClick={onResetDemo}
            className="text-[#2B2016]/55 hover:text-[#3D3226] flex items-center gap-1 cursor-pointer"
            title="Reset database to demo seed data"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Reset Demo</span>
          </button>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-full bg-[#2B2016] text-white flex items-center justify-center font-instrument-serif italic text-xl shadow-md">
              S
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-instrument-serif tracking-tight text-[#3D3226] group-hover:text-[#B98A2E] transition-colors">
                  Stockproof
                </span>
                <span className="text-[10px] font-mono tracking-widest px-1.5 py-0.5 rounded-full bg-[#3D3226]/5 text-[#B98A2E] border border-[#B98A2E]/30 uppercase">
                  VERIFY v2.4
                </span>
              </div>
              <p className="text-[10px] font-mono text-[#2B2016]/50 -mt-0.5">
                Grain Stock Verification & Risk Engine
              </p>
            </div>
          </div>

          {/* Navigation tabs */}
          <nav className="hidden md:flex items-center gap-1 ml-6 pl-6 border-l border-[#3D3226]/10">
            <button
              onClick={() => onNavigate('overview')}
              className={tabClass(currentView === 'overview')}
            >
              OVERVIEW
            </button>
            <button
              onClick={() => onNavigate('dashboard')}
              className={tabClass(currentView === 'dashboard')}
            >
              WAREHOUSES
            </button>
            <button
              onClick={() => onNavigate('reviews')}
              className={`${tabClass(currentView === 'reviews')} flex items-center gap-1.5`}
            >
              <span>REVIEW QUEUE</span>
              {openReviewCount > 0 && (
                <span className="bg-[#B5574F] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {openReviewCount}
                </span>
              )}
            </button>
            <button
              onClick={() => onNavigate('reports')}
              className={`${tabClass(currentView === 'reports')} flex items-center gap-1.5`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>AUDIT REPORT</span>
            </button>
          </nav>
        </div>

        {/* Role Switcher */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Active persona pill */}
          <div className="hidden lg:flex flex-col items-end text-right">
            <span className="text-xs font-medium text-[#3D3226]">{activeUser.name}</span>
            <span className="text-[10px] font-mono text-[#2B2016]/50">{activeUser.designation}</span>
          </div>

          {/* Role selector segmented control */}
          <div className="bg-[#F5F0E8] border border-[#3D3226]/10 rounded-full p-1 flex items-center gap-1 text-xs font-mono">
            <button
              onClick={() => onSelectRole('auditor')}
              className={`px-2.5 py-1 rounded-full transition-colors flex items-center gap-1.5 ${
                currentRole === 'auditor'
                  ? 'bg-[#2B2016] text-white font-bold shadow-xs'
                  : 'text-[#2B2016]/55 hover:text-[#3D3226]'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>FIELD AUDITOR</span>
            </button>
            <button
              onClick={() => onSelectRole('risk_officer')}
              className={`px-2.5 py-1 rounded-full transition-colors flex items-center gap-1.5 ${
                currentRole === 'risk_officer'
                  ? 'bg-[#2B2016] text-white font-bold shadow-xs'
                  : 'text-[#2B2016]/55 hover:text-[#3D3226]'
              }`}
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>RISK OFFICER</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="safe-bottom flex md:hidden border-t border-[#3D3226]/10 bg-white px-2 pt-1.5 justify-around text-xs font-mono">
        <button
          onClick={() => onNavigate('overview')}
          className={`touch-target py-2 px-3 ${currentView === 'overview' ? 'text-[#B98A2E] font-bold' : 'text-[#2B2016]/55'}`}
        >
          OVERVIEW
        </button>
        <button
          onClick={() => onNavigate('dashboard')}
          className={`touch-target py-2 px-3 ${currentView === 'dashboard' ? 'text-[#B98A2E] font-bold' : 'text-[#2B2016]/55'}`}
        >
          WAREHOUSES
        </button>
        <button
          onClick={() => onNavigate('reviews')}
          className={`touch-target py-2 px-3 flex items-center gap-1 ${currentView === 'reviews' ? 'text-[#B98A2E] font-bold' : 'text-[#2B2016]/55'}`}
        >
          <span>REVIEWS</span>
          {openReviewCount > 0 && (
            <span className="bg-[#B5574F] text-white text-[9px] px-1 rounded-full">
              {openReviewCount}
            </span>
          )}
        </button>
        <button
          onClick={() => onNavigate('reports')}
          className={`touch-target py-2 px-3 ${currentView === 'reports' ? 'text-[#B98A2E] font-bold' : 'text-[#2B2016]/55'}`}
        >
          REPORT
        </button>
      </div>
    </header>
  );
};
