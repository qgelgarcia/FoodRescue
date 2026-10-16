import React, { useState } from 'react';
import { validateAccount } from '../../lib/validation';

export function useAccountFields(values, signup) {
  const [touched, setTouched] = useState({});
  const errors = validateAccount(values, signup);
  function field(name) {
    const visible = touched[name] && errors[name];
    return {
      id: `account-${name}`,
      maxLength: { email: 254, password: 128, confirmPassword: 128, fullName: 80, phone: 24 }[name],
      onBlur: () => setTouched(previous => ({ ...previous, [name]: true })),
      'aria-invalid': Boolean(visible),
      'aria-describedby': visible ? `account-${name}-error` : undefined,
    };
  }
  function message(name) {
    return touched[name] && errors[name] ? <small className="field-error" id={`account-${name}-error`} role="status">{errors[name]}</small> : null;
  }
  return { field, message, valid: Object.keys(errors).length === 0 };
}
