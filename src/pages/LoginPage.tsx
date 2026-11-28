import { AlertTriangle, Clock } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthHero } from '../components/auth/AuthHero';
import { CheckEmailStatus, PasswordUpdatedStatus } from '../components/auth/AuthStatusView';
import { ForgotPasswordForm } from '../components/auth/ForgotPasswordForm';
import { LoginForm } from '../components/auth/LoginForm';
import { ResetPasswordForm } from '../components/auth/ResetPasswordForm';
import { SignedOutView } from '../components/auth/SignedOutView';
import { BRAND_ASSETS, BRAND_COPY } from '../config/brandConfig';
import { useAuth } from '../hooks';
import { authApi, isValidEmail, validatePasswordPolicy } from '../services/api';

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

  const renderErrorBanner = () =>
    errorMessage ? (
      <div className="mb-4 p-3 bg-red-50/90 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-800 animate-fadeIn">
        <AlertTriangle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        <div className="font-medium leading-relaxed">{errorMessage}</div>
      </div>
    ) : null;

  return (
    <div className="h-screen max-h-screen w-full flex bg-white font-sans antialiased overflow-hidden">
      <AuthHero />

      <div className="w-full lg:w-1/2 h-full max-h-screen flex flex-col justify-between px-6 sm:px-10 lg:px-12 xl:px-16 py-6 sm:py-8 bg-white overflow-y-auto">
        <div className="hidden sm:block h-1" />

        <div className="w-full max-w-[380px] mx-auto my-auto py-2">
          <div className="lg:hidden flex items-center justify-center mb-6">
            <img
              src={BRAND_ASSETS.foodieLogo}
              alt="Foodie Logo"
              className="h-8 w-auto object-contain"
            />
          </div>

          {view === 'SIGN_IN' && (
            <div>
              <div className="mb-5">
                <h2 className="text-2xl font-semibold text-foreground tracking-tight leading-snug">
                  {BRAND_COPY.authWelcomeTitle}
                </h2>
                <p className="text-sm text-foreground-muted mt-1.5 leading-normal">
                  {BRAND_COPY.authWelcomeSubtitle}
                </p>
              </div>
              {renderErrorBanner()}
              <LoginForm
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

          {view === 'FORGOT_PASSWORD' && (
            <ForgotPasswordForm
              email={email}
              isLoading={isLoading}
              errorMessage={errorMessage}
              onEmailChange={(val) => {
                setEmail(val);
                if (errorMessage) setErrorMessage(null);
              }}
              onSubmit={handleSendResetLink}
              onBackToSignIn={() => {
                setErrorMessage(null);
                setView('SIGN_IN');
              }}
            />
          )}

          {view === 'CHECK_EMAIL' && (
            <CheckEmailStatus
              email={email}
              onBackToSignIn={() => setView('SIGN_IN')}
              onResendLink={handleSendResetLink}
            />
          )}

          {view === 'SET_NEW_PASSWORD' && (
            <ResetPasswordForm
              isVerifyingToken={isVerifyingToken}
              isTokenValid={isTokenValid}
              newPassword={newPassword}
              confirmPassword={confirmPassword}
              showNewPassword={showNewPassword}
              showConfirmPassword={showConfirmPassword}
              isLoading={isLoading}
              errorMessage={errorMessage}
              onNewPasswordChange={setNewPassword}
              onConfirmPasswordChange={setConfirmPassword}
              onToggleShowNewPassword={() => setShowNewPassword((p) => !p)}
              onToggleShowConfirmPassword={() => setShowConfirmPassword((p) => !p)}
              onSubmit={handleUpdatePassword}
              onRequestNewLink={() => {
                setErrorMessage(null);
                setView('FORGOT_PASSWORD');
              }}
              onBackToSignIn={() => {
                setErrorMessage(null);
                setView('SIGN_IN');
              }}
            />
          )}

          {view === 'PASSWORD_UPDATED' && (
            <PasswordUpdatedStatus
              onSignIn={() => {
                navigate('/login', { replace: true });
                setView('SIGN_IN');
                setNewPassword('');
                setConfirmPassword('');
              }}
            />
          )}

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
              {renderErrorBanner()}
              <LoginForm
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
