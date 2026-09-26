import React, { useState } from 'react';
import { Camera, ClipboardList, User } from 'lucide-react';
import { FarmerAudit } from './FarmerAudit.js';
import { FarmerRecords } from './FarmerRecords.js';
import { FarmerProfile } from './FarmerProfile.js';
import { loadProfile } from './farmerStore.js';

export type FarmerTab = 'audit' | 'records' | 'profile';

interface FarmerShellProps {
  initialTab?: FarmerTab;
  greeting?: string | null;
  onGreetingShown?: () => void;
  onExitToLanding: () => void;
  onLogout: () => void;
}

/**
 * Farmer-only shell. Three tabs, nothing else: Audit/Camera (default),
 * Records, Profile. Does not reuse Inspector chrome — Inspector untouched.
 */
export const FarmerShell: React.FC<FarmerShellProps> = ({
  initialTab = 'audit',
  greeting = null,
  onGreetingShown,
  onExitToLanding,
  onLogout,
}) => {
  const [tab, setTab] = useState<FarmerTab>(initialTab);
  const [profile, setProfile] = useState(() => loadProfile());
  const [hello, setHello] = useState(true);

  const showGreeting = hello && greeting;
  const dismissGreeting = () => {
    setHello(false);
    onGreetingShown?.();
  };

  const tabs: { id: FarmerTab; label: string; Icon: typeof Camera }[] = [
    { id: 'audit', label: 'Audit / Camera', Icon: Camera },
    { id: 'records', label: 'Records', Icon: ClipboardList },
    { id: 'profile', label: 'Profile', Icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#FAF8F3] text-[#2B2016] flex flex-col font-sans">
      {/* Farmer header */}
      <header className="bg-white/95 backdrop-blur border-b border-[#3D3226]/10 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {profile.photoDataUrl ? (
              <img
                src={profile.photoDataUrl}
                alt="Farmer"
                className="w-9 h-9 rounded-full object-cover border border-[#3D3226]/15 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#2B2016] text-white flex items-center justify-center text-xl shrink-0">
                🌾
              </div>
            )}
            <div>
              <p className="text-base font-instrument-serif text-[#3D3226] leading-tight">My StockProof</p>
              <p className="text-[11px] font-mono text-[#2B2016]/55 leading-tight">
                {profile.name ? profile.name : 'Check your grain stock'}
              </p>
            </div>
          </div>
          <button
            onClick={onExitToLanding}
            className="text-xs font-mono text-[#2B2016]/55 hover:text-[#3D3226] cursor-pointer shrink-0"
          >
            ← Home
          </button>
        </div>
        <nav className="max-w-2xl mx-auto px-4 sm:px-6 pb-3 flex items-center gap-2">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`touch-target flex-1 px-3 py-2.5 rounded-full text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                tab === id
                  ? 'bg-[#2B2016] text-white font-bold shadow-xs'
                  : 'text-[#2B2016]/60 hover:text-[#3D3226] bg-[#F5F0E8] border border-[#3D3226]/10'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </header>

      {showGreeting && (
        <div className="max-w-2xl w-full mx-auto px-4 sm:px-6 pt-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-[#2A2118] flex items-start justify-between gap-3">
            <span>{greeting}</span>
            <button onClick={dismissGreeting} className="text-[#2B2016]/55 hover:text-[#3D3226] cursor-pointer shrink-0" aria-label="Dismiss">
              ✕
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {tab === 'audit' && <FarmerAudit onSaved={() => setTab('records')} />}
        {tab === 'records' && <FarmerRecords onGoAudit={() => setTab('audit')} />}
        {tab === 'profile' && (
          <FarmerProfile
            onSaved={() => setProfile(loadProfile())}
            onLogout={onLogout}
          />
        )}
      </main>
    </div>
  );
};
