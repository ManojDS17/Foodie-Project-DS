import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Shield,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthHero } from '../components/auth/AuthHero';
import { SignedOutView } from '../components/auth/SignedOutView';
import { PasswordRequirements } from '../components/common/InputField';
import { BRAND_ASSETS, BRAND_COPY } from '../config/brandConfig';
import { useAuth } from '../hooks';
import { authApi, isValidEmail, validatePasswordPolicy } from '../services/api';

interface SignInFormProps {
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

const SignInForm: React.FC<SignInFormProps> = ({
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

type AuthView =
  | 'SIGN_IN'
  | 'FORGOT_PASSWORD'
  | 'CHECK_EMAIL'
  | 'SET_NEW_PASSWORD'
  | 'PASSWORD_UPDATED'
  | 'SIGNED_OUT'
  | 'SESSION_EXPIRED';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const searchKey = searchParams.toString();
  const [prevSearchKey, setPrevSearchKey] = useState(searchKey);

  const deriveInitialView = (params: URLSearchParams): AuthView => {
    const urlView = params.get('view');
    const isSessionExpired = sessionStorage.getItem('foodie_session_expired') === 'true';
    const isSignedOut = sessionStorage.getItem('foodie_signed_out') === 'true';
    if (params.get('token')) return 'SET_NEW_PASSWORD';
    if (urlView === 'expired' || isSessionExpired) return 'SESSION_EXPIRED';
    if (urlView === 'signed_out' || isSignedOut) return 'SIGNED_OUT';
    if (urlView === 'forgot') return 'FORGOT_PASSWORD';
    return 'SIGN_IN';
  };

  const [view, setView] = useState<AuthView>(() => deriveInitialView(searchParams));
  const [email, setEmail] = useState(() => {
    return searchParams.get('email') || sessionStorage.getItem('foodie_expired_email') || '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [resetToken, setResetToken] = useState<string>(() => searchParams.get('token') || '');
  const [isVerifyingToken, setIsVerifyingToken] = useState(() => Boolean(searchParams.get('token')));
  const [isTokenValid, setIsTokenValid] = useState<boolean | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  if (searchKey !== prevSearchKey) {
    setPrevSearchKey(searchKey);
    const nextToken = searchParams.get('token');
    const nextEmail = searchParams.get('email') || sessionStorage.getItem('foodie_expired_email');
    if (nextEmail) setEmail(nextEmail);
    if (nextToken) {
      setResetToken(nextToken);
      setView('SET_NEW_PASSWORD');
      setIsVerifyingToken(true);
      setIsTokenValid(null);
      setErrorMessage(null);
    } else {
      const nextUrlView = searchParams.get('view');
      if (nextUrlView === 'expired') setView('SESSION_EXPIRED');
      else if (nextUrlView === 'signed_out') setView('SIGNED_OUT');
      else if (nextUrlView === 'forgot') setView('FORGOT_PASSWORD');
    }
  }

  useEffect(() => {
    const urlView = searchParams.get('view');
    const token = searchParams.get('token');
    const isSessionExpired = sessionStorage.getItem('foodie_session_expired') === 'true';
    const isSignedOut = sessionStorage.getItem('foodie_signed_out') === 'true';

    if (token) {
      let active = true;
      authApi
        .verifyResetToken(token)
        .then((res) => {
          if (!active) return;
          setIsTokenValid(true);
          if (res.email) {
            setEmail(res.email);
          }
        })
        .catch((err) => {
          if (!active) return;
          setIsTokenValid(false);
          setErrorMessage(err.message || 'This reset link is invalid or has expired.');
        })
        .finally(() => {
          if (active) setIsVerifyingToken(false);
        });
      return () => {
        active = false;
      };
    } else if (urlView === 'expired' || isSessionExpired) {
      sessionStorage.removeItem('foodie_session_expired');
      sessionStorage.removeItem('foodie_expired_email');
      sessionStorage.removeItem('foodie_signed_out');
    } else if (urlView === 'signed_out' || isSignedOut) {
      sessionStorage.removeItem('foodie_signed_out');
      sessionStorage.removeItem('foodie_session_expired');
      sessionStorage.removeItem('foodie_expired_email');
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address (e.g. name@company.com or name@company.com.au).');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      await login(email.trim(), password, keepSignedIn);
      const redirectPath = sessionStorage.getItem('foodie_redirect_after_login') || '/';
      sessionStorage.removeItem('foodie_redirect_after_login');
      navigate(redirectPath);
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Email or password is incorrect. Check your details and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address (e.g. name@company.com or name@company.com.au).');
      return;
    }
    setErrorMessage(null);
    setIsLoading(true);

    try {
      await authApi.forgotPassword(email.trim());
      setView('CHECK_EMAIL');
    } catch (err: any) {
      setErrorMessage(err.message || 'No account found with this email address.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const policyErr = validatePasswordPolicy(newPassword, 'Password');
    if (policyErr) {
      setErrorMessage(policyErr);
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (!resetToken) {
      setErrorMessage('Reset token is missing or expired. Please request a new link.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      await authApi.resetPassword(resetToken, newPassword);
      setView('PASSWORD_UPDATED');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen max-h-screen w-full flex bg-white font-sans antialiased overflow-hidden">
      {/* 1. Left 50% Width Hero (Responsive, never overflows, 100% viewport fit) */}
      <AuthHero />

      {/* 2. Right 50% Width Interactive Auth Container */}
      <div className="w-full lg:w-1/2 h-full max-h-screen flex flex-col justify-between px-6 sm:px-10 lg:px-12 xl:px-16 py-6 sm:py-8 bg-white overflow-y-auto">
        {/* Top spacer */}
        <div className="hidden sm:block h-1" />

        {/* Center Content Box - vertically auto-centered */}
        <div className="w-full max-w-[380px] mx-auto my-auto py-2">
          {/* Mobile-only Foodie Logo */}
          <div className="lg:hidden flex items-center justify-center mb-6">
            <img
              src={BRAND_ASSETS.foodieLogo}
              alt="Foodie Logo"
              className="h-8 w-auto object-contain"
            />
          </div>
          {/* ======================================================== */}
          {/* VIEW 1: SIGN IN */}
          {/* ======================================================== */}
          {view === 'SIGN_IN' && (
            <div>
              {/* Header */}
              <div className="mb-5">
                <h2 className="text-2xl font-semibold text-foreground tracking-tight leading-snug">
                  {BRAND_COPY.authWelcomeTitle}
                </h2>
                <p className="text-sm text-foreground-muted mt-1.5 leading-normal">
                  {BRAND_COPY.authWelcomeSubtitle}
                </p>
              </div>

              {/* Error Banner */}
              {errorMessage && (
                <div className="mb-4 p-3 bg-red-50/90 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-800 animate-fadeIn">
                  <AlertTriangle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <div className="font-medium leading-relaxed">
                    {errorMessage}
                  </div>
                </div>
              )}

              {/* Login Form */}
              <SignInForm
                email={email}
                password={password}
                showPassword={showPassword}
                keepSignedIn={keepSignedIn}
                showKeepSignedIn={true}
                isLoading={isLoading}
                submitLabel={isLoading ? 'Signing in...' : 'Sign in'}
                onEmailChange={(val) => {
                  setEmail(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                onPasswordChange={(val) => {
                  setPassword(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                onToggleShowPassword={() => setShowPassword((p) => !p)}
                onKeepSignedInChange={setKeepSignedIn}
                onForgotPassword={() => {
                  setErrorMessage(null);
                  setView('FORGOT_PASSWORD');
                }}
                onSubmit={handleLogin}
              />
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 2: FORGOT PASSWORD */}
          {/* ======================================================== */}
          {view === 'FORGOT_PASSWORD' && (
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

              <form onSubmit={handleSendResetLink} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
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
                    onClick={() => {
                      setErrorMessage(null);
                      setView('SIGN_IN');
                    }}
                    className="text-xs font-medium text-foreground-muted hover:text-foreground flex items-center justify-center gap-1.5 mx-auto transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to sign in</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 3: CHECK EMAIL */}
          {/* ======================================================== */}
          {view === 'CHECK_EMAIL' && (
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
                  onClick={() => {
                    setView('SIGN_IN');
                  }}
                  className="w-full bg-white hover:bg-neutral-50 border border-border-strong text-foreground-body py-2.5 rounded-lg text-sm font-semibold transition-all shadow-xs cursor-pointer"
                >
                  Back to sign in
                </button>
              </div>

              <p className="text-xs text-foreground-muted mt-5 leading-relaxed">
                Didn't get the email? Check your spam folder or{' '}
                <button
                  type="button"
                  onClick={handleSendResetLink}
                  className="text-primary underline hover:text-primary-hover font-medium cursor-pointer"
                >
                  resend the link
                </button>
                .
              </p>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 4: SET NEW PASSWORD */}
          {/* ======================================================== */}
          {view === 'SET_NEW_PASSWORD' && (
            <div>
              {isVerifyingToken ? (
                <div className="py-10 text-center">
                  <Loader2 className="w-7 h-7 animate-spin text-primary mx-auto mb-2.5" />
                  <p className="text-xs sm:text-sm font-medium text-foreground-body">
                    Verifying security token...
                  </p>
                </div>
              ) : isTokenValid === false ? (
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
                      onClick={() => {
                        setErrorMessage(null);
                        setView('FORGOT_PASSWORD');
                      }}
                      className="w-full bg-primary hover:bg-primary-hover text-white py-2.5 rounded-lg text-xs sm:text-sm font-semibold tracking-normal transition-all shadow-xs cursor-pointer"
                    >
                      Request a new reset link
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMessage(null);
                        setView('SIGN_IN');
                      }}
                      className="w-full bg-white hover:bg-neutral-50 border border-border-strong text-foreground-body py-2.5 rounded-lg text-sm font-semibold transition-all shadow-xs cursor-pointer"
                    >
                      Back to sign in
                    </button>
                  </div>
                </div>
              ) : (
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

                  <form onSubmit={handleUpdatePassword} className="space-y-3.5">
                    {/* New Password */}
                    <div>
                      <label className="block text-xs font-medium text-foreground-muted mb-1">
                        New password
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••••••••••"
                          className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-border-subtle text-sm text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block text-xs font-medium text-foreground-muted mb-1">
                        Confirm new password
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••••••••••"
                          className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-border-subtle text-sm text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Interactive Requirements Checkmarks */}
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
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 5: PASSWORD UPDATED */}
          {/* ======================================================== */}
          {view === 'PASSWORD_UPDATED' && (
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
                  onClick={() => {
                    navigate('/login', { replace: true });
                    setView('SIGN_IN');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="w-full bg-primary hover:bg-primary-hover text-white py-2.5 rounded-lg text-xs sm:text-sm font-semibold tracking-normal transition-all shadow-xs cursor-pointer"
                >
                  Sign in
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 6: SIGNED OUT */}
          {/* ======================================================== */}
          {view === 'SIGNED_OUT' && (
            <SignedOutView
              onSignInAgain={() => {
                setErrorMessage(null);
                setPassword('');
                sessionStorage.removeItem('foodie_signed_out');
                setView('SIGN_IN');
                navigate('/login', { replace: true });
              }}
            />
          )}

          {/* ======================================================== */}
          {/* VIEW 7: SESSION EXPIRED */}
          {/* ======================================================== */}
          {view === 'SESSION_EXPIRED' && (
            <div>
              <div className="text-center mb-4">
                <div className="w-11 h-11 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-100">
                  <Clock className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">Session expired</h2>
                <p className="text-sm text-foreground-muted mt-1.5 leading-normal">
                  You were signed out after a period of inactivity. Sign in again to pick up where you left off.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-4 p-3 bg-red-50/90 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-800 animate-fadeIn">
                  <AlertTriangle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <div className="font-medium leading-relaxed">
                    {errorMessage}
                  </div>
                </div>
              )}

              <SignInForm
                email={email}
                password={password}
                showPassword={showPassword}
                showKeepSignedIn={false}
                isLoading={isLoading}
                submitLabel={isLoading ? 'Signing in...' : 'Sign in'}
                onEmailChange={(val) => {
                  setEmail(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                onPasswordChange={(val) => {
                  setPassword(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                onToggleShowPassword={() => setShowPassword((p) => !p)}
                onForgotPassword={() => {
                  setErrorMessage(null);
                  setView('FORGOT_PASSWORD');
                }}
                onSubmit={handleLogin}
              />

              <div className="text-center pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setPassword('');
                    setView('SIGN_IN');
                  }}
                  className="text-xs font-medium text-foreground-muted hover:text-foreground transition-colors cursor-pointer"
                >
                  Sign in with a different account
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Footer: Official PowerTech Energy attribution - centered in the middle of right half */}
        <div className="w-full pt-4 border-t border-surface-hover flex items-center justify-center gap-2.5 flex-shrink-0">
          <span className="text-xs text-foreground-muted font-medium">by</span>
          <img
            src={BRAND_ASSETS.powertechFullLogo}
            alt="PowerTech Energy"
            className="h-8 sm:h-9 w-auto object-contain opacity-90"
          />
        </div>
      </div>
    </div>
  );
};
