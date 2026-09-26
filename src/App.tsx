/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Warehouse,
  Verification,
  ReviewItem,
  PortfolioSummary
} from './types.js';
import {
  fetchWarehouses,
  fetchReviews,
  fetchPortfolioSummary,
  fetchInspectorProfile
} from './services/api.js';
import { InspectorProfile } from './types.js';
import { Header, HeaderView } from './components/Header.js';
import { VerificationModal } from './components/VerificationModal.js';
import { ReportPrintView } from './components/ReportPrintView.js';
import { useTheme } from './hooks/useTheme.js';
import { OfflineBanner } from './components/OfflineBanner.js';
import { DashboardView } from './components/DashboardView.js';
import { ProfileTab } from './components/ProfileTab.js';
import { WarehouseDetailModal } from './components/WarehouseDetailModal.js';
import { VerificationFlow } from './components/VerificationFlow.js';
import { AuditRecordsTab } from './components/AuditRecordsTab.js';
import { RecordDetailModal } from './components/RecordDetailModal.js';
import { ReportExportModal } from './components/ReportExportModal.js';
import { PhysicsModal } from './components/PhysicsModal.js';
import { LandingPageView } from './components/LandingPageView.js';
import { LoginModal, LoginRole } from './components/LoginModal.js';
import { FarmerPanel } from './panels/FarmerPanel.js';
import { CheckCircle2, AlertOctagon, Info } from 'lucide-react';

const AUTH_KEY = 'stockproof_auth';

export default function App() {
  // Navigation state (single inspector identity comes from the saved Profile)
  const [currentView, setCurrentView] = useState<HeaderView>('overview');

  // --- Role gate ---------------------------------------------------------
  // Two panels behind one login. The role is remembered, but clicking
  // "Console" always asks again — the first click of a demo must never
  // silently drop someone into the wrong panel.
  const [role, setRole] = useState<LoginRole | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isConsoleLocked, setIsConsoleLocked] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<{
    view: HeaderView;
    openReport?: boolean;
    startSpecimen?: boolean;
  } | null>(null);
  const [greeting, setGreeting] = useState<string | null>(null);

  // Data state
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [inspectorProfile, setInspectorProfile] = useState<InspectorProfile | null>(null);
  const { theme, toggleTheme } = useTheme();

  // Modals & Active Flows
  const [selectedWarehouseForDetail, setSelectedWarehouseForDetail] = useState<Warehouse | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<Verification | null>(null);
  const [activeVerificationWarehouse, setActiveVerificationWarehouse] = useState<Warehouse | null>(null);
  const [isPhysicsModalOpen, setIsPhysicsModalOpen] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

  // Offline simulation state
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  // Notification toast
  const [notification, setNotification] = useState<{
    id: string;
    type: 'success' | 'urgent' | 'info';
    message: string;
  } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'urgent' | 'info' = 'info') => {
    const id = Date.now().toString();
    setNotification({ id, type, message });
    setTimeout(() => {
      setNotification((curr) => (curr?.id === id ? null : curr));
    }, 4500);
  }, []);

  // Primary data loader
  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [whs, revs, sum] = await Promise.all([
        fetchWarehouses(),
        fetchReviews(),
        fetchPortfolioSummary(),
      ]);
      setWarehouses(whs);
      setReviews(revs);
      setSummary(sum);
    } catch (err: any) {
      console.error('Failed to load STOCKPROOF data:', err);
      showToast('Could not sync with central registry. Operating in offline mode.', 'urgent');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAllData();
    fetchInspectorProfile().then(setInspectorProfile).catch(() => setInspectorProfile(null));
  }, [loadAllData]);

  // Saved profile reused as the auditor identity on new audits and reports.
  // No role switcher: without a saved profile, audits sign generically.
  const baseAuditor = { id: 'inspector', name: 'Field Inspector', role: 'field_inspector' };
  const profileName = inspectorProfile?.displayName
    || (inspectorProfile?.inspectorType === 'government' ? inspectorProfile?.gov?.inspectorName : inspectorProfile?.bank?.employeeName)
    || '';
  const profileId = inspectorProfile?.inspectorType === 'government' ? inspectorProfile?.gov?.govId : inspectorProfile?.bank?.employeeId;
  const currentAuditor = profileName
    ? { ...baseAuditor, name: profileName, role: profileId ? `field_inspector · ${profileId}` : baseAuditor.role }
    : baseAuditor;

  // Handle verification completion
  const handleVerificationCompleted = async (verification: Verification) => {
    setActiveVerificationWarehouse(null);

    if (isSimulatedOffline) {
      setPendingSyncCount((prev) => prev + 1);
      showToast(
        `Verification for ${verification.declaredAtTimeOfRun} T recorded to field cache. Will upload to central database when connected.`,
        'info'
      );
    } else {
      showToast(
        `Verification recorded: ${verification.status === 'consistent' ? 'Consistent' : 'Flagged for Review'}.`,
        verification.status === 'high_priority' ? 'urgent' : 'success'
      );
    }

    // Refresh data
    await loadAllData();
  };

  // Handle offline toggle
  const handleToggleOffline = () => {
    setIsSimulatedOffline((prev) => {
      const nextState = !prev;
      if (!nextState && pendingSyncCount > 0) {
        showToast(`Syncing ${pendingSyncCount} cached verification records to central registry...`, 'success');
        setPendingSyncCount(0);
        loadAllData();
      }
      return nextState;
    });
  };

  const openReviewCount = reviews.filter((r) => r.status === 'open').length;
  const isLanding = !activeVerificationWarehouse && currentView === 'overview' && role !== 'farmer';

  // --- Role handlers -----------------------------------------------------
  // Landing CTA -> navigate to the console FIRST, then lock it and ask who
  // they are. The console is what sits blurred behind the modal; the landing
  // page is never the backdrop. Both state updates land in one batch, so the
  // very first paint already shows the console blurred and inert.
  const handleEnterConsole = useCallback((
    view: HeaderView = 'dashboard',
    opts: { openReport?: boolean; startSpecimen?: boolean } = {},
  ) => {
    setPendingIntent({ view, ...opts });
    // 'reports' is a Header action, not a render branch — normalise it here
    // and let the login handler open the report modal instead.
    setCurrentView(view === 'reports' ? 'dashboard' : view);
    setIsLoginOpen(true);
    setIsConsoleLocked(true);
  }, []);

  const handleLoginSuccess = useCallback((profile: { role: LoginRole; email: string }) => {
    setRole(profile.role);
    setIsLoginOpen(false);
    setIsConsoleLocked(false);
    setGreeting(`Welcome${profile.email ? ` ${profile.email}` : ''} — signed in as ${profile.role}.`);
    const intent = pendingIntent;
    setPendingIntent(null);
    if (profile.role === 'farmer') return; // the farmer panel owns its own nav
    if (intent?.openReport) {
      setIsReportModalOpen(true);
      return;
    }
    if (intent?.startSpecimen) {
      const specimenWh = warehouses.find((w) => w.id === 'wh-001') || warehouses[0];
      if (specimenWh) {
        setActiveVerificationWarehouse(specimenWh);
        return;
      }
    }
    setCurrentView(intent?.view ?? 'dashboard');
  }, [pendingIntent, warehouses]);

  // Locked mode: no peeking at the panel. Backing out returns to the landing.
  const handleLoginClose = useCallback(() => {
    setIsLoginOpen(false);
    setIsConsoleLocked(false);
    setPendingIntent(null);
    if (!role) {
      setCurrentView('overview');
      setActiveVerificationWarehouse(null);
      setSelectedRecord(null);
    }
  }, [role]);

  // Always available: a returning visitor can change panel without clearing
  // localStorage by hand.
  const handleSwitchRole = useCallback(() => {
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch {
      /* ignore */
    }
    setRole(null);
    setIsLoginOpen(false);
    setIsConsoleLocked(false);
    setPendingIntent(null);
    setCurrentView('overview');
    setActiveVerificationWarehouse(null);
    setSelectedRecord(null);
    setSelectedWarehouseForDetail(null);
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  }, []);

  // Public verify links (?verify=<gc-id>) open a popup OVER the existing app —
  // anonymous, no login, and no separate verification page.
  const [verifyId, setVerifyId] = useState<string | null>(() => {
    try {
      return new URLSearchParams(window.location.search).get('verify');
    } catch {
      return null;
    }
  });

  // Scanning a QR should land on the working panel, never the marketing landing.
  useEffect(() => {
    if (verifyId) setCurrentView('dashboard');
  }, [verifyId]);

  const closeVerification = useCallback(() => {
    setVerifyId(null);
    // Drop the param so a refresh does not re-open the popup.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('verify');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    } catch {
      /* history is unavailable — the popup still closes */
    }
  }, []);

  // ?report=<verificationId> renders the printable official report and owns the
  // whole page. Unlike ?verify= (which must live inside the app as a popup), a
  // print document legitimately takes over the viewport.
  const [reportId, setReportId] = useState<string | null>(() => {
    try {
      return new URLSearchParams(window.location.search).get('report');
    } catch {
      return null;
    }
  });

  const closeReport = useCallback(() => {
    setReportId(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('report');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    } catch {
      /* ignore */
    }
  }, []);

  // Console-only theming: the marketing landing keeps its designed light look,
  // and so does the farmer panel — its washi cards are a light design.
  const prefersLight = isLanding || role === 'farmer';
  useEffect(() => {
    if (prefersLight) {
      document.body.classList.remove('dark-mode');
      document.body.classList.add('light-mode');
      document.body.dataset.forcedTheme = 'landing';
      document.documentElement.style.colorScheme = 'light';
    } else if (document.body.dataset.forcedTheme === 'landing') {
      delete document.body.dataset.forcedTheme;
      document.body.classList.remove('light-mode', 'dark-mode');
      document.body.classList.add(`${theme}-mode`);
      document.documentElement.style.colorScheme = theme;
    }
  }, [prefersLight, theme]);

  if (reportId) {
    return <ReportPrintView verificationId={reportId} onExit={closeReport} />;
  }

  // A locked console sits behind the login popup, blurred and inert.
  const lockClass = isConsoleLocked ? 'blur-md pointer-events-none select-none' : '';

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] flex flex-col font-sans">
      <div className={lockClass} aria-hidden={isConsoleLocked || undefined} inert={isConsoleLocked || undefined}>
      {role === 'farmer' ? (
        <FarmerPanel
          greeting={greeting}
          onGreetingShown={() => setGreeting(null)}
          onExitToLanding={handleSwitchRole}
          onLogout={handleSwitchRole}
        />
      ) : (
      <>
      {/* Top Header with Golden Rule, Role Switcher, and Nav — hidden on marketing landing */}
      {!isLanding && (
      <>
      <Header
        openReviewCount={openReviewCount}
        currentView={currentView}
        theme={theme}
        onToggleTheme={toggleTheme}
        onNavigate={(view) => {
          // Leave any open verification flow first — otherwise the flow
          // keeps rendering on top and the navbar looks dead.
          setActiveVerificationWarehouse(null);
          if (view === 'reports') {
            setIsReportModalOpen(true);
          } else {
            setCurrentView(view);
          }
          requestAnimationFrame(() => {
            window.scrollTo({ top: 0, behavior: 'auto' });
          });
        }}
        onOpenPhysics={() => setIsPhysicsModalOpen(true)}
      />

      {/* Realistic Field Connectivity / Offline Banner */}
      <OfflineBanner
        isSimulatedOffline={isSimulatedOffline}
        onToggleSimulatedOffline={handleToggleOffline}
        pendingSyncCount={pendingSyncCount}
      />
      </>
      )}

      {/* Main App Content Viewport */}
      <main className={activeVerificationWarehouse || currentView !== 'overview' ? 'flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto' : 'flex-1 w-full'}>
        {/* If an active verification flow is open, show the 4-step pipeline */}
        {activeVerificationWarehouse ? (
          <div className="py-2 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <VerificationFlow
              warehouse={activeVerificationWarehouse}
              onCancel={() => setActiveVerificationWarehouse(null)}
              onComplete={handleVerificationCompleted}
              currentAuditor={currentAuditor}
            />
          </div>
        ) : currentView === 'overview' ? (
          <LandingPageView
            onEnterConsole={() => handleEnterConsole('dashboard')}
            onStartSampleVerification={() => handleEnterConsole('dashboard', { startSpecimen: true })}
            onOpenPhysics={() => setIsPhysicsModalOpen(true)}
            onOpenReviews={() => handleEnterConsole('reviews')}
            onOpenReports={() => handleEnterConsole('dashboard', { openReport: true })}
          />
        ) : currentView === 'reviews' ? (
          <div className="max-w-5xl mx-auto">
            <AuditRecordsTab
              agentType="bank"
              onOpenRecord={(v) => setSelectedRecord(v)}
            />
          </div>
        ) : currentView === 'profile' ? (
          <div className="max-w-5xl mx-auto">
            <ProfileTab
              onProfileSaved={(p) => {
                setInspectorProfile(p);
                showToast('Profile saved and applied across the panel.', 'success');
              }}
            />
          </div>
        ) : (
          <DashboardView
            warehouses={warehouses}
            summary={summary}
            currentAuditor={currentAuditor}
            onSelectWarehouse={(warehouse) => setSelectedWarehouseForDetail(warehouse)}
            onStartVerification={(warehouse) => setActiveVerificationWarehouse(warehouse)}
            onOpenReport={() => setIsReportModalOpen(true)}
            onOpenReviewQueue={() => setCurrentView('reviews')}
            onNavigateToOverview={() => setCurrentView('overview')}
            onVerificationSaved={handleVerificationCompleted}
            isLoading={isLoading}
          />
        )}
      </main>
      </>
      )}

      {/* Warehouse Detail Modal */}
      <WarehouseDetailModal
        warehouse={selectedWarehouseForDetail}
        onClose={() => setSelectedWarehouseForDetail(null)}
        onStartVerification={(warehouse) => {
          setSelectedWarehouseForDetail(null);
          setActiveVerificationWarehouse(warehouse);
        }}
      />

      {/* Recorded reading detail */}
      {selectedRecord && (
        <RecordDetailModal
          record={selectedRecord}
          warehouse={warehouses.find((w) => w.id === selectedRecord.warehouseId)}
          onClose={() => setSelectedRecord(null)}
        />
      )}
      </div>

      {/* --- Root-level overlays: these must work for BOTH panels, and while the
          console is locked. A scanned QR opens the verification popup with no
          login and no role, which is the whole point of a public QR. --- */}

      {/* Public QR verification popup — opens over the app, never replaces it */}
      {verifyId && (
        <VerificationModal id={verifyId} onClose={closeVerification} />
      )}

      {/* Agronomic Physics & Defensible Formula Modal */}
      <PhysicsModal
        isOpen={isPhysicsModalOpen}
        onClose={() => setIsPhysicsModalOpen(false)}
      />

      {/* Printable / CSV Audit Ledger Report Modal */}
      <ReportExportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        warehouses={warehouses}
        summary={summary}
      />

      {/* Panel escape hatch — without this the Inspector panel is a dead end. */}
      {role && !isLanding && (
        <button
          type="button"
          onClick={handleSwitchRole}
          className="fixed bottom-4 right-4 z-40 px-3.5 py-2 rounded-full bg-[var(--sheet)] border border-[var(--hairline-strong)] text-[var(--ink-2)] text-[11px] font-mono shadow-[var(--sheet-shadow)] hover:border-[var(--gold)] transition-colors cursor-pointer"
        >
          {role === 'farmer' ? 'Switch to Inspector' : 'Switch to Farmer'}
        </button>
      )}

      {/* Login gate — first, and again on every explicit Console click. */}
      <LoginModal
        isOpen={isLoginOpen}
        dismissable={false}
        onClose={handleLoginClose}
        onSuccess={handleLoginSuccess}
      />

      {/* Floating Procedural Notification Toast */}
      {notification && (
        <div className="safe-bottom fixed bottom-5 left-4 right-4 sm:left-auto sm:right-5 sm:max-w-md z-50 animate-fade-in">
          <div
            className={`p-3.5 rounded-xl border text-xs font-mono shadow-[var(--sheet-shadow)] flex items-start gap-3 bg-[var(--sheet)] ${
              notification.type === 'urgent'
                ? 'border-l-4 border-l-[var(--danger)] border-[var(--hairline-strong)] text-[var(--ink-2)]'
                : notification.type === 'success'
                ? 'border-l-4 border-l-[var(--moss)] border-[var(--success-line)] text-[var(--ink-2)]'
                : 'border-l-4 border-l-[var(--gold)] border-[var(--gold-line)] text-[var(--ink-2)]'
            }`}
          >
            {notification.type === 'urgent' ? (
              <AlertOctagon className="w-4 h-4 shrink-0 text-[var(--danger)] mt-0.5" />
            ) : notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--success-ink)] mt-0.5" />
            ) : (
              <Info className="w-4 h-4 shrink-0 text-[var(--gold)] mt-0.5" />
            )}
            <div className="flex-1 leading-relaxed">
              {notification.message}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
