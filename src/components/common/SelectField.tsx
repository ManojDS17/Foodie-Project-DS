import React from 'react';
import { AlertCircle } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Option[];
  error?: string;
  helperText?: string;
  required?: boolean;
}

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  options,
  error,
  helperText,
  required = false,
  id,
  className = '',
  ...props
}) => {
  const selectId = id || `select-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-xs font-bold text-foreground">
        {label} {required && <span className="text-primary">*</span>}
      </label>

      <select
        id={selectId}
        className={`w-full px-3.5 py-2.5 text-xs bg-surface-card border rounded-lg transition-colors outline-none font-medium cursor-pointer ${
          error
            ? 'border-primary focus:ring-1 focus:ring-primary bg-primary-light/20'
            : 'border-border-subtle focus:border-foreground focus:ring-1 focus:ring-foreground'
        } ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

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
