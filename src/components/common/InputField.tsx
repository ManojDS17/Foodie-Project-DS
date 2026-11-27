import React from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { getPasswordChecks } from '../../services/api';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  error,
  helperText,
  required = false,
  id,
  className = '',
  ...props
}) => {
  const inputId = id || `input-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-xs font-bold text-foreground flex items-center justify-between">
        <span>
          {label} {required && <span className="text-primary">*</span>}
        </span>
      </label>

      <input
        id={inputId}
        className={`w-full px-3.5 py-2.5 text-xs bg-surface-card border rounded-lg transition-colors outline-none font-medium placeholder:text-foreground-subtle ${
          error
            ? 'border-primary focus:ring-1 focus:ring-primary bg-primary-light/20'
            : 'border-border-subtle focus:border-foreground focus:ring-1 focus:ring-foreground'
        } ${className}`}
        {...props}
      />

      {error ? (
        <span className="text-[11px] font-semibold text-primary flex items-center gap-1 mt-0.5 animate-fadeIn">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {error}
        </span>
      ) : helperText ? (
        <span className="text-[11px] text-foreground-muted mt-0.5">{helperText}</span>
      ) : null}
    </div>
  );
};

export interface PasswordRequirementsProps {
  password: string;
  confirmPassword?: string;
  showMatchRule?: boolean;
  className?: string;
}

export const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({
  password,
  confirmPassword = '',
  showMatchRule = true,
  className = '',
}) => {
  const {
    hasMinLength,
    hasMaxLength,
    hasNumber,
    hasSymbol,
    passwordsMatch,
  } = getPasswordChecks(password, confirmPassword);

  const lengthMet = hasMinLength && hasMaxLength;

  return (
    <div
      className={`p-3 rounded-xl bg-surface-subtle border border-border-default space-y-1.5 text-[11px] ${className}`}
    >
      <p className="font-bold text-foreground-body text-[11px] uppercase tracking-wider mb-1">
        Password security requirements
      </p>

      <div className="flex items-center gap-2">
        <span
          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${
            lengthMet ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'
          }`}
        >
          <Check className="w-2.5 h-2.5" />
        </span>
        <span className={lengthMet ? 'text-emerald-700 font-semibold' : 'text-foreground-muted'}>
          {!hasMaxLength
            ? 'Maximum 50 characters allowed'
            : 'Minimum 12 characters required (up to 50)'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${
            hasNumber ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'
          }`}
        >
          <Check className="w-2.5 h-2.5" />
        </span>
        <span className={hasNumber ? 'text-emerald-700 font-semibold' : 'text-foreground-muted'}>
          At least one number (0-9)
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${
            hasSymbol ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'
          }`}
        >
          <Check className="w-2.5 h-2.5" />
        </span>
        <span className={hasSymbol ? 'text-emerald-700 font-semibold' : 'text-foreground-muted'}>
          At least one special character (e.g. @ # $ %)
        </span>
      </div>

      {showMatchRule && (
        <div className="flex items-center gap-2">
          <span
            className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${
              passwordsMatch ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'
            }`}
          >
            <Check className="w-2.5 h-2.5" />
          </span>
          <span
            className={passwordsMatch ? 'text-emerald-700 font-semibold' : 'text-foreground-muted'}
          >
            Passwords match
          </span>
        </div>
      )}
    </div>
  );
};
