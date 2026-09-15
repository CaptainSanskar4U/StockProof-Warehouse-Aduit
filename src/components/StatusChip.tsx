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
      colorClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      IconComponent = CheckCircle2;
      break;

    case 'review':
      label = 'REVIEW REQUIRED';
      colorClass = 'bg-[#B98A2E]/10 text-[#7A5A1A] border-[#B98A2E]/30';
      IconComponent = AlertTriangle;
      break;

    case 'high_priority':
      label = 'HIGH PRIORITY';
      colorClass = 'bg-red-50 text-red-800 border-red-200';
      IconComponent = AlertOctagon;
      break;

    case 'urgent':
      label = 'URGENT REVIEW';
      colorClass = 'bg-red-50 text-red-800 border-red-300';
      IconComponent = AlertOctagon;
      break;

    case 'medium':
      label = 'MEDIUM PRIORITY';
      colorClass = 'bg-[#B98A2E]/10 text-[#7A5A1A] border-[#B98A2E]/30';
      IconComponent = AlertTriangle;
      break;

    case 'routine':
      label = 'ROUTINE';
      colorClass = 'bg-stone-100 text-stone-600 border-stone-200';
      IconComponent = Clock;
      break;

    case 'open':
      label = 'OPEN ACTION';
      colorClass = 'bg-[#B98A2E]/10 text-[#7A5A1A] border-[#B98A2E]/30';
      IconComponent = Clock;
      break;

    case 'resolved':
      label = 'RESOLVED';
      colorClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      IconComponent = Check;
      break;

    case 'escalated':
      label = 'ESCALATED TO RISK COMM.';
      colorClass = 'bg-red-50 text-red-800 border-red-300';
      IconComponent = AlertOctagon;
      break;

    default:
      label = String(status).toUpperCase();
      colorClass = 'bg-stone-100 text-stone-600 border-stone-200';
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
