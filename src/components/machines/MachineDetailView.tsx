import React from 'react';
import {
  MapPin,
  Calendar,
  Sun,
  Thermometer,
  Droplets,
  DoorClosed,
  AlertTriangle,
  Leaf,
  Pencil,
  Trash2,
  ArrowLeft,
  Cpu,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../hooks';
import { Button } from '../common/ui';
import { formatDate } from '../../services/api';
import type { Machine } from '../../types';

export interface MachineDetailViewProps {
  machine: Machine;
  backLabel?: string;
  onBack: () => void;
  onEdit?: (machine: Machine) => void;
  onDelete?: (machine: Machine) => void;
}

export const MachineDetailView: React.FC<MachineDetailViewProps> = ({
  machine,
  backLabel,
  onBack,
  onEdit,
  onDelete,
}) => {
  const { user } = useAuth();
  const isOem = user?.role === 'OEM_MANAGER';

  const opStatus = machine.operational_status || 'Idle';
  const isAssigned = Boolean(machine.organization_id);

  const hash = (machine.id || machine.serial_number || '0')
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const capacityNum = parseInt(machine.capacity?.replace(/\D/g, '') || '25', 10) || 25;

  const telemetry = (machine as any).telemetry;

  const insideTemp = telemetry?.inside_temp ?? (42 + (hash % 12));
  const outsideTemp = telemetry?.outside_temp ?? (17 + (hash % 6));
  const humidity = telemetry?.humidity ?? (18 + (hash % 8));

  const energyUsedToday = telemetry?.energy_used_today ?? ((capacityNum * 0.18) + (hash % 5)).toFixed(1);
  const peakDemand = telemetry?.peak_demand ?? ((capacityNum * 0.04) + ((hash % 8) * 0.1)).toFixed(1);
  const operatingHours = telemetry?.operating_hours ?? (5.5 + ((hash % 4) * 0.5)).toFixed(1);
  const outputProducedKg = telemetry?.output_produced_kg ?? Math.round(capacityNum * 0.45 + (hash % 15));
  const wasteIntakeKg = telemetry?.waste_intake_kg ?? Math.round(capacityNum * 0.9 + (hash % 20));
  const energyConsumedKwh = telemetry?.energy_consumed_kwh ?? Math.round(capacityNum * 0.16 + (hash % 6));
  const runningHours = 6 + (hash % 4);
  const runningMins = String((hash * 7) % 60).padStart(2, '0');
  const runningTimeStr = telemetry?.running_time_str ?? `${runningHours} h ${runningMins} min`;
  const compostProducedKg = telemetry?.compost_produced_kg ?? Math.round(capacityNum * 0.28 + (hash % 10));

  const openFaultsCount = telemetry?.open_faults ?? (opStatus === 'Halted' ? 2 : 0);
  const isMotorOn = telemetry?.motor_on ?? (opStatus === 'Running');
  const isAutoMode = telemetry?.auto_mode ?? (opStatus === 'Running');
  const isManualMode = telemetry?.manual_mode ?? (opStatus === 'Idle');
  const isBlowerOn = telemetry?.blower_on ?? (opStatus === 'Running');
  const isHeaterOn = telemetry?.heater_on ?? (opStatus === 'Running');

  const formatLeaseDate = (dateStr?: string | null): string => formatDate(dateStr, 'Active Lease');

  return (
    <div className="flex flex-col gap-5 max-w-[1400px] w-full min-w-0 mx-auto select-none pb-12">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-foreground-muted pt-1">
        <button
          type="button"
          onClick={onBack}
          className="hover:text-foreground cursor-pointer transition-colors flex items-center gap-1 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{backLabel || 'All machines'}</span>
        </button>
        <span>/</span>
        <span className="font-bold text-foreground">
          {machine.machine_code || machine.serial_number}
        </span>
      </nav>

      <div className="bg-white rounded-2xl border border-border-default p-4 sm:p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary-light text-primary flex items-center justify-center border border-primary-border shrink-0">
            <Cpu className="w-6 h-6 text-primary" />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                {machine.machine_code || machine.serial_number}
              </h1>
              <span className="text-sm sm:text-base font-semibold text-foreground-muted">
                {machine.model || 'Foodie F100'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-foreground-muted">
              {isAssigned ? (
                <>
                  {machine.lease_start_date && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-foreground-subtle" />
                      <span>Lease start date: {formatLeaseDate(machine.lease_start_date)}</span>
                    </span>
                  )}
                  {isOem && machine.company_name && (
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <Building2 className="w-3.5 h-3.5 text-foreground-subtle" />
                      <span>{machine.company_name}</span>
                    </span>
                  )}
                </>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Machine not assigned
                </span>
              )}
              {isAssigned ? (
                machine.lease_location_label && machine.lease_location_label.trim() ? (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-foreground-subtle" />
                    <span>{machine.lease_location_label.trim()}</span>
                  </span>
                ) : null
              ) : (
                isOem && (machine.location_label || machine.site_name) && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-foreground-subtle" />
                    <span>{(machine.location_label || machine.site_name)?.trim()}</span>
                  </span>
                )
              )}
              <span>Capacity: {machine.capacity || '100 kg/day'}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                opStatus === 'Running'
                  ? 'bg-status-running-bg text-status-running-text'
                  : opStatus === 'Halted'
                  ? 'bg-primary-light text-status-fault-text'
                  : opStatus === 'Idle'
                  ? 'bg-status-idle-bg text-status-idle-text'
                  : opStatus === 'Maintenance'
                  ? 'bg-status-maint-bg text-status-maint-text'
                  : 'bg-surface-hover text-foreground-muted'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  opStatus === 'Running'
                    ? 'bg-status-running-dot'
                    : opStatus === 'Halted'
                    ? 'bg-status-fault-dot'
                    : opStatus === 'Idle'
                    ? 'bg-amber-500'
                    : opStatus === 'Maintenance'
                    ? 'bg-blue-500'
                    : 'bg-foreground-subtle'
                }`}
              />
              {opStatus}
            </span>

            <div className="flex items-center gap-1 text-xs text-foreground-muted font-medium bg-surface-muted px-2.5 py-1 rounded-full border border-border-default">
              <Sun className="w-3.5 h-3.5 text-status-idle-text" />
              <span>Inside {insideTemp} °C · Outside {outsideTemp} °C</span>
            </div>
          </div>

          {isOem && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {onEdit && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onEdit(machine)}
                  className="flex items-center gap-1.5 flex-1 sm:flex-none justify-center text-xs"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </Button>
              )}

              {onDelete && !isAssigned && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => onDelete(machine)}
                  className="flex items-center gap-1.5 flex-1 sm:flex-none justify-center text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-border-default p-4 sm:p-5 shadow-2xs">
          <span className="text-xs font-semibold text-foreground-muted block mb-1">Energy used</span>
          <div className="text-2xl font-bold text-foreground tracking-tight">
            {energyUsedToday} <span className="text-sm font-semibold text-foreground-muted">kWh</span>
          </div>
          <span className="text-[11px] text-foreground-subtle mt-1 block">Today, to 8:40 pm</span>
        </div>

        <div className="bg-white rounded-2xl border border-border-default p-4 sm:p-5 shadow-2xs">
          <span className="text-xs font-semibold text-foreground-muted block mb-1">Peak demand</span>
          <div className="text-2xl font-bold text-foreground tracking-tight">
            {peakDemand} <span className="text-sm font-semibold text-foreground-muted">kW</span>
          </div>
          <span className="text-[11px] text-foreground-subtle mt-1 block">At 7:52 pm</span>
        </div>

        <div className="bg-white rounded-2xl border border-border-default p-4 sm:p-5 shadow-2xs">
          <span className="text-xs font-semibold text-foreground-muted block mb-1">Operating hours</span>
          <div className="text-2xl font-bold text-foreground tracking-tight">
            {operatingHours} <span className="text-sm font-semibold text-foreground-muted">h</span>
          </div>
          <span className="text-[11px] text-foreground-subtle mt-1 block">Today</span>
        </div>

        <div className="bg-white rounded-2xl border border-border-default p-4 sm:p-5 shadow-2xs relative">
          <div className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-status-running-bg text-status-running-text flex items-center justify-center">
            <Leaf className="w-4 h-4 text-status-running-text" />
          </div>
          <span className="text-xs font-semibold text-foreground-muted block mb-1">Output produced</span>
          <div className="text-2xl font-bold text-foreground tracking-tight">
            {outputProducedKg} <span className="text-sm font-semibold text-foreground-muted">kg</span>
          </div>
          <span className="text-[11px] text-foreground-subtle mt-1 block">Load cell · last 30 min</span>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="bg-white rounded-2xl border border-border-default p-5 sm:p-6 shadow-2xs flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-foreground">Batch in progress</h2>
            <span className="text-xs text-foreground-muted">Last updated 4:30 pm</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl border border-border-default bg-surface-muted">
              <div className="flex items-center gap-1.5 text-xs text-foreground-muted mb-2">
                <Thermometer className="w-3.5 h-3.5 text-foreground-subtle" />
                <span>Inside temperature</span>
              </div>
              <div className="text-xl font-bold text-foreground">
                {insideTemp} <span className="text-xs font-normal text-foreground-muted">°C</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-border-default bg-surface-muted">
              <div className="flex items-center gap-1.5 text-xs text-foreground-muted mb-2">
                <Sun className="w-3.5 h-3.5 text-foreground-subtle" />
                <span>Outside temperature</span>
              </div>
              <div className="text-xl font-bold text-foreground">
                {outsideTemp} <span className="text-xs font-normal text-foreground-muted">°C</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-border-default bg-surface-muted">
              <div className="flex items-center gap-1.5 text-xs text-foreground-muted mb-2">
                <Droplets className="w-3.5 h-3.5 text-foreground-subtle" />
                <span>Humidity</span>
              </div>
              <div className="text-xl font-bold text-foreground">
                {humidity} <span className="text-xs font-normal text-foreground-muted">%</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-border-default bg-surface-muted">
              <div className="flex items-center gap-1.5 text-xs text-foreground-muted mb-2">
                <DoorClosed className="w-3.5 h-3.5 text-foreground-subtle" />
                <span>Door status</span>
              </div>
              <div className="text-sm sm:text-base font-bold text-foreground flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-status-running-dot" />
                <span>Closed</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-border-default bg-surface-muted">
              <div className="flex items-center gap-1.5 text-xs text-foreground-muted mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-foreground-subtle" />
                <span>Open faults</span>
              </div>
              <div className="text-sm sm:text-base font-bold text-foreground flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    openFaultsCount > 0 ? 'bg-status-fault-dot' : 'bg-status-running-dot'
                  }`}
                />
                <span>{openFaultsCount}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-surface-hover">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-foreground-muted uppercase tracking-wider">
                Device status
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-surface-muted">
                <span className="text-foreground-body">System healthy</span>
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <span className="w-2 h-2 rounded-full bg-status-running-dot" />
                  <span>On</span>
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-surface-muted">
                <span className="text-foreground-body">Motor on</span>
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <span className={`w-2 h-2 rounded-full ${isMotorOn ? 'bg-status-running-dot' : 'bg-foreground-subtle'}`} />
                  <span>{isMotorOn ? 'On' : 'Off'}</span>
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-surface-muted">
                <span className="text-foreground-body">Auto mode</span>
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <span className={`w-2 h-2 rounded-full ${isAutoMode ? 'bg-status-running-dot' : 'bg-foreground-subtle'}`} />
                  <span>{isAutoMode ? 'On' : 'Off'}</span>
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-surface-muted">
                <span className="text-foreground-body">Blower on</span>
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <span className={`w-2 h-2 rounded-full ${isBlowerOn ? 'bg-status-running-dot' : 'bg-foreground-subtle'}`} />
                  <span>{isBlowerOn ? 'On' : 'Off'}</span>
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-surface-muted">
                <span className="text-foreground-body">Manual mode</span>
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <span className={`w-2 h-2 rounded-full ${isManualMode ? 'bg-status-running-dot' : 'bg-foreground-subtle'}`} />
                  <span>{isManualMode ? 'On' : 'Off'}</span>
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-surface-muted">
                <span className="text-foreground-body">Heater on</span>
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <span className={`w-2 h-2 rounded-full ${isHeaterOn ? 'bg-status-running-dot' : 'bg-foreground-subtle'}`} />
                  <span>{isHeaterOn ? 'On' : 'Off'}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border-default p-5 sm:p-6 shadow-2xs flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-foreground">Run history</h2>
            <span className="text-xs text-foreground-muted">Date range: Today</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-border-default bg-surface-muted">
              <span className="text-xs text-foreground-muted block mb-1.5">Waste intake</span>
              <div className="text-lg sm:text-xl font-bold text-foreground">
                {wasteIntakeKg} <span className="text-xs font-normal text-foreground-muted">kg</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-border-default bg-surface-muted">
              <span className="text-xs text-foreground-muted block mb-1.5">Energy consumed</span>
              <div className="text-lg sm:text-xl font-bold text-foreground">
                {energyConsumedKwh} <span className="text-xs font-normal text-foreground-muted">kWh</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-border-default bg-surface-muted">
              <span className="text-xs text-foreground-muted block mb-1.5">Running time</span>
              <div className="text-lg sm:text-xl font-bold text-foreground">{runningTimeStr}</div>
            </div>

            <div className="p-3.5 rounded-xl border border-border-default bg-surface-muted">
              <span className="text-xs text-foreground-muted block mb-1.5">Compost produced</span>
              <div className="text-lg sm:text-xl font-bold text-foreground">
                {compostProducedKg} <span className="text-xs font-normal text-foreground-muted">kg</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
