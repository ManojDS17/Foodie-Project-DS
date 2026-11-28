import React from 'react';
import { CheckCircle2, Mail } from 'lucide-react';

export interface CheckEmailStatusProps {
  email: string;
  onBackToSignIn: () => void;
  onResendLink: (e: React.FormEvent) => void;
}

export const CheckEmailStatus: React.FC<CheckEmailStatusProps> = ({
  email,
  onBackToSignIn,
  onResendLink,
}) => (
  <div className="text-center">
    <div className="w-11 h-11 rounded-full bg-red-50 text-primary flex items-center justify-center mx-auto mb-3.5 border border-red-100">
      <Mail className="w-5 h-5" />
    </div>

    <h2 className="text-2xl font-semibold text-foreground tracking-tight">
      Check your email
    </h2>
    <p className="text-sm text-foreground-muted mt-1.5 leading-relaxed max-w-sm mx-auto">
      We sent a reset link to <span className="font-semibold text-foreground">{email}</span>. The link expires in 30 minutes.
    </p>

    <div className="mt-5 space-y-2.5">
      <button
        type="button"
        onClick={onBackToSignIn}
        className="w-full bg-white hover:bg-neutral-50 border border-border-strong text-foreground-body py-2.5 rounded-lg text-sm font-semibold transition-all shadow-xs cursor-pointer"
      >
        Back to sign in
      </button>
    </div>

    <p className="text-xs text-foreground-muted mt-5 leading-relaxed">
      Didn't get the email? Check your spam folder or{' '}
      <button
        type="button"
        onClick={onResendLink}
        className="text-primary underline hover:text-primary-hover font-medium cursor-pointer"
      >
        resend the link
      </button>
      .
    </p>
  </div>
);

export interface PasswordUpdatedStatusProps {
  onSignIn: () => void;
}

export const PasswordUpdatedStatus: React.FC<PasswordUpdatedStatusProps> = ({ onSignIn }) => (
  <div className="text-center">
    <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3.5 border border-emerald-100">
      <CheckCircle2 className="w-5 h-5" />
    </div>

    <h2 className="text-2xl font-semibold text-foreground tracking-tight">
      Password updated
    </h2>
    <p className="text-sm text-foreground-muted mt-1.5 leading-relaxed max-w-sm mx-auto">
      Your password has been changed. Sign in with your new password to continue.
    </p>

    <div className="mt-5">
      <button
        type="button"
        onClick={onSignIn}
        className="w-full bg-primary hover:bg-primary-hover text-white py-2.5 rounded-lg text-xs sm:text-sm font-semibold tracking-normal transition-all shadow-xs cursor-pointer"
      >
        Sign in
      </button>
    </div>
  </div>
);

