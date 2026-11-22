import React from 'react';
import {
  Cpu,
  Plus,
  Trash2,
  RefreshCw,
  MapPin,
  ChevronDown,
} from 'lucide-react';
import { Button } from '../common/ui';
import type { Machine } from '../../types';

export interface AssignMachineRow {
  machine_id: string;
  location: string;
  lease_start_date: string;
  lease_end_date: string;
}

export interface AssignMachinesSectionProps {
  title?: string;
  subtitle?: string;
  rows: AssignMachineRow[];
  availableMachines: Machine[];
  isLoadingMachines?: boolean;
  isOptional?: boolean;
  onRowChange: (index: number, field: keyof AssignMachineRow, value: string) => void;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
}

export const calculateOneYearLeaseEndDate = (startDateStr: string): string => {
  if (!startDateStr || !startDateStr.includes('-')) return '';
  try {
    const parts = startDateStr.split('-');
    if (parts.length !== 3) return '';
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (!y || !m || !d) return '';

    let targetYear = y + 1;
    let targetMonth = m;
    let targetDay = d;

    if (m === 2 && d === 29) {
      targetDay = 28;
    }

    return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
  } catch {
    return '';
  }
};

export const AssignMachinesSection: React.FC<AssignMachinesSectionProps> = ({
  title = 'Machines to assign',
  subtitle = 'Only machines that are not mapped to another client are listed.',
  rows,
  availableMachines,
  isLoadingMachines = false,
  isOptional = false,
  onRowChange,
  onAddRow,
  onRemoveRow,
}) => {
  return (
    <div className="bg-surface-card rounded-2xl border border-border-default p-4 sm:p-6 shadow-2xs">
      <div className="border-b border-surface-hover pb-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-foreground tracking-tight">
            {title}
          </h2>
          <p className="text-xs text-foreground-muted mt-0.5">
            {subtitle}
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onAddRow}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
        >
          Add another machine
        </Button>
      </div>

      {isLoadingMachines ? (
        <div className="py-12 text-center text-xs text-foreground-muted flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-primary" />
          <span>Loading available machines from database...</span>
        </div>
      ) : availableMachines.length === 0 ? (
        <div className="py-10 text-center px-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-foreground-subtle mx-auto mb-3">
            <Cpu className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-foreground">No unassigned machines available</h3>
          <p className="text-xs text-foreground-muted mt-1 max-w-md mx-auto">
            All Foodie units in your fleet are currently mapped to client facilities. Commission a new machine in the fleet inventory to lease units.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="hidden lg:grid grid-cols-12 gap-3 text-xs font-semibold text-foreground-muted pb-2 border-b border-surface-hover px-1">
            <div className="col-span-4">Serial Number</div>
            <div className="col-span-3">Location</div>
            <div className="col-span-2">Lease start date</div>
            <div className="col-span-2">Lease end date (if applicable)</div>
            <div className="col-span-1 text-right">Action</div>
          </div>

          {rows.map((row, index) => {
            const selectedMachine = availableMachines.find((m) => m.id === row.machine_id);

            return (
              <div
                key={index}
                className="p-3.5 rounded-xl border border-border-default bg-surface-card hover:border-border-strong transition-colors flex flex-col lg:grid lg:grid-cols-12 gap-3 items-stretch lg:items-start"
              >
                <div className="lg:col-span-4 min-w-0">
                  <label className="block lg:hidden text-[11px] font-semibold text-foreground-muted mb-1">
                    Serial Number {!isOptional && <span className="text-status-fault-text">*</span>}
                  </label>
                  <div className="relative">
                    <select
                      value={row.machine_id}
                      onChange={(e) => onRowChange(index, 'machine_id', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border-strong bg-surface-card text-xs font-medium text-foreground focus:outline-none focus:border-foreground cursor-pointer appearance-none pr-8"
                      required={!isOptional}
                    >
                      <option value="">{isOptional ? 'Select machine (optional)' : 'Select available / unmapped'}</option>
                      {availableMachines.map((m) => (
                        <option
                          key={m.id}
                          value={m.id}
                          disabled={rows.some((r, i) => i !== index && r.machine_id === m.id)}
                        >
                          {m.serial_number || m.machine_code} ({m.model}{m.capacity ? ` · ${m.capacity}` : ''})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-foreground-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  {selectedMachine && (
                    <div className="text-[10px] text-status-running-text font-medium mt-1 truncate">
                      Selected: {selectedMachine.model} ({selectedMachine.capacity || 'Standard'})
                    </div>
                  )}
                </div>

                <div className="lg:col-span-3 min-w-0">
                  <label className="block lg:hidden text-[11px] font-semibold text-foreground-muted mb-1">
                    Location
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={row.location}
                      onChange={(e) => onRowChange(index, 'location', e.target.value)}
                      placeholder="e.g. Kitchen Loading Bay"
                      className="w-full px-3 py-2 pl-8 rounded-lg border border-border-strong bg-surface-card text-xs text-foreground focus:outline-none focus:border-foreground"
                    />
                    <MapPin className="w-3.5 h-3.5 text-foreground-subtle absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div className="lg:col-span-2 min-w-0">
                  <label className="block lg:hidden text-[11px] font-semibold text-foreground-muted mb-1">
                    Lease start date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={row.lease_start_date}
                      onChange={(e) => onRowChange(index, 'lease_start_date', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border-strong bg-surface-card text-xs text-foreground focus:outline-none focus:border-foreground"
                    />
                  </div>
                </div>

                <div className="lg:col-span-2 min-w-0">
                  <label className="block lg:hidden text-[11px] font-semibold text-foreground-muted mb-1">
                    Lease end date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={row.lease_end_date}
                      onChange={(e) => onRowChange(index, 'lease_end_date', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border-strong bg-surface-card text-xs text-foreground focus:outline-none focus:border-foreground"
                    />
                  </div>
                </div>

                <div className="lg:col-span-1 flex items-start justify-end">
                  <button
                    type="button"
                    onClick={() => onRemoveRow(index)}
                    disabled={rows.length === 1 && !row.machine_id}
                    className="p-2 rounded-lg text-foreground-subtle hover:text-status-fault-text hover:bg-primary-light transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Remove machine row"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          <div className="pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onAddRow}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Add another machine
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

