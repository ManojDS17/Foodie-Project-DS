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
  const telemetry = machine.telemetry ?? null;

  const hasTempPair =
    telemetry?.inside_temp !== null &&
    telemetry?.inside_temp !== undefined &&
    telemetry?.outside_temp !== null &&
    telemetry?.outside_temp !== undefined;

  const insideTemp = telemetry?.inside_temp ?? null;
  const outsideTemp = telemetry?.outside_temp ?? null;
  const humidity = telemetry?.humidity ?? null;

  const energyUsedToday = telemetry?.energy_used_today ?? null;
  const peakDemand = telemetry?.peak_demand ?? null;
  const operatingHours = telemetry?.operating_hours ?? null;
  const outputProducedKg = telemetry?.output_produced_kg ?? null;
  const wasteIntakeKg = telemetry?.waste_intake_kg ?? null;
  const energyConsumedKwh = telemetry?.energy_consumed_kwh ?? null;
  const runningTimeStr = telemetry?.running_time_str ?? null;
  const compostProducedKg = telemetry?.compost_produced_kg ?? null;

  const doorStatus = telemetry?.door_status ?? null;
  const openFaultsCount = telemetry?.open_faults ?? null;
  const deviceStates: Array<{ label: string; value: boolean | null | undefined }> = [
    { label: 'System healthy', value: telemetry?.system_healthy },
    { label: 'Motor on', value: telemetry?.motor_on },
    { label: 'Auto mode', value: telemetry?.auto_mode },
    { label: 'Blower on', value: telemetry?.blower_on },
    { label: 'Manual mode', value: telemetry?.manual_mode },
    { label: 'Heater on', value: telemetry?.heater_on },
  ];

  const formatMetricValue = (val: number | null | undefined, decimals?: number): string => {
    if (val === null || val === undefined) return '—';
    return typeof decimals === 'number' ? val.toFixed(decimals) : String(val);
  };

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
              <span>
                {hasTempPair
                  ? `Inside ${insideTemp} °C · Outside ${outsideTemp} °C`
                  : 'Telemetry not connected'}
              </span>
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
          {energyUsedToday !== null ? (
            <>
              <div className="text-2xl font-bold text-foreground tracking-tight">
                {formatMetricValue(energyUsedToday, 1)}{' '}
                <span className="text-sm font-semibold text-foreground-muted">kWh</span>
              </div>
              <span className="text-[11px] text-foreground-subtle mt-1 block">Today</span>
            </>
          ) : (
            <>
              <div className="text-lg sm:text-xl font-bold text-foreground-muted tracking-tight">
                Not connected
              </div>
              <span className="text-[11px] text-foreground-subtle mt-1 block">
                Hardware telemetry unavailable
              </span>
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-border-default p-4 sm:p-5 shadow-2xs">
          <span className="text-xs font-semibold text-foreground-muted block mb-1">Peak demand</span>
          {peakDemand !== null ? (
            <>
              <div className="text-2xl font-bold text-foreground tracking-tight">
                {formatMetricValue(peakDemand, 1)}{' '}
                <span className="text-sm font-semibold text-foreground-muted">kW</span>
              </div>
              <span className="text-[11px] text-foreground-subtle mt-1 block">Today</span>
            </>
          ) : (
            <>
              <div className="text-lg sm:text-xl font-bold text-foreground-muted tracking-tight">
                Not connected
              </div>
              <span className="text-[11px] text-foreground-subtle mt-1 block">
                Hardware telemetry unavailable
              </span>
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-border-default p-4 sm:p-5 shadow-2xs">
          <span className="text-xs font-semibold text-foreground-muted block mb-1">Operating hours</span>
          {operatingHours !== null ? (
            <>
              <div className="text-2xl font-bold text-foreground tracking-tight">
                {formatMetricValue(operatingHours, 1)}{' '}
                <span className="text-sm font-semibold text-foreground-muted">h</span>
              </div>
              <span className="text-[11px] text-foreground-subtle mt-1 block">Today</span>
            </>
          ) : (
            <>
              <div className="text-lg sm:text-xl font-bold text-foreground-muted tracking-tight">
                Not connected
              </div>
              <span className="text-[11px] text-foreground-subtle mt-1 block">
                Hardware telemetry unavailable
              </span>
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-border-default p-4 sm:p-5 shadow-2xs relative">
          <div className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-status-running-bg text-status-running-text flex items-center justify-center">
            <Leaf className="w-4 h-4 text-status-running-text" />
          </div>
          <span className="text-xs font-semibold text-foreground-muted block mb-1">Output produced</span>
          {outputProducedKg !== null ? (
            <>
              <div className="text-2xl font-bold text-foreground tracking-tight">
                {formatMetricValue(outputProducedKg)}{' '}
                <span className="text-sm font-semibold text-foreground-muted">kg</span>
              </div>
              <span className="text-[11px] text-foreground-subtle mt-1 block">Today</span>
            </>
          ) : (
            <>
              <div className="text-lg sm:text-xl font-bold text-foreground-muted tracking-tight">
                Not connected
              </div>
              <span className="text-[11px] text-foreground-subtle mt-1 block">
                Hardware telemetry unavailable
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="bg-white rounded-2xl border border-border-default p-5 sm:p-6 shadow-2xs flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-foreground">Batch in progress</h2>
            <span className="text-xs text-foreground-muted">
              {telemetry?.last_updated_label || 'Telemetry not connected'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl border border-border-default bg-surface-muted">
              <div className="flex items-center gap-1.5 text-xs text-foreground-muted mb-2">
                <Thermometer className="w-3.5 h-3.5 text-foreground-subtle" />
                <span>Inside temperature</span>
              </div>
              <div className="text-xl font-bold text-foreground">
                {insideTemp !== null ? (
                  <>
                    {insideTemp} <span className="text-xs font-normal text-foreground-muted">°C</span>
                  </>
                ) : (
                  <span className="text-foreground-muted">—</span>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-border-default bg-surface-muted">
              <div className="flex items-center gap-1.5 text-xs text-foreground-muted mb-2">
                <Sun className="w-3.5 h-3.5 text-foreground-subtle" />
                <span>Outside temperature</span>
              </div>
              <div className="text-xl font-bold text-foreground">
                {outsideTemp !== null ? (
                  <>
                    {outsideTemp} <span className="text-xs font-normal text-foreground-muted">°C</span>
                  </>
                ) : (
                  <span className="text-foreground-muted">—</span>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-border-default bg-surface-muted">
              <div className="flex items-center gap-1.5 text-xs text-foreground-muted mb-2">
                <Droplets className="w-3.5 h-3.5 text-foreground-subtle" />
                <span>Humidity</span>
              </div>
              <div className="text-xl font-bold text-foreground">
                {humidity !== null ? (
                  <>
                    {humidity} <span className="text-xs font-normal text-foreground-muted">%</span>
                  </>
                ) : (
                  <span className="text-foreground-muted">—</span>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-border-default bg-surface-muted">
              <div className="flex items-center gap-1.5 text-xs text-foreground-muted mb-2">
                <DoorClosed className="w-3.5 h-3.5 text-foreground-subtle" />
                <span>Door status</span>
              </div>
              <div className="text-sm sm:text-base font-bold text-foreground flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    doorStatus ? 'bg-status-running-dot' : 'bg-foreground-subtle'
                  }`}
                />
                <span className={doorStatus ? 'text-foreground' : 'text-foreground-muted'}>
                  {doorStatus || 'Not connected'}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-border-default bg-surface-muted">
              <div className="flex items-center gap-1.5 text-xs text-foreground-muted mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-foreground-subtle" />
                <span>Open faults</span>
              </div>
              <div className="text-sm sm:text-base font-bold text-foreground flex items-center gap-1.5">
                {openFaultsCount !== null ? (
                  <>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        openFaultsCount > 0 ? 'bg-status-fault-dot' : 'bg-status-running-dot'
                      }`}
                    />
                    <span>{openFaultsCount}</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-foreground-subtle" />
                    <span className="text-foreground-muted">—</span>
                  </>
                )}
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
              {deviceStates.map((item) => {
                const isKnown = item.value !== null && item.value !== undefined;
                const dotClass = !isKnown
                  ? 'bg-foreground-subtle'
                  : item.value
                  ? 'bg-status-running-dot'
                  : 'bg-foreground-subtle';
                const labelText = !isKnown ? 'Not connected' : item.value ? 'On' : 'Off';
                return (
                  <div
                    key={item.label}
                    className="flex items-center justify-between py-1 border-b border-surface-muted"
                  >
                    <span className="text-foreground-body">{item.label}</span>
                    <span
                      className={`flex items-center gap-1.5 font-semibold ${
                        isKnown ? 'text-foreground' : 'text-foreground-muted'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${dotClass}`} />
                      <span>{labelText}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border-default p-5 sm:p-6 shadow-2xs flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-foreground">Run history</h2>
            <span className="text-xs text-foreground-muted">
              {telemetry ? 'Date range: Today' : 'Telemetry not connected'}
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-border-default bg-surface-muted">
              <span className="text-xs text-foreground-muted block mb-1.5">Waste intake</span>
              <div className="text-lg sm:text-xl font-bold text-foreground">
                {wasteIntakeKg !== null ? (
                  <>
                    {wasteIntakeKg} <span className="text-xs font-normal text-foreground-muted">kg</span>
                  </>
                ) : (
                  <span className="text-foreground-muted">—</span>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-border-default bg-surface-muted">
              <span className="text-xs text-foreground-muted block mb-1.5">Energy consumed</span>
              <div className="text-lg sm:text-xl font-bold text-foreground">
                {energyConsumedKwh !== null ? (
                  <>
                    {energyConsumedKwh}{' '}
                    <span className="text-xs font-normal text-foreground-muted">kWh</span>
                  </>
                ) : (
                  <span className="text-foreground-muted">—</span>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-border-default bg-surface-muted">
              <span className="text-xs text-foreground-muted block mb-1.5">Running time</span>
              <div className="text-lg sm:text-xl font-bold text-foreground">
                {runningTimeStr ? (
                  runningTimeStr
                ) : (
                  <span className="text-foreground-muted">—</span>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-border-default bg-surface-muted">
              <span className="text-xs text-foreground-muted block mb-1.5">Compost produced</span>
              <div className="text-lg sm:text-xl font-bold text-foreground">
                {compostProducedKg !== null ? (
                  <>
                    {compostProducedKg}{' '}
                    <span className="text-xs font-normal text-foreground-muted">kg</span>
                  </>
                ) : (
                  <span className="text-foreground-muted">—</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
