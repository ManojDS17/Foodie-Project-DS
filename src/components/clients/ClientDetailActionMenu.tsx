import React, { useEffect, useRef } from 'react';
import { Archive, Download, MoreHorizontal, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import type { Organization } from '../../types';

export interface ClientDetailActionMenuProps {
  client: Organization;
  assignedMachinesCount: number;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onEdit: () => void;
  onExportDetails: () => void;
  onToggleStatus: () => void;
  onCannotDeactivate: (message: string) => void;
  onDeleteClient: () => void;
}

export const ClientDetailActionMenu: React.FC<ClientDetailActionMenuProps> = ({
  client,
  assignedMachinesCount,
  isOpen,
  onToggle,
  onClose,
  onEdit,
  onExportDetails,
  onToggleStatus,
  onCannotDeactivate,
  onDeleteClient,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const isInactive =
    !client.is_active || client.status === 'Inactive' || client.status === 'Archived';

  return (
    <div className="flex items-center gap-2 self-start sm:self-center">
      <button
        type="button"
        onClick={onEdit}
        className="px-3.5 py-2 rounded-lg text-xs font-semibold border border-border-strong text-foreground-body hover:bg-surface-muted flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
      >
        <Pencil className="w-3.5 h-3.5 text-foreground-body" />
        <span>Edit client</span>
      </button>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={onToggle}
          className="p-2 rounded-lg text-xs font-medium border border-border-strong text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors cursor-pointer shadow-2xs"
          aria-label="More options"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-1 w-48 bg-white border border-border-default rounded-xl shadow-lg z-30 py-1 divide-y divide-surface-hover">
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onExportDetails();
                }}
                className="w-full px-3.5 py-2 text-left text-xs text-foreground-body hover:bg-surface-muted flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-foreground-muted" />
                <span>Export client details</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (!isInactive && assignedMachinesCount > 0) {
                    onCannotDeactivate(
                      `Cannot deactivate client: ${client.company_name} currently has ${assignedMachinesCount} machine(s) leased. Please terminate all machine leases before deactivating.`
                    );
                    return;
                  }
                  onToggleStatus();
                }}
                className="w-full px-3.5 py-2 text-left text-xs text-foreground-body hover:bg-surface-muted flex items-center gap-2 cursor-pointer"
              >
                {isInactive ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 text-status-running-text" />
                    <span>Active</span>
                  </>
                ) : (
                  <>
                    <Archive className="w-3.5 h-3.5 text-foreground-muted" />
                    <span>Inactive</span>
                  </>
                )}
              </button>
            </div>
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDeleteClient();
                }}
                className="w-full px-3.5 py-2 text-left text-xs text-primary hover:bg-primary-light flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-primary" />
                <span>Delete client</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

