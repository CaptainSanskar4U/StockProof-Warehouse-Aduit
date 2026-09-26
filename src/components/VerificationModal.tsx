import React, { useEffect, useState } from 'react';
import type { GovCheck } from '../types.js';
import { fetchGovCheck } from '../services/api.js';
import { authenticityNote, isUnverifiedRecord, UNVERIFIED_HEADLINE } from '../lib/verify.js';
import { SafeImage } from './SafeImage.js';

/** Public verification opens INSIDE the existing app as a popup — not a separate page. */
const OFFLINE_MESSAGE =
  'Verification unavailable — Internet connection required to verify the original record.';

function Row({ k, v, struck }: { k: string; v: string; struck?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-[var(--hairline-soft)]">
      <span className="font-mono text-[11px] text-[var(--ink-faint)] uppercase">{k}</span>
      <span
        className={`font-mono text-xs text-right ${struck ? 'text-[var(--ink-faint)] line-through' : 'text-[var(--ink)]'}`}
      >
        {v}
      </span>
    </div>
  );
}

interface VerificationModalProps {
  id: string;
  onClose: () => void;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({ id, onClose }) => {
  const [record, setRecord] = useState<GovCheck | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'not-found' | 'unavailable'>('loading');

  useEffect(() => {
    let alive = true;
    setState('loading');
    setRecord(null);
    fetchGovCheck(id)
      .then((r) => {
        if (!alive) return;
        setRecord(r);
        setState('ready');
      })
      .catch((err: unknown) => {
        if (!alive) return;
        const msg = err instanceof Error ? err.message : '';
        // A 404 is "this id does not exist". Anything else (offline, 5xx, DNS)
        // is "we could not reach the server" — never claim either one is verified.
        setState(msg === 'Record not found' ? 'not-found' : 'unavailable');
      });
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const unverified = record ? isUnverifiedRecord(record) : false;
  const isGovernment = record?.agentType === 'government';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--overlay-soft)]"
      onClick={onClose}
    >
      <div
        className="washi-sheet max-w-xl w-full px-5 sm:px-6 py-5 max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Public verification result"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow-quiet">Public verification</p>
            <h3 className="serif-reading text-2xl text-[var(--ink)] mt-1 leading-snug">
              {isGovernment ? 'Government audit record' : 'Bank check record'}
            </h3>
            <p className="font-mono text-[11px] text-[var(--ink-faint)] mt-1 break-all">
              Verification ID · {id}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close verification"
            className="touch-target shrink-0 px-3 py-1.5 text-xs border border-[var(--hairline)] rounded-full hover:border-[var(--hairline-strong)] cursor-pointer"
          >
            ✕
          </button>
        </div>

        {state === 'loading' && (
          <div className="washi-sheet p-8 text-center mt-4">
            <p className="text-sm text-[var(--ink-soft)]">Reading the stored record…</p>
          </div>
        )}

        {state === 'not-found' && (
          <div className="washi-sheet p-6 text-center mt-4">
            <p className="serif-reading text-xl">No record found</p>
            <p className="text-sm text-[var(--ink-soft)] mt-2">
              Nothing is stored under this id. Check the QR and try again.
            </p>
            <p className="font-mono text-[11px] text-[var(--ink-faint)] mt-3">
              This is a different problem from being offline — the server answered, and it has no
              such record.
            </p>
          </div>
        )}

        {state === 'unavailable' && (
          <div
            className="rounded-[12px] border border-[var(--warn-line)] bg-[var(--warn-bg)] px-5 py-4 mt-4"
            data-testid="verify-unavailable"
          >
            <p className="text-base font-bold text-[var(--warn-ink)] leading-snug">
              ⚠ {OFFLINE_MESSAGE}
            </p>
            <p className="text-sm text-[var(--warn-ink)] mt-2 leading-relaxed">
              We did not reach the server holding the true record, so this audit is{' '}
              <strong>not verified</strong>. Nothing is guessed and no stale number is shown.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="touch-target mt-4 px-4 py-2 text-xs bg-[var(--ink)] text-[var(--ink-inverse)] rounded-full cursor-pointer"
            >
              Close
            </button>
          </div>
        )}

        {state === 'ready' && record && (
          <div className="mt-4 space-y-3">
            {/* Provenance: we reached the server and this IS the stored record.
                Deliberately separate from authenticity below — never merged. */}
            <div
              className="rounded-[12px] border border-[var(--success-line)] bg-[var(--success-bg)] px-5 py-3"
              data-testid="provenance-banner"
            >
              <p className="text-sm font-bold text-[var(--success-ink)] leading-snug">
                ✓ Original Record Verified
              </p>
              <p className="text-[11px] font-mono text-[var(--success-ink)] mt-1 leading-relaxed">
                Fetched live from the server holding the true record. Any edited or downloaded report
                that disagrees with this popup does not match the stored audit.
              </p>
            </div>

            {unverified && (
              <div
                className="rounded-[12px] border-2 border-[var(--danger-line)] bg-[var(--danger-bg)] px-5 py-4"
                data-testid="unverified-banner"
              >
                <p className="text-base font-bold text-[var(--danger-ink)] leading-snug">
                  {UNVERIFIED_HEADLINE}
                </p>
              </div>
            )}

            {record.authenticity === 'unchecked' && (
              <div
                className="rounded-[12px] border border-[var(--warn-line)] bg-[var(--warn-bg)] px-5 py-3"
                data-testid="unchecked-banner"
              >
                <p className="text-sm text-[var(--warn-ink)] leading-snug">
                  Authenticity check unavailable — the detectors did not report, so this photo is
                  <strong> not confirmed genuine</strong>. The verdict below is shown as measured.
                </p>
              </div>
            )}

            <div className="washi-sheet px-5 py-4">
              <p className="eyebrow-quiet">Who · where · when</p>
              <div className="mt-1">
                <Row k="Name" v={record.inspectorName} />
                <Row k="Location" v={record.location} />
                {record.storageName ? <Row k="Storage" v={record.storageName} /> : null}
                {record.scheme ? <Row k="Scheme" v={record.scheme} /> : null}
                <Row k="Date" v={new Date(record.createdAt).toLocaleString()} />
                <Row k="Verification ID" v={record.id} />
                {record.verificationId ? <Row k="Audit ref" v={record.verificationId} /> : null}
              </div>
            </div>

            <div className="washi-sheet px-5 py-4">
              <p className="eyebrow-quiet">True stored result</p>
              <div className="mt-1">
                <Row k="Declared" v={`${record.declaredTonnes.toFixed(1)} T`} />
                {unverified ? (
                  <>
                    <Row
                      k="Estimated"
                      v={`${record.estCentral.toFixed(1)} T · untrusted estimate — not evidence`}
                      struck
                    />
                    <Row
                      k="Range"
                      v={`${record.estLow.toFixed(1)} – ${record.estHigh.toFixed(1)} T · untrusted estimate — not evidence`}
                      struck
                    />
                  </>
                ) : (
                  <>
                    <Row k="Estimated" v={`${record.estCentral.toFixed(1)} T`} />
                    <Row k="Range" v={`${record.estLow.toFixed(1)} – ${record.estHigh.toFixed(1)} T`} />
                  </>
                )}
                <Row k="Volume" v={`${record.volumeM3.toFixed(1)} m³`} />
                <Row
                  k="Verdict"
                  v={record.match === null ? 'UNVERIFIED' : record.match ? 'MATCH' : 'MISMATCH'}
                />
                <Row
                  k="Authenticity"
                  v={`${record.authenticity} — ${authenticityNote(record.authenticity)}`}
                />
              </div>
            </div>

            {record.photoDataUrl && (
              <div className="rounded-[10px] overflow-hidden border border-[var(--hairline)] bg-[var(--matte)]">
                <SafeImage
                  src={record.photoDataUrl}
                  alt="Stored evidence photo"
                  className="w-full max-h-80 object-contain"
                />
              </div>
            )}

            {record.checkerNote && (
              <p className="text-xs text-[var(--ink-soft)] leading-relaxed">{record.checkerNote}</p>
            )}

            <p className="font-mono text-[11px] text-[var(--ink-faint)] leading-relaxed border-t border-[var(--hairline)] pt-3">
              The analysis runs on-device and offline — but opening this link needs internet to
              reach the server holding the true record. What you see above is exactly what is
              stored; any edited report claiming otherwise does not match this popup. No phone
              number is ever published here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
