import React, { useState } from 'react';
import { SharedAuditProvider } from '../components/proof/SharedAuditContext.js';
import { FarmerNewAuditTab } from './FarmerNewAuditTab.js';
import { BankableTab, GeometryTab, ReverseTab } from '../components/proof/ProofTabs.js';
import { fetchWarehouses } from '../services/api.js';
import type { Warehouse } from '../types.js';

type Method = 'new-audit' | 'reverse' | 'geometry' | 'bankable';

interface FarmerAuditProps {
  onSaved: () => void;
}

/**
 * Audit/Camera — New Audit is the single main workflow (farmer-owned fork),
 * with Reverse Proof, Geometry and Bankable kept as extra check methods.
 * Engines reused as-is; Inspector code untouched.
 */
export const FarmerAudit: React.FC<FarmerAuditProps> = ({ onSaved }) => {
  const [method, setMethod] = useState<Method>('new-audit');
  const [warehouses, setWarehouses] = useState<Warehouse[] | null>(null);

  const ensureWarehouses = async () => {
    if (warehouses !== null) return;
    try {
      setWarehouses(await fetchWarehouses());
    } catch {
      setWarehouses([]);
    }
  };

  const pickMethod = (m: Method) => {
    setMethod(m);
    if (m === 'new-audit') void ensureWarehouses();
  };

  // Load stores on first mount so New Audit is ready immediately.
  React.useEffect(() => {
    void ensureWarehouses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const methods: { id: Method; label: string }[] = [
    { id: 'new-audit', label: 'New Audit' },
    { id: 'reverse', label: 'Reverse Proof' },
    { id: 'geometry', label: 'Geometry' },
    { id: 'bankable', label: 'Bankable' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-instrument-serif text-3xl text-[#3D3226]">Check your stock</h1>
        <p className="text-sm text-[#2B2016]/60 mt-1">Photograph your pile and compare it with your receipt.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {methods.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => pickMethod(id)}
            className={`touch-target px-4 py-2 rounded-full text-xs font-mono tracking-wider whitespace-nowrap cursor-pointer ${
              method === id
                ? 'bg-[#2B2016] text-white font-bold'
                : 'text-[#2B2016]/60 bg-white border border-[#3D3226]/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <SharedAuditProvider>
        {method === 'new-audit' && (
          <>
            {warehouses === null && (
              <div className="bg-white border border-[#3D3226]/10 rounded-xl p-10 text-center text-sm text-[#2B2016]/55">
                <span className="inline-block animate-spin mr-2">⟳</span> Loading stores…
              </div>
            )}
            {warehouses !== null && warehouses.length === 0 && (
              <div className="bg-white border border-[#3D3226]/10 rounded-xl p-8 text-center text-sm text-[#2B2016]/60">
                Stores need a connection to load. Please reconnect and reopen this page.
              </div>
            )}
            {warehouses !== null && warehouses.length > 0 && (
              <FarmerNewAuditTab
                warehouses={warehouses}
                onViewRecords={onSaved}
              />
            )}
          </>
        )}
        {method === 'reverse' && <ReverseTab />}
        {method === 'geometry' && <GeometryTab />}
        {method === 'bankable' && <BankableTab />}
      </SharedAuditProvider>
    </div>
  );
};
