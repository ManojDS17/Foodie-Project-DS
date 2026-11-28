import React from 'react';
import { Edit2, Eye, Trash2 } from 'lucide-react';
import type { Machine } from '../../types';
import { RowActionMenu } from '../common/RowActionMenu';

export interface MachineRowActionsProps {
  machine: Machine;
  isOem: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const MachineRowActions: React.FC<MachineRowActionsProps> = ({
  machine,
  isOem,
  isOpen,
  onToggle,
  onClose,
  onView,
  onEdit,
  onDelete,
}) => (
  <RowActionMenu
    isOpen={isOpen}
    onToggle={onToggle}
    onClose={onClose}
    buttonAriaLabel={`Actions for ${machine.machine_code || machine.serial_number}`}
    width="w-44"
  >
    <button
      type="button"
      onClick={() => {
        onView();
        onClose();
      }}
      className="w-full px-3.5 py-2 text-left text-xs font-semibold text-foreground hover:bg-surface-muted flex items-center gap-2.5 cursor-pointer"
    >
      <Eye className="w-3.5 h-3.5 text-foreground-muted" />
      <span>View details</span>
    </button>

    {isOem && (
      <>
        <button
          type="button"
          onClick={() => {
            onEdit();
            onClose();
          }}
          className="w-full px-3.5 py-2 text-left text-xs font-semibold text-foreground hover:bg-surface-muted flex items-center gap-2.5 cursor-pointer"
        >
          <Edit2 className="w-3.5 h-3.5 text-foreground-muted" />
          <span>Edit machine</span>
        </button>

        <div className="border-t border-surface-hover my-1" />

        <button
          type="button"
          onClick={() => {
            onDelete();
            onClose();
          }}
          className="w-full px-3.5 py-2 text-left text-xs font-semibold text-primary hover:bg-red-50 flex items-center gap-2.5 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5 text-primary" />
          <span>Delete machine</span>
        </button>
      </>
    )}
  </RowActionMenu>
);

