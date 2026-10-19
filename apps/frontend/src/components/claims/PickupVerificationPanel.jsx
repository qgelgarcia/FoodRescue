import React, { useCallback, useState } from 'react';
import { Camera, CheckCircle2, KeyRound, ShieldCheck } from 'lucide-react';
import PickupScanner from './PickupScanner';

const MANUAL_CODE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function PickupVerificationPanel({ onVerify, busy = false, locked = false, blocked = false }) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [candidate, setCandidate] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const acceptQrCandidate = useCallback((token) => {
    setScannerOpen(false);
    setError('');
    setNotice('');
    setCandidate({ value: token, source: 'qr' });
  }, []);

  function reviewManualCode(event) {
    event.preventDefault();
    const value = manualCode.trim();
    setError('');
    setNotice('');
    if (!MANUAL_CODE_PATTERN.test(value)) {
      setError('Enter the printed pickup code using letters, numbers, or hyphens.');
      return;
    }
    setCandidate({ value, source: 'manual' });
  }

  async function confirmPickup() {
    if (!candidate || busy || locked || blocked) return;
    setError('');
    setNotice('');
    const succeeded = await onVerify(candidate.value);
    if (!succeeded) return;
    setCandidate(null);
    setManualCode('');
    setNotice('Pickup confirmed. The claim is recorded as picked up.');
  }

  return (
    <section className="rounded-3xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="pickup-verification-title">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-[#0c6b20]"><ShieldCheck size={20} /></span>
        <div className="min-w-0 flex-1">
          <h2 id="pickup-verification-title" className="font-['Space_Grotesk'] text-lg font-bold text-[#182019]">Verify a pickup</h2>
          <p className="mt-1 text-xs leading-relaxed text-[#536054]">Scan a claimant’s QR token or enter the pickup code printed beside it. The server confirms the full claim quantity and checks that the pickup is still valid.</p>
        </div>
      </div>

      {blocked && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-950">The pickup was confirmed. Refresh the donor request list before verifying another pickup.</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || locked || blocked}
          onClick={() => { setError(''); setNotice(''); setCandidate(null); setScannerOpen((open) => !open); }}
          className="inline-flex items-center gap-2 rounded-xl bg-[#2c8a38] px-3.5 py-2.5 text-xs font-bold text-white hover:bg-[#23702d] disabled:cursor-not-allowed disabled:opacity-55"
        >
          <Camera size={15} /> {scannerOpen ? 'Close scanner' : 'Scan QR code'}
        </button>
      </div>

      {scannerOpen && <PickupScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onCandidate={acceptQrCandidate} />}

      <form onSubmit={reviewManualCode} className="mt-4 border-t border-[#e6ece2] pt-4">
        <label htmlFor="pickup-manual-code" className="mb-1.5 block text-xs font-bold text-[#182019]">Manual pickup code</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <KeyRound size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#687066]" />
            <input
              id="pickup-manual-code"
              type="text"
              inputMode="text"
              autoComplete="off"
              maxLength={64}
              value={manualCode}
              onChange={(event) => { setManualCode(event.target.value); setCandidate(null); setError(''); }}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              disabled={busy || locked || blocked}
              className="w-full rounded-xl border border-[#cbd8c5] bg-white py-2.5 pl-9 pr-3 font-mono text-sm uppercase tracking-wide text-[#182019] placeholder:normal-case placeholder:tracking-normal placeholder:text-[#828b80] focus:border-[#2c8a38] focus:outline-none focus:ring-2 focus:ring-[#2c8a38]/15 disabled:bg-[#f1f4ef]"
            />
          </div>
          <button type="submit" disabled={busy || locked || blocked || !manualCode.trim()} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#cbd8c5] bg-white px-3.5 py-2.5 text-xs font-bold text-[#354438] hover:bg-[#f5faee] disabled:cursor-not-allowed disabled:opacity-55">
            <CheckCircle2 size={14} /> Review code
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-[#687066]">Enter the printed code only, not a link.</p>
      </form>

      {candidate && <div className="mt-4 rounded-2xl border border-[#cbd8c5] bg-[#f8fbf5] p-3.5" role="group" aria-label="Confirm pickup verification">
        <p className="text-sm font-bold text-[#182019]">Confirm this pickup?</p>
        <p className="mt-1 text-xs leading-relaxed text-[#536054]">
          {candidate.source === 'qr' ? 'A pickup token was read from the QR code.' : 'The entered manual code is ready to verify.'}
          {' '}Confirming records the entire claim quantity as picked up.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy || locked || blocked} onClick={confirmPickup} className="rounded-xl bg-[#2c8a38] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#23702d] disabled:opacity-55">{busy ? 'Verifying…' : 'Confirm pickup'}</button>
          <button type="button" disabled={busy} onClick={() => setCandidate(null)} className="rounded-xl border border-[#cbd8c5] bg-white px-3.5 py-2 text-xs font-bold text-[#354438] hover:bg-[#f5faee] disabled:opacity-55">Cancel</button>
        </div>
      </div>}

      {error && <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900" role="alert">{error}</p>}
      {notice && <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-900" role="status">{notice}</p>}
    </section>
  );
}
