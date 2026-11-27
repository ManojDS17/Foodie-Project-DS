import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
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
  buttonClassName = 'p-1 rounded-lg hover:bg-surface-hover text-foreground-muted hover:text-foreground transition-colors cursor-pointer',
  buttonAriaLabel = 'Row actions',
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const btnRect = buttonRef.current.getBoundingClientRect();
    const menuEl = menuRef.current;
    const rect = menuEl?.getBoundingClientRect();
    const menuHeight = rect?.height || menuEl?.offsetHeight || 120;
    const menuWidth = rect?.width || menuEl?.offsetWidth || 176;

    const spaceBelow = window.innerHeight - btnRect.bottom;
    const spaceAbove = btnRect.top;

    const openUpward = spaceBelow < menuHeight + 12 && spaceAbove >= menuHeight;

    let top = openUpward ? btnRect.top - menuHeight - 6 : btnRect.bottom + 6;
    if (top < 10) top = 10;
    if (top + menuHeight > window.innerHeight - 10) {
      top = Math.max(10, window.innerHeight - menuHeight - 10);
    }

    let left = btnRect.right - menuWidth;
    if (left < 10) left = 10;
    if (left + menuWidth > window.innerWidth - 10) {
      left = Math.max(10, window.innerWidth - menuWidth - 10);
    }

    setCoords({ top, left });
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
      const frame = requestAnimationFrame(updatePosition);
      return () => cancelAnimationFrame(frame);
    } else {
      setCoords(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const frame = requestAnimationFrame(updatePosition);

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target;
      if (
        target instanceof Node &&
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleScrollOrResize = (e: Event) => {
      if (e.target && e.target instanceof Node && menuRef.current && menuRef.current.contains(e.target)) {
        return;
      }
      onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, onClose]);

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <button
        ref={buttonRef}
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

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            style={
              coords
                ? {
                    position: 'fixed',
                    top: `${coords.top}px`,
                    left: `${coords.left}px`,
                    zIndex: 99999,
                  }
                : {
                    position: 'fixed',
                    top: '-9999px',
                    left: '-9999px',
                    zIndex: 99999,
                  }
            }
            className={`${width} bg-surface-card rounded-xl border border-border-default shadow-2xl py-1.5 text-left animate-in fade-in zoom-in-95 duration-100 select-none`}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>,
          document.body
        )}
    </div>
  );
};

