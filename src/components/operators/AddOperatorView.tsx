import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  AlertCircle,
  Save,
  ArrowLeft,
  X,
  Eye,
  EyeOff,
  Building2,
  Cpu,
  Mail,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { orgsApi, machinesApi, usersApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/ui';
import { sanitizePhoneNumber, validatePhoneNumberInput, isValidEmail } from '../clients/AddClientView';
import type { Organization, Machine, User } from '../../types';

export interface AddOperatorViewProps {
  existingClients?: Organization[];
  initialClientId?: string;
  isClientLocked?: boolean;
  backLabel?: string;
  onBack: () => void;
  onSuccess: (newOperator: User) => void;
}

export const AddOperatorView: React.FC<AddOperatorViewProps> = ({
  existingClients,
  initialClientId,
  isClientLocked,
  backLabel,
  onBack,
  onSuccess,
}) => {
  const { user } = useAuth();
  const effectiveOrgId = initialClientId || (user?.role === 'SITE_ADMIN' ? user.organization_id : '') || '';
  const isLocked = Boolean(isClientLocked || user?.role === 'SITE_ADMIN');

  const [clients, setClients] = useState<Organization[]>(existingClients || []);
  const [fleetMachines, setFleetMachines] = useState<Machine[]>([]);
  const [existingUsersList, setExistingUsersList] = useState<User[]>([]);

  // Form Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>(effectiveOrgId);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullName = `${firstName} ${lastName}`.trim();

  // Password rules validation states
  const hasMinLength = password.length >= 12;
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  // Load clients and machines
  useEffect(() => {
    if (effectiveOrgId && !selectedClientId) {
      setSelectedClientId(effectiveOrgId);
    }
  }, [effectiveOrgId, selectedClientId]);

  useEffect(() => {
    Promise.all([
      existingClients && Array.isArray(existingClients) && existingClients.length > 0
        ? Promise.resolve(existingClients)
        : orgsApi.getAll().catch(() => []),
      machinesApi.getAll().catch(() => []),
      usersApi.getAll().catch(() => []),
    ])
      .then(([clientList, machineList, userList]) => {
        const safeClients = Array.isArray(clientList) ? clientList : [];
        const activeClients = safeClients.filter((c) => !c.is_deleted);
        setClients(activeClients);
        setFleetMachines(Array.isArray(machineList) ? machineList : []);
        setExistingUsersList(Array.isArray(userList) ? userList : []);
      })
      .catch((err) => {
        console.error('Failed to load clients or machines for operator view:', err);
      });
  }, [existingClients]);

  const cleanEmail = email.trim().toLowerCase();
  const duplicateUser = cleanEmail
    ? existingUsersList.find(
        (u) => u.email && u.email.trim().toLowerCase() === cleanEmail && !u.is_deleted
      )
    : null;
  const duplicateClientEmail = cleanEmail
    ? clients.find(
        (c) => c.email && c.email.trim().toLowerCase() === cleanEmail && !c.is_deleted
      )
    : null;
  const isEmailDuplicate = emailTouched && Boolean(duplicateUser || duplicateClientEmail);
  const isEmailFormatInvalid = emailTouched && cleanEmail.length > 0 && !isValidEmail(cleanEmail);

  const selectedClient = Array.isArray(clients) ? clients.find((c) => c.id === selectedClientId) : undefined;
  const clientMachines = selectedClientId && Array.isArray(fleetMachines)
    ? fleetMachines.filter((m) => m.organization_id === selectedClientId && !m.is_deleted)
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. First & Last Name
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    if (!cleanFirst) {
      setError('First name is required.');
      return;
    }
    if (cleanFirst.split(/\s+/).length > 20) {
      setError('First name cannot exceed 20 words.');
      return;
    }
    if (!cleanLast) {
      setError('Last name is required.');
      return;
    }
    if (cleanLast.split(/\s+/).length > 20) {
      setError('Last name cannot exceed 20 words.');
      return;
    }

    // 2. Email Address
    if (!email.trim()) {
      setError('Email address is required.');
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
        duplicateUser
          ? `An account with email "${cleanEmail}" is already registered. Email must be unique.`
          : `Email is already registered to client "${duplicateClientEmail?.company_name}". Email must be unique.`
      );
      return;
    }

    // 3. Client Organization
    if (!selectedClientId) {
      setError('Please select a client organization to assign the operator.');
      return;
    }

    // 4. Phone Number
    if (phoneNumber.trim()) {
      const phoneErr = validatePhoneNumberInput(phoneNumber);
      if (phoneErr) {
        setError(phoneErr);
        return;
      }
    }

    // 5. Password & Confirm Password
    if (!password.trim()) {
      setError('Password is required.');
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

    setIsSubmitting(true);
    setError(null);

    try {
      const created = await usersApi.create({
        first_name: cleanFirst,
        last_name: cleanLast,
        email: email.trim().toLowerCase(),
        phone_number: phoneNumber.trim() || undefined,
        password: password.trim(),
        organization_id: selectedClientId,
        role: 'OPERATOR',
      });

      onSuccess(created);
    } catch (err: any) {
      setError(err?.message || 'Failed to create operator account.');
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
          <span>{backLabel || 'Home'}</span>
        </button>
        <span className="text-foreground-subtle">/</span>
        <span className="font-bold text-foreground">Add new operator</span>
      </nav>

      {/* 2. Header Card */}
      <div className="bg-white rounded-2xl border border-border-default p-4 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-surface-hover text-foreground font-bold text-xl flex items-center justify-center border border-border-default shrink-0">
            <UserPlus className="w-7 h-7 text-foreground" />
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                {fullName || 'New Operator'}
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-hover text-foreground-body border border-border-default">
                Facility Operator
              </span>
            </div>
            <p className="text-xs text-foreground-muted mt-1">
              Assign a facility operator to a client organization with automated machine access and telemetry visibility.
            </p>
          </div>
        </div>

        {/* Action Buttons in Header */}
        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
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
            form="add-operator-full-form"
            variant="primary"
            isLoading={isSubmitting}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save operator
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
      <form id="add-operator-full-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Section 1: Operator Details */}
        <div className="bg-white rounded-2xl border border-border-default p-6 shadow-2xs">
          <div className="border-b border-surface-hover pb-4 mb-6">
            <h2 className="text-base font-bold text-foreground tracking-tight">
              Operator details
            </h2>
            <p className="text-xs text-foreground-muted mt-0.5">
              Personal contact details and client organization assignment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* First Name */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                First name <span className="text-status-fault-text">*</span>
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Alex"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs font-medium"
                required
              />
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Last name <span className="text-status-fault-text">*</span>
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Rivera"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs font-medium"
                required
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
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailTouched(false);
                    if (error) setError(null);
                  }}
                  onBlur={() => {
                    if (email.trim()) {
                      setEmailTouched(true);
                    }
                  }}
                  placeholder="e.g. alex.rivera@client.example"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                    isEmailDuplicate || isEmailFormatInvalid
                      ? 'border-primary bg-primary-light text-status-fault-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary'
                      : 'border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground'
                  }`}
                  required
                />
              </div>
              {isEmailDuplicate ? (
                <p className="text-[11px] text-status-fault-text mt-1.5 flex items-start gap-1 font-medium leading-tight">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-status-fault-text" />
                  <span>
                    {duplicateUser
                      ? `An account with email "${cleanEmail}" is already registered.`
                      : `Email is already registered to client "${duplicateClientEmail?.company_name}".`}
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

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Phone number
              </label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(sanitizePhoneNumber(e.target.value));
                  if (error) setError(null);
                }}
                maxLength={15}
                placeholder="e.g. +61 8 8200 1100"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs font-mono"
              />
            </div>

            {/* Client Organization */}
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Assign to client organization <span className="text-status-fault-text">*</span>
              </label>
              {isLocked ? (
                <input
                  type="text"
                  value={
                    (selectedClient
                      ? selectedClient.company_name
                      : (user?.company_name || 'Assigned Client Organization')
                    ).replace(/^\[[A-Z0-9_-]+\]\s*/i, '')
                  }
                  disabled
                  readOnly
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-surface-muted text-foreground-body text-xs font-medium cursor-not-allowed select-none focus:outline-none"
                />
              ) : (
                <select
                  value={selectedClientId}
                  onChange={(e) => {
                    setSelectedClientId(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs cursor-pointer font-medium"
                  required
                >
                  <option value="">Select a client organization</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name.replace(/^\[[A-Z0-9_-]+\]\s*/i, '')}
                    </option>
                  ))}
                </select>
              )}

              {/* Machine Assignment Preview */}
              {selectedClientId && (
                <div className="mt-4 p-4 bg-surface-subtle rounded-xl border border-border-default animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-foreground" />
                      <span className="text-xs font-bold text-foreground">
                        {(selectedClient?.company_name || user?.company_name || '').replace(/^\[[A-Z0-9_-]+\]\s*/i, '')}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-status-running-text bg-status-running-bg px-2.5 py-0.5 rounded-md border border-status-running-dot/30 self-start sm:self-auto">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{clientMachines.length} Machine{clientMachines.length === 1 ? '' : 's'} Assigned</span>
                    </span>
                  </div>

                  <p className="text-[11px] text-foreground-muted mb-3">
                    All machines currently active under this client will be instantly available on the operator's dashboard upon sign in.
                  </p>

                  {clientMachines.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {clientMachines.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-border-default text-xs shadow-2xs"
                        >
                          <div className="w-8 h-8 rounded-md bg-surface-hover flex items-center justify-center shrink-0 border border-border-default">
                            <Cpu className="w-4 h-4 text-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-foreground">{m.machine_code}</span>
                              <span className="text-[10px] font-semibold text-status-running-text">
                                {m.connectivity_status || 'Online'}
                              </span>
                            </div>
                            <div className="text-[11px] text-foreground-muted truncate mt-0.5">
                              {m.model} {m.lease_location_label?.trim() ? `· ${m.lease_location_label.trim()}` : ''}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800">
                      No machines are currently assigned to this client. When machines are added to this client, they will automatically appear on this operator's dashboard.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Security & Login Credentials */}
        <div className="bg-white rounded-2xl border border-border-default p-6 shadow-2xs">
          <div className="border-b border-surface-hover pb-4 mb-6">
            <h2 className="text-base font-bold text-foreground tracking-tight">
              Security & login credentials
            </h2>
            <p className="text-xs text-foreground-muted mt-0.5">
              Initial password for the operator account. A welcome email with these credentials and direct login access will be dispatched automatically.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Password */}
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

            {/* Interactive Password Requirements Checklist */}
            <div className="md:col-span-2 -mt-1 mb-1 p-3 bg-slate-50 border border-border-default rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-700 font-semibold' : 'text-foreground-muted'}`}>
                <Check className={`w-3.5 h-3.5 ${hasMinLength ? 'text-emerald-600 stroke-[3]' : 'text-foreground-subtle'}`} />
                <span>At least 12 characters</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-700 font-semibold' : 'text-foreground-muted'}`}>
                <Check className={`w-3.5 h-3.5 ${hasNumber ? 'text-emerald-600 stroke-[3]' : 'text-foreground-subtle'}`} />
                <span>One number</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasSymbol ? 'text-emerald-700 font-semibold' : 'text-foreground-muted'}`}>
                <Check className={`w-3.5 h-3.5 ${hasSymbol ? 'text-emerald-600 stroke-[3]' : 'text-foreground-subtle'}`} />
                <span>One symbol</span>
              </div>
              <div className={`flex items-center gap-1.5 ${passwordsMatch ? 'text-emerald-700 font-semibold' : 'text-foreground-muted'}`}>
                <Check className={`w-3.5 h-3.5 ${passwordsMatch ? 'text-emerald-600 stroke-[3]' : 'text-foreground-subtle'}`} />
                <span>Passwords match</span>
              </div>
            </div>
          </div>

          <div className="mt-5 p-3.5 bg-surface-muted rounded-xl border border-border-default text-xs text-foreground-body flex items-center gap-2">
            <Mail className="w-4 h-4 text-foreground-muted shrink-0" />
            <span>
              Upon submission, an invitation email with credentials and direct login access will be sent to <strong>{email || 'the operator'}</strong>.
            </span>
          </div>
        </div>

        {/* Bottom Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
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
            Save operator
          </Button>
        </div>
      </form>
    </div>
  );
};
