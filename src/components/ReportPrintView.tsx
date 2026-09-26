import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { GovCheck, Verification, Warehouse } from '../types.js';
import { fetchGovChecksByVerification, fetchVerifications, fetchWarehouses, postGovCheck } from '../services/api.js';
import {
  authenticityNote,
  buildVerifyUrl,
  govCheckInputFromVerification,
  isUnverifiedRecord,
  reportOrigin,
  UNVERIFIED_HEADLINE,
} from '../lib/verify.js';

/**
 * Official inspection report.
 *
 * SINGLE SOURCE OF TRUTH: every measured figure below (declared, estimate,
 * range, volume, verdict, authenticity, photo) is read from the server-stored
 * GovCheck record — the exact record the QR code resolves to. A saved
 * Verification supplies descriptive context only (grain, geometry, refs);
 * where the two overlap, the GovCheck always wins. The printed page and the
 * scanned popup therefore cannot disagree.
 */

const INK = '#1a1a1a';
const INK_SOFT = '#555';
const RULE = '#8c8c8c';
const HAIRLINE = '#c4c4c4';
const ACCENT = '#8a6a1f';
const DANGER = '#a11414';
const SUCCESS = '#2c5c3a';

type Phase = 'loading' | 'ready' | 'unavailable' | 'missing';

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

interface ReportPrintViewProps {
  verificationId: string;
  onExit: () => void;
}

export const ReportPrintView: React.FC<ReportPrintViewProps> = ({ verificationId, onExit }) => {
  const [phase, setPhase] = useState<Phase>('loading');
  const [record, setRecord] = useState<GovCheck | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [errorNote, setErrorNote] = useState<string>('');

  const load = useCallback(async () => {
    setPhase('loading');
    setErrorNote('');
    try {
      const [verifications, warehouses] = await Promise.all([
        fetchVerifications(),
        fetchWarehouses().catch(() => [] as Warehouse[]),
      ]);
      const v = verifications.find((x) => x.id === verificationId) || null;
      setVerification(v);
      setWarehouse(v ? warehouses.find((w) => w.id === v.warehouseId) || null : null);

      // The stored QR record is the evidentiary source. Reuse it if it exists.
      let rec: GovCheck | null = null;
      const existing = await fetchGovChecksByVerification(verificationId).catch(() => [] as GovCheck[]);
      if (existing && existing.length > 0) {
        rec = existing[0];
      } else if (v) {
        // No record minted yet (report opened straight from the list).
        // Mint one now so the printed QR is never dead.
        rec = await postGovCheck(govCheckInputFromVerification(v, warehouses.find((w) => w.id === v.warehouseId)));
      }

      if (!rec) {
        setPhase('missing');
        setErrorNote('No audit reading found for this report, and no verification record could be created.');
        return;
      }

      setRecord(rec);
      // Print robustness: higher resolution, wider quiet zone and the highest
      // error-correction level, because this code is printed on paper and then
      // scanned by a phone camera.
      const img = await QRCode.toDataURL(buildVerifyUrl(rec.id), {
        width: 360,
        margin: 2,
        errorCorrectionLevel: 'H',
      });
      setQrDataUrl(img);
      setPhase('ready');
    } catch (err) {
      setPhase('unavailable');
      setErrorNote(err instanceof Error ? err.message : 'Could not reach the record server.');
    }
  }, [verificationId]);

  useEffect(() => {
    load();
  }, [load]);

  // Open the print dialog only once the document is fully rendered, otherwise
  // the photo and QR would be missing from the printed page.
  useEffect(() => {
    if (phase !== 'ready') return;
    const t = setTimeout(() => window.print(), 350);
    return () => clearTimeout(t);
  }, [phase]);

  // Back to the panel once the dialog closes, so a refresh never re-prints.
  useEffect(() => {
    const after = () => onExit();
    window.addEventListener('afterprint', after);
    return () => window.removeEventListener('afterprint', after);
  }, [onExit]);

  const isGov = (record?.agentType || verification?.agentType || 'bank') === 'government';
  const unverified = record ? isUnverifiedRecord(record) : false;
  const verdictWord = !record ? '' : record.match === null ? 'UNVERIFIED' : record.match ? 'MATCH' : 'MISMATCH';

  const docTitle = isGov ? 'Public Stock Audit Report' : 'Collateral Stock Verification Report';
  const formRef = isGov ? 'FORM-GC-114 · PUBLIC STOCK AUDIT' : 'FORM-702-AGRI · COLLATERAL VERIFICATION';
  const refNumber = isGov
    ? verification?.gov?.warehouseRef || record?.storageName || warehouse?.code || '—'
    : verification?.bank?.loanRef || warehouse?.loanReference || '—';
  const subjectName = isGov
    ? record?.inspectorName || verification?.gov?.warehouseRef || warehouse?.name || '—'
    : verification?.bank?.farmerName?.trim() || record?.inspectorName || warehouse?.borrowerName || '—';

  const ctx = verification?.context;
  const geo = verification?.geometry;

  return (
    <>
      {/* Screen-only controls */}
      <div className="no-print" style={{ padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onExit}
          style={{ padding: '8px 16px', background: '#2A2118', color: '#F6F1E7', border: 0, borderRadius: 999, fontSize: 13, cursor: 'pointer' }}
        >
          ← Back to panel
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          style={{ padding: '8px 16px', background: '#8a6a1f', color: '#fff', border: 0, borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          Print / Save as PDF
        </button>
        <span style={{ fontSize: 12, color: INK_SOFT }}>
          In the print dialog choose <strong>Destination: Save as PDF</strong> for a PDF file.
        </span>
      </div>

      <div className="print-doc" style={{ background: '#fff', color: INK, fontFamily: 'Georgia, "Times New Roman", serif', padding: '10px 12px 24px', maxWidth: 900, margin: '0 auto' }}>
        {phase !== 'ready' && (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <h1 style={{ fontSize: 20, margin: '0 0 10px' }}>
              {phase === 'loading' ? 'Preparing report…' : 'Report unavailable'}
            </h1>
            <p style={{ fontSize: 13, color: INK_SOFT, margin: 0 }}>
              {phase === 'loading'
                ? 'Reading the stored audit record.'
                : phase === 'unavailable'
                  ? `⚠ Verification unavailable — internet connection required to produce a report from the true stored record. (${errorNote})`
                  : errorNote}
            </p>
          </div>
        )}

        {phase === 'ready' && record && (
          <article>
            {/* ---------------- Masthead ---------------- */}
            <header style={{ borderBottom: `2pt solid ${INK}`, paddingBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div>
                  <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 9, letterSpacing: 2.4, color: ACCENT, textTransform: 'uppercase', fontWeight: 700 }}>
                    StockProof · Warehouse Audit &amp; Risk Compliance
                  </div>
                  <h1 style={{ fontSize: 21, margin: '4px 0 2px', lineHeight: 1.15 }}>{docTitle}</h1>
                  <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 10, color: INK_SOFT }}>
                    {formRef}
                  </div>
                </div>
                <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 10, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <div><span style={{ color: INK_SOFT }}>Report ID</span><br /><strong style={{ fontSize: 12 }}>{record.id}</strong></div>
                  <div style={{ marginTop: 4 }}><span style={{ color: INK_SOFT }}>Issued</span> {fmtDate(record.createdAt)}</div>
                </div>
              </div>
            </header>

            {/* ---------------- UNVERIFIED warning ----------------
                Border + bold + caps, not a colour fill, so the warning survives
                printing even when background graphics are disabled. */}
            {unverified && (
              <div
                className="print-keep"
                style={{ border: `2pt solid ${DANGER}`, padding: '9px 12px', marginTop: 12 }}
              >
                <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 8.5, letterSpacing: 1.8, color: DANGER, fontWeight: 700, textTransform: 'uppercase' }}>
                  Unverified — not audit evidence
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: DANGER, marginTop: 3, lineHeight: 1.35 }}>
                  {UNVERIFIED_HEADLINE}
                </div>
                <div style={{ fontSize: 11, marginTop: 4, color: INK }}>
                  Estimated quantities in section 2 are an <strong>untrusted estimate — not evidence</strong> and must not be used for compliance or payment decisions.
                </div>
              </div>
            )}

            {record.authenticity === 'unchecked' && (
              <div className="print-keep" style={{ border: `1pt solid ${INK}`, padding: '8px 12px', marginTop: 12 }}>
                <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 8.5, letterSpacing: 1.8, fontWeight: 700, textTransform: 'uppercase' }}>
                  Authenticity check unavailable
                </div>
                <div style={{ fontSize: 11.5, marginTop: 3 }}>
                  The image detectors did not report for this capture, so the photograph is <strong>not confirmed genuine</strong>. The verdict below is shown as measured.
                </div>
              </div>
            )}

            {/* ---------------- 1. Particulars ---------------- */}
            <Section n="1" title="Particulars of inspection">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                <tbody>
                  <TR k="Inspected on" v={fmtDateTime(record.createdAt)} />
                  <TR k={isGov ? 'Issuing authority ref' : 'Loan / reference ID'} v={refNumber} />
                  <TR k={isGov ? 'Warehouse / centre' : 'Person inspected'} v={subjectName} />
                  <TR k="Storage location" v={record.storageName || warehouse?.name || '—'} />
                  <TR k="District / state" v={record.location} />
                  {record.scheme && <TR k="Scheme" v={record.scheme} />}
                  <TR k="Inspecting officer" v={`${record.inspectorName}${verification ? ` (${verification.runBy.role})` : ''}`} />
                  {record.verificationId && <TR k="Internal audit reference" v={record.verificationId} />}
                </tbody>
              </table>
            </Section>

            {/* ---------------- 2. Quantity determination ---------------- */}
            <Section n="2" title="Quantity determined">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                <tbody>
                  <TR k="Declared quantity (receipt)" v={`${record.declaredTonnes.toFixed(2)} T`} />
                  {unverified ? (
                    <>
                      <TR k="Estimated quantity" v={`${record.estCentral.toFixed(2)} T  ·  untrusted estimate — not evidence`} strike />
                      <TR k="Defensible range" v={`${record.estLow.toFixed(2)} – ${record.estHigh.toFixed(2)} T  ·  untrusted estimate — not evidence`} strike />
                    </>
                  ) : (
                    <>
                      <TR k="Estimated quantity" v={`${record.estCentral.toFixed(2)} T`} />
                      <TR k="Defensible range" v={`${record.estLow.toFixed(2)} – ${record.estHigh.toFixed(2)} T`} />
                    </>
                  )}
                  <TR k="Difference (declared − estimated)" v={`${(record.declaredTonnes - record.estCentral >= 0 ? '+' : '') + (record.declaredTonnes - record.estCentral).toFixed(2)} T`} />
                  <TR k="Measured volume" v={`${record.volumeM3.toFixed(2)} m³`} />
                  {verification && <TR k="Confidence" v={`${verification.estimate.confidencePercent}%`} />}
                  {verification && <TR k="Effective bulk density" v={`${verification.estimate.effectiveDensity.toFixed(3)} t/m³`} />}
                </tbody>
              </table>
            </Section>

            {/* ---------------- 3. Findings ---------------- */}
            <Section n="3" title="Findings">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                <tbody>
                  <TR
                    k="Verdict"
                    v={verdictWord}
                    vColor={record.match === null ? DANGER : record.match ? SUCCESS : DANGER}
                  />
                  <TR k="Image authenticity" v={`${record.authenticity} — ${authenticityNote(record.authenticity)}`} />
                  {verification && <TR k="Grain" v={String(ctx?.grainType || '—')} />}
                  {verification && <TR k="Season" v={String(ctx?.season || '—')} />}
                  {verification && <TR k="Moisture" v={`${ctx?.humidityPercent?.toFixed(1)}%`} />}
                  {verification && <TR k="Compaction / storage" v={`${ctx?.compaction || '—'} · ${ctx?.storageDays ?? '—'} days`} />}
                  {verification && (
                    <TR
                      k="Pile geometry"
                      v={`${geo?.pileType || 'cone'} · h ${geo?.heightMeters?.toFixed(2)} m · base ${geo?.baseDiameterMeters?.toFixed(2)} m (${(geo?.measurementMethod || '').replace(/_/g, ' ')})`}
                    />
                  )}
                  {verification && <TR k="Capture medium" v={verification.mediaType === 'video-frame' ? 'Video frame' : 'Still photograph'} />}
                </tbody>
              </table>
            </Section>

            {/* ---------------- 4. Evidence + QR ---------------- */}
            <Section n="4" title="Evidence &amp; verification">
              <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                  <Label>Photograph on record</Label>
                  {record.photoDataUrl ? (
                    <img
                      src={record.photoDataUrl}
                      alt="Audit evidence photograph"
                      style={{ width: '100%', maxHeight: 250, objectFit: 'contain', border: `0.5pt solid ${RULE}`, marginTop: 4 }}
                    />
                  ) : (
                    <div style={{ border: `0.5pt solid ${HAIRLINE}`, padding: 18, marginTop: 4, fontSize: 10.5, color: INK_SOFT, fontFamily: 'Arial, Helvetica, sans-serif' }}>
                      No photograph was retained for this record.
                    </div>
                  )}
                </div>
                <div style={{ flex: '0 0 168px' }}>
                  <Label>Verification QR</Label>
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt={`Verification QR for ${record.id}`} style={{ width: 168, height: 168, marginTop: 4 }} />
                  ) : (
                    <div style={{ width: 168, height: 168, border: `0.5pt solid ${HAIRLINE}`, marginTop: 4 }} />
                  )}
                  <div style={{ fontFamily: 'Courier New, monospace', fontSize: 8.5, marginTop: 5, wordBreak: 'break-all', lineHeight: 1.35 }}>
                    {buildVerifyUrl(record.id)}
                  </div>
                  <div style={{ fontSize: 9, color: INK_SOFT, marginTop: 3, lineHeight: 1.35 }}>
                    Scans to the true stored record held by the server. This PDF is not the record of truth.
                  </div>
                </div>
              </div>
            </Section>

            {/* ---------------- 5. Observation ---------------- */}
            <Section n="5" title="Observation of the inspecting officer">
              {record.checkerNote && <Para>{record.checkerNote}</Para>}
              {verification?.explanatoryReason && <Para>{verification.explanatoryReason}</Para>}
              {verification?.auditRecommendation && <Para>{verification.auditRecommendation}</Para>}
            </Section>

            {/* ---------------- 6. OFFICIAL STAMP ----------------
                Deliberately empty. No seal, no signature, no digital stamp is
                generated — a physical one is applied to the printed copy. */}
            <Section n="6" title="Official stamp &amp; signature">
              <div
                className="stamp-area print-keep"
                data-testid="stamp-area"
                style={{ border: `1pt dashed ${RULE}`, minHeight: '50mm', padding: 8 }}
              />
              <div style={{ display: 'flex', gap: 22, marginTop: 12, fontSize: 10, fontFamily: 'Arial, Helvetica, sans-serif' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ borderTop: `0.5pt solid ${INK}`, paddingTop: 3 }}>Signature of inspecting officer</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ borderTop: `0.5pt solid ${INK}`, paddingTop: 3 }}>Date</div>
                </div>
              </div>
            </Section>

            {/* ---------------- Footer ---------------- */}
            <footer style={{ borderTop: `1pt solid ${RULE}`, marginTop: 16, paddingTop: 7, fontSize: 9, color: INK_SOFT, fontFamily: 'Arial, Helvetica, sans-serif', lineHeight: 1.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
                <span>Report {record.id} · audit ref {record.verificationId || '—'}</span>
                <span>Issued {fmtDateTime(record.createdAt)}</span>
              </div>
              <div style={{ marginTop: 3 }}>
                This report is issued under the StockProof physical stock verification protocol. The measurement system supports the inspecting officer; it does not replace the physical inspection. Quantities are stated in metric tonnes (T).
              </div>
            </footer>
          </article>
        )}
      </div>
    </>
  );
};

/* ------------------------------------------------------------------ pieces */

const Section: React.FC<{ n: string; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <section className="print-keep" style={{ marginTop: 15 }}>
    <h2
      style={{
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: 9,
        letterSpacing: 1.9,
        textTransform: 'uppercase',
        color: ACCENT,
        fontWeight: 700,
        borderBottom: `0.5pt solid ${HAIRLINE}`,
        paddingBottom: 3,
        margin: '0 0 6px',
      }}
    >
      {n}. {title}
    </h2>
    {children}
  </section>
);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 8.5, letterSpacing: 1.5, textTransform: 'uppercase', color: INK_SOFT }}>
    {children}
  </div>
);

const Para: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ fontSize: 11.5, lineHeight: 1.6, margin: '0 0 7px' }}>{children}</p>
);

const TR: React.FC<{ k: string; v: string; strike?: boolean; vColor?: string }> = ({ k, v, strike, vColor }) => (
  <tr className="print-row">
    <th
      scope="row"
      style={{
        textAlign: 'left',
        fontWeight: 400,
        color: INK_SOFT,
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: 10,
        width: '42%',
        padding: '4px 8px 4px 0',
        borderBottom: `0.5pt solid ${HAIRLINE}`,
        verticalAlign: 'top',
      }}
    >
      {k}
    </th>
    <td
      style={{
        padding: '4px 0',
        borderBottom: `0.5pt solid ${HAIRLINE}`,
        fontSize: 11.5,
        verticalAlign: 'top',
        fontWeight: 600,
        color: vColor || INK,
        textDecoration: strike ? 'line-through' : undefined,
      }}
    >
      {v}
    </td>
  </tr>
);
