import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[#E32032] hover:bg-[#C71828] active:bg-[#B51423] text-white shadow-xs focus-visible:ring-2 focus-visible:ring-[#E32032]/40',
  secondary:
    'bg-white hover:bg-[#F9FAFB] active:bg-[#F3F4F6] text-[#171717] border border-[#E3E4E6] shadow-2xs focus-visible:ring-2 focus-visible:ring-[#171717]/20',
  ghost:
    'bg-transparent hover:bg-black/5 active:bg-black/10 text-[#171717] focus-visible:ring-2 focus-visible:ring-[#171717]/20',
  danger:
    'bg-red-50 hover:bg-red-100 text-[#E32032] border border-red-200 active:bg-red-200/80 focus-visible:ring-2 focus-visible:ring-[#E32032]/30',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5 rounded-lg min-h-[30px]',
  md: 'px-3.5 py-2 text-xs gap-2 rounded-lg min-h-[36px]',
  lg: 'px-4 py-2.5 text-sm gap-2.5 rounded-lg min-h-[42px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      className = '',
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={`inline-flex items-center justify-center font-semibold transition-all duration-150 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0 flex items-center">{leftIcon}</span>
        )}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon && (
          <span className="shrink-0 flex items-center">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

