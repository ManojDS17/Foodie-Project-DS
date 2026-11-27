import React from 'react';
import { Loader2 } from 'lucide-react';
import type { Machine } from '../../types';

export interface DeleteMachineModalProps {
  isOpen: boolean;
  machine: Machine | null;
  onClose: () => void;
  onConfirm: () => Promise<void> | Promise<boolean> | void;
  isDeleting: boolean;
}

export const DeleteMachineModal: React.FC<DeleteMachineModalProps> = ({
  isOpen,
  machine,
  onClose,
  onConfirm,
  isDeleting,
}) => {
  if (!isOpen || !machine) return null;

  const isAssigned = Boolean(machine.organization_id);

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-2xs transition-opacity animate-in fade-in duration-200"
        onClick={isDeleting ? undefined : onClose}
        aria-hidden="true"
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-md bg-surface-card rounded-xl shadow-xl border border-border-default p-6 text-left transform transition-all animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <h3 className="text-base font-bold text-foreground">
            Delete {machine.serial_number || machine.machine_code}?
          </h3>

          {/* Description */}
          <p className="text-xs text-foreground-muted mt-2.5 leading-relaxed">
            This will archive the machine from active fleet inventory.
          </p>

          {isAssigned && (
            <div className="mt-3.5 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              This machine is currently assigned to a client. Only unassigned available machines can be removed from fleet inventory.
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-surface-hover">
            <button
              type="button"
              disabled={isDeleting}
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-foreground bg-surface-card border border-border-strong hover:bg-surface-muted transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting || isAssigned}
              onClick={onConfirm}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-primary hover:bg-primary-hover transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Delete machine</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
