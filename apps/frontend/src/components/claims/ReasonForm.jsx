import React from 'react';

export default function ReasonForm({
  id,
  value,
  onChange,
  onSubmit,
  onCancel,
  busy = false,
  locked = false,
  minLength = 0,
  submitLabel = 'Submit',
  cancelLabel = 'Close form',
  helpText,
}) {
  const length = value.trim().length;

  return (
    <form className="mt-3 space-y-2.5" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <label htmlFor={id} className="block text-xs font-bold text-[#182019]">
        {minLength > 0 ? 'Explain your request' : 'Add a note (optional)'}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={2000}
        minLength={minLength || undefined}
        required={minLength > 0}
        rows={3}
        placeholder={helpText || (minLength > 0 ? 'Tell the donor why you need to cancel this claim.' : 'Share context with the claimant, if helpful.')}
        className="w-full rounded-xl border border-[#cbd8c5] bg-white px-3 py-2 text-sm text-[#182019] placeholder:text-[#687066] focus:border-[#2c8a38] focus:outline-none focus:ring-2 focus:ring-[#2c8a38]/15"
      />
      <div className="flex items-center justify-between gap-3 text-[11px] text-[#687066]">
        <span>{minLength > 0 ? '10–2,000 characters.' : 'Up to 2,000 characters.'}</span>
        <span>{length}/2,000</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy || locked || length < minLength}
          className="rounded-xl bg-[#2c8a38] px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#23702d] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {busy ? 'Saving…' : submitLabel}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-xl border border-[#cbd8c5] bg-white px-3.5 py-2 text-xs font-bold text-[#354438] hover:bg-[#f5faee] disabled:opacity-55"
        >
          {cancelLabel}
        </button>
      </div>
    </form>
  );
}
