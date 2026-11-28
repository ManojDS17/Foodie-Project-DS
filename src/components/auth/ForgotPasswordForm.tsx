import React from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';

export interface ForgotPasswordFormProps {
  email: string;
  isLoading: boolean;
  errorMessage: string | null;
  onEmailChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBackToSignIn: () => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  email,
  isLoading,
  errorMessage,
  onEmailChange,
  onSubmit,
  onBackToSignIn,
}) => (
  <div>
    <div className="mb-5">
      <h2 className="text-2xl font-semibold text-foreground tracking-tight leading-snug">
        Reset your password
      </h2>
      <p className="text-sm text-foreground-muted mt-1.5 leading-normal">
        Enter the email linked to your account and we'll send you a reset link.
      </p>
    </div>

    {errorMessage && (
      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
        {errorMessage}
      </div>
    )}

    <form onSubmit={onSubmit} className="space-y-3.5">
      <div>
        <label className="block text-xs font-medium text-foreground-muted mb-1">
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="name@company.com"
          className="w-full px-3.5 py-2.5 rounded-lg border border-border-subtle text-sm text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all bg-white"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-primary hover:bg-primary-hover text-white py-2.5 rounded-lg text-xs sm:text-sm font-semibold tracking-normal transition-all shadow-xs cursor-pointer mt-1 disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Sending reset link...</span>
          </>
        ) : (
          <span>Send reset link</span>
        )}
      </button>

      <div className="text-center pt-1.5">
        <button
          type="button"
          onClick={onBackToSignIn}
          className="text-xs font-medium text-foreground-muted hover:text-foreground flex items-center justify-center gap-1.5 mx-auto transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to sign in</span>
        </button>
      </div>
    </form>
  </div>
);

