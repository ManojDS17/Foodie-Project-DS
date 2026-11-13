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
    default: 'bg-[#F8F9FA] border-[#E3E4E6] text-[#171717]',
    danger: 'bg-red-50 border-red-100 text-[#E32032]',
    success: 'bg-emerald-50 border-emerald-100 text-[#00C951]',
    warning: 'bg-amber-50 border-amber-100 text-amber-700',
  };

  return (
    <div
      id={id}
      onClick={onClick}
      className={`bg-white rounded-xl border border-[#E3E4E6] p-3 sm:p-4 shadow-xs transition-all duration-200 min-w-0 ${
        className || ''
      } ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-[#CBD5E1]' : ''
      }`}
    >
      {/* Top Header: Title + Icon Container */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-[11px] sm:text-xs font-medium text-[#666666] truncate flex-1 min-w-0">
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
            valueColor || 'text-[#171717]'
          }`}
        >
          {value}
        </span>
        {unit && (
          <span className="text-xs sm:text-sm font-bold text-[#171717] ml-1 sm:ml-1.5 shrink-0">{unit}</span>
        )}
      </div>

      {/* Subtitle directly below */}
      {subtitle && (
        <p className="text-[11px] text-[#888888] mt-1.5 truncate">
          {subtitle}
        </p>
      )}
    </div>
  );
};
