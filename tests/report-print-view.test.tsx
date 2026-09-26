/**
 * Official inspection report — print document guarantees.
 *
 * The report is a legal-ish artefact handed to a person after inspection, so
 * these tests are deliberately strict about the three things that could make
 * it dishonest: a fabricated stamp, a trustworthy-looking number on an
 * UNVERIFIED record, or a QR that does not resolve to the true stored record.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';

const UNVERIFIED_HEADLINE =
  '⚠️ UNVERIFIED — this image could not be confirmed as genuine and should not be used as audit evidence.';

const govCheck = {
  id: 'gc-a8f91klm',
  createdAt: '2026-09-26T14:12:00.000Z',
  inspectorName: 'Ramesh Patel',
  location: 'Nashik, Maharashtra',
  storageName: 'Godown 4 - Lasalgaon',
  declaredTonnes: 500,
  estCentral: 499.5,
  estLow: 487,
  estHigh: 512,
  volumeM3: 640,
  match: true as boolean | null,
  authenticity: 'real' as 'real' | 'ai' | 'inconclusive' | 'unchecked',
  checkerNote: 'Pile measured with a gauge rod. Moisture confirmed at 12.4% with a meter.',
  photoDataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
  verificationId: 'ver-1',
  agentType: 'government' as 'government' | 'bank',
  scheme: 'Public Distribution System' as const,
};

const verification = {
  id: 'ver-1',
  warehouseId: 'wh-001',
  timestamp: '2026-09-26T14:10:00.000Z',
  photoUrl: 'https://example.test/pile.jpg',
  declaredAtTimeOfRun: 500,
  discrepancyTonnes: 0.5,
  status: 'consistent' as const,
  explanatoryReason: 'Declared receipt falls inside the measured range.',
  auditRecommendation: 'No further action required.',
  runBy: { id: 'i1', name: 'Ramesh Patel', role: 'field_inspector' },
  agentType: 'government' as const,
  gov: { warehouseRef: 'WH-NAS-04', region: 'Nashik', scheme: 'Public Distribution System' as const },
  geometry: {
    pileType: 'cone' as const, heightMeters: 4.2, baseDiameterMeters: 14,
    calculatedVolumeM3: 640, measurementMethod: 'manual_gauge' as const,
  },
  context: {
    grainType: 'wheat' as const, season: 'rabi' as const,
    humidityPercent: 12.4, compaction: 'medium' as const, storageDays: 45,
  },
  estimate: {
    centralTonnes: 499.5, rangeLow: 487, rangeHigh: 512,
    confidencePercent: 88, effectiveDensity: 0.781, volumeM3: 640,
  },
};

let fetchVerifications: ReturnType<typeof vi.fn<(id?: string) => Promise<any>>>;
let fetchWarehouses: ReturnType<typeof vi.fn<() => Promise<any[]>>>;
let fetchGovChecks: ReturnType<typeof vi.fn<(id: string) => Promise<any[]>>>;
let postGovCheck: ReturnType<typeof vi.fn<(i: any) => Promise<any>>>;
let toDataURL: ReturnType<typeof vi.fn<(t: string, o?: any) => Promise<string>>>;

beforeEach(() => {
  fetchVerifications = vi.fn(async () => [verification]);
  fetchWarehouses = vi.fn(async () => [
    { id: 'wh-001', name: 'Central Godown', code: 'WH-NAS-01', district: 'Nashik', state: 'Maharashtra', loanReference: 'LN-99' },
  ]);
  fetchGovChecks = vi.fn(async () => [govCheck]);
  postGovCheck = vi.fn(async () => govCheck);
  toDataURL = vi.fn(async () => 'data:image/png;base64,QRSTUB');

  vi.doMock('../src/services/api.js', () => ({
    fetchVerifications: (id?: string) => fetchVerifications(id),
    fetchWarehouses: () => fetchWarehouses(),
    fetchGovChecksByVerification: (id: string) => fetchGovChecks(id),
    postGovCheck: (i: any) => postGovCheck(i),
  }));
  vi.doMock('qrcode', () => ({ default: { toDataURL: (t: string, o?: any) => toDataURL(t, o) } }));
  // Keep the print dialog out of the test run.
  window.print = vi.fn() as any;
});

async function renderReport() {
  const mod = await import('../src/components/ReportPrintView.js');
  return render(<mod.ReportPrintView verificationId="ver-1" onExit={() => {}} />);
}

describe('ReportPrintView', () => {
  it('renders an official document with the required particulars', async () => {
    await renderReport();
    await waitFor(() => expect(screen.getByText(/Particulars of inspection/)).toBeInTheDocument());

    expect(screen.getByText('Public Stock Audit Report')).toBeInTheDocument();
    expect(screen.getByText('Ramesh Patel')).toBeInTheDocument();
    expect(screen.getByText('Godown 4 - Lasalgaon')).toBeInTheDocument();
    expect(screen.getByText('Nashik, Maharashtra')).toBeInTheDocument();
    expect(screen.getByText('Public Distribution System')).toBeInTheDocument();
    expect(screen.getByText('WH-NAS-04')).toBeInTheDocument();   // issuing authority ref
    expect(screen.getByText('gc-a8f91klm')).toBeInTheDocument(); // report id
    expect(screen.getByText('500.00 T')).toBeInTheDocument();
    expect(screen.getByText('487.00 – 512.00 T')).toBeInTheDocument();
    expect(screen.getByText('640.00 m³')).toBeInTheDocument();
    expect(screen.getByText('MATCH')).toBeInTheDocument();
    expect(screen.getAllByAltText(/Verification QR for gc-a8f91klm/).length).toBeGreaterThan(0);
    expect(screen.getAllByAltText('Audit evidence photograph').length).toBeGreaterThan(0);
  });

  it('OFFICIAL STAMP: the area exists, is large enough, and is EMPTY', async () => {
    await renderReport();
    await waitFor(() => expect(screen.getByTestId('stamp-area')).toBeInTheDocument());

    const stamp = screen.getByTestId('stamp-area');
    // Present and labelled
    expect(screen.getByText(/Official stamp & signature/i)).toBeInTheDocument();
    // Large enough to be usable after printing: 50mm of clear space.
    expect(stamp.style.minHeight).toBe('50mm');
    // Strictly empty: no text, no seal, no signature, no image
    expect(stamp.textContent).toBe('');
    expect(stamp.querySelectorAll('img, svg, canvas')).toHaveLength(0);
    // And it must never be split across two printed pages
    expect(stamp.className).toContain('print-keep');
  });

  it('UNVERIFIED: strikes the estimate and prints the exact warning', async () => {
    fetchGovChecks = vi.fn(async () => [{ ...govCheck, authenticity: 'ai', match: null }]);
    await renderReport();
    await waitFor(() => expect(screen.getByText(UNVERIFIED_HEADLINE)).toBeInTheDocument());

    expect(screen.getByText('UNVERIFIED')).toBeInTheDocument();
    const struck = screen.getByText(/487\.00 – 512\.00 T/);
    expect(struck.closest('td')?.style.textDecoration).toContain('line-through');
    expect(screen.getAllByText(/untrusted estimate — not evidence/).length).toBeGreaterThan(0);
    // Warning must not depend on a background fill to be legible in print
    const warn = screen.getByText(UNVERIFIED_HEADLINE).closest('div[style]')?.parentElement;
    expect(warn?.getAttribute('style') || '').toContain('border');
  });

  it('unchecked: states the check was unavailable and never claims genuine', async () => {
    fetchGovChecks = vi.fn(async () => [{ ...govCheck, authenticity: 'unchecked' }]);
    await renderReport();
    await waitFor(() => expect(screen.getAllByText(/Authenticity check unavailable/).length).toBeGreaterThan(0));
    // The banner must say plainly that the photo is not confirmed genuine.
    expect(screen.getByText(/not confirmed genuine/i)).toBeInTheDocument();
    expect(screen.queryByText(UNVERIFIED_HEADLINE)).not.toBeInTheDocument();
    expect(screen.queryByText(/confirmed genuine by detectors/i)).not.toBeInTheDocument();
  });

  it('QR encodes the verify URL, generated with print-grade settings', async () => {
    await renderReport();
    await waitFor(() => expect(toDataURL).toHaveBeenCalled());

    const [payload, opts] = toDataURL.mock.calls[0] as [string, any];
    expect(payload).toMatch(/\?verify=gc-a8f91klm$/);
    // Printed + phone-scanned: needs the strongest error correction and a
    // wider quiet zone than the on-screen QR.
    expect(opts.errorCorrectionLevel).toBe('H');
    expect(opts.margin).toBeGreaterThanOrEqual(2);
    expect(opts.width).toBeGreaterThanOrEqual(300);
  });

  it('honours VITE_REPORT_ORIGIN so a localhost-printed QR still resolves', async () => {
    vi.stubEnv('VITE_REPORT_ORIGIN', 'https://nimbus-plum-omega.vercel.app/');
    await renderReport();
    await waitFor(() => expect(toDataURL).toHaveBeenCalled());
    const payload = toDataURL.mock.calls[0][0] as string;
    expect(payload.startsWith('https://nimbus-plum-omega.vercel.app/?verify=')).toBe(true);
    vi.unstubAllEnvs();
  });

  it('never fabricates a record: mints one only if none exists', async () => {
    fetchGovChecks = vi.fn(async () => []);
    await renderReport();
    await waitFor(() => expect(postGovCheck).toHaveBeenCalled());
    expect(toDataURL).toHaveBeenCalled();
  });

  it('refuses to print a report it could not source from the server', async () => {
    fetchVerifications = vi.fn(async () => { throw new Error('Failed to fetch'); });
    await renderReport();
    await waitFor(() => expect(screen.getByText(/Verification unavailable/)).toBeInTheDocument());
    expect(screen.queryByTestId('stamp-area')).not.toBeInTheDocument();
  });

  it('offers a bank variant of the same document', async () => {
    fetchGovChecks = vi.fn(async () => [{ ...govCheck, agentType: 'bank', scheme: undefined }]);
    await renderReport();
    await waitFor(() => expect(screen.getByText('Collateral Stock Verification Report')).toBeInTheDocument());
  });
});
