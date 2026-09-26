/**
 * Verification popup state machine.
 *
 * The critical rule under test: the popup must NEVER claim a record is verified
 * unless it actually reached the server holding the true record.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { VerificationModal } from '../src/components/VerificationModal.js';

const UNVERIFIED_HEADLINE =
  '⚠️ UNVERIFIED — this image could not be confirmed as genuine and should not be used as audit evidence.';

const base = {
  id: 'gc-a8f91klm',
  createdAt: '2026-09-26T14:12:00.000Z',
  inspectorName: 'Ramesh Patel',
  location: 'Nashik, Maharashtra',
  storageName: 'Godown 4',
  declaredTonnes: 500,
  estCentral: 499.5,
  estLow: 487,
  estHigh: 512,
  volumeM3: 640,
  match: true as boolean | null,
  authenticity: 'real' as 'real' | 'ai' | 'inconclusive' | 'unchecked',
  checkerNote: 'Measured with a gauge rod.',
  verificationId: 'ver-1',
  agentType: 'government' as 'government' | 'bank',
  scheme: 'Public Distribution System',
};

let fetchGovCheck: ReturnType<typeof vi.fn<(id: string) => Promise<unknown>>>;

beforeEach(() => {
  fetchGovCheck = vi.fn();
  vi.doMock('../src/services/api.js', () => ({ fetchGovCheck: (id: string) => fetchGovCheck(id) }));
});

async function renderModal(id = base.id) {
  const mod = await import('../src/components/VerificationModal.js');
  return render(<mod.VerificationModal id={id} onClose={() => {}} />);
}

describe('VerificationModal', () => {
  it('shows the true stored record and a provenance banner for a genuine record', async () => {
    fetchGovCheck.mockResolvedValue(base);
    await renderModal();

    await waitFor(() => expect(screen.getByTestId('provenance-banner')).toBeInTheDocument());
    expect(screen.getByText(/✓ Original Record Verified/)).toBeInTheDocument();
    expect(screen.getByText('Ramesh Patel')).toBeInTheDocument();
    expect(screen.getByText('Nashik, Maharashtra')).toBeInTheDocument();
    expect(screen.getByText('500.0 T')).toBeInTheDocument();
    expect(screen.getByText('487.0 – 512.0 T')).toBeInTheDocument();
    expect(screen.getByText('MATCH')).toBeInTheDocument();
    expect(screen.getByText('gc-a8f91klm')).toBeInTheDocument();
  });

  it('UNVERIFIED: ai verdict shows the exact headline and strikes the estimate', async () => {
    fetchGovCheck.mockResolvedValue({ ...base, authenticity: 'ai', match: null });
    await renderModal();

    await waitFor(() => expect(screen.getByTestId('unverified-banner')).toBeInTheDocument());
    expect(screen.getByText(UNVERIFIED_HEADLINE)).toBeInTheDocument();
    expect(screen.getByText('UNVERIFIED')).toBeInTheDocument();
    // numbers must read as untrusted, never as plain evidence
    const est = screen.getByText(/499\.5 T · untrusted estimate — not evidence/);
    expect(est).toHaveClass('line-through');
    expect(est).toHaveClass('text-[var(--ink-faint)]');
    expect(screen.getByText(/487\.0 – 512\.0 T · untrusted estimate — not evidence/)).toHaveClass('line-through');
    // provenance is still true and is NOT merged with authenticity
    expect(screen.getByTestId('provenance-banner')).toBeInTheDocument();
  });

  it('UNVERIFIED: inconclusive verdict behaves identically to ai', async () => {
    fetchGovCheck.mockResolvedValue({ ...base, authenticity: 'inconclusive', match: null });
    await renderModal();
    await waitFor(() => expect(screen.getByText(UNVERIFIED_HEADLINE)).toBeInTheDocument());
  });

  it('unchecked: amber note, normal verdict, explicitly NOT treated as genuine', async () => {
    fetchGovCheck.mockResolvedValue({ ...base, authenticity: 'unchecked', match: true });
    await renderModal();

    await waitFor(() => expect(screen.getByTestId('unchecked-banner')).toBeInTheDocument());
    const banner = within(screen.getByTestId('unchecked-banner'));
    expect(banner.getByText(/Authenticity check unavailable/)).toBeInTheDocument();
    expect(banner.getByText(/not confirmed genuine/i)).toBeInTheDocument();
    // must NOT show the UNVERIFIED headline, and must NOT strike the numbers
    expect(screen.queryByText(UNVERIFIED_HEADLINE)).not.toBeInTheDocument();
    expect(screen.getByText('487.0 – 512.0 T')).toBeInTheDocument();
    expect(screen.queryByText(/confirmed genuine by detectors/i)).not.toBeInTheDocument();
  });

  it('OFFLINE: refuses to claim verification when the server is unreachable', async () => {
    fetchGovCheck.mockRejectedValue(new TypeError('Failed to fetch'));
    await renderModal();

    await waitFor(() => expect(screen.getByTestId('verify-unavailable')).toBeInTheDocument());
    expect(
      screen.getByText(/Verification unavailable — Internet connection required to verify the original record\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/not verified/i)).toBeInTheDocument();
    // the hard guarantee: no "verified" claim anywhere in the offline state
    expect(screen.queryByText(/Original Record Verified/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Original Record Verified/);
  });

  it('OFFLINE: shows no stale or guessed numbers', async () => {
    fetchGovCheck.mockRejectedValue(new Error('Record read failed (503)'));
    await renderModal();
    await waitFor(() => expect(screen.getByTestId('verify-unavailable')).toBeInTheDocument());
    expect(screen.queryByText('Ramesh Patel')).not.toBeInTheDocument();
    expect(screen.queryByText(/487\.0/)).not.toBeInTheDocument();
  });

  it('404 is reported as "no record", never as an internet problem', async () => {
    fetchGovCheck.mockRejectedValue(new Error('Record not found'));
    await renderModal();

    await waitFor(() => expect(screen.getByText('No record found')).toBeInTheDocument());
    expect(screen.queryByTestId('verify-unavailable')).not.toBeInTheDocument();
    expect(screen.getByText(/different problem from being offline/)).toBeInTheDocument();
  });

  it('never renders a phone-number FIELD, even when the record carries one', async () => {
    fetchGovCheck.mockResolvedValue({
      ...base,
      // Defence in depth: the stored shape has no phone field, and the UI has
      // no renderer for one, so an injected field is simply never displayed.
      farmerPhone: '9876543210',
      phone: '+91 98765 43210',
    });
    await renderModal();
    await waitFor(() => expect(screen.getByTestId('provenance-banner')).toBeInTheDocument());
    expect(document.body.textContent).not.toMatch(/(?:\+91[\s-]?)?[6-9]\d{9}/);
  });

  it('KNOWN LIMITATION: free-text fields are rendered verbatim', async () => {
    // location/inspectorName/storageName are free text and the POST endpoint is
    // unauthenticated, so a crafted body can put arbitrary characters there.
    // The UI does not sanitise them. Documented rather than silently ignored —
    // see the deploy checklist: authenticate POST /api/gov-checks.
    fetchGovCheck.mockResolvedValue({ ...base, location: 'Nashik · 9876543210' });
    await renderModal();
    await waitFor(() => expect(screen.getByTestId('provenance-banner')).toBeInTheDocument());
    expect(screen.getByText(/9876543210/)).toBeInTheDocument();
  });

  it('labels which panel the record came from (works for gov and bank)', async () => {
    fetchGovCheck.mockResolvedValue(base);
    const { unmount } = await renderModal();
    await waitFor(() => expect(screen.getByText('Government audit record')).toBeInTheDocument());
    unmount();

    fetchGovCheck.mockResolvedValue({ ...base, agentType: 'bank', scheme: undefined });
    await renderModal();
    await waitFor(() => expect(screen.getByText('Bank check record')).toBeInTheDocument());
  });
});
