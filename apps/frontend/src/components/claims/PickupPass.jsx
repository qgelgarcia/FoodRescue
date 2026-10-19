import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Clock, MapPin, Ticket } from 'lucide-react';

function formatDeadline(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function PickupPass({ claim }) {
  const pass = claim.claim_code;

  if (!pass) {
    return (
      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Your pickup pass is unavailable. Please contact the donor before travelling.
      </div>
    );
  }

  return (
    <section className="mt-4 rounded-2xl border border-emerald-200 bg-[#f4fbf1] p-4" aria-label="Pickup pass">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="mx-auto rounded-xl border border-[#e3e9df] bg-white p-2 sm:mx-0">
          <QRCodeSVG value={String(pass)} size={148} level="M" includeMargin bgColor="#ffffff" fgColor="#182019" />
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-[#0c6b20]">
            <Ticket size={14} /> Show this pass to the donor
          </p>
          <p className="mt-1 text-xs text-[#536054]">The donor scans the QR code to confirm the whole pickup.</p>
          <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-xl border border-emerald-300 bg-white px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#687066]">Manual code</span>
            <code className="break-all font-mono text-sm font-extrabold tracking-wider text-[#182019]">{pass}</code>
          </div>
          {(claim.location || claim.expires_at) && (
            <div className="mt-3 flex flex-col items-center gap-1 text-xs text-[#536054] sm:items-start">
              {claim.location && <span className="inline-flex items-center gap-1.5"><MapPin size={13} className="text-[#2c8a38]" />{claim.location}</span>}
              {claim.expires_at && <span className="inline-flex items-center gap-1.5"><Clock size={13} className="text-[#2c8a38]" />Pickup by {formatDeadline(claim.expires_at)}</span>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
