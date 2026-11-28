import React from 'react';
import { LayoutGrid, Plus } from 'lucide-react';
import { formatDate } from '../../services/api';
import type { Machine } from '../../types';
import { RowActionMenu } from '../common/RowActionMenu';

const getModelCapacity = (model: string, capacity?: string | null): string => {
  if (capacity && capacity.trim()) return capacity;
  if (model.includes('1000')) return '1000 kg/day';
  if (model.includes('500')) return '500 kg/day';
  if (model.includes('100')) return '100 kg/day';
  if (model.includes('25')) return '25 kg/day';
  return '100 kg/day';
};

export interface ClientMachineTableProps {
  machines: Machine[];
  activeMachineMenuId: string | null;
  onToggleMenu: (machineId: string | null) => void;
  onAssignMachine: () => void;
  onViewMachine: (machine: Machine) => void;
  onEditLease: (machine: Machine) => void;
  onTerminateLease: (machine: Machine) => void;
}

export const ClientMachineTable: React.FC<ClientMachineTableProps> = ({
  machines,
  activeMachineMenuId,
  onToggleMenu,
  onAssignMachine,
  onViewMachine,
  onEditLease,
  onTerminateLease,
}) => (
  <div>
    <div className="p-6 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h3 className="text-sm font-bold text-foreground">Machines</h3>
        <p className="text-xs text-foreground-muted mt-0.5">
          Foodie machines leased to this client and their live status.
        </p>
      </div>

      <button
        type="button"
        onClick={onAssignMachine}
        className="px-4 py-2 rounded-lg text-xs font-semibold bg-primary hover:bg-primary-hover text-white flex items-center gap-1.5 shadow-2xs self-start sm:self-auto cursor-pointer transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Assign machine</span>
      </button>
    </div>

    {machines.length === 0 ? (
      <div className="p-12 text-center">
        <div className="w-12 h-12 rounded-xl bg-surface-hover flex items-center justify-center text-foreground-subtle mx-auto mb-3">
          <LayoutGrid className="w-6 h-6" />
        </div>
        <h4 className="text-xs font-bold text-foreground">No machines assigned</h4>
        <p className="text-xs text-foreground-muted mt-1 max-w-sm mx-auto">
          This client currently has no Foodie machines mapped. Click "Assign machine" above to lease units.
        </p>
      </div>
    ) : (
      <div className="overflow-x-auto pb-16">
        <table className="w-full text-xs text-left min-w-[700px]">
          <thead>
            <tr className="border-b border-border-default bg-surface-muted text-foreground-muted font-semibold">
              <th className="py-3 px-6">Serial Number</th>
              <th className="py-3 px-6">Model</th>
              <th className="py-3 px-6">Location</th>
              <th className="py-3 px-6">Lease start date</th>
              <th className="py-3 px-6">Machine status</th>
              <th className="py-3 px-6">Connectivity</th>
              <th className="py-3 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {machines.map((m) => {
              const isOnline = (m.connectivity_status || '').toLowerCase() === 'online';
              const isRunning =
                (m.operational_status || '').toLowerCase() === 'running' || isOnline;

              return (
                <tr key={m.id} className="hover:bg-surface-muted transition-colors">
                  <td className="py-4 px-6 font-bold text-primary">
                    <button
                      type="button"
                      onClick={() => onViewMachine(m)}
                      className="underline hover:text-primary-hover cursor-pointer"
                    >
                      {m.serial_number || m.machine_code}
                    </button>
                  </td>

                  <td className="py-4 px-6">
                    <div className="font-bold text-foreground">{m.model}</div>
                    <div className="text-[11px] text-foreground-muted">
                      {getModelCapacity(m.model, m.capacity)}
                    </div>
                  </td>

                  <td className="py-4 px-6 text-foreground">
                    {m.lease_location_label?.trim() || '—'}
                  </td>

                  <td className="py-4 px-6 text-foreground">
                    {formatDate(m.lease_start_date || m.created_at)}
                  </td>

                  <td className="py-4 px-6">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                        isRunning
                          ? 'bg-status-running-bg text-status-running-text border-status-running-dot/30'
                          : 'bg-status-idle-bg text-status-idle-text border-status-idle-dot/30'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isRunning ? 'bg-status-running-dot' : 'bg-status-idle-dot'
                        }`}
                      />
                      <span>{isRunning ? 'Running' : 'Idle'}</span>
                    </span>
                  </td>

                  <td className="py-4 px-6">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                        isOnline
                          ? 'bg-status-running-bg text-status-running-text border-status-running-dot/30'
                          : 'bg-primary-light text-status-fault-text border-primary-border'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isOnline ? 'bg-status-running-dot' : 'bg-status-fault-dot'
                        }`}
                      />
                      <span>{isOnline ? 'Online' : 'Offline'}</span>
                    </span>
                  </td>

                  <td className="py-4 px-6 text-right">
                    <RowActionMenu
                      isOpen={activeMachineMenuId === m.id}
                      onToggle={() =>
                        onToggleMenu(activeMachineMenuId === m.id ? null : m.id)
                      }
                      onClose={() => onToggleMenu(null)}
                      width="w-44"
                      buttonAriaLabel={`Actions for ${m.machine_code || m.serial_number}`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onToggleMenu(null);
                          onEditLease(m);
                        }}
                        className="w-full px-3.5 py-2 text-left text-xs font-semibold text-foreground-body hover:bg-surface-muted transition-colors cursor-pointer"
                      >
                        Edit lease details
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onToggleMenu(null);
                          onViewMachine(m);
                        }}
                        className="w-full px-3.5 py-2 text-left text-xs font-semibold text-foreground-body hover:bg-surface-muted transition-colors cursor-pointer"
                      >
                        View machine
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onToggleMenu(null);
                          onTerminateLease(m);
                        }}
                        className="w-full px-3.5 py-2 text-left text-xs font-semibold text-primary hover:bg-primary-light transition-colors cursor-pointer"
                      >
                        Terminate lease
                      </button>
                    </RowActionMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

