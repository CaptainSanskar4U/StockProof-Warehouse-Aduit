/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Warehouse,
  Verification,
  ReviewItem,
  PortfolioSummary,
  UserRole
} from '../types.js';
import {
  fetchWarehouses,
  fetchReviews,
  fetchPortfolioSummary,
  updateReviewItem,
  resetDemoData
} from '../services/api.js';
import { Header, USERS } from '../components/Header.js';
import { OfflineBanner } from '../components/OfflineBanner.js';
import { DashboardView } from '../components/DashboardView.js';
import { WarehouseDetailModal } from '../components/WarehouseDetailModal.js';
import { VerificationFlow } from '../components/VerificationFlow.js';
import { ReviewQueueView } from '../components/ReviewQueueView.js';
import { ReportExportModal } from '../components/ReportExportModal.js';
import { PhysicsModal } from '../components/PhysicsModal.js';
import { CheckCircle2, AlertOctagon, Info } from 'lucide-react';

export type PanelKind = 'farmer' | 'inspector';

export interface ConsoleShellProps {
  panel: PanelKind;
  initialRole: UserRole;
  initialView?: 'dashboard' | 'reviews';
  autoOpenReports?: boolean;
  autoStartSpecimen?: boolean;
  greeting?: string | null;
  onGreetingShown?: () => void;
  onExitToLanding: () => void;
}

/**
 * ConsoleShell — the full console experience (Header, Dashboard, Review Queue,
 * Verification flow, modals, offline banner, toasts). Rendered identically by
 * both the Farmer panel and the Inspector panel; `panel` only selects which
 * wrapper mounted it so future per-panel customization has an anchor.
 * Extracted verbatim from the original single-panel App — no behavior changed.
 */
export const ConsoleShell: React.FC<ConsoleShellProps> = ({
  initialRole,
  initialView = 'dashboard',
  autoOpenReports = false,
  autoStartSpecimen = false,
  greeting = null,
  onGreetingShown,
  onExitToLanding,
}) => {
  // Navigation & Role state
  const [currentRole, setCurrentRole] = useState<UserRole>(initialRole);
  const [currentView, setCurrentView] = useState<'overview' | 'dashboard' | 'reviews' | 'reports'>(initialView);

  // Data state
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals & Active Flows
  const [selectedWarehouseForDetail, setSelectedWarehouseForDetail] = useState<Warehouse | null>(null);
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
  }, [loadAllData]);

  // Landing deep-links: open the specimen verification once data arrives.
  const specimenStarted = useRef(false);
  useEffect(() => {
    if (!autoStartSpecimen || specimenStarted.current || isLoading) return;
    const specimenWh = warehouses.find((w) => w.id === 'wh-001') || warehouses[0];
    if (specimenWh) {
      specimenStarted.current = true;
      setActiveVerificationWarehouse(specimenWh);
    }
  }, [autoStartSpecimen, isLoading, warehouses]);

  // Landing deep-link: open the audit report ledger on entry.
  const reportsOpened = useRef(false);
  useEffect(() => {
    if (autoOpenReports && !reportsOpened.current) {
      reportsOpened.current = true;
      setIsReportModalOpen(true);
    }
  }, [autoOpenReports]);

  // One-shot welcome toast after login (owned by the parent router).
  const greeted = useRef(false);
  useEffect(() => {
    if (greeting && !greeted.current) {
      greeted.current = true;
      showToast(greeting, 'success');
      onGreetingShown?.();
    }
  }, [greeting, showToast, onGreetingShown]);

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

  // Handle review item updates (Resolve / Escalate / Add note)
  const handleUpdateReview = async (id: string, payload: any) => {
    try {
      await updateReviewItem(id, payload);
      showToast('Review action logged and updated successfully.', 'success');
      await loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update review item', 'urgent');
    }
  };

  // Handle reset demo data
  const handleResetDemo = async () => {
    try {
      await resetDemoData();
      showToast('Demo data successfully reset to initial seed state.', 'info');
      await loadAllData();
    } catch (err: any) {
      showToast('Error resetting demo data', 'urgent');
    }
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

  return (
    <div className="min-h-screen bg-[#FAF8F3] text-[#2B2016] flex flex-col font-sans">
      <Header
        currentRole={currentRole}
        onSelectRole={(role) => {
          setCurrentRole(role);
          showToast(`Switched persona to ${USERS[role].name} (${USERS[role].badge})`, 'info');
        }}
        openReviewCount={openReviewCount}
        currentView={currentView}
        onNavigate={(view) => {
          // Leave any open verification flow first — otherwise the flow
          // keeps rendering on top and the navbar looks dead.
          setActiveVerificationWarehouse(null);
          if (view === 'reports') {
            setIsReportModalOpen(true);
          } else if (view === 'overview') {
            onExitToLanding();
          } else {
            setCurrentView(view);
          }
          requestAnimationFrame(() => {
            window.scrollTo({ top: 0, behavior: 'auto' });
          });
        }}
        onOpenPhysics={() => setIsPhysicsModalOpen(true)}
        onResetDemo={handleResetDemo}
      />

      {/* Realistic Field Connectivity / Offline Banner */}
      <OfflineBanner
        isSimulatedOffline={isSimulatedOffline}
        onToggleSimulatedOffline={handleToggleOffline}
        pendingSyncCount={pendingSyncCount}
      />

      {/* Main App Content Viewport */}
      <main className={activeVerificationWarehouse || currentView !== 'overview' ? 'flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto' : 'flex-1 w-full'}>
        {/* If an active verification flow is open, show the 4-step pipeline */}
        {activeVerificationWarehouse ? (
          <div className="py-2 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <VerificationFlow
              warehouse={activeVerificationWarehouse}
              onCancel={() => setActiveVerificationWarehouse(null)}
              onComplete={handleVerificationCompleted}
              currentAuditor={USERS[currentRole]}
            />
          </div>
        ) : currentView === 'reviews' ? (
          <ReviewQueueView
            reviews={reviews}
            onUpdateReview={handleUpdateReview}
            onSelectWarehouse={(warehouseId) => {
              const wh = warehouses.find((w) => w.id === warehouseId);
              if (wh) setSelectedWarehouseForDetail(wh);
            }}
          />
        ) : (
          <DashboardView
            warehouses={warehouses}
            summary={summary}
            currentRole={currentRole}
            currentAuditor={USERS[currentRole]}
            onSelectWarehouse={(warehouse) => setSelectedWarehouseForDetail(warehouse)}
            onStartVerification={(warehouse) => setActiveVerificationWarehouse(warehouse)}
            onOpenReport={() => setIsReportModalOpen(true)}
            onOpenReviewQueue={() => setCurrentView('reviews')}
            onNavigateToOverview={onExitToLanding}
            onVerificationSaved={handleVerificationCompleted}
            isLoading={isLoading}
          />
        )}
      </main>

      {/* Warehouse Detail Modal */}
      <WarehouseDetailModal
        warehouse={selectedWarehouseForDetail}
        onClose={() => setSelectedWarehouseForDetail(null)}
        onStartVerification={(warehouse) => {
          setSelectedWarehouseForDetail(null);
          setActiveVerificationWarehouse(warehouse);
        }}
      />

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

      {/* Floating Procedural Notification Toast */}
      {notification && (
        <div className="safe-bottom fixed bottom-5 left-4 right-4 sm:left-auto sm:right-5 sm:max-w-md z-50 animate-fade-in">
          <div
            className={`p-3.5 rounded-xl border text-xs font-mono shadow-[0_12px_32px_rgba(0,0,0,0.12)] flex items-start gap-3 bg-white ${
              notification.type === 'urgent'
                ? 'border-l-4 border-l-[#B5574F] border-[#B5574F]/30 text-[#3D3226]'
                : notification.type === 'success'
                ? 'border-l-4 border-l-emerald-500 border-emerald-200 text-[#3D3226]'
                : 'border-l-4 border-l-[#B98A2E] border-[#B98A2E]/30 text-[#3D3226]'
            }`}
          >
            {notification.type === 'urgent' ? (
              <AlertOctagon className="w-4 h-4 shrink-0 text-[#B5574F] mt-0.5" />
            ) : notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 shrink-0 text-[#B98A2E] mt-0.5" />
            )}
            <div className="flex-1 leading-relaxed">
              {notification.message}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
