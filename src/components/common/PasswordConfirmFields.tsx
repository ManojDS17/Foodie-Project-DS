import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { PasswordRequirements } from './InputField';

export interface PasswordConfirmFieldsProps {
  password: string;
  confirmPassword: string;
  showPassword: boolean;
  showConfirmPassword: boolean;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onToggleShowPassword: () => void;
  onToggleShowConfirmPassword: () => void;
  requirementsClassName?: string;
}

export const PasswordConfirmFields: React.FC<PasswordConfirmFieldsProps> = ({
  password,
  confirmPassword,
  showPassword,
  showConfirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  onToggleShowPassword,
  onToggleShowConfirmPassword,
  requirementsClassName = '',
}) => (
  <>
    <div>
      <label className="block text-xs font-semibold text-foreground mb-1.5">
        Password <span className="text-status-fault-text">*</span>
      </label>
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => onPasswordChange(e.target.value.slice(0, 50))}
          maxLength={50}
          placeholder="At least 12 chars, 1 number, 1 symbol"
          className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs font-medium pr-10"
          required
          minLength={12}
        />
        <button
          type="button"
          onClick={onToggleShowPassword}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-dim hover:text-foreground cursor-pointer"
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>

    <div>
      <label className="block text-xs font-semibold text-foreground mb-1.5">
        Confirm password <span className="text-status-fault-text">*</span>
      </label>
      <div className="relative">
        <input
          type={showConfirmPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => onConfirmPasswordChange(e.target.value.slice(0, 50))}
          maxLength={50}
          placeholder="Re-enter login password"
          className={`w-full px-3.5 py-2.5 rounded-xl border bg-white text-foreground focus:outline-none text-xs font-medium pr-10 ${
            confirmPassword
              ? confirmPassword === password
                ? 'border-emerald-500 focus:border-emerald-500'
                : 'border-primary focus:border-primary'
              : 'border-border-strong focus:border-foreground'
          }`}
          required
          minLength={12}
        />
        <button
          type="button"
          onClick={onToggleShowConfirmPassword}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-dim hover:text-foreground cursor-pointer"
        >
          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>

    <PasswordRequirements
      password={password}
      confirmPassword={confirmPassword}
      className={requirementsClassName}
    />
  </>
);

