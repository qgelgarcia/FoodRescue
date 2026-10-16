import React, { useState } from 'react';
import { Eye, EyeOff, CheckCheck, X } from 'lucide-react';
import { PASSWORD_REQUIREMENTS } from '../../lib/account-inputs';

export default function PasswordInput({ value, onChange, signup, inputProps, error, disabled }) {
  const [visible, setVisible] = useState(false);
  const requirements = PASSWORD_REQUIREMENTS.map(rule => ({ ...rule, met: rule.regex.test(value) }));
  const score = requirements.filter(rule => rule.met).length;
  const strength = ['Enter a password', 'Weak password', 'Fair password', 'Moderate password', 'Strong password', 'Very strong password'][value ? score : 0];
  return <div className="password-field">
    <label htmlFor={inputProps.id}>Password <span className="req">*</span></label>
    <div className="password-input-wrap">
      <input {...inputProps} type={visible ? 'text' : 'password'} value={value} onChange={onChange}
        required minLength={signup ? 8 : 1} disabled={disabled} placeholder={signup ? 'Create your password' : 'Enter your password'}
        autoComplete={signup ? 'new-password' : 'current-password'}
        aria-describedby={[inputProps['aria-describedby'], signup ? 'password-requirements' : ''].filter(Boolean).join(' ') || undefined} />
      <button type="button" onClick={() => setVisible(previous => !previous)} disabled={disabled}
        aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}>
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
    {error}
    {signup && <div id="password-requirements" className="password-guide">
      <div className="password-strength-bars" aria-hidden="true">{requirements.map((rule, index) => <span key={rule.text} style={{ background: score > index ? ['#d7ebcd', '#b7dca9', '#8bc47c', '#52a95a', '#25823a'][index] : '#e8eee3' }} />)}</div>
      <p className="password-strength-caption"><span>Must contain:</span><span role="status">{strength}</span></p>
      <ul aria-label="Password requirements">{requirements.map(rule => <li key={rule.text} className={rule.met ? 'met' : ''}>
        {rule.met ? <CheckCheck size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
        <span>{rule.text}<span className="sr-only">{rule.met ? ' — Requirement met' : ' — Requirement not met'}</span></span>
      </li>)}</ul>
    </div>}
  </div>;
}
