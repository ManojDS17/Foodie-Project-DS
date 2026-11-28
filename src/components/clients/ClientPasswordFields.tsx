import React from 'react';
import { PasswordConfirmFields } from '../common/PasswordConfirmFields';

export interface ClientPasswordFieldsProps {
  password: string;
  confirmPassword: string;
  showPassword: boolean;
  showConfirmPassword: boolean;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onToggleShowPassword: () => void;
  onToggleShowConfirmPassword: () => void;
}

export const ClientPasswordFields: React.FC<ClientPasswordFieldsProps> = ({
  password,
  confirmPassword,
  showPassword,
  showConfirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  onToggleShowPassword,
  onToggleShowConfirmPassword,
}) => (
  <div className="md:col-span-2 lg:col-span-2 space-y-3">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <PasswordConfirmFields
        password={password}
        confirmPassword={confirmPassword}
        showPassword={showPassword}
        showConfirmPassword={showConfirmPassword}
        onPasswordChange={onPasswordChange}
        onConfirmPasswordChange={onConfirmPasswordChange}
        onToggleShowPassword={onToggleShowPassword}
        onToggleShowConfirmPassword={onToggleShowConfirmPassword}
        requirementsClassName="sm:col-span-2"
      />
    </div>
  </div>
);

