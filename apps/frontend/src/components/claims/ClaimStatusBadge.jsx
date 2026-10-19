import React from 'react';

const STATUS_LABELS = {
  pending: 'Awaiting donor',
  accepted: 'Ready for pickup',
  rejected: 'Declined',
  picked_up: 'Picked up',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

const STATUS_STYLES = {
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  accepted: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  rejected: 'border-rose-200 bg-rose-50 text-rose-800',
  picked_up: 'border-[#dce4d7] bg-[#f1f4ef] text-[#536054]',
  cancelled: 'border-[#dce4d7] bg-[#f1f4ef] text-[#536054]',
  expired: 'border-amber-200 bg-amber-50 text-amber-800',
};

export default function ClaimStatusBadge({ status }) {
  const normalizedStatus = status === 'ready_for_pickup' ? 'accepted' : status === 'completed' ? 'picked_up' : status;
  const label = STATUS_LABELS[normalizedStatus] || 'Status update';
  const style = STATUS_STYLES[normalizedStatus] || STATUS_STYLES.picked_up;
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${style}`}>{label}</span>;
}

export { STATUS_LABELS };
