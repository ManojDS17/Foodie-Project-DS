import React from 'react';
import { Archive, Download, Edit2, Eye, RotateCcw, Trash2 } from 'lucide-react';
import type { Organization } from '../../types';
import { RowActionMenu } from '../common/RowActionMenu';

export interface ClientRowActionsProps {
  client: Organization;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onView: () => void;
  onEdit: () => void;
  onExport: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}

export const ClientRowActions: React.FC<ClientRowActionsProps> = ({
  client,
  isOpen,
  onToggle,
  onClose,
  onView,
  onEdit,
  onExport,
  onToggleStatus,
  onDelete,
}) => {
  const isInactive =
    !client.is_active || client.status === 'Inactive' || client.status === 'Archived';

  return (
    <RowActionMenu
      isOpen={isOpen}
      onToggle={onToggle}
      onClose={onClose}
      buttonAriaLabel={`Actions for ${client.company_name}`}
      width="w-48"
    >
      <button
        type="button"
        onClick={() => {
          onClose();
          onView();
        }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors cursor-pointer"
      >
        <Eye className="w-3.5 h-3.5 text-foreground-muted" />
        <span>View client</span>
      </button>

      <button
        type="button"
        onClick={() => {
          onClose();
          onEdit();
        }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors cursor-pointer"
      >
        <Edit2 className="w-3.5 h-3.5 text-foreground-muted" />
        <span>Edit client</span>
      </button>

      <button
        type="button"
        onClick={() => {
          onClose();
          onExport();
        }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors cursor-pointer"
      >
        <Download className="w-3.5 h-3.5 text-foreground-muted" />
        <span>Export data</span>
      </button>

      <button
        type="button"
        onClick={() => {
          onClose();
          onToggleStatus();
        }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors cursor-pointer"
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

      <div className="border-t border-surface-hover my-1" />

      <button
        type="button"
        onClick={() => {
          onClose();
          onDelete();
        }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-primary hover:bg-red-50 transition-colors cursor-pointer"
      >
        <Trash2 className="w-3.5 h-3.5 text-primary" />
        <span>Delete client</span>
      </button>
    </RowActionMenu>
  );
};

