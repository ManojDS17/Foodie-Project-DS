import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from '../common/ui';
import type { Machine } from '../../types';

export interface TerminateLeaseModalProps {
  isOpen: boolean;
  machine: Machine | null;
  clientName: string;
  onClose: () => void;
  onConfirm: (machineId: string, remark: string) => Promise<void>;
}

export const TerminateLeaseModal: React.FC<TerminateLeaseModalProps> = ({
  isOpen,
  machine,
  clientName,
  onClose,
  onConfirm,
}) => {
  const [remark, setRemark] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !machine) return null;

  const handleClose = () => {
    if (isSubmitting) return;
    setRemark('');
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(machine.id, remark.trim());
      setRemark('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to terminate lease.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="bg-surface-card rounded-2xl max-w-md w-full shadow-2xl border border-border-default overflow-hidden flex flex-col">
        <div className="p-6 border-b border-surface-hover flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-light text-primary flex items-center justify-center shrink-0 border border-primary-border">
              <AlertTriangle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Terminate Machine Lease</h3>
              <p className="text-xs text-foreground-muted mt-0.5">
                Remove machine from {clientName} and return to fleet.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-foreground-subtle hover:text-foreground p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {error && (
            <div className="p-3 rounded-lg bg-primary-light border border-primary-border text-xs text-status-fault-text">
              {error}
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-surface-muted border border-border-default text-xs flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-foreground-muted">Machine Code:</span>
              <span className="font-mono font-bold text-foreground">{machine.machine_code || machine.serial_number}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground-muted">Model:</span>
              <span className="font-medium text-foreground">{machine.model}</span>
            </div>
            {machine.lease_location_label && machine.lease_location_label.trim() && (
              <div className="flex items-center justify-between">
                <span className="text-foreground-muted">Current Location:</span>
                <span className="font-medium text-foreground">{machine.lease_location_label.trim()}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground-body">
              Termination Reason / Remark <span className="text-status-fault-text">*</span>
            </label>
            <textarea
              rows={3}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="e.g., Client contract ended, facility relocation, upgraded to higher capacity model..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-border-strong focus:outline-none focus:border-foreground text-foreground resize-none"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="p-4 px-6 bg-surface-muted border-t border-surface-hover flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={handleConfirm}
            isLoading={isSubmitting}
            disabled={!remark.trim()}
          >
            Terminate lease
          </Button>
        </div>
      </div>
    </div>
  );
};

