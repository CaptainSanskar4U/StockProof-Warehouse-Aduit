import React from 'react';
import { ShieldCheck, HelpCircle, FileSpreadsheet, UserRound } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle.js';
import type { Theme } from '../hooks/useTheme.js';

export type HeaderView = 'overview' | 'dashboard' | 'reviews' | 'reports' | 'profile';

interface HeaderProps {
  openReviewCount: number;
  currentView: HeaderView;
  onNavigate: (view: HeaderView) => void;
  onOpenPhysics: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  openReviewCount,
  currentView,
  onNavigate,
  onOpenPhysics,
  theme,
  onToggleTheme,
}) => {
  const tabClass = (active: boolean) =>
    `px-3 py-2 rounded-full text-[12px] font-mono tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
      active
        ? 'bg-[var(--ink)] text-[var(--ink-inverse)] font-bold'
        : 'text-[var(--ink-soft)] hover:text-[var(--ink-2)]'
    }`;

  return (
    <header className="bg-[var(--sheet-translucent)] backdrop-blur border-b border-[var(--hairline)] sticky top-0 z-40">
      {/* Top Banner: The Golden Rule mandated in Section 2 */}
      <div className="bg-[var(--gold-tint-bg)] border-b border-[var(--gold-line)] px-4 py-1.5 flex items-center justify-between text-[11px] font-mono">
        <div className="flex items-center gap-2 text-[var(--ink-soft)] truncate">
          <ShieldCheck className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />
          <span className="text-[var(--ink-2)] font-medium">
            GOLDEN RULE:
          </span>
          <span className="truncate">
            The system supports the auditor — it does not replace the physical audit.
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenPhysics}
            className="text-[var(--gold)] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle className="w-3 h-3" />
            <span className="hidden sm:inline">Defensible Formula</span>
          </button>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        {/* Brand identity */}
        <div className="flex items-center gap-4">
          <div
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-11 h-11 rounded-full bg-[var(--ink)] text-[var(--ink-inverse)] flex items-center justify-center font-instrument-serif italic text-2xl shadow-md">
              S
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-2xl font-instrument-serif tracking-tight text-[var(--ink-2)] group-hover:text-[var(--gold)] transition-colors">
                  Inspector Panel
                </span>
                <span className="text-[10px] font-mono tracking-widest px-2 py-0.5 rounded-full bg-[var(--wash)] text-[var(--gold)] border border-[var(--gold-line)] uppercase">
                  VERIFY v2.4
                </span>
              </div>
              <p className="text-[11px] font-mono text-[var(--ink-soft)] mt-0.5">
                StockProof Inspector Panel · Grain Stock Verification
              </p>
            </div>
          </div>

          {/* Navigation tabs */}
          <nav className="hidden lg:flex items-center gap-1 ml-4 pl-4 border-l border-[var(--hairline)]">
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
              INSPECTOR PANEL
            </button>
            <button
              onClick={() => onNavigate('reviews')}
              className={`${tabClass(currentView === 'reviews')} flex items-center gap-1.5`}
            >
              <span>BANK CHECKS</span>
              {openReviewCount > 0 && (
                <span className="bg-[var(--danger)] text-[var(--ink-inverse)] text-[10px] font-bold px-1.5 py-0.2 rounded-full">
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
            <button
              onClick={() => onNavigate('profile')}
              className={`${tabClass(currentView === 'profile')} flex items-center gap-1.5`}
            >
              <UserRound className="w-3.5 h-3.5" />
              <span>PROFILE</span>
            </button>
          </nav>
        </div>

        {/* Theme control */}
        <div className="flex items-center ml-auto">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="safe-bottom flex lg:hidden overflow-x-auto border-t border-[var(--hairline)] bg-[var(--sheet)] px-2 pt-1.5 justify-start sm:justify-around text-[11px] font-mono">
        <button
          onClick={() => onNavigate('overview')}
          className={`touch-target shrink-0 py-2 px-3 ${currentView === 'overview' ? 'text-[var(--gold)] font-bold' : 'text-[var(--ink-soft)]'}`}
        >
          OVERVIEW
        </button>
        <button
          onClick={() => onNavigate('dashboard')}
          className={`touch-target shrink-0 py-2 px-3 ${currentView === 'dashboard' ? 'text-[var(--gold)] font-bold' : 'text-[var(--ink-soft)]'}`}
        >
          PANEL
        </button>
        <button
          onClick={() => onNavigate('reviews')}
          className={`touch-target shrink-0 py-2 px-3 flex items-center gap-1 ${currentView === 'reviews' ? 'text-[var(--gold)] font-bold' : 'text-[var(--ink-soft)]'}`}
        >
          <span>BANK CHECKS</span>
          {openReviewCount > 0 && (
            <span className="bg-[var(--danger)] text-[var(--ink-inverse)] text-[9px] px-1 rounded-full">
              {openReviewCount}
            </span>
          )}
        </button>
        <button
          onClick={() => onNavigate('reports')}
          className={`touch-target shrink-0 py-2 px-3 ${currentView === 'reports' ? 'text-[var(--gold)] font-bold' : 'text-[var(--ink-soft)]'}`}
        >
          REPORT
        </button>
        <button
          onClick={() => onNavigate('profile')}
          className={`touch-target shrink-0 py-2 px-3 ${currentView === 'profile' ? 'text-[var(--gold)] font-bold' : 'text-[var(--ink-soft)]'}`}
        >
          PROFILE
        </button>
      </div>
    </header>
  );
};
