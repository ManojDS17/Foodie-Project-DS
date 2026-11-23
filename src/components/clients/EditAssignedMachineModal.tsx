import React, { useState, useEffect } from 'react';
import { X, Cpu, MapPin, AlertCircle } from 'lucide-react';
import { Button } from '../common/ui';
import { machinesApi } from '../../services/api';
import { calculateOneYearLeaseEndDate } from './AssignMachinesSection';
import { validateLocationInput } from '../machines/AddMachineView';
import type { Machine } from '../../types';

export interface EditAssignedMachineModalProps {
  isOpen: boolean;
  machine: Machine | null;
  clientName: string;
  onClose: () => void;
  onSuccess: (updatedMachine: Machine) => void;
}

export const EditAssignedMachineModal: React.FC<EditAssignedMachineModalProps> = ({
  isOpen,
  machine,
  clientName,
  onClose,
  onSuccess,
}) => {
  const [location, setLocation] = useState('');
  const [leaseStartDate, setLeaseStartDate] = useState('');
  const [leaseEndDate, setLeaseEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (machine) {
      setLocation(machine.lease_location_label || '');
      setLeaseStartDate(
        machine.lease_start_date ? machine.lease_start_date.split('T')[0] : ''
      );
      setLeaseEndDate(
        machine.lease_end_date ? machine.lease_end_date.split('T')[0] : ''
      );
      setError(null);
    }
  }, [machine]);

  if (!isOpen || !machine) return null;

  const handleClose = () => {
    if (isSubmitting) return;
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (location.trim()) {
      const locErr = validateLocationInput(location);
      if (locErr) {
        setError(locErr);
        return;
      }
    }
    if (leaseStartDate && leaseEndDate && leaseEndDate < leaseStartDate) {
      setError('Lease end date cannot be earlier than lease start date.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updated = await machinesApi.update(machine.id, {
        lease_location_label: location.trim() ? location.trim() : null,
        lease_start_date: leaseStartDate || undefined,
        lease_end_date: leaseEndDate || undefined,
      });

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update machine lease details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="bg-surface-card rounded-2xl max-w-lg w-full shadow-2xl border border-border-default overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-surface-hover flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-light text-primary flex items-center justify-center shrink-0 border border-primary-border">
              <Cpu className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Edit Assigned Machine</h3>
              <p className="text-xs text-foreground-muted mt-0.5">
                Update installation location and lease period for {clientName}.
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

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-primary-light border border-primary-border text-xs text-status-fault-text flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-surface-muted border border-border-default text-xs flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-foreground-muted font-medium">Serial Number:</span>
              <span className="font-mono font-bold text-primary">
                {machine.serial_number || machine.machine_code}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground-muted font-medium">Model:</span>
              <span className="font-bold text-foreground">
                {machine.model} {machine.capacity ? `(${machine.capacity})` : ''}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground-muted font-medium">Client:</span>
              <span className="font-medium text-foreground">{clientName}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="assigned-machine-location" className="block text-xs font-semibold text-foreground">
                Installation location
              </label>
              <span className={`text-[11px] ${location.length >= 100 ? 'text-status-fault-text font-semibold' : 'text-foreground-subtle'}`}>
                {location.length}/100 characters
              </span>
            </div>
            <div className="relative">
              <input
                id="assigned-machine-location"
                type="text"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  if (error) setError(null);
                }}
                maxLength={100}
                placeholder="e.g. Kitchen Loading Bay"
                className="w-full px-3.5 py-2 pl-9 rounded-xl border border-border-strong bg-surface-card text-xs text-foreground focus:outline-none focus:border-foreground"
              />
              <MapPin className="w-4 h-4 text-foreground-subtle absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="assigned-machine-start-date" className="block text-xs font-semibold text-foreground mb-1.5">
                Lease start date
              </label>
              <div className="relative">
                <input
                  id="assigned-machine-start-date"
                  type="date"
                  value={leaseStartDate}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    setLeaseStartDate(newStart);
                    if (newStart) {
                      const autoEnd = calculateOneYearLeaseEndDate(newStart);
                      if (autoEnd) setLeaseEndDate(autoEnd);
                    }
                    if (error) setError(null);
                  }}
                  className="w-full px-3.5 py-2 rounded-xl border border-border-strong bg-surface-card text-xs text-foreground focus:outline-none focus:border-foreground cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label htmlFor="assigned-machine-end-date" className="block text-xs font-semibold text-foreground mb-1.5">
                Lease end date
              </label>
              <div className="relative">
                <input
                  id="assigned-machine-end-date"
                  type="date"
                  value={leaseEndDate}
                  onChange={(e) => {
                    setLeaseEndDate(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full px-3.5 py-2 rounded-xl border border-border-strong bg-surface-card text-xs text-foreground focus:outline-none focus:border-foreground cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-hover mt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
            >
              Save changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

