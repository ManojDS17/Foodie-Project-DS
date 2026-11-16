import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  X,
  AlertCircle,
  RefreshCw,
  MapPin,
  ChevronDown,
} from 'lucide-react';
import { machinesApi } from '../../services/api';
import { Button } from '../common/ui';
import type { Organization, Machine } from '../../types';

export interface AssignMachineRow {
  machine_id: string;
  location: string;
  lease_start_date: string;
  lease_end_date: string;
}

const calculateFiveYearsLater = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return '';
  const targetYear = y + 5;
  if (m === 2 && d === 29) {
    const isLeap = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
    const targetDay = isLeap ? 29 : 28;
    return `${targetYear}-02-${String(targetDay).padStart(2, '0')}`;
  }
  return `${targetYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

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
      lease_end_date: calculateFiveYearsLater(todayStr),
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
        copy[index] = {
          ...copy[index],
          lease_start_date: value,
          lease_end_date: calculateFiveYearsLater(value),
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
        lease_end_date: calculateFiveYearsLater(today),
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
          lease_end_date: calculateFiveYearsLater(today),
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
            location_label: row.location.trim() || undefined,
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
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#6B7280] pt-1">
        <button
          type="button"
          onClick={onBack}
          className="hover:text-[#111827] cursor-pointer transition-colors flex items-center gap-1 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{client.company_name}</span>
        </button>
        <span className="text-[#9CA3AF]">/</span>
        <span className="font-bold text-[#111827]">Assign machine</span>
      </nav>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#FFF5F5] text-[#E32032] font-bold text-xl flex items-center justify-center border border-[#FEE2E2] shrink-0">
            <Cpu className="w-7 h-7 text-[#E32032]" />
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
              Assign machine
            </h1>
            <p className="text-xs text-[#6B7280] mt-1">
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
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4 flex items-start gap-3 text-xs text-[#991B1B] animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626] mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-[#991B1B] hover:text-[#7F1D1D] p-0.5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-[#6B7280] block text-[11px] mb-1 font-medium">Client</span>
            <span className="font-bold text-[#111827] text-sm block truncate">{client.company_name}</span>
          </div>

          <div>
            <span className="text-[#6B7280] block text-[11px] mb-1 font-medium">Client ID</span>
            <span className="font-mono font-bold text-[#E32032] text-sm block">
              {client.client_code || '—'}
            </span>
          </div>

          <div>
            <span className="text-[#6B7280] block text-[11px] mb-1 font-medium">Machines Assigned</span>
            <span className="font-bold text-[#111827] text-sm block">
              {assignedMachinesCount}
            </span>
          </div>

          <div>
            <span className="text-[#6B7280] block text-[11px] mb-1 font-medium">Available Inventory</span>
            <span className="font-bold text-[#059669] text-sm block">
              {isLoadingMachines ? 'Checking...' : `${availableMachines.length} units`}
            </span>
          </div>
        </div>
      </div>

      <form id="assign-machine-full-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 shadow-2xs">
          <div className="border-b border-[#F3F4F6] pb-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[#111827] tracking-tight">
                Machines to assign
              </h2>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Only machines that are not mapped to another client are listed.
              </p>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAddRow}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Add another machine
            </Button>
          </div>

          {isLoadingMachines ? (
            <div className="py-12 text-center text-xs text-[#6B7280] flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#E32032]" />
              <span>Loading available machines from database...</span>
            </div>
          ) : availableMachines.length === 0 ? (
            <div className="py-10 text-center px-4">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-[#9CA3AF] mx-auto mb-3">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[#111827]">No unassigned machines available</h3>
              <p className="text-xs text-[#6B7280] mt-1 max-w-md mx-auto">
                All Foodie units in your fleet are currently mapped to client facilities. Commission a new machine in the fleet inventory to lease units.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="hidden lg:grid grid-cols-12 gap-3 text-xs font-semibold text-[#6B7280] pb-2 border-b border-[#F3F4F6] px-1">
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
                    className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#FDFDFD] hover:border-[#D1D5DB] transition-colors flex flex-col lg:grid lg:grid-cols-12 gap-3 items-stretch lg:items-center"
                  >
                    <div className="lg:col-span-4 min-w-0">
                      <label className="block lg:hidden text-[11px] font-semibold text-[#6B7280] mb-1">
                        Serial Number <span className="text-[#DC2626]">*</span>
                      </label>
                      <div className="relative">
                        <select
                          value={row.machine_id}
                          onChange={(e) => handleRowChange(index, 'machine_id', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] bg-white text-xs font-medium text-[#111827] focus:outline-none focus:border-[#111827] cursor-pointer appearance-none pr-8"
                          required
                        >
                          <option value="">Select available / unmapped</option>
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
                        <ChevronDown className="w-4 h-4 text-[#6B7280] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                      {selectedMachine && (
                        <div className="text-[10px] text-[#059669] font-medium mt-1 truncate">
                          Selected: {selectedMachine.model} ({selectedMachine.capacity || 'Standard'})
                        </div>
                      )}
                    </div>

                    <div className="lg:col-span-3 min-w-0">
                      <label className="block lg:hidden text-[11px] font-semibold text-[#6B7280] mb-1">
                        Location
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={row.location}
                          onChange={(e) => handleRowChange(index, 'location', e.target.value)}
                          placeholder="e.g. Kitchen Loading Bay"
                          className="w-full px-3 py-2 pl-8 rounded-lg border border-[#D1D5DB] bg-white text-xs text-[#111827] focus:outline-none focus:border-[#111827]"
                        />
                        <MapPin className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-2.5 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    <div className="lg:col-span-2 min-w-0">
                      <label className="block lg:hidden text-[11px] font-semibold text-[#6B7280] mb-1">
                        Lease start date
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          value={row.lease_start_date}
                          onChange={(e) => handleRowChange(index, 'lease_start_date', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] bg-white text-xs text-[#111827] focus:outline-none focus:border-[#111827]"
                        />
                      </div>
                    </div>

                    <div className="lg:col-span-2 min-w-0">
                      <label className="block lg:hidden text-[11px] font-semibold text-[#6B7280] mb-1">
                        Lease end date
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          value={row.lease_end_date}
                          onChange={(e) => handleRowChange(index, 'lease_end_date', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] bg-white text-xs text-[#111827] focus:outline-none focus:border-[#111827]"
                        />
                      </div>
                    </div>

                    <div className="lg:col-span-1 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(index)}
                        disabled={rows.length === 1 && !row.machine_id}
                        className="p-2 rounded-lg text-[#9CA3AF] hover:text-[#DC2626] hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
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
                  onClick={handleAddRow}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Add another machine
                </Button>
              </div>
            </div>
          )}
        </div>

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
