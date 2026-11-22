import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Save,
  ArrowLeft,
  X,
  AlertCircle,
} from 'lucide-react';
import { machinesApi } from '../../services/api';
import { Button } from '../common/ui';
import type { Organization, Machine } from '../../types';
import { AssignMachinesSection, calculateOneYearLeaseEndDate } from './AssignMachinesSection';
import type { AssignMachineRow } from './AssignMachinesSection';

export type { AssignMachineRow };

export interface AssignMachineViewProps {
  client: Organization;
  assignedMachinesCount?: number;
  onBack: () => void;
  onSuccess: () => void;
}

export const AssignMachineView: React.FC<AssignMachineViewProps> = ({
  client,
  assignedMachinesCount = 0,
  onBack,
  onSuccess,
}) => {
  const [availableMachines, setAvailableMachines] = useState<Machine[]>([]);
  const todayStr = new Date().toISOString().split('T')[0];
  const [rows, setRows] = useState<AssignMachineRow[]>([
    {
      machine_id: '',
      location: '',
      lease_start_date: todayStr,
      lease_end_date: calculateOneYearLeaseEndDate(todayStr),
    },
  ]);

  const [isLoadingMachines, setIsLoadingMachines] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoadingMachines(true);
    setError(null);

    machinesApi
      .getAll()
      .then((allMachines) => {
        const unassigned = allMachines.filter((m) => !m.organization_id);
        setAvailableMachines(unassigned);
      })
      .catch((err) => {
        console.error('Failed to load available machines:', err);
        setError('Failed to load available fleet machines.');
      })
      .finally(() => {
        setIsLoadingMachines(false);
      });
  }, [client.id]);

  const handleRowChange = (index: number, field: keyof AssignMachineRow, value: string) => {
    setRows((prev) => {
      const copy = [...prev];
      if (field === 'lease_start_date') {
        const autoEnd = calculateOneYearLeaseEndDate(value);
        copy[index] = {
          ...copy[index],
          lease_start_date: value,
          lease_end_date: autoEnd || copy[index].lease_end_date,
        };
      } else {
        copy[index] = { ...copy[index], [field]: value };
      }
      return copy;
    });
    if (error) setError(null);
  };

  const handleAddRow = () => {
    const today = new Date().toISOString().split('T')[0];
    setRows((prev) => [
      ...prev,
      {
        machine_id: '',
        location: '',
        lease_start_date: today,
        lease_end_date: calculateOneYearLeaseEndDate(today),
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    const today = new Date().toISOString().split('T')[0];
    if (rows.length === 1) {
      setRows([
        {
          machine_id: '',
          location: '',
          lease_start_date: today,
          lease_end_date: calculateOneYearLeaseEndDate(today),
        },
      ]);
      return;
    }
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedRows = rows.filter((r) => r.machine_id.trim());
    if (selectedRows.length === 0) {
      setError('Please select at least one machine to assign.');
      return;
    }

    const ids = selectedRows.map((r) => r.machine_id);
    const hasDuplicates = new Set(ids).size !== ids.length;
    if (hasDuplicates) {
      setError('You have selected the same machine multiple times.');
      return;
    }

    for (let i = 0; i < selectedRows.length; i++) {
      const row = selectedRows[i];
      if (row.lease_start_date && row.lease_end_date && row.lease_end_date < row.lease_start_date) {
        setError(`Row #${i + 1}: Lease end date cannot be earlier than lease start date.`);
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await Promise.all(
        selectedRows.map((row) =>
          machinesApi.update(row.machine_id, {
            organization_id: client.id,
            lease_location_label: row.location.trim() ? row.location.trim() : null,
            lease_start_date: row.lease_start_date || undefined,
            lease_end_date: row.lease_end_date || undefined,
            lease_status: 'Active',
          })
        )
      );

      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to assign machines.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] w-full min-w-0 mx-auto select-none pb-12">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-foreground-muted pt-1">
        <button
          type="button"
          onClick={onBack}
          className="hover:text-foreground cursor-pointer transition-colors flex items-center gap-1 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{client.company_name}</span>
        </button>
        <span className="text-foreground-subtle">/</span>
        <span className="font-bold text-foreground">Assign machine</span>
      </nav>

      <div className="bg-surface-card rounded-2xl border border-border-default p-4 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary-light text-primary font-bold text-xl flex items-center justify-center border border-primary-border shrink-0">
            <Cpu className="w-7 h-7 text-primary" />
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              Assign machine
            </h1>
            <p className="text-xs text-foreground-muted mt-1">
              Lease Foodie composter units to {client.company_name}.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-2.5 shrink-0 w-full sm:w-auto">
          <Button
            type="button"
            variant="secondary"
            onClick={onBack}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="assign-machine-full-form"
            variant="primary"
            isLoading={isSubmitting}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Assign machines
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-primary-light border border-primary-border rounded-xl p-4 flex items-start gap-3 text-xs text-primary animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 shrink-0 text-status-fault-text mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-primary hover:text-primary-hover p-0.5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="bg-surface-card rounded-2xl border border-border-default p-4 sm:p-6 shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-foreground-muted block text-[11px] mb-1 font-medium">Client</span>
            <span className="font-bold text-foreground text-sm block truncate">{client.company_name}</span>
          </div>

          <div>
            <span className="text-foreground-muted block text-[11px] mb-1 font-medium">Client ID</span>
            <span className="font-mono font-bold text-primary text-sm block">
              {client.client_code || '—'}
            </span>
          </div>

          <div>
            <span className="text-foreground-muted block text-[11px] mb-1 font-medium">Machines Assigned</span>
            <span className="font-bold text-foreground text-sm block">
              {assignedMachinesCount}
            </span>
          </div>

          <div>
            <span className="text-foreground-muted block text-[11px] mb-1 font-medium">Available Inventory</span>
            <span className="font-bold text-status-running-text text-sm block">
              {isLoadingMachines ? 'Checking...' : `${availableMachines.length} units`}
            </span>
          </div>
        </div>
      </div>

      <form id="assign-machine-full-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
        <AssignMachinesSection
          title="Machines to assign"
          subtitle="Only machines that are not mapped to another client are listed."
          rows={rows}
          availableMachines={availableMachines}
          isLoadingMachines={isLoadingMachines}
          isOptional={false}
          onRowChange={handleRowChange}
          onAddRow={handleAddRow}
          onRemoveRow={handleRemoveRow}
        />

        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onBack}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Assign machines
          </Button>
        </div>
      </form>
    </div>
  );
};
