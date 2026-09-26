import React from 'react';
import { VerificationStatus, ReviewPriority, ReviewStatus } from '../types.js';
import { CheckCircle2, AlertTriangle, AlertOctagon, Clock, Check } from 'lucide-react';

interface StatusChipProps {
  status: VerificationStatus | ReviewPriority | ReviewStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  status,
  size = 'md',
  showIcon = true
}) => {
  let label = '';
  let colorClass = '';
  let IconComponent: any = null;

  switch (status) {
    case 'consistent':
      label = 'CONSISTENT';
      colorClass = 'bg-[var(--success-bg)] text-[var(--success-ink)] border-[var(--success-line)]';
      IconComponent = CheckCircle2;
      break;

    case 'review':
      label = 'REVIEW REQUIRED';
      colorClass = 'bg-[var(--gold-wash)] text-[var(--gold-ink)] border-[var(--gold-line)]';
      IconComponent = AlertTriangle;
      break;

    case 'high_priority':
      label = 'HIGH PRIORITY';
      colorClass = 'bg-[var(--danger-bg)] text-[var(--danger-ink)] border-[var(--danger-line)]';
      IconComponent = AlertOctagon;
      break;

    case 'urgent':
      label = 'URGENT REVIEW';
      colorClass = 'bg-[var(--danger-bg)] text-[var(--danger-ink)] border-[var(--danger-line)]';
      IconComponent = AlertOctagon;
      break;

    case 'medium':
      label = 'MEDIUM PRIORITY';
      colorClass = 'bg-[var(--gold-wash)] text-[var(--gold-ink)] border-[var(--gold-line)]';
      IconComponent = AlertTriangle;
      break;

    case 'routine':
      label = 'ROUTINE';
      colorClass = 'bg-[var(--wash)] text-[var(--ink-soft)] border-[var(--hairline)]';
      IconComponent = Clock;
      break;

    case 'open':
      label = 'OPEN ACTION';
      colorClass = 'bg-[var(--gold-wash)] text-[var(--gold-ink)] border-[var(--gold-line)]';
      IconComponent = Clock;
      break;

    case 'resolved':
      label = 'RESOLVED';
      colorClass = 'bg-[var(--success-bg)] text-[var(--success-ink)] border-[var(--success-line)]';
      IconComponent = Check;
      break;

    case 'escalated':
      label = 'ESCALATED TO RISK COMM.';
      colorClass = 'bg-[var(--danger-bg)] text-[var(--danger-ink)] border-[var(--danger-line)]';
      IconComponent = AlertOctagon;
      break;

    default:
      label = String(status).toUpperCase();
      colorClass = 'bg-[var(--wash)] text-[var(--ink-soft)] border-[var(--hairline)]';
      IconComponent = Clock;
  }

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px] tracking-wider gap-1',
    md: 'px-2.5 py-1 text-xs tracking-wider gap-1.5',
    lg: 'px-3 py-1.5 text-sm tracking-widest gap-2 font-semibold',
  }[size];

  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded-full border whitespace-nowrap select-none ${sizeClasses} ${colorClass}`}
    >
      {showIcon && IconComponent && (
        <IconComponent className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      )}
      <span>{label}</span>
    </span>
  );
};
