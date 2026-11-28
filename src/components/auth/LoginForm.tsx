import React from 'react';
import { Eye, EyeOff, Loader2, Shield } from 'lucide-react';
import { BRAND_COPY } from '../../config/brandConfig';

export interface LoginFormProps {
  email: string;
  password: string;
  showPassword: boolean;
  keepSignedIn?: boolean;
  showKeepSignedIn?: boolean;
  isLoading: boolean;
  submitLabel?: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onToggleShowPassword: () => void;
  onKeepSignedInChange?: (checked: boolean) => void;
  onForgotPassword: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  email,
  password,
  showPassword,
  keepSignedIn = true,
  showKeepSignedIn = true,
  isLoading,
  submitLabel = 'Sign in',
  onEmailChange,
  onPasswordChange,
  onToggleShowPassword,
  onKeepSignedInChange,
  onForgotPassword,
  onSubmit,
}) => (
  <>
    <form onSubmit={onSubmit} className="space-y-3.5">
      <div>
        <label className="block text-xs font-medium text-foreground-muted mb-1">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="name@powertechenergy.com.au"
          className="w-full px-3 py-2 text-sm bg-white border border-border-default rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all text-foreground"
          autoComplete="email"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground-muted mb-1">
          Password
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="Enter password"
            className="w-full px-3 py-2 pr-10 text-sm bg-white border border-border-default rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all text-foreground"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={onToggleShowPassword}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-foreground-subtle hover:text-foreground-body cursor-pointer transition-colors"
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {showKeepSignedIn && (
        <div className="flex items-center justify-between pt-0.5">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={keepSignedIn}
              onChange={(e) => onKeepSignedInChange?.(e.target.checked)}
              className="w-3.5 h-3.5 text-primary border-border-strong rounded focus:ring-primary accent-primary cursor-pointer"
            />
            <span className="text-xs text-foreground-body">Keep me signed in</span>
          </label>

          <button
            type="button"
            onClick={onForgotPassword}
            className="text-xs font-medium text-primary hover:text-primary-hover hover:underline cursor-pointer transition-colors"
          >
            Forgot password?
          </button>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-2 px-4 bg-primary hover:bg-primary-hover active:bg-primary-active disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        <span>{submitLabel}</span>
      </button>
    </form>

    <div className="mt-4 pt-3.5 border-t border-surface-hover flex items-start gap-2.5 text-xs text-foreground-muted">
      <Shield className="w-4 h-4 text-foreground-subtle shrink-0 mt-0.5" />
      <p className="leading-snug">{BRAND_COPY.authNotice}</p>
    </div>
  </>
);

