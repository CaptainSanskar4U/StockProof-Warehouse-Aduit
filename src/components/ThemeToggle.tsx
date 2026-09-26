import React from 'react';
import { Moon, Sun } from 'lucide-react';
import type { Theme } from '../hooks/useTheme.js';

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

/** Quiet corner toggle — moon for the dark hours, sun for the paper. */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onToggle }) => {
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isDark}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light theme' : 'Dark theme'}
      className="touch-target w-8 h-8 rounded-full border border-[var(--hairline-strong)] bg-[var(--sheet)] text-[var(--ink-soft)] hover:text-[var(--gold)] hover:border-[var(--gold-line)] flex items-center justify-center transition-all cursor-pointer shrink-0"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
};
