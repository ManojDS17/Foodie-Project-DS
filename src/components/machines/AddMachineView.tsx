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
import type { Machine, MachineModel } from '../../types';

export interface AddMachineViewProps {
  onBack: () => void;
  onSuccess: (newMachine: Machine) => void;
}

export const AddMachineView: React.FC<AddMachineViewProps> = ({
  onBack,
  onSuccess,
}) => {
  const [machineModels, setMachineModels] = useState<MachineModel[]>([]);
  const [formData, setFormData] = useState({
    serial_number: '',
    model: '',
    version: '',
    capacity: '',
    location: '',
    location_description: '',
    plc_software_version: '',
    energy_meter_model: '',
    deodor_model: '',
    extractor_model: '',
    has_stairs: false,
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load next machine serial number and dynamic models from DB
  useEffect(() => {
    machinesApi
      .getNextCode()
      .then((res) => {
        if (res?.next_code) {
          setFormData((prev) => ({ ...prev, serial_number: res.next_code }));
        }
      })
      .catch((err) => console.error('Failed to get next machine code:', err));

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
        capacity: selectedModel?.capacity || '',
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

    let finalSerial = formData.serial_number.trim();
    if (!finalSerial) {
      try {
        const res = await machinesApi.getNextCode();
        if (res?.next_code) finalSerial = res.next_code;
      } catch (err) {
        console.error('Failed to get next serial number:', err);
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const created = await machinesApi.create({
        serial_number: finalSerial || undefined,
        machine_code: finalSerial || undefined,
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
      });

      onSuccess(created);
    } catch (err: any) {
      setError(err?.message || 'Failed to create machine.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto select-none pb-12">
      {/* 1. Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-foreground-muted pt-1">
        <button
          type="button"
          onClick={onBack}
          className="hover:text-foreground cursor-pointer transition-colors flex items-center gap-1 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Machines</span>
        </button>
        <span className="text-foreground-subtle">/</span>
        <span className="font-bold text-foreground">Add new machine</span>
      </nav>

      {/* 2. Header Card */}
      <div className="bg-white rounded-2xl border border-border-default p-4 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary-light text-primary font-bold text-xl flex items-center justify-center border border-primary-border shrink-0">
            <Cpu className="w-7 h-7 text-primary" />
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              Add new machine
            </h1>
            <p className="text-xs text-foreground-muted mt-1">
              Commission a new Foodie composter unit and register it into your fleet inventory.
            </p>
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
            form="add-machine-full-form"
            variant="primary"
            isLoading={isSubmitting}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save machine
          </Button>
        </div>
      </div>

      {/* Error Alert Banner */}
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

      {/* 3. Form Sections */}
      <form id="add-machine-full-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Section 1: Machine Specifications */}
        <div className="bg-white rounded-2xl border border-border-default p-4 sm:p-6 shadow-2xs">
          <div className="border-b border-surface-hover pb-4 mb-6">
            <h2 className="text-base font-bold text-foreground tracking-tight">
              Machine Specifications
            </h2>
            <p className="text-xs text-foreground-muted mt-0.5">
              Dynamic model selection, capacity, and hardware specifications.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Model (Dynamic from DB) */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Model <span className="text-status-fault-text">*</span>
              </label>
              <div className="relative">
                <select
                  name="model"
                  value={formData.model}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs cursor-pointer font-medium appearance-none pr-9"
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
                      <option value="F25">F25</option>
                      <option value="F100">F100</option>
                      <option value="F500">F500</option>
                      <option value="F1000">F1000</option>
                    </>
                  )}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-foreground-muted">
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

            {/* Capacity (Clean label, Non-editable, Auto-populated beside Model) */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Capacity
              </label>
              <input
                type="text"
                name="capacity"
                value={formData.capacity}
                readOnly
                placeholder="Select a model..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-surface-muted text-foreground-body text-xs font-medium cursor-not-allowed focus:outline-none"
              />
            </div>

            {/* Hardware Version */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Hardware version (optional)
              </label>
              <input
                type="text"
                name="version"
                value={formData.version}
                onChange={handleChange}
                placeholder="e.g. v2.1"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs font-medium"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Installation Location */}
        <div className="bg-white rounded-2xl border border-border-default p-4 sm:p-6 shadow-2xs">
          <div className="border-b border-surface-hover pb-4 mb-6">
            <h2 className="text-base font-bold text-foreground tracking-tight">
              Installation Location
            </h2>
          </div>

          <div className="space-y-4">
            {/* Location */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Location <span className="text-status-fault-text">*</span>
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g. 2 Discovery Way, Mawson Lakes 5095"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs font-medium"
                required
              />
            </div>

            {/* Location Description */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Location description (optional)
              </label>
              <textarea
                name="location_description"
                value={formData.location_description}
                onChange={handleChange}
                rows={2}
                placeholder="e.g. Installed at the carpark shed of the client's location"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs resize-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Hardware & Ancillaries */}
        <div className="bg-white rounded-2xl border border-border-default p-4 sm:p-6 shadow-2xs">
          <div className="border-b border-surface-hover pb-4 mb-6">
            <h2 className="text-base font-bold text-foreground tracking-tight">
              Hardware & software
            </h2>
            <p className="text-xs text-foreground-muted mt-0.5">
              Firmware software version and auxiliary composter equipment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* PLC Software Version */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                PLC software version <span className="text-status-fault-text">*</span>
              </label>
              <input
                type="text"
                name="plc_software_version"
                value={formData.plc_software_version}
                onChange={handleChange}
                placeholder="e.g. v20251201"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs font-medium"
                required
              />
            </div>

            {/* Energy Meter Model */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Energy meter model <span className="text-status-fault-text">*</span>
              </label>
              <input
                type="text"
                name="energy_meter_model"
                value={formData.energy_meter_model}
                onChange={handleChange}
                placeholder="e.g. Victron Energy Meter ET340 - 3 phase"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs font-medium"
                required
              />
            </div>

            {/* Deodorizer Model */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Deodor model (optional)
              </label>
              <input
                type="text"
                name="deodor_model"
                value={formData.deodor_model}
                onChange={handleChange}
                placeholder="e.g. D-180"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs"
              />
            </div>

            {/* Extractor Model */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Extractor model (optional)
              </label>
              <input
                type="text"
                name="extractor_model"
                value={formData.extractor_model}
                onChange={handleChange}
                placeholder="e.g. DC-1200P"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs"
              />
            </div>

            {/* Has stairs (optional) - Exact Yes / No segmented control */}
            <div className="md:col-span-2 lg:col-span-4">
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Has stairs (optional)
              </label>
              <div className="inline-flex rounded-xl border border-border-strong p-0.5 bg-surface-muted">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, has_stairs: true }))}
                  className={`px-5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                    formData.has_stairs
                      ? 'bg-white text-foreground font-semibold shadow-xs border border-border-strong'
                      : 'text-foreground-muted hover:text-foreground'
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, has_stairs: false }))}
                  className={`px-5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                    !formData.has_stairs
                      ? 'bg-white text-foreground font-semibold shadow-xs border border-border-strong'
                      : 'text-foreground-muted hover:text-foreground'
                  }`}
                >
                  No
                </button>
              </div>
            </div>

            {/* Notes (optional) */}
            <div className="md:col-span-2 lg:col-span-4">
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Notes (optional)
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={2}
                placeholder="e.g. Deliver to rear access gate"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs resize-none"
              />
            </div>
          </div>
        </div>

        {/* Docked Bottom Bar */}
        <div className="bg-white rounded-2xl border border-border-default p-4 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-medium text-foreground-muted hover:text-foreground transition-colors cursor-pointer flex items-center justify-center sm:justify-start gap-1.5 px-2 py-1"
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
              Save machine
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

