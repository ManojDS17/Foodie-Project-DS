import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
} from 'lucide-react';

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
    if (!isOpen) return;
    updatePosition();
    const frame = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(frame);
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

export interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  rowsPerPage: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  variant?: 'clients' | 'machines';
}

const getVisiblePages = (
  currentPage: number,
  totalPages: number
): (number | 'ellipsis-left' | 'ellipsis-right')[] => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis-left' | 'ellipsis-right')[] = [1];
  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);

  if (windowStart > 2) {
    pages.push('ellipsis-left');
  }

  for (let p = windowStart; p <= windowEnd; p += 1) {
    pages.push(p);
  }

  if (windowEnd < totalPages - 1) {
    pages.push('ellipsis-right');
  }

  pages.push(totalPages);
  return pages;
};

export const PaginationBar: React.FC<PaginationBarProps> = ({
  currentPage,
  totalPages,
  rowsPerPage,
  totalItems,
  startIndex,
  endIndex,
  itemLabel,
  onPageChange,
  onRowsPerPageChange,
  variant = 'clients',
}) => {
  const visiblePages = getVisiblePages(currentPage, totalPages);

  const containerClass =
    variant === 'machines'
      ? 'px-5 py-3.5 border-t border-border-default flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-foreground-muted bg-white select-none'
      : 'pt-3.5 mt-3 border-t border-border-default flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-foreground-muted select-none';

  return (
    <div className={containerClass}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span>Page</span>
          <span className="font-semibold text-foreground px-2 py-0.5 rounded border border-border-default bg-surface-muted">
            {currentPage}
          </span>
          <span>of {totalPages}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span>Rows per page</span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              const val = Number(e.target.value);
              onRowsPerPageChange(val);
              try {
                localStorage.setItem('foodie_rows_per_page', String(val));
              } catch {}
            }}
            className="px-2 py-0.5 rounded border border-border-default bg-white text-foreground font-semibold text-xs cursor-pointer focus:outline-none"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <div className="text-[11px] text-foreground-dim">
          Showing {totalItems > 0 ? startIndex + 1 : 0}–{endIndex} of {totalItems} {itemLabel}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(1)}
          aria-label="First page"
          className="p-1.5 rounded-lg border border-border-default bg-white text-foreground-muted hover:text-foreground hover:bg-surface-muted disabled:opacity-40 transition-colors cursor-pointer"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          aria-label="Previous page"
          className="p-1.5 rounded-lg border border-border-default bg-white text-foreground-muted hover:text-foreground hover:bg-surface-muted disabled:opacity-40 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {visiblePages.map((entry) => {
          if (typeof entry !== 'number') {
            return (
              <span key={entry} className="px-1.5 text-xs text-foreground-subtle select-none">
                ...
              </span>
            );
          }

          const isActive = entry === currentPage;
          return (
            <button
              key={entry}
              type="button"
              onClick={() => onPageChange(entry)}
              className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? variant === 'machines'
                    ? 'bg-primary-light border border-primary-border text-primary font-bold'
                    : 'bg-red-50 text-primary border border-red-200'
                  : 'border border-border-default bg-white text-foreground-muted hover:text-foreground hover:bg-surface-muted'
              }`}
            >
              {entry}
            </button>
          );
        })}

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          aria-label="Next page"
          className="p-1.5 rounded-lg border border-border-default bg-white text-foreground-muted hover:text-foreground hover:bg-surface-muted disabled:opacity-40 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          aria-label="Last page"
          className="p-1.5 rounded-lg border border-border-default bg-white text-foreground-muted hover:text-foreground hover:bg-surface-muted disabled:opacity-40 transition-colors cursor-pointer"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

