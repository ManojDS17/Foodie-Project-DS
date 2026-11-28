import React from 'react';
import { Mail } from 'lucide-react';
import { PasswordConfirmFields } from '../common/PasswordConfirmFields';

export interface OperatorPasswordFieldsProps {
  email: string;
  password: string;
  confirmPassword: string;
  showPassword: boolean;
  showConfirmPassword: boolean;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onToggleShowPassword: () => void;
  onToggleShowConfirmPassword: () => void;
}

export const OperatorPasswordFields: React.FC<OperatorPasswordFieldsProps> = ({
  email,
  password,
  confirmPassword,
  showPassword,
  showConfirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  onToggleShowPassword,
  onToggleShowConfirmPassword,
}) => (
  <div className="bg-white rounded-2xl border border-border-default p-6 shadow-2xs">
    <div className="border-b border-surface-hover pb-4 mb-6">
      <h2 className="text-base font-bold text-foreground tracking-tight">
        Security & login credentials
      </h2>
      <p className="text-xs text-foreground-muted mt-0.5">
        Initial password for the operator account. A welcome email with these credentials and direct login access will be dispatched automatically.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <PasswordConfirmFields
        password={password}
        confirmPassword={confirmPassword}
        showPassword={showPassword}
        showConfirmPassword={showConfirmPassword}
        onPasswordChange={onPasswordChange}
        onConfirmPasswordChange={onConfirmPasswordChange}
        onToggleShowPassword={onToggleShowPassword}
        onToggleShowConfirmPassword={onToggleShowConfirmPassword}
        requirementsClassName="md:col-span-2 -mt-1 mb-1"
      />
    </div>

    <div className="mt-5 p-3.5 bg-surface-muted rounded-xl border border-border-default text-xs text-foreground-body flex items-center gap-2">
      <Mail className="w-4 h-4 text-foreground-muted shrink-0" />
      <span>
        Upon submission, an invitation email with credentials and direct login access will be sent to <strong>{email || 'the operator'}</strong>.
      </span>
    </div>
  </div>
);

