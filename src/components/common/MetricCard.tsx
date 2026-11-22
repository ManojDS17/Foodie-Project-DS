import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface MetricCardProps {
  id?: string;
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconVariant?: 'default' | 'danger' | 'success' | 'warning';
  valueColor?: string;
  onClick?: () => void;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  id,
  title,
  value,
  unit,
  subtitle,
  icon: Icon,
  iconVariant = 'default',
  valueColor,
  onClick,
  className,
}) => {
  const iconVariantStyles = {
    default: 'bg-surface-subtle border-border-subtle text-foreground',
    danger: 'bg-primary-light border-primary-border text-primary',
    success: 'bg-emerald-50 border-emerald-100 text-status-running-dot',
    warning: 'bg-amber-50 border-amber-100 text-amber-700',
  };

  return (
    <div
      id={id}
      onClick={onClick}
      className={`bg-surface-card rounded-xl border border-border-subtle p-3 sm:p-4 shadow-xs transition-all duration-200 min-w-0 ${
        className || ''
      } ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-border-strong' : ''
      }`}
    >
      {/* Top Header: Title + Icon Container */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-[11px] sm:text-xs font-medium text-foreground-muted truncate flex-1 min-w-0">
          {title}
        </span>
        {Icon && (
          <div
            className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg border flex items-center justify-center shrink-0 ${iconVariantStyles[iconVariant]}`}
          >
            <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </div>
        )}
      </div>

      {/* Metric Value & Unit */}
      <div className="flex items-baseline mt-1.5 flex-wrap min-w-0">
        <span
          className={`text-xl sm:text-2xl font-black tracking-tight truncate ${
            valueColor || 'text-foreground'
          }`}
        >
          {value}
        </span>
        {unit && (
          <span className="text-xs sm:text-sm font-bold text-foreground ml-1 sm:ml-1.5 shrink-0">{unit}</span>
        )}
      </div>

      {/* Subtitle directly below */}
      {subtitle && (
        <p className="text-[11px] text-foreground-dim mt-1.5 truncate">
          {subtitle}
        </p>
      )}
    </div>
  );
};
