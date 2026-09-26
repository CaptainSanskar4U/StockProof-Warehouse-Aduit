import React from 'react';
import { ConsoleShell } from './ConsoleShell.js';
import type { ConsoleShellProps } from './ConsoleShell.js';

type InspectorPanelProps = Omit<ConsoleShellProps, 'panel' | 'initialRole'>;

/**
 * Inspector Panel — the existing console, unchanged.
 */
export const InspectorPanel: React.FC<InspectorPanelProps> = (props) => (
  <ConsoleShell {...props} panel="inspector" initialRole="auditor" />
);
