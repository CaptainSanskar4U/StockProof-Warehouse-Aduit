import React, { useState } from 'react';
import { ReviewItem, ReviewPriority, ReviewStatus } from '../types.js';
import { StatusChip } from './StatusChip.js';
import { RangeBar } from './RangeBar.js';
import { 
  AlertOctagon, 
  AlertTriangle, 
  CheckCircle2, 
  MessageSquare, 
  Clock, 
  Send, 
  ShieldCheck, 
  ChevronDown, 
  ChevronUp, 
  Filter, 
  FileText 
} from 'lucide-react';

interface ReviewQueueViewProps {
  reviews: ReviewItem[];
  onUpdateReview: (
    id: string, 
    payload: { 
      status?: ReviewStatus; 
      note?: string; 
      resolutionType?: string; 
      priority?: ReviewPriority; 
      assignedTo?: string 
    }
  ) => Promise<void>;
  onSelectWarehouse: (warehouseId: string) => void;
}

export const ReviewQueueView: React.FC<ReviewQueueViewProps> = ({
  reviews,
  onUpdateReview,
  onSelectWarehouse,
}) => {
  const [priorityFilter, setPriorityFilter] = useState<'all' | ReviewPriority>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ReviewStatus>('open');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newNoteText, setNewNoteText] = useState<Record<string, string>>({});
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const filteredReviews = reviews.filter((r) => {
    if (priorityFilter !== 'all' && r.priority !== priorityFilter) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    return true;
  });

  const handleAddNote = async (id: string) => {
    const text = newNoteText[id]?.trim();
    if (!text) return;
    setIsUpdating(id);
    try {
      await onUpdateReview(id, { note: text });
      setNewNoteText((prev) => ({ ...prev, [id]: '' }));
    } finally {
      setIsUpdating(null);
    }
  };

  const handleResolve = async (id: string, resolutionType: string) => {
    setIsUpdating(id);
    try {
      await onUpdateReview(id, {
        status: 'resolved',
        resolutionType,
        note: `Action item resolved: ${resolutionType.replace(/_/g, ' ').toUpperCase()}`,
      });
    } finally {
      setIsUpdating(null);
    }
  };

  const handleEscalate = async (id: string) => {
    setIsUpdating(id);
    try {
      await onUpdateReview(id, {
        status: 'escalated',
        priority: 'urgent',
        note: `Formally escalated to Bank Credit Committee for on-site physical recount and loan release hold.`,
      });
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header and Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#3D3226]/10 pb-5">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#B98A2E] uppercase block">
            COLLATERAL RISK MANAGEMENT
          </span>
          <h1 className="display-console font-instrument-serif text-[#3D3226] mt-0.5">
            Audit Review & Discrepancy Queue
          </h1>
          <p className="text-xs font-mono text-[#2B2016]/55 mt-1">
            Prioritized review list of warehouse receipts where physical volume falls outside defensible bounds.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <div className="bg-white border border-[#3D3226]/10 rounded p-1 flex items-center gap-1">
            <button
              onClick={() => setStatusFilter('open')}
              className={`px-2.5 py-1 rounded transition-colors ${
                statusFilter === 'open' ? 'bg-[#2B2016] text-white font-bold' : 'text-[#2B2016]/55 hover:text-[#3D3226]'
              }`}
            >
              Open Flags
            </button>
            <button
              onClick={() => setStatusFilter('resolved')}
              className={`px-2.5 py-1 rounded transition-colors ${
                statusFilter === 'resolved' ? 'bg-[#2B2016] text-white font-bold' : 'text-[#2B2016]/55 hover:text-[#3D3226]'
              }`}
            >
              Resolved
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded transition-colors ${
                statusFilter === 'all' ? 'bg-[#2B2016] text-white font-bold' : 'text-[#2B2016]/55 hover:text-[#3D3226]'
              }`}
            >
              All
            </button>
          </div>

          <div className="bg-white border border-[#3D3226]/10 rounded p-1 flex items-center gap-1">
            <span className="text-[10px] text-[#2B2016]/55 px-1.5">Priority:</span>
            {(['all', 'urgent', 'medium', 'routine'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-2 py-0.5 rounded-full text-[11px] uppercase transition-colors ${
                  priorityFilter === p ? 'bg-[#2B2016] text-white font-semibold' : 'text-[#2B2016]/55 hover:text-[#3D3226]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Reviews List */}
      {filteredReviews.length === 0 ? (
        <div className="bg-white border border-[#3D3226]/10 rounded-xl p-12 text-center text-xs font-mono text-[#2B2016]/55 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto opacity-75" />
          <p className="text-[#3D3226] font-medium text-sm">No review items match your filter</p>
          <p>All stock receipts are consistent with physical bounds, or items have been resolved.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
                <div
                  key={item.id}
                  className="bg-white border border-[#3D3226]/10 rounded-lg overflow-hidden transition-colors"
                >
                {/* Collapsed Header Bar */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-[#F5F0E8] transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip status={item.priority} size="sm" />
                      <StatusChip status={item.status} size="sm" />
                      <span className="text-xs font-mono text-[#2B2016]/55">{item.warehouseLocation}</span>
                    </div>

                    <h3 className="text-base sm:text-lg font-instrument-serif text-[#3D3226]">
                      {item.warehouseName}
                    </h3>
                  </div>

                  {/* Right side metrics summary */}
                  <div className="flex items-center gap-4 sm:gap-6">
                    <div className="text-right font-mono">
                      <span className="text-[10px] text-[#2B2016]/55 block uppercase">Discrepancy</span>
                      <span className={`text-base font-bold ${item.discrepancyTonnes > 5 ? 'text-[#B23A32]' : 'text-[#B98A2E]'}`}>
                        {item.discrepancyTonnes > 0 ? `+${item.discrepancyTonnes} T gap` : '0 T boundary'}
                      </span>
                    </div>

                    <div className="hidden sm:block text-right font-mono">
                      <span className="text-[10px] text-[#2B2016]/55 block uppercase">Declared vs Est.</span>
                      <span className="text-xs text-[#3D3226]">
                        {item.declaredTonnes} T vs ({item.estimatedRange[0]}–{item.estimatedRange[1]} T)
                      </span>
                    </div>

                    <div className="text-[#2B2016]/55 p-1">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details & Resolution Workflow */}
                {isExpanded && (
                  <div className="p-4 sm:p-6 border-t border-[#3D3226]/10 bg-[#F5F0E8] space-y-5">
                    {/* Visual Range bar */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono text-[#2B2016]/55 uppercase tracking-wider block">
                        PHYSICAL BOUND ANALYSIS
                      </span>
                      <RangeBar
                        rangeLow={item.estimatedRange[0]}
                        rangeHigh={item.estimatedRange[1]}
                        declared={item.declaredTonnes}
                      />
                    </div>

                    {/* Metadata summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono bg-white p-3.5 rounded border border-[#3D3226]/10">
                      <div>
                        <span className="text-[#2B2016]/55 block text-[10px]">CROP</span>
                        <strong className="text-[#3D3226] uppercase">{item.grainType}</strong>
                      </div>
                      <div>
                        <span className="text-[#2B2016]/55 block text-[10px]">CONFIDENCE</span>
                        <strong className="text-[#B98A2E]">{item.confidencePercent}%</strong>
                      </div>
                      <div>
                        <span className="text-[#2B2016]/55 block text-[10px]">ASSIGNED AUDITOR</span>
                        <strong className="text-[#3D3226]">{item.assignedTo}</strong>
                      </div>
                      <div>
                        <span className="text-[#2B2016]/55 block text-[10px]">LOGGED DATE</span>
                        <strong className="text-[#3D3226]">{new Date(item.createdAt).toLocaleDateString()}</strong>
                      </div>
                    </div>

                    {/* Action & Resolution Area */}
                    {item.status === 'open' && (
                      <div className="p-4 bg-white rounded border border-[#3D3226]/10 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-mono text-[#B98A2E] uppercase tracking-wider font-semibold">
                          <ShieldCheck className="w-4 h-4" />
                          <span>Audit Resolution Actions</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                            <button
                              disabled={isUpdating === item.id}
                              onClick={() => handleResolve(item.id, 'stock_confirmed_physical')}
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#2F7A3D] border border-emerald-200 rounded transition-colors cursor-pointer"
                            >
                              Physical core sample validated
                            </button>

                          <button
                            disabled={isUpdating === item.id}
                            onClick={() => handleResolve(item.id, 'weighbridge_slips_verified')}
                            className="px-3 py-1.5 bg-[#3D3226]/10 hover:bg-[#3D3226]/15 text-[#3D3226] rounded transition-colors cursor-pointer"
                          >
                            Weighbridge Slips Re-verified
                          </button>

                            <button
                              disabled={isUpdating === item.id}
                              onClick={() => handleEscalate(item.id)}
                              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-[#B23A32] border border-red-200 rounded transition-colors cursor-pointer"
                            >
                              Escalate to bank risk committee
                            </button>
                        </div>
                      </div>
                    )}

                    {/* Audit Notes Log */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-mono text-[#2B2016]/55 uppercase tracking-wider block">
                        AUDITOR OBSERVATION LOG ({item.notes.length})
                      </span>

                      <div className="space-y-1.5">
                        {item.notes.map((n, idx) => (
                          <div
                            key={idx}
                            className="text-xs font-mono text-[#2B2016]/70 bg-white p-2.5 rounded border border-[#3D3226]/10 leading-relaxed"
                          >
                            {n}
                          </div>
                        ))}
                      </div>

                      {/* Add new note form */}
                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="text"
                          placeholder="Add auditor / credit officer note..."
                          value={newNoteText[item.id] || ''}
                          onChange={(e) =>
                            setNewNoteText((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddNote(item.id);
                          }}
                          className="flex-1 bg-white border border-[#3D3226]/10 rounded px-3 py-2 text-xs font-mono text-[#3D3226] placeholder-[#2B2016]/40 focus:outline-none focus:border-[#2B2016]"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddNote(item.id)}
                          disabled={!newNoteText[item.id]?.trim() || isUpdating === item.id}
                          className="px-3 py-2 bg-[#2B2016] hover:bg-[#3D3226] text-white font-mono font-bold text-xs rounded-full transition-colors cursor-pointer disabled:opacity-40"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
