import React, { useState, useEffect } from 'react';
import {
  Building2,
  AlertCircle,
  Save,
  ArrowLeft,
  X,
} from 'lucide-react';
import {
  orgsApi,
  machinesApi,
  usersApi,
  isValidEmail,
  validatePhoneNumberInput,
  isValidABN,
  validatePasswordPolicy,
  calculateOneYearLeaseEndDate,
  getTodayIsoDate,
} from '../../services/api';
import { Button } from '../common/ui';
import type { Organization, Machine, User } from '../../types';
import { AssignMachinesSection, type AssignMachineRow } from './AssignMachinesSection';
import { ClientAddressFields } from './ClientAddressFields';
import {
  ClientDetailsSection,
  type ClientDetailsFieldsValues,
} from './ClientIdentityFields';

export { ClientDetailsSection, type ClientDetailsFieldsValues };

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

  const [clientCode, setClientCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [onboardingDate, setOnboardingDate] = useState(() => getTodayIsoDate());
  const [businessType, setBusinessType] = useState<string>('');
  const [taxId, setTaxId] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [commsPreference, setCommsPreference] = useState('');

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

  const cleanTaxDigits = taxId.replace(/\D/g, '');
  const duplicateClient =
    cleanTaxDigits.length === 11
      ? clientList.find(
          (c) => c.tax_id && c.tax_id.replace(/\D/g, '') === cleanTaxDigits
        )
      : null;
  const isAbnChecksumInvalid = cleanTaxDigits.length === 11 && !isValidABN(cleanTaxDigits);

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

        <ClientAddressFields
          contactPoc={contactPoc}
          phoneNumber={phoneNumber}
          email={email}
          website={website}
          billingAddress={billingAddress}
          shippingAddress={shippingAddress}
          password={password}
          confirmPassword={confirmPassword}
          showPassword={showPassword}
          showConfirmPassword={showConfirmPassword}
          isEmailDuplicate={isEmailDuplicate}
          isEmailFormatInvalid={isEmailFormatInvalid}
          duplicateClientByEmail={duplicateClientByEmail}
          onContactPocChange={(v) => {
            setContactPoc(v);
            if (error && error.includes('Point of contact')) setError(null);
          }}
          onPhoneNumberChange={(v) => {
            setPhoneNumber(v);
            if (error && error.includes('Phone number')) setError(null);
          }}
          onEmailChange={(v) => {
            setEmail(v);
            setEmailTouched(false);
            if (error && error.includes('email')) setError(null);
          }}
          onEmailBlur={() => {
            if (email.trim()) setEmailTouched(true);
          }}
          onWebsiteChange={setWebsite}
          onBillingAddressChange={(v) => {
            setBillingAddress(v);
            if (error) setError(null);
          }}
          onShippingAddressChange={setShippingAddress}
          onPasswordChange={(v) => {
            setPassword(v);
            if (error) setError(null);
          }}
          onConfirmPasswordChange={(v) => {
            setConfirmPassword(v);
            if (error) setError(null);
          }}
          onToggleShowPassword={() => setShowPassword((p) => !p)}
          onToggleShowConfirmPassword={() => setShowConfirmPassword((p) => !p)}
        />

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
