import React from 'react';
import { FarmerShell } from '../farmer/FarmerShell.js';

/**
 * Farmer Panel — farmer-owned experience: Audit/Camera, Records, Profile.
 *
 * Self-contained on purpose. It used to borrow its prop type from the old
 * single-panel `ConsoleShell`, but that shell is gone: the Inspector page now
 * lives in App.tsx (landed from GitHub) and the two never share a chrome.
 */
export interface FarmerPanelProps {
  initialView?: 'dashboard' | 'reviews';
  autoOpenReports?: boolean;
  autoStartSpecimen?: boolean;
  greeting?: string | null;
  onGreetingShown?: () => void;
  onExitToLanding: () => void;
  onLogout: () => void;
}

export const FarmerPanel: React.FC<FarmerPanelProps> = ({
  initialView,
  autoOpenReports,
  greeting,
  onGreetingShown,
  onExitToLanding,
  onLogout,
}) => (
  <FarmerShell
    initialTab={initialView === 'reviews' || autoOpenReports ? 'records' : 'audit'}
    greeting={greeting}
    onGreetingShown={onGreetingShown}
    onExitToLanding={onExitToLanding}
    onLogout={onLogout}
  />
);
