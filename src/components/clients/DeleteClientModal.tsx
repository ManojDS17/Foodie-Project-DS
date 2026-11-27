import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { orgsApi } from '../../services/api';
import type { Organization, Machine } from '../../types';

export interface DeleteClientModalProps {
  isOpen: boolean;
  client?: Organization | null;
  selectedClients?: Organization[];
  machines?: Machine[];
  onClose: () => void;
  onSuccess: (deletedIds: string[]) => void;
}

export const DeleteClientModal: React.FC<DeleteClientModalProps> = ({
  isOpen,
  client,
  selectedClients,
  machines,
  onClose,
  onSuccess,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setIsDeleting(false);
  }, [isOpen, client, selectedClients]);

  if (!isOpen) return null;

  // Determine if single or multiple deletion
  const clientsToDelete = selectedClients && selectedClients.length > 0
    ? selectedClients
    : client
    ? [client]
    : [];

  if (clientsToDelete.length === 0) return null;

  const isMultiple = clientsToDelete.length > 1;
  const title = isMultiple
    ? `Delete ${clientsToDelete.length} clients?`
    : `Delete ${clientsToDelete[0].company_name}?`;

  const buttonLabel = isMultiple ? 'Delete clients' : 'Delete client';

  const getMachineCount = (c: Organization): number => {
    if (machines && Array.isArray(machines)) {
      return machines.filter((m) => m.organization_id === c.id && !m.is_deleted).length;
    }
    return c.total_machines || 0;
  };

  const clientsWithMachines = clientsToDelete.filter((c) => getMachineCount(c) > 0);
  const hasAssignedMachines = clientsWithMachines.length > 0;

  const handleDelete = async () => {
    if (hasAssignedMachines) {
      setError(
        `Cannot delete client with active assigned machines. Please unassign all machines first.`
      );
      return;
    }
    setIsDeleting(true);
    setError(null);
    try {
      const ids = clientsToDelete.map((c) => c.id);
      if (ids.length === 1) {
        await orgsApi.delete(ids[0]);
      } else {
        await orgsApi.bulkDelete(ids);
      }
      onSuccess(ids);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete client record(s).');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Confirmation Dialog Card */}
      <div className="relative bg-surface-card w-full max-w-lg rounded-2xl shadow-2xl border border-border-subtle overflow-hidden z-10 animate-in zoom-in-95 duration-200 p-5 sm:p-7">
        {/* Title */}
        <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
          {title}
        </h3>

        {/* Explanatory Text */}
        <p className="text-xs sm:text-[13px] text-foreground-body mt-3 leading-relaxed">
          {hasAssignedMachines
            ? 'This client organization currently has active machines assigned. System rules require all machines to be unassigned before the client record can be deleted.'
            : 'The client record is archived and then permanently removed along with its contact associations. Every deletion is recorded in the audit log.'}
        </p>

        {hasAssignedMachines && (
          <div className="mt-4 p-3 bg-primary-light border border-primary-border rounded-xl text-xs text-primary flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Action Blocked:</strong> {clientsWithMachines.map((c) => `${c.company_name} has ${getMachineCount(c)} active machine(s)`).join(', ')}. Please unassign all machines from the client detail view before deleting.
            </span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mt-4 p-3 bg-primary-light border border-primary-border rounded-xl text-xs text-primary flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Footer Actions (Right aligned) */}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg text-xs font-semibold border border-border-strong bg-surface-card text-foreground hover:bg-surface-muted transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || hasAssignedMachines}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-primary hover:bg-primary-hover text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>{buttonLabel}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
