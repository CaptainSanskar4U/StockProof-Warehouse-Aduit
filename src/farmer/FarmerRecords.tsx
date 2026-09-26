import React, { useEffect, useState } from 'react';
import { Download, Search, ArrowLeft } from 'lucide-react';
import { findRecordByCode, loadRecords, type FarmerRecord } from './farmerStore.js';
import { qrDataUrl, verifyUrl } from './qr.js';

interface FarmerRecordsProps {
  onGoAudit: () => void;
}

const esc = (s: string | number) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const isUnverified = (r: FarmerRecord) => r.photoVerdict === 'ai' || r.photoVerdict === 'inconclusive';

function reportHtml(r: FarmerRecord, qrImg: string | null): string {
  const unverified = isUnverified(r);
  const verdict = unverified
    ? 'UNVERIFIED — image not confirmed genuine, not audit evidence'
    : r.match
      ? 'MATCH — pile looks correct'
      : 'DISCREPANCY — needs a closer look';
  const color = unverified ? '#9C4A42' : r.match ? '#2F7A3D' : '#B23A32';
  const date = new Date(r.createdAt).toLocaleString();
  const url = r.verificationId ? `${window.location.origin}/?verify=${r.verificationId}` : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>StockProof check ${esc(r.code)}</title>
<style>
body{font-family:Georgia,serif;color:#2A2118;max-width:640px;margin:0 auto;padding:32px 24px;}
h1{font-size:26px;margin:0 0 4px;} .sub{color:#6B5F4F;font-size:13px;margin:0 0 20px;}
.card{border:1px solid #ddd;border-radius:12px;padding:16px 18px;margin:12px 0;}
.code{font-family:monospace;font-size:28px;font-weight:bold;letter-spacing:4px;}
.nums{display:flex;gap:16px;} .nums div{flex:1;} .big{font-size:30px;font-weight:bold;}
.big-gray{font-size:30px;font-weight:bold;color:#999;text-decoration:line-through;}
.verdict{border:2px solid ${color};color:${color};border-radius:12px;padding:12px 16px;font-weight:bold;font-size:18px;text-align:center;margin:12px 0;}
.reassure{font-style:italic;text-align:center;color:#3D3226;margin:4px 0 12px;}
img.pile{width:100%;border-radius:12px;margin-top:8px;}
img.qr{width:180px;height:180px;margin-top:8px;}
.label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8A7D68;}
.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dotted #ddd;font-size:14px;}
.note{font-size:12px;color:#6B5F4F;margin-top:16px;}
.qrbox{text-align:center;}
@media print{body{padding:0;}}
</style></head><body>
<h1>🌾 StockProof — Stock Check Report</h1>
<p class="sub">${esc(date)} · Verification code: <span class="code">${esc(r.code)}</span>${r.verificationId ? ` · Server ID: <span class="code" style="font-size:18px">${esc(r.verificationId)}</span>` : ''}</p>
<div class="card"><span class="label">Farmer</span><div class="row"><span>Name</span><strong>${esc(r.farmerName)}</strong></div><div class="row"><span>Storage</span><strong>${esc(r.storageName)}</strong></div><div class="row"><span>Grain</span><strong>${esc(r.grainName)}</strong></div></div>
<div class="card"><span class="label">Result</span><div class="nums"><div><span class="label">Receipt said</span><div class="big">${esc(r.declaredTonnes)} T</div></div><div><span class="label">Pile estimate</span>${unverified ? `<div class="big-gray">${esc(r.estLow)}–${esc(r.estHigh)} T</div><div class="label">untrusted estimate — not evidence</div>` : `<div class="big">${esc(r.estLow)}–${esc(r.estHigh)} T</div>`}</div></div>${unverified ? '' : `<div class="row"><span>Middle of range</span><strong>about ${esc(r.estCentral)} T</strong></div>`}</div>
<div class="verdict">${unverified ? '⚠️ ' : r.match ? '✅ ' : '🚨 '}${esc(verdict)}</div>
${unverified ? '<p class="reassure">This image could not be confirmed as genuine and should not be used as audit evidence.</p>' : r.match ? '' : '<p class="reassure">This does not mean something is wrong. It means someone should check it.</p>'}
${r.photoVerdict === 'unchecked' ? '<p class="reassure">Authenticity check unavailable at audit time — recorded as unchecked, not confirmed genuine.</p>' : ''}
${r.photoDataUrl ? `<img class="pile" src="${r.photoDataUrl}" alt="Grain pile photo">` : ''}
${r.verificationId && qrImg ? `<div class="card qrbox"><span class="label">Scan to verify against the true stored record</span><br><img class="qr" src="${qrImg}" alt="Verification QR code"><div class="label">${esc(url)}</div></div>` : ''}
<p class="note">Analysis runs on-device and offline. Opening the verification link needs internet to reach the server holding the true stored record — an edited report can't fake what the QR points to. A bank or inspector would measure precisely before any decision.</p>
</body></html>`;
}

async function printReport(r: FarmerRecord): Promise<void> {
  const popup = window.open('', '_blank', 'width=720,height=900');
  if (!popup) return;
  let qrImg: string | null = null;
  if (r.verificationId) {
    qrImg = await qrDataUrl(verifyUrl(r.verificationId));
  }
  popup.document.write(reportHtml(r, qrImg));
  popup.document.close();
  popup.focus();
  popup.print();
}

const QrBlock: React.FC<{ verificationId: string | null }> = ({ verificationId }) => {
  const [img, setImg] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setImg(null);
    if (!verificationId) return;
    (async () => {
      const url = await qrDataUrl(verifyUrl(verificationId));
      if (alive) setImg(url);
    })();
    return () => {
      alive = false;
    };
  }, [verificationId]);
  if (!verificationId) {
    return (
      <p className="font-mono text-[11px] text-[#A87F2A] text-center">
        Verification QR pending — reconnect and save again to get it.
      </p>
    );
  }
  return (
    <div className="bg-white border border-[#3D3226]/10 rounded-2xl p-5 text-center space-y-2">
      <p className="text-xs font-mono uppercase tracking-widest text-[#2B2016]/55">Scan to verify</p>
      {img ? (
        <img src={img} alt="Verification QR code" className="mx-auto w-40 h-40 rounded-lg border border-[#3D3226]/15 bg-white p-1" />
      ) : (
        <p className="font-mono text-[11px] text-[#8A7D68]">Preparing QR…</p>
      )}
      <p className="font-mono text-sm font-bold tracking-widest text-[#3D3226] break-all">{verificationId}</p>
      <p className="text-xs text-[#2B2016]/60">Points to the true stored record — an edited report can't fake it.</p>
    </div>
  );
};

const RecordDetail: React.FC<{ record: FarmerRecord; onBack: () => void; lookupMode?: boolean }> = ({
  record: r,
  onBack,
  lookupMode = false,
}) => {
  const unverified = isUnverified(r);
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-mono text-[#2B2016]/60 hover:text-[#3D3226] flex items-center gap-1.5 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{lookupMode ? 'Back to lookup' : 'Back to records'}</span>
      </button>
      <div className="bg-white border border-[#3D3226]/10 rounded-2xl p-6 text-center space-y-1">
        <p className="text-xs font-mono uppercase tracking-widest text-[#2B2016]/55">Verification code</p>
        <p className="font-mono text-3xl font-bold tracking-widest text-[#3D3226]">{r.code}</p>
        <p className="text-xs text-[#2B2016]/55">{new Date(r.createdAt).toLocaleString()}</p>
      </div>
      {r.photoDataUrl && (
        <img src={r.photoDataUrl} alt="Grain pile" className="w-full rounded-2xl border border-[#3D3226]/10 max-h-80 object-cover" />
      )}
      <div className="bg-white border border-[#3D3226]/10 rounded-2xl p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[#2B2016]/55">Receipt said</p>
            <p className="font-instrument-serif text-3xl sm:text-4xl text-[#3D3226]">{r.declaredTonnes} T</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-mono uppercase tracking-widest text-[#2B2016]/55">Pile looked like</p>
            {unverified ? (
              <>
                <p className="font-instrument-serif text-3xl sm:text-4xl text-[#8A7D68]/70 line-through">{r.estLow}–{r.estHigh} T</p>
                <p className="font-mono text-[11px] text-[#8A7D68]">untrusted estimate — not evidence</p>
              </>
            ) : (
              <p className="font-instrument-serif text-3xl sm:text-4xl text-[#3D3226]">{r.estLow}–{r.estHigh} T</p>
            )}
          </div>
        </div>
        <p className="text-sm text-[#2B2016]/60 mt-2">
          {r.grainName} · {unverified ? 'estimate withheld' : `middle of range about ${r.estCentral} T`} · {r.farmerName} · {r.storageName}
        </p>
        {r.photoVerdict === 'unchecked' && (
          <p className="font-mono text-[11px] text-[#A87F2A] mt-2">
            Authenticity check unavailable at audit time — recorded as unchecked, not confirmed genuine.
          </p>
        )}
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
          <p className="text-xl font-bold text-emerald-800">✅ Looks correct.</p>
        </div>
      ) : (
        <div className="bg-red-50 border-2 border-[#B5574F] rounded-2xl px-5 py-4 text-center">
          <p className="text-xl font-bold text-[#B23A32]">🚨 Numbers don't match — this needs a closer look.</p>
          <p className="text-sm text-[#3D3226] mt-2 italic">
            This does not mean something is wrong. It means someone should check it.
          </p>
        </div>
      )}
      <QrBlock verificationId={r.verificationId} />
      <button
        type="button"
        onClick={() => void printReport(r)}
        className="touch-target w-full px-4 py-3.5 rounded-full bg-[#2B2016] text-white font-bold text-base flex items-center justify-center gap-2 cursor-pointer"
      >
        <Download className="w-5 h-5" />
        <span>Download Report</span>
      </button>
    </div>
  );
};

/** Records — summary + trust line, list, detail, report, code lookup. */
export const FarmerRecords: React.FC<FarmerRecordsProps> = ({ onGoAudit }) => {
  const [records, setRecords] = useState<FarmerRecord[]>(() => loadRecords());
  const [selected, setSelected] = useState<FarmerRecord | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [lookup, setLookup] = useState<FarmerRecord | null | undefined>(undefined);

  const refresh = () => {
    setRecords(loadRecords());
    setSelected(null);
  };

  const runLookup = () => {
    if (!codeInput.trim()) return;
    setLookup(findRecordByCode(codeInput));
  };

  if (selected) {
    return <RecordDetail record={selected} onBack={refresh} />;
  }

  if (lookup !== undefined) {
    return lookup ? (
      <RecordDetail record={lookup} lookupMode onBack={() => setLookup(undefined)} />
    ) : (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setLookup(undefined)}
          className="text-sm font-mono text-[#2B2016]/60 hover:text-[#3D3226] flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <div className="bg-white border border-[#3D3226]/10 rounded-2xl p-8 text-center">
          <p className="text-lg text-[#3D3226]">No check found with that code.</p>
          <p className="text-sm text-[#2B2016]/60 mt-1">Check the code and try again — it looks like SP-XXXXX.</p>
        </div>
      </div>
    );
  }

  const matched = records.filter((r) => r.match === true).length;
  const flagged = records.filter((r) => r.match === false).length;
  const unverifiedCount = records.filter((r) => r.match === null).length;
  const last = records[0] ? new Date(records[0].createdAt).toLocaleDateString() : null;
  const trustLine =
    records.length === 0
      ? ''
      : `You've done ${records.length} check${records.length === 1 ? '' : 's'}. ${matched} matched, ${flagged} flagged${unverifiedCount > 0 ? `, ${unverifiedCount} unverified` : ''}.`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-instrument-serif text-3xl text-[#3D3226]">My Records</h1>
        {records.length > 0 && <p className="text-sm text-[#2B2016]/60 mt-1">{trustLine}</p>}
      </div>

      {records.length === 0 ? (
        <div className="bg-white border border-[#3D3226]/10 rounded-2xl p-10 text-center space-y-3">
          <p className="text-4xl">🌾</p>
          <p className="text-base text-[#3D3226]">You haven't checked any stock yet. Go to Audit / Camera to do your first check.</p>
          <button
            type="button"
            onClick={onGoAudit}
            className="touch-target px-6 py-3 rounded-full bg-[#2B2016] text-white font-bold text-base cursor-pointer"
          >
            Do my first check
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Checks', value: String(records.length) },
              { label: '✅ Matched', value: String(matched) },
              { label: '🚨 Flagged', value: String(flagged) },
              { label: '⚠️ Unverified', value: String(unverifiedCount) },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-[#3D3226]/10 rounded-xl px-3 py-3 text-center">
                <p className="font-instrument-serif text-2xl text-[#3D3226]">{s.value}</p>
                <p className="text-[11px] font-mono uppercase tracking-wider text-[#2B2016]/55">{s.label}</p>
              </div>
            ))}
          </div>
          {last && <p className="text-xs text-[#2B2016]/55">Most recent check: {last}</p>}
          <div className="space-y-2">
            {records.map((r) => {
              const unverified = isUnverified(r);
              return (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => setSelected(r)}
                  className="w-full bg-white border border-[#3D3226]/10 rounded-2xl p-3 flex items-center gap-3 text-left cursor-pointer hover:border-[#3D3226]/30 transition-colors"
                >
                  {r.photoDataUrl ? (
                    <img src={r.photoDataUrl} alt="" className="w-16 h-16 rounded-xl object-cover border border-[#3D3226]/10 shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-[#F5F0E8] border border-[#3D3226]/10 shrink-0 flex items-center justify-center text-2xl">
                      🌾
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {unverified ? (
                      <p className="text-sm font-bold text-[#8A7D68]/80">
                        {r.declaredTonnes} T receipt · <span className="line-through">estimate withheld</span>
                      </p>
                    ) : (
                      <p className="text-sm font-bold text-[#2A2118]">
                        {r.declaredTonnes} T receipt · {r.estLow}–{r.estHigh} T pile
                      </p>
                    )}
                    <p className="text-xs text-[#2B2016]/55 truncate">
                      {new Date(r.createdAt).toLocaleString()} · {r.code}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
                      unverified
                        ? 'bg-[#8A7D68]/15 text-[#6B5F4F]'
                        : r.match
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-[#B23A32]'
                    }`}
                  >
                    {unverified ? '⚠️' : r.match ? '✅' : '🚨'}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Code lookup — works for farmer or bank, straight from local records. */}
      <div className="bg-white border border-[#3D3226]/10 rounded-2xl p-5 space-y-3">
        <p className="text-xs font-mono uppercase tracking-widest text-[#B98A2E]">Check a code</p>
        <p className="text-sm text-[#2B2016]/60">Enter a verification code to see that saved check again.</p>
        <div className="flex gap-2">
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            placeholder="SP-XXXXX"
            className="flex-1 min-w-0 w-0 bg-[#F5F0E8] border border-[#3D3226]/15 rounded-xl px-4 py-3 font-mono text-lg tracking-widest text-[#2A2118] placeholder-[#2B2016]/30 focus:outline-none focus:border-[#B98A2E] uppercase"
            maxLength={8}
          />
          <button
            type="button"
            onClick={runLookup}
            className="touch-target shrink-0 px-5 py-3 rounded-xl bg-[#2B2016] text-white font-bold cursor-pointer flex items-center gap-1.5"
          >
            <Search className="w-4 h-4" />
            <span>Look up</span>
          </button>
        </div>
      </div>
    </div>
  );
};



