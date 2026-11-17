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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/ui';
import type { Machine } from '../../types';

export interface MachineDetailViewProps {
  machine: Machine;
  onBack: () => void;
  onEdit?: (machine: Machine) => void;
  onDelete?: (machine: Machine) => void;
}

export const MachineDetailView: React.FC<MachineDetailViewProps> = ({
  machine,
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

  const insideTemp = 42 + (hash % 12);
  const outsideTemp = 17 + (hash % 6);
  const humidity = 18 + (hash % 8);

  const energyUsedToday = ((capacityNum * 0.18) + (hash % 5)).toFixed(1);
  const peakDemand = ((capacityNum * 0.04) + ((hash % 8) * 0.1)).toFixed(1);
  const operatingHours = (5.5 + ((hash % 4) * 0.5)).toFixed(1);
  const outputProducedKg = Math.round(capacityNum * 0.45 + (hash % 15));
  const wasteIntakeKg = Math.round(capacityNum * 0.9 + (hash % 20));
  const energyConsumedKwh = Math.round(capacityNum * 0.16 + (hash % 6));
  const runningHours = 6 + (hash % 4);
  const runningMins = String((hash * 7) % 60).padStart(2, '0');
  const runningTimeStr = `${runningHours} h ${runningMins} min`;
  const compostProducedKg = Math.round(capacityNum * 0.28 + (hash % 10));

  const openFaultsCount = opStatus === 'Halted' ? 2 : 0;
  const isMotorOn = opStatus === 'Running';
  const isAutoMode = opStatus === 'Running';
  const isManualMode = opStatus === 'Idle';
  const isBlowerOn = opStatus === 'Running';
  const isHeaterOn = opStatus === 'Running';

  const formatDate = (dateStr?: string | null): string => {
    if (!dateStr) return 'Active Lease';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const locationText = machine.location_label || machine.site_name || machine.company_name || 'Assigned Facility';

  return (
    <div className="flex flex-col gap-5 max-w-[1400px] w-full min-w-0 mx-auto select-none pb-12">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#6B7280] pt-1">
        <button
          type="button"
          onClick={onBack}
          className="hover:text-[#111827] cursor-pointer transition-colors flex items-center gap-1 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All machines</span>
        </button>
        <span>/</span>
        <span className="font-bold text-[#111827]">
          {machine.machine_code || machine.serial_number}
        </span>
      </nav>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#FFF5F5] text-[#E32032] flex items-center justify-center border border-[#FEE2E2] shrink-0">
            <Cpu className="w-6 h-6 text-[#E32032]" />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
                {machine.machine_code || machine.serial_number}
              </h1>
              <span className="text-sm sm:text-base font-semibold text-[#6B7280]">
                {machine.model || 'Foodie F100'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6B7280]">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#9CA3AF]" />
                <span>Lease start date {formatDate(machine.lease_start_date)}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#9CA3AF]" />
                <span>{locationText}</span>
              </span>
              <span>Capacity {machine.capacity || '100 kg/day'}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                opStatus === 'Running'
                  ? 'bg-[#EAFBF1] text-[#059669]'
                  : opStatus === 'Halted'
                  ? 'bg-[#FEF2F2] text-[#DC2626]'
                  : 'bg-[#F3F4F6] text-[#6B7280]'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  opStatus === 'Running'
                    ? 'bg-[#10B981]'
                    : opStatus === 'Halted'
                    ? 'bg-[#EF4444]'
                    : 'bg-[#9CA3AF]'
                }`}
              />
              {opStatus}
            </span>

            <div className="flex items-center gap-1 text-xs text-[#6B7280] font-medium bg-[#F9FAFB] px-2.5 py-1 rounded-full border border-[#E5E7EB]">
              <Sun className="w-3.5 h-3.5 text-[#F59E0B]" />
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
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-5 shadow-2xs">
          <span className="text-xs font-semibold text-[#6B7280] block mb-1">Energy used</span>
          <div className="text-2xl font-bold text-[#111827] tracking-tight">
            {energyUsedToday} <span className="text-sm font-semibold text-[#6B7280]">kWh</span>
          </div>
          <span className="text-[11px] text-[#9CA3AF] mt-1 block">Today, to 8:40 pm</span>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-5 shadow-2xs">
          <span className="text-xs font-semibold text-[#6B7280] block mb-1">Peak demand</span>
          <div className="text-2xl font-bold text-[#111827] tracking-tight">
            {peakDemand} <span className="text-sm font-semibold text-[#6B7280]">kW</span>
          </div>
          <span className="text-[11px] text-[#9CA3AF] mt-1 block">At 7:52 pm</span>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-5 shadow-2xs">
          <span className="text-xs font-semibold text-[#6B7280] block mb-1">Operating hours</span>
          <div className="text-2xl font-bold text-[#111827] tracking-tight">
            {operatingHours} <span className="text-sm font-semibold text-[#6B7280]">h</span>
          </div>
          <span className="text-[11px] text-[#9CA3AF] mt-1 block">Today</span>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-5 shadow-2xs relative">
          <div className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-[#EAFBF1] text-[#00C951] flex items-center justify-center">
            <Leaf className="w-4 h-4 text-[#00C951]" />
          </div>
          <span className="text-xs font-semibold text-[#6B7280] block mb-1">Output produced</span>
          <div className="text-2xl font-bold text-[#111827] tracking-tight">
            {outputProducedKg} <span className="text-sm font-semibold text-[#6B7280]">kg</span>
          </div>
          <span className="text-[11px] text-[#9CA3AF] mt-1 block">Load cell · last 30 min</span>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 sm:p-6 shadow-2xs flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-[#111827]">Batch in progress</h2>
            <span className="text-xs text-[#6B7280]">Last updated 4:30 pm</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB]">
              <div className="flex items-center gap-1.5 text-xs text-[#6B7280] mb-2">
                <Thermometer className="w-3.5 h-3.5 text-[#9CA3AF]" />
                <span>Inside temperature</span>
              </div>
              <div className="text-xl font-bold text-[#111827]">
                {insideTemp} <span className="text-xs font-normal text-[#6B7280]">°C</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB]">
              <div className="flex items-center gap-1.5 text-xs text-[#6B7280] mb-2">
                <Sun className="w-3.5 h-3.5 text-[#9CA3AF]" />
                <span>Outside temperature</span>
              </div>
              <div className="text-xl font-bold text-[#111827]">
                {outsideTemp} <span className="text-xs font-normal text-[#6B7280]">°C</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB]">
              <div className="flex items-center gap-1.5 text-xs text-[#6B7280] mb-2">
                <Droplets className="w-3.5 h-3.5 text-[#9CA3AF]" />
                <span>Humidity</span>
              </div>
              <div className="text-xl font-bold text-[#111827]">
                {humidity} <span className="text-xs font-normal text-[#6B7280]">%</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB]">
              <div className="flex items-center gap-1.5 text-xs text-[#6B7280] mb-2">
                <DoorClosed className="w-3.5 h-3.5 text-[#9CA3AF]" />
                <span>Door status</span>
              </div>
              <div className="text-sm sm:text-base font-bold text-[#111827] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                <span>Closed</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB]">
              <div className="flex items-center gap-1.5 text-xs text-[#6B7280] mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-[#9CA3AF]" />
                <span>Open faults</span>
              </div>
              <div className="text-sm sm:text-base font-bold text-[#111827] flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    openFaultsCount > 0 ? 'bg-[#EF4444]' : 'bg-[#10B981]'
                  }`}
                />
                <span>{openFaultsCount}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#F3F4F6]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
                Device status
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-[#F9FAFB]">
                <span className="text-[#374151]">System healthy</span>
                <span className="flex items-center gap-1.5 font-semibold text-[#111827]">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                  <span>On</span>
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-[#F9FAFB]">
                <span className="text-[#374151]">Motor on</span>
                <span className="flex items-center gap-1.5 font-semibold text-[#111827]">
                  <span className={`w-2 h-2 rounded-full ${isMotorOn ? 'bg-[#10B981]' : 'bg-[#9CA3AF]'}`} />
                  <span>{isMotorOn ? 'On' : 'Off'}</span>
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-[#F9FAFB]">
                <span className="text-[#374151]">Auto mode</span>
                <span className="flex items-center gap-1.5 font-semibold text-[#111827]">
                  <span className={`w-2 h-2 rounded-full ${isAutoMode ? 'bg-[#10B981]' : 'bg-[#9CA3AF]'}`} />
                  <span>{isAutoMode ? 'On' : 'Off'}</span>
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-[#F9FAFB]">
                <span className="text-[#374151]">Blower on</span>
                <span className="flex items-center gap-1.5 font-semibold text-[#111827]">
                  <span className={`w-2 h-2 rounded-full ${isBlowerOn ? 'bg-[#10B981]' : 'bg-[#9CA3AF]'}`} />
                  <span>{isBlowerOn ? 'On' : 'Off'}</span>
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-[#F9FAFB]">
                <span className="text-[#374151]">Manual mode</span>
                <span className="flex items-center gap-1.5 font-semibold text-[#111827]">
                  <span className={`w-2 h-2 rounded-full ${isManualMode ? 'bg-[#10B981]' : 'bg-[#9CA3AF]'}`} />
                  <span>{isManualMode ? 'On' : 'Off'}</span>
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-[#F9FAFB]">
                <span className="text-[#374151]">Heater on</span>
                <span className="flex items-center gap-1.5 font-semibold text-[#111827]">
                  <span className={`w-2 h-2 rounded-full ${isHeaterOn ? 'bg-[#10B981]' : 'bg-[#9CA3AF]'}`} />
                  <span>{isHeaterOn ? 'On' : 'Off'}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 sm:p-6 shadow-2xs flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-[#111827]">Run history</h2>
            <span className="text-xs text-[#6B7280]">Date range: Today</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB]">
              <span className="text-xs text-[#6B7280] block mb-1.5">Waste intake</span>
              <div className="text-lg sm:text-xl font-bold text-[#111827]">
                {wasteIntakeKg} <span className="text-xs font-normal text-[#6B7280]">kg</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB]">
              <span className="text-xs text-[#6B7280] block mb-1.5">Energy consumed</span>
              <div className="text-lg sm:text-xl font-bold text-[#111827]">
                {energyConsumedKwh} <span className="text-xs font-normal text-[#6B7280]">kWh</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB]">
              <span className="text-xs text-[#6B7280] block mb-1.5">Running time</span>
              <div className="text-lg sm:text-xl font-bold text-[#111827]">{runningTimeStr}</div>
            </div>

            <div className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB]">
              <span className="text-xs text-[#6B7280] block mb-1.5">Compost produced</span>
              <div className="text-lg sm:text-xl font-bold text-[#111827]">
                {compostProducedKg} <span className="text-xs font-normal text-[#6B7280]">kg</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
