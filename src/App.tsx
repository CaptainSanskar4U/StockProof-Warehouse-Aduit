/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LandingPageView } from './components/LandingPageView.js';
import { LoginModal } from './components/LoginModal.js';
import { PhysicsModal } from './components/PhysicsModal.js';
import { FarmerPanel } from './panels/FarmerPanel.js';
import { InspectorPanel } from './panels/InspectorPanel.js';
import { VerifyCheck } from './farmer/VerifyCheck.js';
import type { PanelKind } from './panels/ConsoleShell.js';

type LandingAction = null | 'specimen' | 'reviews' | 'reports';

function getStoredRole(): PanelKind | null {
  try {
    const raw = localStorage.getItem('stockproof_auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { role?: unknown };
    return parsed.role === 'farmer' || parsed.role === 'inspector' ? parsed.role : null;
  } catch {
    return null;
  }
}

/**
 * App — thin router: landing page, locked login popup, then the role panel.
 * Login → Farmer → Farmer Panel. Login → Inspector → Inspector Panel.
 * All console UI lives in panels/ConsoleShell (shared by both panels).
 */
export default function App() {
  const [enteredConsole, setEnteredConsole] = useState<boolean>(false);
  const [isLoginOpen, setIsLoginOpen] = useState<boolean>(false);
  const [authedRole, setAuthedRole] = useState<PanelKind | null>(null);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [landingAction, setLandingAction] = useState<LandingAction>(null);
  const [isPhysicsModalOpen, setIsPhysicsModalOpen] = useState<boolean>(false);
  // Public QR verification link — anonymous by design, bypasses login.
  const [verifyId] = useState<string | null>(() => {
    try {
      return new URLSearchParams(window.location.search).get('verify')?.trim() || null;
    } catch {
      return null;
    }
  });

  // Remember the stored role across reloads (stay on landing until entry).
  useEffect(() => {
    setAuthedRole(getStoredRole());
  }, []);

  // Landing → enter console first, then lock with login immediately if needed.
  const handleEnterConsole = useCallback((action: LandingAction = null) => {
    setLandingAction(action);
    setEnteredConsole(true);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
    if (!getStoredRole()) {
      setIsLoginOpen(true);
    }
  }, []);

  const handleLoginSuccess = useCallback((profile: { role: 'farmer' | 'inspector'; email: string }) => {
    setIsLoginOpen(false);
    setAuthedRole(profile.role);
    // Panel is already loaded behind the popup — just unlock it.
    setGreeting(`Welcome${profile.email ? ` ${profile.email}` : ''} — signed in as ${profile.role}.`);
  }, []);

  const handleLoginClose = useCallback(() => {
    // Locked mode: no peeking at the panel. Send back to landing.
    if (!getStoredRole()) {
      setIsLoginOpen(false);
      setEnteredConsole(false);
      setLandingAction(null);
      return;
    }
    setIsLoginOpen(false);
  }, []);

  const handleExitToLanding = useCallback(() => {
    setEnteredConsole(false);
    setLandingAction(null);
    setGreeting(null);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  }, []);

  // Proper logout: clear the demo session and return to the landing page.
  const handleLogout = useCallback(() => {
    try {
      localStorage.removeItem('stockproof_auth');
    } catch {
      /* ignore */
    }
    setAuthedRole(null);
    setIsLoginOpen(false);
    setEnteredConsole(false);
    setLandingAction(null);
    setGreeting(null);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  }, []);

  // While the login popup is up without a known role, show the inspector
  // shell blurred behind it — it is fully locked and invisible anyway.
  const visibleRole: PanelKind = authedRole ?? 'inspector';
  const isConsoleLocked = isLoginOpen && enteredConsole;

  if (verifyId) {
    return <VerifyCheck id={verifyId} />;
  }

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {!enteredConsole ? (
        <div className="min-h-screen bg-white text-[#2B2016] flex flex-col font-sans">
          <main className="flex-1 w-full">
            <LandingPageView
              onEnterConsole={() => handleEnterConsole(null)}
              onStartSampleVerification={() => handleEnterConsole('specimen')}
              onOpenPhysics={() => setIsPhysicsModalOpen(true)}
              onOpenReviews={() => handleEnterConsole('reviews')}
              onOpenReports={() => handleEnterConsole('reports')}
            />
          </main>
        </div>
      ) : (
        <div
          className={isConsoleLocked ? 'blur-md pointer-events-none select-none' : ''}
          aria-hidden={isConsoleLocked || undefined}
        >
          {visibleRole === 'farmer' ? (
            <FarmerPanel
              initialView={landingAction === 'reviews' ? 'reviews' : 'dashboard'}
              autoOpenReports={landingAction === 'reports'}
              autoStartSpecimen={landingAction === 'specimen'}
              greeting={greeting}
              onGreetingShown={() => setGreeting(null)}
              onExitToLanding={handleExitToLanding}
              onLogout={handleLogout}
            />
          ) : (
            <InspectorPanel
              initialView={landingAction === 'reviews' ? 'reviews' : 'dashboard'}
              autoOpenReports={landingAction === 'reports'}
              autoStartSpecimen={landingAction === 'specimen'}
              greeting={greeting}
              onGreetingShown={() => setGreeting(null)}
              onExitToLanding={handleExitToLanding}
            />
          )}
        </div>
      )}

      {/* Landing "See how it works" — console shell is not mounted on landing. */}
      <PhysicsModal
        isOpen={isPhysicsModalOpen}
        onClose={() => setIsPhysicsModalOpen(false)}
      />

      {/* Login popup on top of the panel — locked, exact Login.html design */}
      <LoginModal
        isOpen={isLoginOpen}
        dismissable={false}
        onClose={handleLoginClose}
        onSuccess={handleLoginSuccess}
      />
    </div>
  );
}
