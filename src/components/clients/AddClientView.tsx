import React, { useState, useEffect } from 'react';
import {
  Building2,
  AlertCircle,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  X,
  Eye,
  EyeOff,
  Check,
} from 'lucide-react';
import { orgsApi, machinesApi, usersApi } from '../../services/api';
import { Button } from '../common/ui';
import type { Organization, Machine, User } from '../../types';

export const sanitizePhoneNumber = (val: string): string => {
  return val.replace(/[^0-9+\s()-]/g, '').slice(0, 20);
};

export const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim();
  if (clean.includes('..')) return false;
  const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
  return EMAIL_REGEX.test(clean);
};

export const validatePhoneNumberInput = (phone: string): string | null => {
  const trimmed = phone.trim();
  if (!trimmed) return null;

  if (/[^0-9+\s()-]/.test(trimmed)) {
    return 'Phone number can only contain numbers, spaces, and standard symbols (+, -, ()). Special characters like @, # are not allowed.';
  }
  if (trimmed.length > 20) {
    return 'Phone number cannot exceed 20 characters.';
  }
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length < 7) {
    return 'Please enter a valid phone number with at least 7 digits (e.g. +61 400 000 000).';
  }
  if (digitsOnly.length > 15) {
    return 'Phone number cannot exceed 15 digits.';
  }
  return null;
};

export const limitToMaxWords = (val: string, maxWords: number): string => {
  const trimmed = val.trim();
  if (!trimmed) return val;
  const words = trimmed.split(/\s+/);
  if (words.length <= maxWords) return val;
  return words.slice(0, maxWords).join(' ');
};

export const formatABN = (val: string): string => {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
};

export const isValidABN = (val: string): boolean => {
  const digits = val.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const sum = digits.split('').reduce((acc, char, index) => {
    const digit = index === 0 ? parseInt(char, 10) - 1 : parseInt(char, 10);
    return acc + digit * weights[index];
  }, 0);
  return sum % 89 === 0;
};

export interface AddClientViewProps {
  existingClients?: Organization[];
  onBack: () => void;
  onSuccess: (newOrg: Organization) => void;
}

interface MachineRow {
  machine_id: string;
  location: string;
  lease_start_date: string;
  lease_end_date: string;
}

export const AddClientView: React.FC<AddClientViewProps> = ({
  existingClients,
  onBack,
  onSuccess,
}) => {
  const [clientList, setClientList] = useState<Organization[]>(existingClients || []);
  const [userList, setUserList] = useState<User[]>([]);

  useEffect(() => {
    if (existingClients && existingClients.length > 0) {
      setClientList(existingClients);
    } else {
      orgsApi.getAll().then((data) => setClientList(data)).catch(() => {});
    }
    usersApi.getAll().then((data) => setUserList(data)).catch(() => {});
  }, [existingClients]);

  // Section 1: Client details
  const [clientCode, setClientCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [onboardingDate, setOnboardingDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [businessType, setBusinessType] = useState<string>('');
  const [taxId, setTaxId] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [commsPreference, setCommsPreference] = useState('');

  // Section 2: Contact details
  const [contactPoc, setContactPoc] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [website, setWebsite] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');

  // Section 3: Machine assignments
  const todayStr = new Date().toISOString().split('T')[0];
  const [machineRows, setMachineRows] = useState<MachineRow[]>([
    {
      machine_id: '',
      location: '',
      lease_start_date: todayStr,
      lease_end_date: '',
    },
  ]);

  const [availableMachines, setAvailableMachines] = useState<Machine[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Duplicate & Checksum ABN validation
  const cleanTaxDigits = taxId.replace(/\D/g, '');
  const duplicateClient =
    cleanTaxDigits.length === 11
      ? clientList.find(
          (c) => c.tax_id && c.tax_id.replace(/\D/g, '') === cleanTaxDigits
        )
      : null;
  const isAbnChecksumInvalid = cleanTaxDigits.length === 11 && !isValidABN(cleanTaxDigits);

  // Duplicate Email validation
  const cleanEmail = email.trim().toLowerCase();
  const duplicateClientByEmail = cleanEmail
    ? clientList.find(
        (c) => c.email && c.email.trim().toLowerCase() === cleanEmail
      )
    : null;
  const duplicateUserByEmail = cleanEmail
    ? userList.find(
        (u) => u.email && u.email.trim().toLowerCase() === cleanEmail
      )
    : null;
  const isEmailDuplicate = Boolean(duplicateClientByEmail || duplicateUserByEmail);
  const isEmailFormatInvalid = cleanEmail.length > 0 && cleanEmail.includes('@') && cleanEmail.indexOf('@') < cleanEmail.length - 1 && !isValidEmail(cleanEmail);

  // Password rules validation states
  const hasMinLength = password.length >= 12;
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  // Load next client code and available unmapped machines
  useEffect(() => {
    orgsApi
      .getNextCode()
      .then((res) => {
        if (res?.next_code) {
          setClientCode(res.next_code);
        }
      })
      .catch((err) => console.error('Failed to get next client code:', err));

    machinesApi
      .getAll()
      .then((list) => {
        const unassigned = list.filter((m) => !m.organization_id);
        setAvailableMachines(unassigned);
      })
      .catch((err) => console.error('Failed to load fleet machines:', err));
  }, []);

  const handleAddMachineRow = () => {
    const today = new Date().toISOString().split('T')[0];
    setMachineRows((prev) => [
      ...prev,
      {
        machine_id: '',
        location: '',
        lease_start_date: today,
        lease_end_date: '',
      },
    ]);
  };

  const handleRemoveMachineRow = (index: number) => {
    const today = new Date().toISOString().split('T')[0];
    if (machineRows.length === 1) {
      setMachineRows([
        {
          machine_id: '',
          location: '',
          lease_start_date: today,
          lease_end_date: '',
        },
      ]);
      return;
    }
    setMachineRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateMachineRow = (
    index: number,
    field: keyof MachineRow,
    value: string
  ) => {
    setMachineRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalClientCode = clientCode.trim().toUpperCase();
    if (!finalClientCode) {
      try {
        const res = await orgsApi.getNextCode();
        if (res?.next_code) finalClientCode = res.next_code;
      } catch {}
    }

    if (!companyName.trim()) {
      setError('Full name / Company name is required.');
      return;
    }
    if (companyName.trim().split(/\s+/).length > 20) {
      setError('Full name / Company name cannot exceed 20 words.');
      return;
    }
    if (!contactPoc.trim()) {
      setError('Point of contact name is required.');
      return;
    }
    if (contactPoc.trim().length > 50) {
      setError('Point of contact name cannot exceed 50 characters.');
      return;
    }
    if (!email.trim()) {
      setError('Primary contact email address is required.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address (e.g. name@company.com or name@company.com.au).');
      return;
    }
    if (isEmailDuplicate) {
      setError(
        duplicateClientByEmail
          ? `Email address is already registered to client "${duplicateClientByEmail.company_name}" (${duplicateClientByEmail.client_code}). Please use a different email address.`
          : 'Email address is already registered to an existing account. Please use a different email address.'
      );
      return;
    }
    if (!billingAddress.trim()) {
      setError('Please enter the billing address.');
      return;
    }
    if (taxId.trim()) {
      const abnDigits = taxId.replace(/\D/g, '');
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
          `Tax ID (ABN) "${taxId}" is already registered to client "${duplicateClient.company_name}" (${duplicateClient.client_code}). Duplicate ABNs are not allowed.`
        );
        return;
      }
    }
    if (phoneNumber.trim()) {
      const phoneErr = validatePhoneNumberInput(phoneNumber);
      if (phoneErr) {
        setError(phoneErr);
        return;
      }
    }

    if (!password.trim()) {
      setError('Account password is required for client site admin credentials.');
      return;
    }
    if (password.length < 12) {
      setError('Password must be at least 12 characters long.');
      return;
    }
    if (password.length > 50) {
      setError('Password cannot exceed 50 characters.');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number (0-9).');
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      setError('Password must contain at least one special character / symbol (e.g. !@#$%^&*).');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify confirm password.');
      return;
    }

    for (let i = 0; i < machineRows.length; i++) {
      const row = machineRows[i];
      if (row.machine_id.trim() && row.lease_start_date && row.lease_end_date) {
        if (row.lease_end_date < row.lease_start_date) {
          setError(`Machine #${i + 1}: Lease end date cannot be earlier than lease start date.`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    setError(null);

    const validAssignedMachines = machineRows
      .filter((m) => m.machine_id.trim() !== '')
      .map((m) => ({
        machine_id: m.machine_id.trim(),
        location: m.location.trim() || undefined,
        lease_start_date: m.lease_start_date.trim() || undefined,
        lease_end_date: m.lease_end_date.trim() || undefined,
      }));

    const cleanShipping =
      shippingAddress.trim() &&
      !['same as billing', 'same as billing address'].includes(shippingAddress.trim().toLowerCase())
        ? shippingAddress.trim()
        : undefined;

    try {
      const created = await orgsApi.create({
        client_code: finalClientCode || undefined,
        company_name: companyName.trim(),
        onboarding_date: onboardingDate || undefined,
        business_type: businessType ? (businessType as 'Corporate' | 'Individual') : undefined,
        tax_id: taxId.trim() || undefined,
        contact_poc: contactPoc.trim() || undefined,
        phone_number: phoneNumber.trim() || undefined,
        email: email.trim(),
        password: password.trim(),
        website: website.trim() || undefined,
        billing_address: billingAddress.trim(),
        shipping_address: cleanShipping,
        payment_terms: paymentTerms || undefined,
        comms_preference: commsPreference || undefined,
        assigned_machines:
          validAssignedMachines.length > 0 ? validAssignedMachines : undefined,
        is_active: true,
      });

      onSuccess(created);
    } catch (err: any) {
      setError(err?.message || 'Failed to create client organization.');
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
          <span>Clients</span>
        </button>
        <span className="text-[#9CA3AF]">/</span>
        <span className="font-bold text-[#111827]">Add new client</span>
      </nav>

      {/* 2. Header Profile Card */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#F3F4F6] text-[#111827] font-bold text-xl flex items-center justify-center border border-[#E5E7EB] shrink-0">
            <Building2 className="w-7 h-7 text-[#111827]" />
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
              {companyName || 'New Client'}
            </h1>
            <p className="text-xs text-[#6B7280] mt-1">
              Register an organization, configure commercial terms, and assign machines.
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
            form="add-client-full-form"
            variant="primary"
            isLoading={isSubmitting}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save client
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
      <form id="add-client-full-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Section 1: Client Details */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 shadow-2xs">
          <div className="border-b border-[#F3F4F6] pb-4 mb-6">
            <h2 className="text-base font-bold text-[#111827] tracking-tight">
              Client details
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Core identification, business entity registration, and invoice payment terms.
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
                value={companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  if (error) setError(null);
                }}
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
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
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
                value={taxId}
                onChange={(e) => {
                  setTaxId(formatABN(e.target.value));
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
                value={onboardingDate}
                onChange={(e) => setOnboardingDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs cursor-pointer"
              />
            </div>

            {/* Comms Preference */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Comms preference
              </label>
              <select
                value={commsPreference}
                onChange={(e) => setCommsPreference(e.target.value)}
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
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
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
              Primary operational contact person, billing location, and delivery details.
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
                value={contactPoc}
                onChange={(e) => {
                  setContactPoc(e.target.value.slice(0, 50));
                  if (error && error.includes('Point of contact')) setError(null);
                }}
                maxLength={50}
                required
                placeholder="e.g. Alex Morgan"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs font-medium"
              />
              <p className="text-[11px] text-[#6B7280] mt-1 flex justify-between items-center">
                <span>Primary operational contact person.</span>
                <span className={`text-[11px] ${contactPoc.length >= 50 ? 'text-[#DC2626] font-semibold' : 'text-[#9CA3AF]'}`}>
                  {contactPoc.length}/50 characters
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
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(sanitizePhoneNumber(e.target.value));
                  if (error && error.includes('Phone number')) setError(null);
                }}
                maxLength={20}
                placeholder="e.g. +61 8 8200 1100"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs font-mono"
              />
            </div>

            {/* Email Address */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#171717]">
                  Email address <span className="text-[#DC2626]">*</span>
                </label>
                {isEmailDuplicate ? (
                  <span className="text-[11px] font-semibold text-[#DC2626]">
                    Email already exists
                  </span>
                ) : isEmailFormatInvalid ? (
                  <span className="text-[11px] font-semibold text-[#DC2626]">
                    Invalid email address
                  </span>
                ) : null}
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error && error.includes('email')) setError(null);
                }}
                placeholder="e.g. contact@company.com"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                  isEmailDuplicate || isEmailFormatInvalid
                    ? 'border-[#EF4444] bg-[#FEF2F2] text-[#B91C1C] focus:outline-none focus:border-[#EF4444] focus:ring-1 focus:ring-[#EF4444]'
                    : 'border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717]'
                }`}
                required
              />
              {isEmailDuplicate ? (
                <p className="text-[11px] text-[#DC2626] mt-1.5 flex items-start gap-1 font-medium leading-tight">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#DC2626]" />
                  <span>
                    {duplicateClientByEmail
                      ? `Email is already registered to client "${duplicateClientByEmail.company_name}" (${duplicateClientByEmail.client_code}).`
                      : 'Email is already registered to an existing user account.'}
                  </span>
                </p>
              ) : isEmailFormatInvalid ? (
                <p className="text-[11px] text-[#DC2626] mt-1.5 flex items-start gap-1 font-medium leading-tight">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#DC2626]" />
                  <span>
                    Please enter a valid email address (e.g. name@company.com or name@company.com.au).
                  </span>
                </p>
              ) : null}
            </div>

            {/* Account Password */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Password <span className="text-[#DC2626]">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value.slice(0, 50));
                    if (error) setError(null);
                  }}
                  maxLength={50}
                  placeholder="At least 12 chars, 1 number, 1 symbol"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs font-medium pr-10"
                  required
                  minLength={12}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#888888] hover:text-[#171717] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Confirm password <span className="text-[#DC2626]">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value.slice(0, 50));
                    if (error) setError(null);
                  }}
                  maxLength={50}
                  placeholder="Re-enter login password"
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-white text-[#171717] focus:outline-none text-xs font-medium pr-10 ${
                    confirmPassword
                      ? confirmPassword === password
                        ? 'border-emerald-500 focus:border-emerald-500'
                        : 'border-[#EF4444] focus:border-[#EF4444]'
                      : 'border-[#D1D5DB] focus:border-[#171717]'
                  }`}
                  required
                  minLength={12}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#888888] hover:text-[#171717] cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Interactive Password Requirements Checklist */}
            <div className="md:col-span-2 lg:col-span-3 -mt-1 mb-1 p-3 bg-slate-50 border border-[#E5E7EB] rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-700 font-semibold' : 'text-[#6B7280]'}`}>
                <Check className={`w-3.5 h-3.5 ${hasMinLength ? 'text-emerald-600 stroke-[3]' : 'text-[#9CA3AF]'}`} />
                <span>At least 12 characters</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-700 font-semibold' : 'text-[#6B7280]'}`}>
                <Check className={`w-3.5 h-3.5 ${hasNumber ? 'text-emerald-600 stroke-[3]' : 'text-[#9CA3AF]'}`} />
                <span>One number</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasSymbol ? 'text-emerald-700 font-semibold' : 'text-[#6B7280]'}`}>
                <Check className={`w-3.5 h-3.5 ${hasSymbol ? 'text-emerald-600 stroke-[3]' : 'text-[#9CA3AF]'}`} />
                <span>One symbol</span>
              </div>
              <div className={`flex items-center gap-1.5 ${passwordsMatch ? 'text-emerald-700 font-semibold' : 'text-[#6B7280]'}`}>
                <Check className={`w-3.5 h-3.5 ${passwordsMatch ? 'text-emerald-600 stroke-[3]' : 'text-[#9CA3AF]'}`} />
                <span>Passwords match</span>
              </div>
            </div>

            {/* Website */}
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Website
              </label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="e.g. https://company.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs font-medium"
              />
            </div>

            {/* Billing Address */}
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Billing address <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="text"
                value={billingAddress}
                onChange={(e) => {
                  setBillingAddress(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Railway Ave, Mount Isa QLD 4825"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs"
                required
              />
            </div>

            {/* Shipping Address */}
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Shipping address (optional)
              </label>
              <input
                type="text"
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder="Leave blank or write 'Same as billing'"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Add Foodie to the Client */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F3F4F6] pb-4 mb-6">
            <div>
              <h2 className="text-base font-bold text-[#111827] tracking-tight">
                Add Foodie to the client
              </h2>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Assign available composter units from your unassigned fleet to this client.
              </p>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAddMachineRow}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Add another machine
            </Button>
          </div>

          <div className="space-y-4">
            {machineRows.map((row, idx) => (
              <div
                key={idx}
                className="bg-[#F9FAFB] rounded-xl p-4 border border-[#E5E7EB] grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
              >
                  {/* Select Machine */}
                  <div className="md:col-span-1">
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                      Machine #{idx + 1}
                    </label>
                    <select
                      value={row.machine_id}
                      onChange={(e) => handleUpdateMachineRow(idx, 'machine_id', e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs cursor-pointer font-medium"
                    >
                      <option value="">Select machine (optional)</option>
                      {availableMachines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.serial_number || m.machine_code} ({m.model})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Installation Location */}
                  <div className="md:col-span-1">
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                      Installation location
                    </label>
                    <input
                      type="text"
                      value={row.location}
                      onChange={(e) => handleUpdateMachineRow(idx, 'location', e.target.value)}
                      placeholder="e.g. Kitchen Dock Bay 1"
                      className="w-full px-3.5 py-2 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs"
                    />
                  </div>

                  {/* Lease Period */}
                  <div className="md:col-span-1">
                    <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                      Lease start date
                    </label>
                    <input
                      type="date"
                      value={row.lease_start_date}
                      onChange={(e) => handleUpdateMachineRow(idx, 'lease_start_date', e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs cursor-pointer"
                    />
                  </div>

                  {/* Lease End Date & Remove Action */}
                  <div className="md:col-span-1 flex items-center gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                        Lease end date
                      </label>
                      <input
                        type="date"
                        value={row.lease_end_date}
                        onChange={(e) => handleUpdateMachineRow(idx, 'lease_end_date', e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-[#D1D5DB] bg-white text-[#171717] focus:outline-none focus:border-[#171717] text-xs cursor-pointer"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveMachineRow(idx)}
                      title="Remove machine row"
                      className="p-2.5 rounded-xl border border-[#E5E7EB] bg-white text-[#9CA3AF] hover:text-[#DC2626] hover:bg-[#FEF2F2] hover:border-[#FCA5A5] transition-colors cursor-pointer shrink-0 mt-2 sm:mt-6"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
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
              Save client
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
