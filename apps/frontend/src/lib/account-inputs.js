export const PASSWORD_REQUIREMENTS = [
  { regex: /.{8,}/s, text: 'At least 8 characters' },
  { regex: /[0-9]/, text: 'At least 1 number' },
  { regex: /[a-z]/, text: 'At least 1 lowercase letter' },
  { regex: /[A-Z]/, text: 'At least 1 uppercase letter' },
  { regex: /[^A-Za-z0-9\s]/, text: 'At least 1 special character' },
];

// National mobile numbers, without the country code or leading trunk zero.
export const PHONE_COUNTRIES = [
  { id: 'PH', name: 'Philippines', code: '+63', digits: 10, template: '917 123 4567', pattern: /^9\d{9}$/ },
  { id: 'US', name: 'United States', code: '+1', digits: 10, template: '202 555 0123', pattern: /^[2-9]\d{9}$/ },
  { id: 'CA', name: 'Canada', code: '+1', digits: 10, template: '416 555 0123', pattern: /^[2-9]\d{9}$/ },
  { id: 'GB', name: 'United Kingdom', code: '+44', digits: 10, template: '7700 900123', pattern: /^7\d{9}$/ },
  { id: 'AU', name: 'Australia', code: '+61', digits: 9, template: '412 345 678', pattern: /^4\d{8}$/ },
  { id: 'SG', name: 'Singapore', code: '+65', digits: 8, template: '8123 4567', pattern: /^[89]\d{7}$/ },
  { id: 'TW', name: 'Taiwan', code: '+886', digits: 9, template: '912 345 678', pattern: /^9\d{8}$/ },
];
export function phoneCountry(id) { return PHONE_COUNTRIES.find(country => country.id === id); }
export function limitPhone(value, countryId) {
  const country = phoneCountry(countryId);
  if (!country) return '';
  let digits = value.replace(/\D/g, '');
  if (value.trim().startsWith('+') && digits.startsWith(country.code.slice(1))) digits = digits.slice(country.code.length - 1);
  if (['PH', 'GB', 'AU', 'TW'].includes(countryId)) digits = digits.replace(/^0/, '');
  return digits.slice(0, country.digits);
}
