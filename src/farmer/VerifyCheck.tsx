import React, { useEffect, useState } from 'react';
import { fetchFarmerCheckById } from '../services/api.js';
import { SafeImage } from '../components/SafeImage.js';
import type { FarmerCheck } from '../types.js';

/**
 * Public verification page — anonymous by design, no login. Shows the true
 * stored record for a QR verification id, including any AI warning.
 * Identity: farmer name + location only. Phone is never shown here.
 */
export const VerifyCheck: React.FC<{ id: string }> = ({ id }) => {
  const [state, setState] = useState<'loading' | 'found' | 'missing' | 'offline'>('loading');
  const [record, setRecord] = useState<FarmerCheck | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const found = await fetchFarmerCheckById(id);
        if (alive) {
          setRecord(found);
          setState('found');
        }
      } catch (err) {
        if (!alive) return;
        const message = err instanceof Error ? err.message : '';
        if (message === 'Check not found') {
          setState('missing');
        } else if (message.startsWith('Failed to fetch') || message.includes('NetworkError')) {
          setState('offline');
        } else {
          setState('missing');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <div className="min-h-screen bg-[#FAF8F3] text-[#2B2016] font-sans flex flex-col">
      <header className="bg-white/95 border-b border-[#3D3226]/10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-[#2B2016] text-white flex items-center justify-center text-xl shrink-0">
            🌾
          </div>
          <div>
            <p className="text-base font-instrument-serif text-[#3D3226] leading-tight">StockProof Verification</p>
            <p className="text-[11px] font-mono text-[#2B2016]/55 leading-tight">Stored record · {id}</p>
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {state === 'loading' && (
          <div className="bg-white border border-[#3D3226]/10 rounded-2xl p-10 text-center">
            <span className="inline-block animate-spin text-3xl">⟳</span>
            <p className="text-sm text-[#2B2016]/60 mt-3">Looking up this check on the server…</p>
          </div>
        )}
        {state === 'missing' && (
          <div className="bg-white border border-[#3D3226]/10 rounded-2xl p-10 text-center space-y-2">
            <p className="text-xl text-[#3D3226]">No check found with this code.</p>
            <p className="text-sm text-[#2B2016]/60">
              The link may be mistyped, or the record may have been removed. Ask the farmer for a fresh report.
            </p>
          </div>
        )}
        {state === 'offline' && (
          <div className="bg-white border border-[#3D3226]/10 rounded-2xl p-10 text-center space-y-2">
            <p className="text-xl text-[#3D3226]">Can't reach the server right now.</p>
            <p className="text-sm text-[#2B2016]/60">
              Verification needs internet to reach the server, even though the analysis itself runs
              offline on the farmer's device. Check your connection and try again.
            </p>
          </div>
        )}
        {state === 'found' && record && <VerifyRecord record={record} />}
        <p className="text-xs text-[#2B2016]/50 text-center mt-6 px-4">
          Analysis runs on-device and offline. Opening this link needs internet to reach the server
          holding the true stored record.
        </p>
      </main>
    </div>
  );
};

const VerifyRecord: React.FC<{ record: FarmerCheck }> = ({ record: r }) => {
  const unverified = r.photoVerdict === 'ai' || r.photoVerdict === 'inconclusive';
  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#3D3226]/10 rounded-2xl p-6 text-center space-y-1">
        <p className="text-xs font-mono uppercase tracking-widest text-[#2B2016]/55">Verified check</p>
        <p className="font-mono text-2xl font-bold tracking-widest text-[#3D3226]">{r.id}</p>
        <p className="text-xs text-[#2B2016]/55">{new Date(r.createdAt).toLocaleString()}</p>
      </div>
      {unverified ? (
        <div className="bg-red-50 border-2 border-[#B5574F] rounded-2xl px-5 py-4 text-center">
          <p className="text-xl font-bold text-[#B23A32]">
            ⚠️ UNVERIFIED — this image could not be confirmed as genuine and should not be used as audit evidence.
          </p>
          <p className="text-sm text-[#3D3226] mt-2 italic">
            {r.photoVerdict === 'ai'
              ? 'The photo was flagged as AI-generated when this check was saved.'
              : 'The photo check was inconclusive when this check was saved.'}
          </p>
        </div>
      ) : r.match ? (
        <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl px-5 py-4 text-center">
          <p className="text-xl font-bold text-emerald-800">✅ Stored verdict: match.</p>
        </div>
      ) : (
        <div className="bg-amber-50 border-2 border-[#B98A2E] rounded-2xl px-5 py-4 text-center">
          <p className="text-xl font-bold text-[#8A6D1B]">🚨 Stored verdict: discrepancy — review required.</p>
        </div>
      )}
      <div className="bg-white border border-[#3D3226]/10 rounded-2xl p-5 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[#2B2016]/55">Receipt said</p>
            <p className="font-instrument-serif text-4xl text-[#3D3226]">{r.declaredTonnes} T</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-mono uppercase tracking-widest text-[#2B2016]/55">Pile estimate</p>
            {unverified ? (
              <>
                <p className="font-instrument-serif text-4xl text-[#8A7D68]/70 line-through">{r.estCentral} T</p>
                <p className="font-mono text-[11px] text-[#8A7D68]">untrusted estimate — not evidence</p>
              </>
            ) : (
              <>
                <p className="font-instrument-serif text-4xl text-[#3D3226]">{r.estCentral} T</p>
                <p className="font-mono text-[11px] text-[#2B2016]/55">
                  range {r.estLow}–{r.estHigh} T · {r.grainName}
                </p>
              </>
            )}
          </div>
        </div>
        {!unverified && (
          <p className="font-mono text-xs text-[#2B2016]/60">
            Volume {r.volumeM3} m³ · {r.grainName}
          </p>
        )}
        {r.photoVerdict === 'unchecked' && (
          <p className="font-mono text-[11px] text-[#A87F2A]">
            Authenticity check unavailable at audit time — recorded as unchecked, not confirmed genuine.
          </p>
        )}
      </div>
      {r.photoDataUrl && (
        <SafeImage src={r.photoDataUrl} alt="Audited pile" className="w-full rounded-2xl border border-[#3D3226]/10 max-h-80 object-cover" />
      )}
      <div className="bg-white border border-[#3D3226]/10 rounded-2xl divide-y divide-[#3D3226]/10 overflow-hidden">
        {[
          ['Farmer', r.farmerName],
          ['Location', r.location || '—'],
          ['Storage', r.storageName || '—'],
          ['Grain', r.grainName],
        ].map(([label, value]) => (
          <div key={label} className="px-5 py-3 flex items-start justify-between gap-4">
            <span className="text-xs font-mono uppercase tracking-wider text-[#2B2016]/55 shrink-0 pt-0.5">{label}</span>
            <span className="text-sm text-[#2A2118] text-right">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
