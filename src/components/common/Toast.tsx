import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, RefreshCw, X } from 'lucide-react';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'success',
  onClose,
  duration = 4000,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const bgStyles = {
    success: 'bg-status-running-text text-white',
    error: 'bg-primary text-white',
    info: 'bg-foreground text-white',
  };

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-white flex-shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-white flex-shrink-0" />,
    info: <Info className="w-4 h-4 text-white flex-shrink-0" />,
  };

  return (
    <div className="fixed top-5 right-5 z-50 animate-in slide-in-from-top-4 fade-in duration-200">
      <div
        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold ${bgStyles[type]}`}
      >
        {icons[type]}
        <span>{message}</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-2 p-0.5 hover:opacity-80 transition-opacity cursor-pointer"
          aria-label="Close notification"
        >
          <X className="w-3.5 h-3.5 text-white" />
        </button>
      </div>
    </div>
  );
};

export interface LoadErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export const LoadErrorBanner: React.FC<LoadErrorBannerProps> = ({ message, onRetry }) => (
  <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-3 text-xs text-red-800">
    <div className="flex items-center gap-2.5 min-w-0">
      <AlertCircle className="w-4 h-4 text-primary shrink-0" />
      <span className="font-medium truncate">{message}</span>
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-red-200 text-red-800 font-semibold hover:bg-red-100 transition-colors cursor-pointer shrink-0"
      >
        <RefreshCw className="w-3 h-3" />
        <span>Retry</span>
      </button>
    )}
  </div>
);

