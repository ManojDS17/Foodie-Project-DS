import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { AuthHero } from './AuthHero';
import { BRAND_ASSETS } from '../../config/brandConfig';

export interface SignedOutViewProps {
  onSignInAgain?: () => void;
  title?: string;
  description?: string;
  buttonText?: string;
  fullscreen?: boolean;
}

export const SignedOutView: React.FC<SignedOutViewProps> = ({
  onSignInAgain,
  title = "You've signed out",
  description = "If you're on a shared device, close this browser window to finish.",
  buttonText = "Sign in again",
  fullscreen = false,
}) => {
  const navigate = useNavigate();

  const handleAction = () => {
    if (onSignInAgain) {
      onSignInAgain();
    } else {
      navigate('/login', { replace: true });
    }
  };

  const cardContent = (
    <div className="text-center w-full max-w-[380px] mx-auto select-none">
      <div className="w-12 h-12 rounded-full bg-neutral-100 text-foreground-body flex items-center justify-center mx-auto mb-4">
        <LogOut className="w-5 h-5" />
      </div>

      <h2 className="text-2xl font-bold text-foreground tracking-tight">
        {title}
      </h2>
      <p className="text-xs sm:text-sm text-foreground-muted mt-2 leading-relaxed max-w-sm mx-auto">
        {description}
      </p>

      <div className="mt-6">
        <button
          type="button"
          onClick={handleAction}
          className="w-full bg-primary hover:bg-primary-hover active:bg-primary-active text-white py-2.5 sm:py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold tracking-normal transition-all shadow-xs hover:shadow cursor-pointer"
        >
          {buttonText}
        </button>
      </div>
    </div>
  );

  if (!fullscreen) {
    return cardContent;
  }

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

          {cardContent}
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
