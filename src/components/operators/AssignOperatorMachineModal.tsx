import React, { useState } from 'react';
import { X, Cpu, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '../common/ui';
import type { User, Machine, OperatorMachineAssignment } from '../../types';

export interface AssignOperatorMachineModalProps {
  isOpen: boolean;
  operator: User | null;
  clientMachines: Machine[];
  existingAssignments: OperatorMachineAssignment[];
  onClose: () => void;
  onAssign: (data: { operator_id: string; machine_id: string; location?: string }) => Promise<void>;
  onRevoke: (assignmentId: string) => Promise<void>;
}

export const AssignOperatorMachineModal: React.FC<AssignOperatorMachineModalProps> = ({
  isOpen,
  operator,
  clientMachines,
  existingAssignments,
  onClose,
  onAssign,
  onRevoke,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!isOpen || !operator) return null;

  const activeAssignments = existingAssignments.filter(
    (a) => a.operator_id === operator.id && a.status === 'Active'
  );

  const activeMachineIds = new Set(activeAssignments.map((a) => a.machine_id));
  const availableToAssign = clientMachines.filter((m) => !activeMachineIds.has(m.id));

  const handleDirectAssign = async (machineId: string) => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const selectedMachine = clientMachines.find((m) => m.id === machineId);
      await onAssign({
        operator_id: operator.id,
        machine_id: machineId,
        location: selectedMachine?.lease_location_label?.trim() || undefined,
      });
    } catch (err: any) {
      setActionError(err?.message || 'Failed to assign machine to operator.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeClick = async (assignmentId: string) => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      await onRevoke(assignmentId);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to revoke machine assignment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-border-default overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-surface-hover flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-light text-primary flex items-center justify-center shrink-0 border border-primary-border">
              <Cpu className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Manage Operator Machines
              </h3>
              <p className="text-xs text-foreground-muted mt-0.5">
                {operator.first_name} {operator.last_name} ({operator.email})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-foreground-subtle hover:text-foreground p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6 overflow-y-auto">
          {actionError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-status-fault-text">
              {actionError}
            </div>
          )}

          <div>
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2.5">
              Currently Assigned Units ({activeAssignments.length})
            </h4>
            {activeAssignments.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-border-strong text-center text-xs text-foreground-muted">
                No machines currently assigned to this operator.
              </div>
            ) : (
              <div className="space-y-2">
                {activeAssignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="p-3 rounded-xl border border-border-default bg-surface-muted flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-foreground block">
                        {assignment.machine_code || assignment.serial_number}
                      </span>
                      <span className="text-foreground-muted text-[11px] block">
                        {assignment.model} {assignment.location ? `· ${assignment.location}` : ''}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRevokeClick(assignment.id)}
                      disabled={isSubmitting}
                      className="px-2.5 py-1.5 rounded-lg border border-primary-border bg-primary-light text-status-fault-text hover:bg-primary-light font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                      title="Revoke machine from this operator"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Revoke</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2.5">
              Available Machines to Assign ({availableToAssign.length})
            </h4>
            {availableToAssign.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-surface-muted border border-border-default text-xs text-foreground-muted flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-status-running-text shrink-0" />
                <span>All client machines are currently assigned to this operator.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {availableToAssign.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl border border-dashed border-border-strong bg-white flex items-center justify-between gap-3 text-xs hover:border-foreground-subtle transition-colors"
                  >
                    <div>
                      <span className="font-mono font-bold text-foreground block">
                        {m.machine_code || m.serial_number}
                      </span>
                      <span className="text-foreground-muted text-[11px] block">
                        {m.model} {m.lease_location_label?.trim() ? `· ${m.lease_location_label.trim()}` : ''}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDirectAssign(m.id)}
                      disabled={isSubmitting}
                      className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5 text-white" />
                      <span>Assign</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 px-6 bg-surface-muted border-t border-surface-hover flex items-center justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};

