import React from 'react';
import { ArrowLeft, Clock, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface PlaceholderViewProps {
  title: string;
  subtitle: string;
  tag?: string;
  footerText?: string;
}

export const PlaceholderView: React.FC<PlaceholderViewProps> = ({
  title,
  subtitle,
  tag = 'Phase 2 Milestone',
  footerText = 'Scheduled in the product development roadmap.',
}) => {
  const navigate = useNavigate();

  return (
    <div className="bg-surface-card rounded-2xl border border-border-subtle p-5 sm:p-12 text-center max-w-2xl mx-auto shadow-xs my-4 sm:my-8">
      <div className="w-12 h-12 rounded-xl bg-primary-light text-primary border border-primary-border flex items-center justify-center mx-auto mb-4">
        <Sparkles className="w-6 h-6" />
      </div>

      <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-foreground-muted border border-slate-200 mb-3">
        {tag}
      </span>

      <h1 className="text-xl font-extrabold text-foreground">{title}</h1>
      <p className="text-xs text-foreground-muted mt-2 max-w-md mx-auto leading-relaxed">
        {subtitle}
      </p>

      <div className="mt-8 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-lg text-xs font-bold bg-foreground text-white hover:bg-black transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Dashboard</span>
        </button>
      </div>

      <div className="mt-6 pt-4 border-t border-surface-page flex items-center justify-center gap-1.5 text-[11px] text-foreground-dim">
        <Clock className="w-3.5 h-3.5" />
        <span>{footerText}</span>
      </div>
    </div>
  );
};
