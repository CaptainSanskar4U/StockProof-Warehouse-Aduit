import React, { useEffect, useState } from 'react';
import { Verification, Warehouse } from '../types.js';
import { StatusChip } from './StatusChip.js';
import { SafeImage } from './SafeImage.js';
import { formatRecordedAt } from './AuditRecordsTab.js';
import { fetchGovChecksByVerification, postGovCheck } from '../services/api.js';
import { authenticityOf, buildVerifyUrl, govCheckInputFromVerification, isUnverifiedRecord, UNVERIFIED_HEADLINE } from '../lib/verify.js';
import QRCode from 'qrcode';

interface RecordDetailModalProps {
  record: Verification;
  warehouse?: Warehouse;
  onClose: () => void;
}

function Row({ k, v, struck }: { k: string; v: string; struck?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-[var(--hairline-soft)]">
      <span className="font-mono text-[11px] text-[var(--ink-faint)] uppercase">{k}</span>
      <span className={`font-mono text-xs text-right ${struck ? 'text-[var(--ink-faint)] line-through' : 'text-[var(--ink)]'}`}>{v}</span>
    </div>
  );
}

export const RecordDetailModal: React.FC<RecordDetailModalProps> = ({ record: a, warehouse, onClose }) => {
  const isGov = (a.agentType || 'bank') === 'government';
  const title = isGov
    ? a.gov?.warehouseRef || warehouse?.code || a.warehouseId
    : a.bank?.farmerName?.trim() || 'Bank audit';
  const location = warehouse
    ? `${warehouse.name} · ${warehouse.district}, ${warehouse.state}`
    : a.bank?.warehouseName || a.gov?.warehouseRef || a.warehouseId;
  const authenticity = authenticityOf(a.photoVerdict);
  const unverified = isUnverifiedRecord({ authenticity });

  // QR for every result: reuse the minted record if present, else mint on demand.
  const [qrId, setQrId] = useState<string | null>(null);
  const [qrImg, setQrImg] = useState<string | null>(null);
  const [qrState, setQrState] = useState<'loading' | 'ready' | 'none' | 'error'>('loading');
  const [qrBusy, setQrBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    setQrId(null);
    setQrImg(null);
    setQrState('loading');
    fetchGovChecksByVerification(a.id)
      .then(async (list) => {
        if (!alive) return;
        if (list && list.length > 0) {
          const id = list[0].id;
          setQrId(id);
          try {
            setQrImg(await QRCode.toDataURL(buildVerifyUrl(id), { width: 220, margin: 1 }));
            setQrState('ready');
          } catch {
            setQrState('error');
          }
        } else {
          setQrState('none');
        }
      })
      .catch(() => {
        if (alive) setQrState('error');
      });
    return () => {
      alive = false;
    };
  }, [a.id]);

  const mintQr = async () => {
    setQrBusy(true);
    try {
      const record = await postGovCheck(govCheckInputFromVerification(a, warehouse));
      setQrId(record.id);
      try {
        setQrImg(await QRCode.toDataURL(buildVerifyUrl(record.id), { width: 220, margin: 1 }));
        setQrState('ready');
      } catch {
        setQrState('error');
      }
    } catch {
      setQrState('error');
    } finally {
      setQrBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto bg-[var(--overlay-soft)]" onClick={onClose}>
      <div className="washi-sheet max-w-xl w-full px-5 sm:px-6 py-5 max-h-[88dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow-quiet">{isGov ? 'Government Audit · record' : 'Bank Checks · record'}</p>
            <h3 className="serif-reading text-2xl text-[var(--ink)] mt-1 leading-snug">{title}</h3>
            <p className="font-mono text-[11px] text-[var(--ink-faint)] mt-1">
              {!isGov && a.bank?.loanRef ? `Loan / Reference ID: ${a.bank.loanRef} · ` : ''}
              {isGov && a.gov?.scheme ? `${a.gov.scheme} · ` : ''}
              Recorded: {formatRecordedAt(a.timestamp)}
            </p>
          </div>
          <StatusChip status={a.status} />
        </div>

        <p className="text-sm text-[var(--ink-soft)] mt-2">Warehouse location: {location}</p>

        {unverified && (
          <div className="mt-3 rounded-[10px] border border-[var(--danger-line)] bg-[var(--danger-bg)] px-4 py-3">
            <p className="text-sm font-bold text-[var(--danger-ink)] leading-snug">{UNVERIFIED_HEADLINE}</p>
            <p className="font-mono text-[11px] text-[var(--danger-ink)] mt-1">untrusted estimate — not evidence</p>
          </div>
        )}
        {authenticity === 'unchecked' && (
          <div className="mt-3 rounded-[10px] border border-[var(--warn-line)] bg-[var(--warn-bg)] px-4 py-3">
            <p className="text-sm text-[var(--warn-ink)]">Authenticity check unavailable — photo not confirmed genuine, verdict shown as measured.</p>
          </div>
        )}

        <div className="mt-4">
          <p className="eyebrow-quiet">Verification QR · points at the stored record</p>
          {qrState === 'loading' && <p className="text-sm text-[var(--ink-soft)] mt-2">Looking up the QR record…</p>}
          {qrState === 'ready' && qrId && qrImg && (
            <div className="flex items-center gap-4 mt-2">
              <img src={qrImg} alt={`Verify ${qrId}`} className="w-[110px] h-[110px] rounded-[8px] border border-[var(--hairline)] bg-white shrink-0" />
              <div className="min-w-0">
                <p className="font-mono text-xs text-[var(--ink)]">{qrId}</p>
                <p className="font-mono text-[11px] text-[var(--ink-faint)] mt-1 break-all">{buildVerifyUrl(qrId)}</p>
              </div>
            </div>
          )}
          {qrState === 'none' && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="text-sm text-[var(--ink-soft)]">No QR record yet for this reading.</p>
              <button type="button" onClick={mintQr} disabled={qrBusy} className="touch-target px-4 py-2 text-xs bg-[var(--ink)] text-[var(--ink-inverse)] rounded-full cursor-pointer disabled:opacity-50">
                {qrBusy ? 'Minting…' : 'Mint QR record'}
              </button>
            </div>
          )}
          {qrState === 'error' && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="text-sm text-[var(--danger-ink)]">QR unavailable — retry when connected. No dead QR is shown.</p>
              <button type="button" onClick={mintQr} disabled={qrBusy} className="touch-target px-4 py-2 text-xs bg-[var(--ink)] text-[var(--ink-inverse)] rounded-full cursor-pointer disabled:opacity-50">
                {qrBusy ? 'Retrying…' : 'Retry'}
              </button>
            </div>
          )}
        </div>

        {a.photoUrl && (
          <div className="mt-4 rounded-[10px] overflow-hidden border border-[var(--hairline)] bg-[var(--matte)]">
            <SafeImage src={a.photoUrl} alt="Recorded evidence photo" className="w-full max-h-64 object-contain" />
          </div>
        )}

        <div className="mt-4">
          <p className="eyebrow-quiet">Recorded reading / measurement</p>
          <div className="mt-1">
            <Row k="Declared" v={`${a.declaredAtTimeOfRun.toFixed(1)} T`} />
            <Row k="Estimated" v={unverified ? `${a.estimate.centralTonnes.toFixed(1)} T · untrusted estimate — not evidence` : `${a.estimate.centralTonnes.toFixed(1)} T`} struck={unverified} />
            <Row k="Range" v={unverified ? `${a.estimate.rangeLow.toFixed(1)} – ${a.estimate.rangeHigh.toFixed(1)} T · untrusted estimate — not evidence` : `${a.estimate.rangeLow.toFixed(1)} – ${a.estimate.rangeHigh.toFixed(1)} T`} struck={unverified} />
            <Row k="Discrepancy" v={`${a.discrepancyTonnes.toFixed(1)} T`} />
            <Row k="Confidence" v={`${a.estimate.confidencePercent}%`} />
            <Row k="Volume" v={`${a.estimate.volumeM3.toFixed(1)} m³`} />
            <Row k="Density" v={`${a.estimate.effectiveDensity.toFixed(3)} t/m³`} />
            <Row k="Grain" v={a.context.grainType} />
            <Row k="Pile" v={`h ${a.geometry.heightMeters.toFixed(1)} m, base ${a.geometry.baseDiameterMeters.toFixed(1)} m`} />
            <Row k="Moisture" v={`${a.context.humidityPercent.toFixed(1)}%`} />
            <Row k="Compaction" v={a.context.compaction} />
            <Row k="Stored" v={`${a.context.storageDays} days`} />
            <Row k="Authenticity" v={authenticity} />
            <Row k="AI primary" v={a.photoVerdict?.primary ? `${a.photoVerdict.primary.label} (AI ${a.photoVerdict.primary.probability_ai.toFixed(3)})` : 'not recorded'} />
            <Row k="AI cross-check" v={a.photoVerdict?.cross ? `${a.photoVerdict.cross.label} (AI ${a.photoVerdict.cross.probability_ai.toFixed(3)})` : 'not recorded'} />
            <Row k="Auditor" v={`${a.runBy.name} (${a.runBy.role})`} />
            <Row k="Record ID" v={a.id} />
          </div>
        </div>

        <p className="text-xs text-[var(--ink-soft)] leading-relaxed mt-4">{a.explanatoryReason}</p>
        <p className="text-xs text-[var(--ink-soft)] leading-relaxed mt-2">{a.auditRecommendation}</p>

        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="touch-target px-5 py-2 bg-[var(--card-ink-bg)] text-[var(--paper)] text-xs rounded-full cursor-pointer">Close</button>
        </div>
      </div>
    </div>
  );
};

