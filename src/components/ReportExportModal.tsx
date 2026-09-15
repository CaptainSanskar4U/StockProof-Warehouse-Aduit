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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#2B2016]/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="bg-white border border-[#3D3226]/10 rounded-2xl max-w-5xl w-full max-h-[92dvh] flex flex-col shadow-[0_24px_64px_rgba(43,32,22,0.25)] overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#3D3226]/10 bg-[#F5F0E8] flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest text-[#B98A2E] uppercase">
                BANK AUDIT & RISK COMPLIANCE
              </span>
              <span className="text-xs font-mono text-[#2B2016]/55">/ FORM-702-AGRI</span>
            </div>
            <h2 className="text-lg sm:text-xl font-instrument-serif text-[#3D3226] mt-0.5">
              Portfolio Collateral Stock Verification Ledger
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCSV}
              className="px-3 py-1.5 bg-[#3D3226]/10 hover:bg-[#3D3226]/15 text-[#3D3226] font-mono text-xs rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#2F7A3D]" /> : <Copy className="w-3.5 h-3.5 text-[#B98A2E]" />}
              <span>{copied ? 'CSV Copied' : 'Copy CSV'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-[#2B2016] hover:bg-[#3D3226] text-white font-mono font-bold text-xs rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Audit Sheet</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-[#2B2016]/55 hover:text-[#3D3226] rounded hover:bg-[#3D3226]/10 transition-colors cursor-pointer ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Executive Summary Bar */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F5F0E8] p-4 rounded border border-[#3D3226]/10 font-mono text-xs">
              <div>
                <span className="text-[10px] text-[#2B2016]/55 uppercase block">Total Facilities</span>
                <strong className="text-[#3D3226] text-base font-display">{summary.totalWarehouses} Sites</strong>
              </div>
              <div>
                <span className="text-[10px] text-[#2B2016]/55 uppercase block">Total Collateral Tonnage</span>
                <strong className="text-[#3D3226] text-base font-display">{summary.totalDeclaredTonnes} T</strong>
              </div>
              <div>
                <span className="text-[10px] text-[#2B2016]/55 uppercase block">Estimated Loan Book</span>
                <strong className="text-[#B98A2E] text-base font-display">₹{summary.totalLoanExposureCr} Cr</strong>
              </div>
              <div>
                <span className="text-[10px] text-[#2B2016]/55 uppercase block">Tonnage At Risk</span>
                <strong className="text-[#B23A32] text-base font-display">{summary.tonnageAtRisk} T</strong>
              </div>
            </div>
          )}

          {/* Audit Table */}
          <div className="border border-[#3D3226]/10 rounded overflow-x-auto bg-[#F5F0E8]">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-white text-[#2B2016]/55 uppercase border-b border-[#3D3226]/10 text-[10px] tracking-wider">
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
              <tbody className="divide-y divide-[#3D3226]/10 text-[#2B2016]/70">
                {warehouses.map((w) => (
                  <tr key={w.id} className="hover:bg-[#F5F0E8] transition-colors">
                    <td className="p-3 font-medium text-[#3D3226]">
                      <div>{w.name}</div>
                      <div className="text-[10px] text-[#2B2016]/55">{w.code}</div>
                    </td>
                    <td className="p-3">
                      {w.district}, {w.state}
                    </td>
                    <td className="p-3 uppercase">
                      {w.grainTypes.join(', ')}
                    </td>
                    <td className="p-3 text-right font-bold text-[#3D3226]">
                      {w.currentDeclaredTonnes.toFixed(1)}
                    </td>
                    <td className="p-3 text-[11px] truncate max-w-48">
                      {w.lendingBank}
                    </td>
                    <td className="p-3 text-[11px] text-[#B98A2E]">
                      {w.receiptNumber}
                    </td>
                    <td className="p-3 text-center">
                      <StatusChip status={w.status} size="sm" />
                    </td>
                    <td className="p-3 text-right text-[11px] text-[#2B2016]/55">
                      {w.lastVerifiedDate ? new Date(w.lastVerifiedDate).toLocaleDateString() : 'Pending'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-[#FAF5EB] border border-[#B98A2E]/30 rounded-xl text-[11px] font-mono text-[#2B2016]/55 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#B98A2E] shrink-0" />
            <span>
              Certifies electronic physical stock verification conducted under STOCKPROOF Optical Photogrammetry & Agronomic Density Protocol v2.4.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#3D3226]/10 bg-[#F5F0E8] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#3D3226]/10 hover:bg-[#3D3226]/15 text-[#3D3226] font-mono text-xs uppercase tracking-wider rounded-full transition-colors"
          >
            Close Report
          </button>
        </div>
      </motion.div>
    </div>
  );
};
