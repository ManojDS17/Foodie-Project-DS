import React, { useRef, useEffect } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface RowActionMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
  className?: string;
  buttonClassName?: string;
  buttonAriaLabel?: string;
}

export const RowActionMenu: React.FC<RowActionMenuProps> = ({
  isOpen,
  onToggle,
  onClose,
  children,
  width = 'w-44',
  className = '',
  buttonClassName = 'p-1 rounded-lg hover:bg-slate-100 text-[#6B7280] hover:text-[#171717] transition-colors cursor-pointer',
  buttonAriaLabel = 'Row actions',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const scrollIntoViewIfNeeded = () => {
      const menuEl = menuRef.current;
      if (!menuEl) return;

      const rect = menuEl.getBoundingClientRect();
      const padding = 36;
      const spaceBelow = window.innerHeight - rect.bottom;

      if (spaceBelow < padding) {
        const scrollNeeded = padding - spaceBelow;
        window.scrollBy({
          top: scrollNeeded,
          behavior: 'smooth',
        });
      }

      let parent = menuEl.parentElement;
      while (parent && parent !== document.body) {
        const style = window.getComputedStyle(parent);
        const overflowY = style.overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll') {
          const parentRect = parent.getBoundingClientRect();
          const parentSpaceBelow = parentRect.bottom - rect.bottom;
          if (parentSpaceBelow < padding) {
            parent.scrollBy({
              top: padding - parentSpaceBelow,
              behavior: 'smooth',
            });
          }
        }
        parent = parent.parentElement;
      }

      try {
        menuEl.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      } catch {}
    };

    const frame = requestAnimationFrame(scrollIntoViewIfNeeded);
    const timer = setTimeout(scrollIntoViewIfNeeded, 60);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={buttonClassName}
        aria-label={buttonAriaLabel}
        aria-expanded={isOpen}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className={`absolute right-0 top-full mt-1 ${width} bg-white rounded-xl border border-[#E5E7EB] shadow-xl py-1.5 z-50 text-left animate-in fade-in zoom-in-95 duration-100`}
        >
          {children}
        </div>
      )}
    </div>
  );
};

