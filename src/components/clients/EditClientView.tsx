import React, { useState, useEffect } from 'react';
import {
  MapPin,
  AlertCircle,
  Save,
  ArrowLeft,
  X,
} from 'lucide-react';
import { orgsApi } from '../../services/api';
import { Button } from '../common/ui';
import { formatABN, isValidABN, sanitizePhoneNumber, validatePhoneNumberInput, isValidEmail } from './AddClientView';
import type { Organization } from '../../types';

export interface EditClientViewProps {
  client: Organization;
  existingClients?: Organization[];
  onBack: () => void;
  onSuccess: (updatedOrg: Organization) => void;
}

export const EditClientView: React.FC<EditClientViewProps> = ({
  client,
  existingClients,
  onBack,
  onSuccess,
}) => {
  const [clientList, setClientList] = useState<Organization[]>(existingClients || []);

  useEffect(() => {
    if (existingClients && existingClients.length > 0) {
      setClientList(existingClients);
    } else {
      orgsApi.getAll().then((data) => setClientList(data)).catch(() => {});
    }
  }, [existingClients]);

  const [formData, setFormData] = useState({
    company_name: client.company_name || '',
    business_type: (client.business_type as 'Corporate' | 'Individual') || '',
    tax_id: client.tax_id || '',
    onboarding_date: client.onboarding_date || (client.created_at ? client.created_at.split('T')[0] : ''),
    comms_preference: client.comms_preference || '',
    payment_terms: client.payment_terms || '',
    contact_poc: client.contact_poc || '',
    phone_number: client.phone_number || '',
    email: client.email || '',
    website: client.website || '',
    billing_address: client.billing_address || '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Duplicate & Checksum ABN validation
  const cleanTaxDigits = formData.tax_id ? formData.tax_id.replace(/\D/g, '') : '';
  const duplicateClient =
    cleanTaxDigits.length === 11
      ? clientList.find(
          (c) =>
            c.id !== client.id &&
            c.tax_id &&
            c.tax_id.replace(/\D/g, '') === cleanTaxDigits
        )
      : null;
  const isAbnChecksumInvalid = cleanTaxDigits.length === 11 && !isValidABN(cleanTaxDigits);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.company_name.trim()) {
      setError('Company name is required.');
      return;
    }
    if (formData.company_name.trim().split(/\s+/).length > 20) {
      setError('Company name cannot exceed 20 words.');
      return;
    }
    if (formData.contact_poc.trim()) {
      if (formData.contact_poc.trim().length > 50) {
        setError('Point of contact name cannot exceed 50 characters.');
        return;
      }
    }
    if (!formData.email.trim() && !client.email) {
      setError('Primary contact email is required.');
      return;
    }
    if (formData.email.trim() && !isValidEmail(formData.email)) {
      setError('Please enter a valid email address (e.g. name@company.com or name@company.com.au).');
      return;
    }
    if (!formData.billing_address.trim()) {
      setError('Please enter the billing address.');
      return;
    }
    if (formData.phone_number.trim()) {
      const phoneErr = validatePhoneNumberInput(formData.phone_number);
      if (phoneErr) {
        setError(phoneErr);
        return;
      }
    }
    if (formData.tax_id.trim()) {
      const abnDigits = formData.tax_id.replace(/\D/g, '');
      if (abnDigits.length !== 11) {
        setError('Tax ID (ABN) must be exactly 11 digits (e.g. 51 824 753 556).');
        return;
      }
      if (!isValidABN(abnDigits)) {
        setError(
          'Invalid Australian Business Number (ABN). The 11-digit ABN does not pass the official ABR Modulus 89 checksum calculation.'
        );
        return;
      }
      if (duplicateClient) {
        setError(
          `Tax ID (ABN) "${formData.tax_id}" is already registered to client "${duplicateClient.company_name}" (${duplicateClient.client_code}). Duplicate ABNs are not allowed.`
        );
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updated = await orgsApi.update(client.id, {
        company_name: formData.company_name.trim(),
        business_type: formData.business_type ? (formData.business_type as 'Corporate' | 'Individual') : undefined,
        tax_id: formData.tax_id.trim() || undefined,
        onboarding_date: formData.onboarding_date || undefined,
        comms_preference: formData.comms_preference || undefined,
        payment_terms: formData.payment_terms || undefined,
        contact_poc: formData.contact_poc.trim() || undefined,
        phone_number: formData.phone_number.trim() || undefined,
        email: client.email || formData.email.trim(),
        website: formData.website.trim() || undefined,
        billing_address: formData.billing_address.trim() || undefined,
      });

      onSuccess(updated);
    } catch (err: any) {
      setError(err?.message || 'Failed to update client organization.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name: string): string => {
    if (!name) return 'CL';
    const clean = name.trim().split(/\s+/);
    if (clean.length === 1) return clean[0].substring(0, 2).toUpperCase();
    return (clean[0][0] + clean[1][0]).toUpperCase();
  };

  const clientStatus = client.status || (client.is_active ? 'Active' : 'Inactive');

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
          <span>Clients</span>
        </button>
        <span className="text-[#9CA3AF]">/</span>
        <button
          type="button"
          onClick={onBack}
          className="hover:text-[#111827] cursor-pointer transition-colors"
        >
          {client.company_name}
        </button>
        <span className="text-[#9CA3AF]">/</span>
        <span className="font-bold text-[#111827]">Edit client</span>
      </nav>

      {/* 2. Client Header Card (Matching Detail View) */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#F3F4F6] text-[#111827] font-bold text-xl flex items-center justify-center border border-[#E5E7EB] shrink-0">
            {getInitials(client.company_name)}
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
                {formData.company_name || client.company_name}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  clientStatus === 'Active'
                    ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
                    : 'bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    clientStatus === 'Active' ? 'bg-[#10B981]' : 'bg-[#9CA3AF]'
                  }`}
                />
                <span>{clientStatus}</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-[#6B7280] mt-1.5">
              <span className="font-mono font-semibold text-[#111827]">{client.client_code}</span>
              <span>{formData.business_type}</span>
              {client.billing_address && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#9CA3AF]" />
                  <span>{client.billing_address}</span>
                </span>
              )}
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
            form="edit-client-full-form"
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

      {/* 3. Form Sections (Full Page Grid) */}
      <form id="edit-client-full-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Section 1: Client Details */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 shadow-2xs">
          <div className="border-b border-[#F3F4F6] pb-4 mb-6">
            <h2 className="text-base font-bold text-[#111827] tracking-tight">
              Client details
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Core legal registration, company identification, and business terms.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Full Name / Company Name */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Full name / Company name <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                placeholder="e.g. Green Valley Foods Pty Ltd"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs font-medium"
                required
              />
            </div>

            {/* Business Type */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Business type
              </label>
              <select
                name="business_type"
                value={formData.business_type}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs cursor-pointer font-medium"
              >
                <option value="">Select</option>
                <option value="Corporate">Corporate</option>
                <option value="Individual">Individual</option>
              </select>
            </div>

            {/* Tax ID (ABN) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#171717]">
                  Tax ID (ABN)
                </label>
                {duplicateClient ? (
                  <span className="text-[11px] font-semibold text-[#DC2626]">
                    Already registered
                  </span>
                ) : isAbnChecksumInvalid ? (
                  <span className="text-[11px] font-semibold text-[#DC2626]">
                    Invalid checksum
                  </span>
                ) : null}
              </div>
              <input
                type="text"
                name="tax_id"
                value={formData.tax_id}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, tax_id: formatABN(e.target.value) }));
                  if (error) setError(null);
                }}
                maxLength={14}
                placeholder="e.g. 51 824 753 556"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono transition-colors ${
                  duplicateClient || isAbnChecksumInvalid
                    ? 'border-[#EF4444] bg-[#FEF2F2] text-[#B91C1C] focus:outline-none focus:border-[#EF4444] focus:ring-1 focus:ring-[#EF4444]'
                    : 'border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717]'
                }`}
              />
              {duplicateClient && (
                <p className="text-[11px] text-[#DC2626] mt-1.5 flex items-start gap-1 font-medium leading-tight">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#DC2626]" />
                  <span>
                    This ABN is already in use by <strong>{duplicateClient.company_name}</strong> ({duplicateClient.client_code}). Please enter a unique ABN.
                  </span>
                </p>
              )}
              {isAbnChecksumInvalid && !duplicateClient && (
                <p className="text-[11px] text-[#DC2626] mt-1.5 flex items-start gap-1 font-medium leading-tight">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#DC2626]" />
                  <span>
                    Invalid ABN. This 11-digit number does not satisfy the official Australian Business Register Modulus 89 checksum.
                  </span>
                </p>
              )}
            </div>

            {/* Onboarding Date */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Onboarding date
              </label>
              <input
                type="date"
                name="onboarding_date"
                value={formData.onboarding_date}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs cursor-pointer"
              />
            </div>

            {/* Comms Preference */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Comms preference
              </label>
              <select
                name="comms_preference"
                value={formData.comms_preference}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs cursor-pointer font-medium"
              >
                <option value="">Select</option>
                <option value="Email">Email</option>
                <option value="Phone">Phone</option>
              </select>
            </div>

            {/* Payment Terms */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Payment terms
              </label>
              <select
                name="payment_terms"
                value={formData.payment_terms}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs cursor-pointer font-medium"
              >
                <option value="">Select</option>
                <option value="15 days">15 days</option>
                <option value="30 days">30 days</option>
                <option value="60 days">60 days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Contact Details */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 shadow-2xs">
          <div className="border-b border-[#F3F4F6] pb-4 mb-6">
            <h2 className="text-base font-bold text-[#111827] tracking-tight">
              Contact details
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Authorized client contact person, direct communication channels, and physical billing/shipping locations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Point of Contact */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Point of contact <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="text"
                name="contact_poc"
                value={formData.contact_poc}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, contact_poc: e.target.value.slice(0, 50) }));
                  if (error && error.includes('Point of contact')) setError(null);
                }}
                maxLength={50}
                required
                placeholder="e.g. Alex Morgan"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs font-medium"
              />
              <p className="text-[11px] text-[#6B7280] mt-1 flex justify-between items-center">
                <span>Primary operational contact person.</span>
                <span className={`text-[11px] ${formData.contact_poc.length >= 50 ? 'text-[#DC2626] font-semibold' : 'text-[#9CA3AF]'}`}>
                  {formData.contact_poc.length}/50 characters
                </span>
              </p>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Phone number
              </label>
              <input
                type="tel"
                name="phone_number"
                value={formData.phone_number}
                onChange={(e) => {
                  const sanitized = sanitizePhoneNumber(e.target.value);
                  setFormData((prev) => ({ ...prev, phone_number: sanitized }));
                  if (error && error.includes('Phone number')) setError(null);
                }}
                maxLength={20}
                placeholder="e.g. +61 8 8200 1100"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs font-mono"
              />
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Email address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                disabled
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-[#F3F4F6] text-[#374151] text-xs font-medium cursor-not-allowed focus:outline-none"
              />
            </div>

            {/* Website */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Website
              </label>
              <input
                type="text"
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="e.g. https://company.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs"
              />
            </div>

            {/* Billing Address */}
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Billing address <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="text"
                name="billing_address"
                value={formData.billing_address}
                onChange={handleChange}
                placeholder="e.g. Railway Ave, Mount Isa QLD 4825"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs"
                required
              />
            </div>
          </div>
        </div>

        {/* Docked / Bottom Action Bar */}
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
