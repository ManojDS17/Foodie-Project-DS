import React, { useState, useEffect } from 'react';
import {
  Cpu,
  AlertCircle,
  Save,
  ArrowLeft,
  X,
} from 'lucide-react';
import { machinesApi } from '../../services/api';
import { Button } from '../common/ui';
import type { Machine, MachineModel, Organization } from '../../types';

export interface EditMachineViewProps {
  machine: Machine;
  organizations?: Organization[];
  onBack: () => void;
  onSuccess: (updatedMachine: Machine) => void;
}

export const EditMachineView: React.FC<EditMachineViewProps> = ({
  machine,
  onBack,
  onSuccess,
}) => {
  const [machineModels, setMachineModels] = useState<MachineModel[]>([]);
  const [formData, setFormData] = useState({
    serial_number: machine.serial_number || machine.machine_code || '',
    model: machine.model || 'Foodie F25',
    version: machine.hardware_version || '',
    capacity: machine.capacity || '',
    location: machine.location_label || '',
    location_description: machine.location_description || '',
    plc_software_version: machine.plc_software_version || '',
    energy_meter_model: machine.energy_meter_model || '',
    deodor_model: machine.deodor_model || '',
    extractor_model: machine.extractor_model || '',
    has_stairs: Boolean(machine.has_stairs),
    notes: machine.notes || '',
    connectivity_status: machine.connectivity_status || 'Offline',
    operational_status: machine.operational_status || 'Idle',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load models dynamically from DB
  useEffect(() => {
    machinesApi
      .getModels()
      .then((data) => {
        const order = ['F25', 'F100', 'F500', 'F1000'];
        const sorted = [...data].sort((a, b) => {
          const idxA = order.indexOf(a.model_code);
          const idxB = order.indexOf(b.model_code);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          return a.model_code.localeCompare(b.model_code);
        });
        setMachineModels(sorted);
      })
      .catch((err) => console.error('Failed to load machine models:', err));
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (name === 'model') {
      const selectedModel = machineModels.find(
        (m) => m.model_code === value || m.display_name === value
      );
      setFormData((prev) => ({
        ...prev,
        model: value,
        capacity: selectedModel?.capacity || prev.capacity,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.model.trim()) {
      setError('Model is required.');
      return;
    }
    if (!formData.version.trim()) {
      setError('Version is required.');
      return;
    }
    if (!formData.location.trim()) {
      setError('Installation location is required.');
      return;
    }
    if (!formData.plc_software_version.trim()) {
      setError('PLC software version is required.');
      return;
    }
    if (!formData.energy_meter_model.trim()) {
      setError('Energy meter model is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updated = await machinesApi.update(machine.id, {
        model: formData.model.trim(),
        capacity: formData.capacity.trim() || undefined,
        hardware_version: formData.version.trim() || undefined,
        location_label: formData.location.trim(),
        location_description: formData.location_description.trim() || undefined,
        plc_software_version: formData.plc_software_version.trim(),
        energy_meter_model: formData.energy_meter_model.trim(),
        deodor_model: formData.deodor_model.trim() || undefined,
        extractor_model: formData.extractor_model.trim() || undefined,
        has_stairs: formData.has_stairs,
        notes: formData.notes.trim() || undefined,
        connectivity_status: formData.connectivity_status,
        operational_status: formData.operational_status,
      });

      onSuccess(updated);
    } catch (err: any) {
      setError(err?.message || 'Failed to update machine.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <button
          type="button"
          onClick={onBack}
          className="hover:text-[#111827] cursor-pointer transition-colors"
        >
          {machine.serial_number || machine.machine_code}
        </button>
        <span className="text-[#9CA3AF]">/</span>
        <span className="font-bold text-[#111827]">Edit machine</span>
      </nav>

      {/* 2. Header Profile Card */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#FFF5F5] text-[#E32032] font-bold text-xl flex items-center justify-center border border-[#FEE2E2] shrink-0">
            <Cpu className="w-7 h-7 text-[#E32032]" />
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
                Edit {machine.serial_number || machine.machine_code}
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB]">
                {formData.model}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-[#6B7280] mt-1.5">
              <span className="font-mono font-semibold text-[#111827]">
                {machine.serial_number || machine.machine_code}
              </span>
              <span>Capacity: {formData.capacity || 'Auto-assigned'}</span>
              <span>Status: {formData.operational_status}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons in Header */}
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
            form="edit-machine-full-form"
            variant="primary"
            isLoading={isSubmitting}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save changes
          </Button>
        </div>
      </div>

      {/* Error Alert Banner */}
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

      {/* 3. Form Sections */}
      <form id="edit-machine-full-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Section 1: Machine Specifications */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 shadow-2xs">
          <div className="border-b border-[#F3F4F6] pb-4 mb-6">
            <h2 className="text-base font-bold text-[#111827] tracking-tight">
              Machine Specifications
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Serial identification, dynamic model selection, and automatic capacity management.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Serial number */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Serial number
              </label>
              <input
                type="text"
                value={formData.serial_number}
                readOnly
                disabled
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-[#F9FAFB] text-[#6B7280] text-xs font-mono cursor-not-allowed uppercase"
              />
            </div>

            {/* Model */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Model <span className="text-[#DC2626]">*</span>
              </label>
              <div className="relative">
                <select
                  name="model"
                  value={formData.model}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs cursor-pointer font-medium appearance-none pr-9"
                  required
                >
                  <option value="">Select</option>
                  {machineModels.length > 0 ? (
                    machineModels.map((m) => (
                      <option key={m.id} value={m.model_code}>
                        {m.model_code}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Foodie F25">F25</option>
                      <option value="Foodie F100">F100</option>
                      <option value="Foodie F500">F500</option>
                      <option value="Foodie F1000">F1000</option>
                    </>
                  )}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#6B7280]">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Version */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Hardware version <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="text"
                name="version"
                value={formData.version}
                onChange={handleChange}
                placeholder="e.g. v2.1"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs font-medium"
                required
              />
            </div>

            {/* Capacity (Clean label, Non-editable, Auto-populated) */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Capacity
              </label>
              <input
                type="text"
                name="capacity"
                value={formData.capacity}
                readOnly
                placeholder="Auto-populated from model"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-[#F9FAFB] text-[#374151] text-xs font-medium cursor-not-allowed focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Installation Location */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 shadow-2xs">
          <div className="border-b border-[#F3F4F6] pb-4 mb-6">
            <h2 className="text-base font-bold text-[#111827] tracking-tight">
              Location
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Physical site placement and facility access requirements.
            </p>
          </div>

          <div className="space-y-4">
            {/* Location Label */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Location <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g. 2 Discovery Way, Mawson Lakes 5095"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs font-medium"
                required
              />
            </div>

            {/* Location Description */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Location description (optional)
              </label>
              <textarea
                name="location_description"
                value={formData.location_description}
                onChange={handleChange}
                rows={2}
                placeholder="e.g. Installed at the carpark shed of the client's location"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs resize-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Hardware & Software */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 shadow-2xs">
          <div className="border-b border-[#F3F4F6] pb-4 mb-6">
            <h2 className="text-base font-bold text-[#111827] tracking-tight">
              Hardware & software
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Firmware software versions and connected auxiliary subsystems.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* PLC Software Version */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                PLC software version <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="text"
                name="plc_software_version"
                value={formData.plc_software_version}
                onChange={handleChange}
                placeholder="e.g. v23410712"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs font-medium"
                required
              />
            </div>

            {/* Energy Meter Model */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Energy meter model <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="text"
                name="energy_meter_model"
                value={formData.energy_meter_model}
                onChange={handleChange}
                placeholder="e.g. Victron Energy Meter ET340"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs font-medium"
                required
              />
            </div>

            {/* Deodorizer Model */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Deodor model (optional)
              </label>
              <input
                type="text"
                name="deodor_model"
                value={formData.deodor_model}
                onChange={handleChange}
                placeholder="e.g. Bio-Filter 200"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs"
              />
            </div>

            {/* Extractor Model */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Extractor model (optional)
              </label>
              <input
                type="text"
                name="extractor_model"
                value={formData.extractor_model}
                onChange={handleChange}
                placeholder="e.g. AirFlow-X10"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs"
              />
            </div>

            {/* Has stairs (optional) - Exact Yes / No segmented control */}
            <div className="md:col-span-2 lg:col-span-4">
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Has stairs (optional)
              </label>
              <div className="inline-flex rounded-xl border border-[#D1D5DB] p-0.5 bg-[#F9FAFB]">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, has_stairs: true }))}
                  className={`px-5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                    formData.has_stairs
                      ? 'bg-white text-[#111827] font-semibold shadow-xs border border-[#D1D5DB]'
                      : 'text-[#6B7280] hover:text-[#111827]'
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, has_stairs: false }))}
                  className={`px-5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                    !formData.has_stairs
                      ? 'bg-white text-[#111827] font-semibold shadow-xs border border-[#D1D5DB]'
                      : 'text-[#6B7280] hover:text-[#111827]'
                  }`}
                >
                  No
                </button>
              </div>
            </div>

            {/* Notes */}
            <div className="md:col-span-2 lg:col-span-4">
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Notes (optional)
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={2}
                placeholder="Add any specific installation, maintenance, or commissioning notes..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs resize-none"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Operational Status */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 shadow-2xs">
          <div className="border-b border-[#F3F4F6] pb-4 mb-6">
            <h2 className="text-base font-bold text-[#111827] tracking-tight">
              Operational status
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Live machine operational condition.
            </p>
          </div>

          <div className="max-w-xs">
            <label className="block text-xs font-semibold text-[#171717] mb-1.5">
              Machine status
            </label>
            <select
              name="operational_status"
              value={formData.operational_status}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs cursor-pointer font-medium"
            >
              <option value="Idle">Idle</option>
              <option value="Running">Running</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </div>
        </div>

        {/* Docked Bottom Bar */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-medium text-[#6B7280] hover:text-[#111827] transition-colors cursor-pointer flex items-center justify-center sm:justify-start gap-1.5 px-2 py-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Discard and return</span>
          </button>

          <div className="flex items-center justify-end gap-2.5 sm:gap-3">
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
              Save changes
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
