import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Warehouse, PortfolioSummary } from '../types.js';
import { X, Download, Printer, Copy, Check, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import { StatusChip } from './StatusChip.js';

interface ReportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  summary: PortfolioSummary | null;
}

export const ReportExportModal: React.FC<ReportExportModalProps> = ({
  isOpen,
  onClose,
  warehouses,
  summary,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyCSV = () => {
    const headers = ['Warehouse Code', 'Name', 'Location', 'Grain Type', 'Declared (T)', 'Status', 'Receipt Ref', 'Loan Ref', 'Bank', 'Last Verified'];
    const rows = warehouses.map(w => [
      w.code,
      `"${w.name}"`,
      `"${w.district}, ${w.state}"`,
      w.grainTypes.join('/'),
      w.currentDeclaredTonnes,
      w.status,
      w.receiptNumber,
      w.loanReference,
      `"${w.lendingBank}"`,
      w.lastVerifiedDate || 'Not Verified',
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    navigator.clipboard.writeText(csvContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[var(--overlay)] backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="bg-[var(--sheet)] border border-[var(--hairline)] rounded-2xl max-w-5xl w-full max-h-[92dvh] flex flex-col shadow-[0_24px_64px_rgba(43,32,22,0.25)] overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--hairline)] bg-[var(--well)] flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest text-[var(--gold)] uppercase">
                BANK AUDIT & RISK COMPLIANCE
              </span>
              <span className="text-xs font-mono text-[var(--ink-soft)]">/ FORM-702-AGRI</span>
            </div>
            <h2 className="text-lg sm:text-xl font-instrument-serif text-[var(--ink-2)] mt-0.5">
              Portfolio Collateral Stock Verification Ledger
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCSV}
              className="px-3 py-1.5 bg-[var(--ink-2)]/10 hover:bg-[var(--ink-2)]/15 text-[var(--ink-2)] font-mono text-xs rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[var(--success-ink)]" /> : <Copy className="w-3.5 h-3.5 text-[var(--gold)]" />}
              <span>{copied ? 'CSV Copied' : 'Copy CSV'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-[var(--ink)] hover:bg-[var(--ink-2)] text-[var(--ink-inverse)] font-mono font-bold text-xs rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Audit Sheet</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-[var(--ink-soft)] hover:text-[var(--ink-2)] rounded hover:bg-[var(--ink-2)]/10 transition-colors cursor-pointer ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Executive Summary Bar */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[var(--well)] p-4 rounded border border-[var(--hairline)] font-mono text-xs">
              <div>
                <span className="text-[10px] text-[var(--ink-soft)] uppercase block">Total Facilities</span>
                <strong className="text-[var(--ink-2)] text-base font-display">{summary.totalWarehouses} Sites</strong>
              </div>
              <div>
                <span className="text-[10px] text-[var(--ink-soft)] uppercase block">Total Collateral Tonnage</span>
                <strong className="text-[var(--ink-2)] text-base font-display">{summary.totalDeclaredTonnes} T</strong>
              </div>
              <div>
                <span className="text-[10px] text-[var(--ink-soft)] uppercase block">Estimated Loan Book</span>
                <strong className="text-[var(--gold)] text-base font-display">₹{summary.totalLoanExposureCr} Cr</strong>
              </div>
              <div>
                <span className="text-[10px] text-[var(--ink-soft)] uppercase block">Tonnage At Risk</span>
                <strong className="text-[var(--danger-ink)] text-base font-display">{summary.tonnageAtRisk} T</strong>
              </div>
            </div>
          )}

          {/* Audit Table */}
          <div className="border border-[var(--hairline)] rounded overflow-x-auto bg-[var(--well)]">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[var(--sheet)] text-[var(--ink-soft)] uppercase border-b border-[var(--hairline)] text-[10px] tracking-wider">
                <tr>
                  <th className="p-3">Warehouse / Code</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Grain</th>
                  <th className="p-3 text-right">Declared (T)</th>
                  <th className="p-3">Lending Bank</th>
                  <th className="p-3">Receipt Ref</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Last Verified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--hairline)] text-[var(--ink-soft)]">
                {warehouses.map((w) => (
                  <tr key={w.id} className="hover:bg-[var(--well)] transition-colors">
                    <td className="p-3 font-medium text-[var(--ink-2)]">
                      <div>{w.name}</div>
                      <div className="text-[10px] text-[var(--ink-soft)]">{w.code}</div>
                    </td>
                    <td className="p-3">
                      {w.district}, {w.state}
                    </td>
                    <td className="p-3 uppercase">
                      {w.grainTypes.join(', ')}
                    </td>
                    <td className="p-3 text-right font-bold text-[var(--ink-2)]">
                      {w.currentDeclaredTonnes.toFixed(1)}
                    </td>
                    <td className="p-3 text-[11px] truncate max-w-48">
                      {w.lendingBank}
                    </td>
                    <td className="p-3 text-[11px] text-[var(--gold)]">
                      {w.receiptNumber}
                    </td>
                    <td className="p-3 text-center">
                      <StatusChip status={w.status} size="sm" />
                    </td>
                    <td className="p-3 text-right text-[11px] text-[var(--ink-soft)]">
                      {w.lastVerifiedDate ? new Date(w.lastVerifiedDate).toLocaleDateString() : 'Pending'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-[var(--gold-tint-bg)] border border-[var(--gold-line)] rounded-xl text-[11px] font-mono text-[var(--ink-soft)] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[var(--gold)] shrink-0" />
            <span>
              Certifies electronic physical stock verification conducted under STOCKPROOF Optical Photogrammetry & Agronomic Density Protocol v2.4.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--hairline)] bg-[var(--well)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--ink-2)]/10 hover:bg-[var(--ink-2)]/15 text-[var(--ink-2)] font-mono text-xs uppercase tracking-wider rounded-full transition-colors"
          >
            Close Report
          </button>
        </div>
      </motion.div>
    </div>
  );
};
