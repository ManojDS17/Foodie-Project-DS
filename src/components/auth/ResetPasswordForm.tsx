import React from 'react';
import { AlertTriangle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { PasswordRequirements } from '../common/InputField';

export interface ResetPasswordFormProps {
  isVerifyingToken: boolean;
  isTokenValid: boolean | null;
  newPassword: string;
  confirmPassword: string;
  showNewPassword: boolean;
  showConfirmPassword: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onToggleShowNewPassword: () => void;
  onToggleShowConfirmPassword: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onRequestNewLink: () => void;
  onBackToSignIn: () => void;
}

export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({
  isVerifyingToken,
  isTokenValid,
  newPassword,
  confirmPassword,
  showNewPassword,
  showConfirmPassword,
  isLoading,
  errorMessage,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onToggleShowNewPassword,
  onToggleShowConfirmPassword,
  onSubmit,
  onRequestNewLink,
  onBackToSignIn,
}) => {
  if (isVerifyingToken) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="w-7 h-7 animate-spin text-primary mx-auto mb-2.5" />
        <p className="text-xs sm:text-sm font-medium text-foreground-body">
          Verifying security token...
        </p>
      </div>
    );
  }

  if (isTokenValid === false) {
    return (
      <div className="text-center py-3">
        <div className="w-11 h-11 rounded-full bg-red-50 text-primary flex items-center justify-center mx-auto mb-3 border border-red-100">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
          Reset link invalid or expired
        </h2>
        <p className="text-xs sm:text-[13px] text-foreground-body mt-1.5 mb-5 leading-relaxed max-w-sm mx-auto">
          {errorMessage || 'This password reset link is invalid or has expired (valid for 30 minutes). Please request a new link.'}
        </p>
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onRequestNewLink}
            className="w-full bg-primary hover:bg-primary-hover text-white py-2.5 rounded-lg text-xs sm:text-sm font-semibold tracking-normal transition-all shadow-xs cursor-pointer"
          >
            Request a new reset link
          </button>
          <button
            type="button"
            onClick={onBackToSignIn}
            className="w-full bg-white hover:bg-neutral-50 border border-border-strong text-foreground-body py-2.5 rounded-lg text-sm font-semibold transition-all shadow-xs cursor-pointer"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl sm:text-[22px] font-bold text-foreground tracking-tight leading-snug">
          Set a new password
        </h2>
        <p className="text-xs sm:text-[13px] text-foreground-body mt-1 leading-normal">
          Choose a password you haven’t used for Foodie Dashboard before.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-3.5 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
          {errorMessage}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-3.5">
        <div>
          <label className="block text-xs font-medium text-foreground-muted mb-1">
            New password
          </label>
          <div className="relative">
            <input
              type={showNewPassword ? 'text' : 'password'}
              required
              value={newPassword}
              onChange={(e) => onNewPasswordChange(e.target.value)}
              placeholder="••••••••••••••••"
              className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-border-subtle text-sm text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
            <button
              type="button"
              onClick={onToggleShowNewPassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted"
            >
              {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground-muted mb-1">
            Confirm new password
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => onConfirmPasswordChange(e.target.value)}
              placeholder="••••••••••••••••"
              className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-border-subtle text-sm text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
            <button
              type="button"
              onClick={onToggleShowConfirmPassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted"
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <PasswordRequirements
          password={newPassword}
          confirmPassword={confirmPassword}
        />

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary hover:bg-primary-hover text-white py-2.5 rounded-lg text-xs sm:text-sm font-semibold tracking-normal transition-all shadow-xs cursor-pointer mt-1 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Updating password...</span>
            </>
          ) : (
            <span>Update password</span>
          )}
        </button>
      </form>
    </div>
  );
};

