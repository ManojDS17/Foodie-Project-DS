import React from 'react';
import {
  Cpu,
  MapPin,
  Wrench,
  Pencil,
  Trash2,
  ArrowLeft,
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

  const isOnline = machine.connectivity_status?.toLowerCase() === 'online';
  const opStatus = machine.operational_status || 'Idle';
  const isAssigned = Boolean(machine.organization_id);

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto select-none pb-12">
      {/* 1. Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#6B7280] pt-1">
        <button
          type="button"
          onClick={onBack}
          className="hover:text-[#111827] cursor-pointer transition-colors flex items-center gap-1 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Machines</span>
        </button>
        <span className="text-[#9CA3AF]">/</span>
        <span className="font-bold text-[#111827]">
          {machine.serial_number || machine.machine_code}
        </span>
      </nav>

      {/* 2. Machine Profile Header Card */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#FFF5F5] text-[#E32032] font-bold text-xl flex items-center justify-center border border-[#FEE2E2] shrink-0">
            <Cpu className="w-7 h-7 text-[#E32032]" />
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
                {machine.serial_number || machine.machine_code}
              </h1>

              {/* Online/Offline Status Badge */}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  isOnline
                    ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
                    : 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isOnline ? 'bg-[#10B981]' : 'bg-[#EF4444]'
                  }`}
                />
                <span>{isOnline ? 'Online' : 'Offline'}</span>
              </span>

              {/* Operational Status Badge */}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  opStatus === 'Running'
                    ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
                    : opStatus === 'Idle'
                    ? 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]'
                    : 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
                }`}
              >
                <span>{opStatus}</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-[#6B7280] mt-1.5">
              <span className="font-semibold text-[#111827]">
                {machine.model}{machine.capacity ? ` · ${machine.capacity}` : ''}
              </span>
              <span>Hardware: {machine.hardware_version || 'v1.0'}</span>
              {machine.location_label && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#9CA3AF]" />
                  <span>{machine.location_label}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 sm:gap-2.5 shrink-0 w-full sm:w-auto">
          {isOem && onDelete && (
            <Button
              type="button"
              variant="danger"
              onClick={() => onDelete(machine)}
              disabled={isAssigned}
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              {isAssigned ? 'Assigned' : 'Delete'}
            </Button>
          )}

          <Button
            type="button"
            variant="secondary"
            onClick={onBack}
          >
            Back to list
          </Button>

          {isOem && onEdit && (
            <Button
              type="button"
              variant="primary"
              onClick={() => onEdit(machine)}
              leftIcon={<Pencil className="w-4 h-4" />}
            >
              Edit machine
            </Button>
          )}
        </div>
      </div>

      {/* 3. Structured Specification Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Card 1: Machine Specifications */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 shadow-2xs">
          <div className="flex items-center gap-2 border-b border-[#F3F4F6] pb-4 mb-5">
            <Cpu className="w-4 h-4 text-[#E32032]" />
            <h2 className="text-sm font-bold text-[#111827] tracking-tight uppercase">
              Machine Specifications
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[#6B7280] block text-[11px] mb-1">Serial Number</span>
              <span className="font-mono font-semibold text-[#111827] text-sm">
                {machine.serial_number || machine.machine_code}
              </span>
            </div>
            <div>
              <span className="text-[#6B7280] block text-[11px] mb-1">Model & Capacity</span>
              <span className="font-semibold text-[#111827] text-sm">
                {machine.model}{machine.capacity ? ` (${machine.capacity})` : ''}
              </span>
            </div>
            <div>
              <span className="text-[#6B7280] block text-[11px] mb-1">Hardware Version</span>
              <span className="font-semibold text-[#111827]">
                {machine.hardware_version || '—'}
              </span>
            </div>
            <div>
              <span className="text-[#6B7280] block text-[11px] mb-1">Fleet Assignment</span>
              <span className="font-semibold text-[#111827]">
                {machine.company_name
                  ? `${machine.company_name} (${machine.client_code || 'Assigned'})`
                  : 'Available (Unassigned)'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Location */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 shadow-2xs">
          <div className="flex items-center gap-2 border-b border-[#F3F4F6] pb-4 mb-5">
            <MapPin className="w-4 h-4 text-[#E32032]" />
            <h2 className="text-sm font-bold text-[#111827] tracking-tight uppercase">
              Location
            </h2>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <span className="text-[#6B7280] block text-[11px] mb-1">Installation Location</span>
              <span className="font-semibold text-[#111827] text-sm">
                {machine.location_label || '—'}
              </span>
            </div>
            {machine.location_description && (
              <div>
                <span className="text-[#6B7280] block text-[11px] mb-1">Location Description</span>
                <span className="text-[#374151] leading-relaxed">
                  {machine.location_description}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Hardware & Software */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 shadow-2xs lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-[#F3F4F6] pb-4 mb-5">
            <Wrench className="w-4 h-4 text-[#E32032]" />
            <h2 className="text-sm font-bold text-[#111827] tracking-tight uppercase">
              Hardware & Software
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-[#6B7280] block text-[11px] mb-1">PLC Software Version</span>
              <span className="font-semibold text-[#111827]">
                {machine.plc_software_version || '—'}
              </span>
            </div>
            <div>
              <span className="text-[#6B7280] block text-[11px] mb-1">Energy Meter Model</span>
              <span className="font-semibold text-[#111827]">
                {machine.energy_meter_model || '—'}
              </span>
            </div>
            <div>
              <span className="text-[#6B7280] block text-[11px] mb-1">Deodor Model</span>
              <span className="font-semibold text-[#111827]">
                {machine.deodor_model || '—'}
              </span>
            </div>
            <div>
              <span className="text-[#6B7280] block text-[11px] mb-1">Extractor Model</span>
              <span className="font-semibold text-[#111827]">
                {machine.extractor_model || '—'}
              </span>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <span className="text-[#6B7280] block text-[11px] mb-1">Has stairs (optional)</span>
              <span className="font-semibold text-[#111827]">
                {machine.has_stairs ? 'Yes' : 'No'}
              </span>
            </div>
            {machine.notes && (
              <div className="sm:col-span-2 lg:col-span-4">
                <span className="text-[#6B7280] block text-[11px] mb-1">Notes</span>
                <span className="text-[#374151] leading-relaxed">
                  {machine.notes}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
