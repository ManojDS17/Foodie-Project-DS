import React, { useState, useEffect } from 'react';
import {
  Building2,
  AlertCircle,
  Save,
  ArrowLeft,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  orgsApi,
  machinesApi,
  usersApi,
  sanitizePhoneNumber,
  isValidEmail,
  validatePhoneNumberInput,
  formatABN,
  isValidABN,
  validatePasswordPolicy,
  calculateOneYearLeaseEndDate,
  getTodayIsoDate,
} from '../../services/api';
import { Button } from '../common/ui';
import { PasswordRequirements } from '../common/InputField';
import type { Organization, Machine, User } from '../../types';
import { AssignMachinesSection, type AssignMachineRow } from './AssignMachinesSection';

export interface ClientDetailsFieldsValues {
  company_name: string;
  business_type: string;
  tax_id: string;
  onboarding_date: string;
  comms_preference: string;
  payment_terms: string;
}

export interface ClientDetailsSectionProps {
  values: ClientDetailsFieldsValues;
  subtitle?: string;
  duplicateClient?: Organization | null;
  isAbnChecksumInvalid: boolean;
  onFieldChange: (field: keyof ClientDetailsFieldsValues, value: string) => void;
}

export const ClientDetailsSection: React.FC<ClientDetailsSectionProps> = ({
  values,
  subtitle = 'Core identification, business entity registration, and invoice payment terms.',
  duplicateClient,
  isAbnChecksumInvalid,
  onFieldChange,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-border-default p-4 sm:p-6 shadow-2xs">
      <div className="border-b border-surface-hover pb-4 mb-6">
        <h2 className="text-base font-bold text-foreground tracking-tight">
          Client details
        </h2>
        <p className="text-xs text-foreground-muted mt-0.5">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Full Name / Company Name */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Full name / Company name <span className="text-status-fault-text">*</span>
          </label>
          <input
            type="text"
            name="company_name"
            value={values.company_name}
            onChange={(e) => onFieldChange('company_name', e.target.value)}
            placeholder="e.g. Green Valley Foods Pty Ltd"
            className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs font-medium"
            required
          />
        </div>

        {/* Business Type */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Business type
          </label>
          <select
            name="business_type"
            value={values.business_type}
            onChange={(e) => onFieldChange('business_type', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs cursor-pointer font-medium"
          >
            <option value="">Select</option>
            <option value="Corporate">Corporate</option>
            <option value="Individual">Individual</option>
          </select>
        </div>

        {/* Tax ID (ABN) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-foreground">
              Tax ID (ABN)
            </label>
            {duplicateClient ? (
              <span className="text-[11px] font-semibold text-status-fault-text">
                Already registered
              </span>
            ) : isAbnChecksumInvalid ? (
              <span className="text-[11px] font-semibold text-status-fault-text">
                Invalid checksum
              </span>
            ) : null}
          </div>
          <input
            type="text"
            name="tax_id"
            value={values.tax_id}
            onChange={(e) => onFieldChange('tax_id', formatABN(e.target.value))}
            maxLength={14}
            placeholder="e.g. 51 824 753 556"
            className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono transition-colors ${
              duplicateClient || isAbnChecksumInvalid
                ? 'border-primary bg-primary-light text-status-fault-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary'
                : 'border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground'
            }`}
          />
          {duplicateClient && (
            <p className="text-[11px] text-status-fault-text mt-1.5 flex items-start gap-1 font-medium leading-tight">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-status-fault-text" />
              <span>
                This ABN is already in use by <strong>{duplicateClient.company_name}</strong> ({duplicateClient.client_code}). Please enter a unique ABN.
              </span>
            </p>
          )}
          {isAbnChecksumInvalid && !duplicateClient && (
            <p className="text-[11px] text-status-fault-text mt-1.5 flex items-start gap-1 font-medium leading-tight">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-status-fault-text" />
              <span>
                Invalid ABN. This 11-digit number does not satisfy the official Australian Business Register Modulus 89 checksum.
              </span>
            </p>
          )}
        </div>

        {/* Onboarding Date */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Onboarding date
          </label>
          <input
            type="date"
            name="onboarding_date"
            value={values.onboarding_date}
            onChange={(e) => onFieldChange('onboarding_date', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs cursor-pointer"
          />
        </div>

        {/* Comms Preference */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Comms preference
          </label>
          <select
            name="comms_preference"
            value={values.comms_preference}
            onChange={(e) => onFieldChange('comms_preference', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs cursor-pointer font-medium"
          >
            <option value="">Select</option>
            <option value="Email">Email</option>
            <option value="Phone">Phone</option>
          </select>
        </div>

        {/* Payment Terms */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Payment terms
          </label>
          <select
            name="payment_terms"
            value={values.payment_terms}
            onChange={(e) => onFieldChange('payment_terms', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs cursor-pointer font-medium"
          >
            <option value="">Select</option>
            <option value="15 days">15 days</option>
            <option value="30 days">30 days</option>
            <option value="60 days">60 days</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export interface AddClientViewProps {
  existingClients?: Organization[];
  onBack: () => void;
  onSuccess: (newOrg: Organization) => void;
}

type MachineRow = AssignMachineRow;

export const AddClientView: React.FC<AddClientViewProps> = ({
  existingClients,
  onBack,
  onSuccess,
}) => {
  const [prevExistingClients, setPrevExistingClients] = useState(existingClients);
  const [clientList, setClientList] = useState<Organization[]>(existingClients || []);
  const [userList, setUserList] = useState<User[]>([]);

  if (existingClients !== prevExistingClients) {
    setPrevExistingClients(existingClients);
    if (existingClients && existingClients.length > 0) {
      setClientList(existingClients);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    if (!existingClients || existingClients.length === 0) {
      orgsApi
        .getAll(undefined, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) setClientList(data);
        })
        .catch(() => {});
    }
    usersApi
      .getAll(undefined, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setUserList(data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [existingClients]);

  // Section 1: Client details
  const [clientCode, setClientCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [onboardingDate, setOnboardingDate] = useState(() => getTodayIsoDate());
  const [businessType, setBusinessType] = useState<string>('');
  const [taxId, setTaxId] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [commsPreference, setCommsPreference] = useState('');

  // Section 2: Contact details
  const [contactPoc, setContactPoc] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [website, setWebsite] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');

  // Section 3: Machine assignments
  const [machineRows, setMachineRows] = useState<MachineRow[]>(() => {
    const todayStr = getTodayIsoDate();
    return [
      {
        machine_id: '',
        location: '',
        lease_start_date: todayStr,
        lease_end_date: calculateOneYearLeaseEndDate(todayStr),
      },
    ];
  });

  const [availableMachines, setAvailableMachines] = useState<Machine[]>([]);
  const [isLoadingMachines, setIsLoadingMachines] = useState(true);
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
  const isEmailDuplicate = emailTouched && Boolean(duplicateClientByEmail || duplicateUserByEmail);
  const isEmailFormatInvalid = emailTouched && cleanEmail.length > 0 && !isValidEmail(cleanEmail);

  // Load next client code and available unmapped machines
  useEffect(() => {
    const controller = new AbortController();

    orgsApi
      .getNextCode()
      .then((res) => {
        if (!controller.signal.aborted && res?.next_code) {
          setClientCode(res.next_code);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) console.error('Failed to get next client code:', err);
      });

    machinesApi
      .getAll(undefined, controller.signal)
      .then((list) => {
        if (controller.signal.aborted) return;
        const unassigned = list.filter((m) => !m.organization_id);
        setAvailableMachines(unassigned);
      })
      .catch((err) => {
        if (!controller.signal.aborted) console.error('Failed to load fleet machines:', err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingMachines(false);
      });

    return () => controller.abort();
  }, []);

  const handleAddMachineRow = () => {
    const today = new Date().toISOString().split('T')[0];
    setMachineRows((prev) => [
      ...prev,
      {
        machine_id: '',
        location: '',
        lease_start_date: today,
        lease_end_date: calculateOneYearLeaseEndDate(today),
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
          lease_end_date: calculateOneYearLeaseEndDate(today),
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
      if (field === 'lease_start_date') {
        const autoEnd = calculateOneYearLeaseEndDate(value);
        updated[index] = {
          ...updated[index],
          lease_start_date: value,
          lease_end_date: autoEnd || updated[index].lease_end_date,
        };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
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
      setEmailTouched(true);
      setError('Please enter a valid email address (e.g. name@company.com or name@company.com.au).');
      return;
    }
    if (isEmailDuplicate) {
      setEmailTouched(true);
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
    const passwordErr = validatePasswordPolicy(password, 'Password');
    if (passwordErr) {
      setError(passwordErr);
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
          setError(`Row #${i + 1}: Lease end date cannot be earlier than lease start date.`);
          return;
        }
      }
    }

    const selectedMachineRows = machineRows.filter((r) => r.machine_id.trim());
    const machineIds = selectedMachineRows.map((r) => r.machine_id);
    if (new Set(machineIds).size !== machineIds.length) {
      setError('You have selected the same machine multiple times.');
      return;
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
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-foreground-muted pt-1">
        <button
          type="button"
          onClick={onBack}
          className="hover:text-foreground cursor-pointer transition-colors flex items-center gap-1 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Clients</span>
        </button>
        <span className="text-foreground-subtle">/</span>
        <span className="font-bold text-foreground">Add new client</span>
      </nav>

      {/* 2. Header Profile Card */}
      <div className="bg-white rounded-2xl border border-border-default p-4 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-surface-hover text-foreground font-bold text-xl flex items-center justify-center border border-border-default shrink-0">
            <Building2 className="w-7 h-7 text-foreground" />
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              {companyName || 'New Client'}
            </h1>
            <p className="text-xs text-foreground-muted mt-1">
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
      <form id="add-client-full-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
        <ClientDetailsSection
          values={{
            company_name: companyName,
            business_type: businessType,
            tax_id: taxId,
            onboarding_date: onboardingDate,
            comms_preference: commsPreference,
            payment_terms: paymentTerms,
          }}
          subtitle="Core identification, business entity registration, and invoice payment terms."
          duplicateClient={duplicateClient}
          isAbnChecksumInvalid={isAbnChecksumInvalid}
          onFieldChange={(field: keyof ClientDetailsFieldsValues, value: string) => {
            if (field === 'company_name') setCompanyName(value);
            else if (field === 'business_type') setBusinessType(value);
            else if (field === 'tax_id') setTaxId(value);
            else if (field === 'onboarding_date') setOnboardingDate(value);
            else if (field === 'comms_preference') setCommsPreference(value);
            else if (field === 'payment_terms') setPaymentTerms(value);
            if (error) setError(null);
          }}
        />

        {/* Section 2: Contact Details */}
        <div className="bg-white rounded-2xl border border-border-default p-4 sm:p-6 shadow-2xs">
          <div className="border-b border-surface-hover pb-4 mb-6">
            <h2 className="text-base font-bold text-foreground tracking-tight">
              Contact details
            </h2>
            <p className="text-xs text-foreground-muted mt-0.5">
              Primary operational contact person, billing location, and delivery details.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Point of Contact */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Point of contact <span className="text-status-fault-text">*</span>
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs font-medium"
              />
              <p className="text-[11px] text-foreground-muted mt-1 flex justify-between items-center">
                <span>Primary operational contact person.</span>
                <span className={`text-[11px] ${contactPoc.length >= 50 ? 'text-status-fault-text font-semibold' : 'text-foreground-subtle'}`}>
                  {contactPoc.length}/50 characters
                </span>
              </p>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Phone number
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(sanitizePhoneNumber(e.target.value));
                  if (error && error.includes('Phone number')) setError(null);
                }}
                maxLength={15}
                placeholder="e.g. +61 8 8200 1100"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs font-mono"
              />
            </div>

            {/* Email Address */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Email address <span className="text-status-fault-text">*</span>
                </label>
                {isEmailDuplicate ? (
                  <span className="text-[11px] font-semibold text-status-fault-text">
                    Email already exists
                  </span>
                ) : isEmailFormatInvalid ? (
                  <span className="text-[11px] font-semibold text-status-fault-text">
                    Invalid email address
                  </span>
                ) : null}
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailTouched(false);
                  if (error && error.includes('email')) setError(null);
                }}
                onBlur={() => {
                  if (email.trim()) {
                    setEmailTouched(true);
                  }
                }}
                placeholder="e.g. contact@company.com"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                  isEmailDuplicate || isEmailFormatInvalid
                    ? 'border-primary bg-primary-light text-status-fault-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary'
                    : 'border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground'
                }`}
                required
              />
              {isEmailDuplicate ? (
                <p className="text-[11px] text-status-fault-text mt-1.5 flex items-start gap-1 font-medium leading-tight">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-status-fault-text" />
                  <span>
                    {duplicateClientByEmail
                      ? `Email is already registered to client "${duplicateClientByEmail.company_name}" (${duplicateClientByEmail.client_code}).`
                      : 'Email is already registered to an existing user account.'}
                  </span>
                </p>
              ) : isEmailFormatInvalid ? (
                <p className="text-[11px] text-status-fault-text mt-1.5 flex items-start gap-1 font-medium leading-tight">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-status-fault-text" />
                  <span>
                    Please enter a valid email address (e.g. name@company.com or name@company.com.au).
                  </span>
                </p>
              ) : null}
            </div>

            {/* Account Password & Confirm Password Block */}
            <div className="md:col-span-2 lg:col-span-2 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Account Password */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Password <span className="text-status-fault-text">*</span>
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
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs font-medium pr-10"
                      required
                      minLength={12}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-dim hover:text-foreground cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Confirm password <span className="text-status-fault-text">*</span>
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
                      className={`w-full px-3.5 py-2.5 rounded-xl border bg-white text-foreground focus:outline-none text-xs font-medium pr-10 ${
                        confirmPassword
                          ? confirmPassword === password
                            ? 'border-emerald-500 focus:border-emerald-500'
                            : 'border-primary focus:border-primary'
                          : 'border-border-strong focus:border-foreground'
                      }`}
                      required
                      minLength={12}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-dim hover:text-foreground cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Interactive Password Requirements Checklist */}
              <PasswordRequirements
                password={password}
                confirmPassword={confirmPassword}
              />
            </div>

            {/* Website */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Website
              </label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="e.g. https://company.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs font-medium"
              />
            </div>

            {/* Billing & Shipping Address (Side by Side) */}
            <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Billing Address */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Billing address <span className="text-status-fault-text">*</span>
                </label>
                <input
                  type="text"
                  value={billingAddress}
                  onChange={(e) => {
                    setBillingAddress(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. Railway Ave, Mount Isa QLD 4825"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs"
                  required
                />
              </div>

              {/* Shipping Address */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Shipping address (optional)
                </label>
                <input
                  type="text"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Leave blank or write 'Same as billing'"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Add Foodie to the Client (Reusable Assign Machines Form) */}
        <AssignMachinesSection
          title="Add Foodie to the client"
          subtitle="Assign available composter units from your unassigned fleet to this client."
          rows={machineRows}
          availableMachines={availableMachines}
          isLoadingMachines={isLoadingMachines}
          isOptional={true}
          onRowChange={handleUpdateMachineRow}
          onAddRow={handleAddMachineRow}
          onRemoveRow={handleRemoveMachineRow}
        />

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
              Save client
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
