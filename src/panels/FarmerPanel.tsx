import React from 'react';
import { FarmerShell } from '../farmer/FarmerShell.js';
import type { ConsoleShellProps } from './ConsoleShell.js';

type FarmerPanelProps = Omit<ConsoleShellProps, 'panel' | 'initialRole'> & {
  onLogout: () => void;
};

/**
 * Farmer Panel — redesigned farmer experience: Audit/Camera, Records,
 * Profile. Keeps router props compatible, and the
 * Inspector Console is completely unaffected.
 */
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
