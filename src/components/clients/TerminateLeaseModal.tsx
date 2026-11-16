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
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#E5E7EB] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-[#F3F4F6] flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-[#E32032] flex items-center justify-center shrink-0 border border-red-100">
              <AlertTriangle className="w-5 h-5 text-[#E32032]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#111827]">Terminate Machine Lease</h3>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Remove machine from {clientName} and return to fleet.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-[#9CA3AF] hover:text-[#111827] p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#DC2626]">
              {error}
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] text-xs flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[#6B7280]">Machine Code:</span>
              <span className="font-mono font-bold text-[#111827]">{machine.machine_code || machine.serial_number}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6B7280]">Model:</span>
              <span className="font-medium text-[#111827]">{machine.model}</span>
            </div>
            {machine.location_label && (
              <div className="flex items-center justify-between">
                <span className="text-[#6B7280]">Current Location:</span>
                <span className="font-medium text-[#111827]">{machine.location_label}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#374151]">
              Termination Reason / Remark <span className="text-[#DC2626]">*</span>
            </label>
            <textarea
              rows={3}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="e.g., Client contract ended, facility relocation, upgraded to higher capacity model..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#D1D5DB] focus:outline-none focus:border-[#111827] text-[#111827] resize-none"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="p-4 px-6 bg-[#F9FAFB] border-t border-[#F3F4F6] flex items-center justify-end gap-2.5">
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

