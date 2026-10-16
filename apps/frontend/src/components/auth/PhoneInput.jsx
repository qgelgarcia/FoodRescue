import React from 'react';
import { PHONE_COUNTRIES, phoneCountry, limitPhone } from '../../lib/account-inputs';

export default function PhoneInput({ value, onChange, countryId, onCountryChange, inputProps, error, disabled }) {
  const country = phoneCountry(countryId);
  return <div className="phone-field">
    <label htmlFor="phone-country">Phone country</label>
    <select id="phone-country" value={countryId} disabled={disabled} autoComplete="tel-country-code"
      onChange={event => { onCountryChange(event.target.value); onChange(''); }}>
      {PHONE_COUNTRIES.map(option => <option key={option.id} value={option.id}>{option.name} ({option.code})</option>)}
    </select>
    <label htmlFor={inputProps.id}>Mobile number (optional)</label>
    <div className="phone-input-wrap"><span aria-hidden="true">{country.code}</span>
      <input {...inputProps} type="tel" inputMode="numeric" autoComplete="tel-national" value={value} disabled={disabled}
        placeholder={country.template} maxLength={country.digits}
        onChange={event => onChange(limitPhone(event.target.value, countryId))}
        onPaste={event => { event.preventDefault(); onChange(limitPhone(event.clipboardData.getData('text'), countryId)); }}
        aria-describedby={inputProps['aria-describedby']} />
    </div>
    {error}
  </div>;
}
