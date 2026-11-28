import React from 'react';
import { Cpu, Edit2, Eye, RefreshCw } from 'lucide-react';
import { formatDate, formatMachineLocation as formatLocation } from '../../services/api';
import type { Machine } from '../../types';
import { PaginationBar } from '../common/RowActionMenu';
import { MachineRowActions } from './MachineRowActions';

const getOperationalBadgeStyles = (opStatus: string) => {
  if (opStatus === 'Running') {
    return {
      pill: 'bg-status-running-bg text-status-running-text border-status-running-dot/30',
      dot: 'bg-status-running-dot',
    };
  }
  if (opStatus === 'Idle') {
    return {
      pill: 'bg-status-idle-bg text-status-idle-text border-status-idle-dot/30',
      dot: 'bg-amber-500',
    };
  }
  if (opStatus === 'Maintenance') {
    return {
      pill: 'bg-status-maint-bg text-status-maint-text border-status-maint-dot/30',
      dot: 'bg-blue-500',
    };
  }
  return {
    pill: 'bg-surface-hover text-foreground-body border-border-default',
    dot: 'bg-foreground-subtle',
  };
};

export interface MachineTableProps {
  machines: Machine[];
  isLoading: boolean;
  isOem: boolean;
  isOperator: boolean;
  activeMenuId: string | null;
  currentPage: number;
  totalPages: number;
  rowsPerPage: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  onToggleMenu: (id: string | null) => void;
  onSelectMachine: (machine: Machine) => void;
  onEditMachine: (machine: Machine) => void;
  onDeleteMachine: (machine: Machine) => void;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;
}

export const MachineTable: React.FC<MachineTableProps> = ({
  machines,
  isLoading,
  isOem,
  isOperator,
  activeMenuId,
  currentPage,
  totalPages,
  rowsPerPage,
  totalItems,
  startIndex,
  endIndex,
  onToggleMenu,
  onSelectMachine,
  onEditMachine,
  onDeleteMachine,
  onPageChange,
  onRowsPerPageChange,
}) => (
  <div className="bg-white rounded-xl border border-border-subtle shadow-xs overflow-hidden">
    <div className="md:hidden divide-y divide-surface-hover">
      {isLoading ? (
        <div className="py-10 text-center text-foreground-muted">
          <div className="flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
            <span>Loading fleet machines from database...</span>
          </div>
        </div>
      ) : machines.length === 0 ? (
        <div className="py-10 text-center text-foreground-muted px-4">
          <Cpu className="w-8 h-8 text-foreground-subtle mx-auto mb-2" />
          <p className="font-bold text-foreground">No machines match current filters</p>
          <p className="text-xs text-foreground-dim mt-1">
            Try clearing search or adjusting your status, client, or location dropdowns.
          </p>
        </div>
      ) : (
        machines.map((m) => {
          const isOnline = m.connectivity_status?.toLowerCase() === 'online';
          const opStatus = m.operational_status || 'Idle';
          const opStyles = getOperationalBadgeStyles(opStatus);

          return (
            <div
              key={m.id}
              className="p-3.5 hover:bg-surface-muted transition-colors flex flex-col gap-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <button
                    type="button"
                    onClick={() => onSelectMachine(m)}
                    className="font-mono font-bold text-sm text-primary underline hover:text-primary-hover cursor-pointer text-left"
                  >
                    {m.machine_code || m.serial_number}
                  </button>
                  <div className="text-xs font-semibold text-foreground mt-0.5">
                    {m.model} {m.capacity ? `· ${m.capacity}` : ''}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      isOnline
                        ? 'bg-status-running-bg text-status-running-text border-status-running-dot/30'
                        : 'bg-surface-hover text-foreground-body border-border-default'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isOnline ? 'bg-status-running-dot' : 'bg-foreground-subtle'
                      }`}
                    />
                    <span>{isOnline ? 'Online' : 'Offline'}</span>
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${opStyles.pill}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${opStyles.dot}`} />
                    <span>{opStatus}</span>
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-foreground-muted">
                {isOem ? (
                  <span>
                    Client: <strong className="text-foreground">{m.company_name || 'Unassigned'}</strong>
                  </span>
                ) : isOperator ? (
                  <span>
                    Total batches: <strong className="text-foreground">{m.total_batches ?? '—'}</strong>
                  </span>
                ) : null}
                <span>{formatLocation(m)}</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-surface-hover">
                <button
                  type="button"
                  onClick={() => onSelectMachine(m)}
                  className="px-3 py-1.5 rounded-lg border border-border-strong text-xs font-semibold text-foreground hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-foreground-muted" />
                  <span>View details</span>
                </button>
                {isOem && (
                  <button
                    type="button"
                    onClick={() => onEditMachine(m)}
                    className="px-3 py-1.5 rounded-lg border border-border-strong text-xs font-semibold text-foreground hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-foreground-muted" />
                    <span>Edit</span>
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>

    <div className="hidden md:block overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <table className="w-full text-left border-collapse text-xs min-w-[750px]">
        <thead>
          <tr className="border-b border-border-default bg-surface-muted text-[11px] font-bold text-foreground-muted">
            <th className="py-3 px-4 font-semibold">Serial Number</th>
            <th className="py-3 px-4 font-semibold">Model</th>
            {isOem && <th className="py-3 px-4 font-semibold">Client</th>}
            {isOperator && <th className="py-3 px-4 font-semibold">Total batches</th>}
            <th className="py-3 px-4 font-semibold">Location</th>
            <th className="py-3 px-4 font-semibold">Lease start date</th>
            <th className="py-3 px-4 font-semibold">Connectivity</th>
            <th className="py-3 px-4 font-semibold">Machine status</th>
            <th className="py-3 px-4 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-hover">
          {isLoading ? (
            <tr>
              <td
                colSpan={isOem || isOperator ? 8 : 7}
                className="py-12 text-center text-foreground-muted"
              >
                <div className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                  <span>Loading fleet machines from database...</span>
                </div>
              </td>
            </tr>
          ) : machines.length === 0 ? (
            <tr>
              <td
                colSpan={isOem || isOperator ? 8 : 7}
                className="py-12 text-center text-foreground-muted"
              >
                <Cpu className="w-8 h-8 text-foreground-subtle mx-auto mb-2" />
                <p className="font-bold text-foreground">No machines match current filters</p>
                <p className="text-xs text-foreground-dim mt-1">
                  Try clearing search or adjusting your status, client, or location dropdowns.
                </p>
              </td>
            </tr>
          ) : (
            machines.map((m) => {
              const isOnline = m.connectivity_status?.toLowerCase() === 'online';
              const opStatus = m.operational_status || 'Idle';
              const opStyles = getOperationalBadgeStyles(opStatus);

              return (
                <tr key={m.id} className="hover:bg-surface-muted transition-colors">
                  <td className="py-3 px-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onSelectMachine(m)}
                      className="font-bold text-primary underline hover:text-primary-hover cursor-pointer whitespace-nowrap font-mono inline-block"
                    >
                      {m.machine_code || m.serial_number}
                    </button>
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-bold text-foreground">{m.model}</div>
                    {m.capacity && (
                      <div className="text-[11px] text-foreground-muted mt-0.5">{m.capacity}</div>
                    )}
                  </td>

                  {isOem && (
                    <td className="py-3 px-4 font-bold text-foreground">
                      {m.company_name || 'Unassigned'}
                    </td>
                  )}

                  {isOperator && (
                    <td className="py-3 px-4 font-semibold text-foreground">
                      {m.total_batches ?? '—'}
                    </td>
                  )}

                  <td className="py-3 px-4 text-foreground">{formatLocation(m)}</td>

                  <td className="py-3 px-4 text-foreground">{formatDate(m.lease_start_date)}</td>

                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                        isOnline
                          ? 'bg-status-running-bg text-status-running-text border-status-running-dot/30'
                          : 'bg-surface-hover text-foreground-body border-border-default'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isOnline ? 'bg-status-running-dot' : 'bg-foreground-subtle'
                        }`}
                      />
                      <span>{isOnline ? 'Online' : 'Offline'}</span>
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${opStyles.pill}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${opStyles.dot}`} />
                      <span>{opStatus}</span>
                    </span>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <MachineRowActions
                      machine={m}
                      isOem={isOem}
                      isOpen={activeMenuId === m.id}
                      onToggle={() => onToggleMenu(activeMenuId === m.id ? null : m.id)}
                      onClose={() => onToggleMenu(null)}
                      onView={() => onSelectMachine(m)}
                      onEdit={() => onEditMachine(m)}
                      onDelete={() => onDeleteMachine(m)}
                    />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>

    <PaginationBar
      variant="machines"
      currentPage={currentPage}
      totalPages={totalPages}
      rowsPerPage={rowsPerPage}
      totalItems={totalItems}
      startIndex={startIndex}
      endIndex={endIndex}
      itemLabel="machines"
      onPageChange={onPageChange}
      onRowsPerPageChange={onRowsPerPageChange}
    />
  </div>
);

