import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus,
  AlertCircle,
  Save,
  ArrowLeft,
  Home,
  X,
} from 'lucide-react';
import {
  orgsApi,
  machinesApi,
  usersApi,
  validatePhoneNumberInput,
  isValidEmail,
  validatePasswordPolicy,
} from '../../services/api';
import { useAuth } from '../../hooks';
import { Button } from '../common/ui';
import type { Organization, Machine, User } from '../../types';
import { OperatorIdentityFields } from './OperatorIdentityFields';
import { OperatorMachineSelector } from './OperatorMachineSelector';
import { OperatorPasswordFields } from './OperatorPasswordFields';

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
  const navigate = useNavigate();

  const handleGoHome = () => {
    window.dispatchEvent(new CustomEvent('foodie:reset-home-view'));
    navigate('/');
    onBack();
  };
  const effectiveOrgId = initialClientId || (user?.role === 'SITE_ADMIN' ? user.organization_id : '') || '';
  const isLocked = Boolean(isClientLocked || user?.role === 'SITE_ADMIN');

  const [clients, setClients] = useState<Organization[]>(existingClients || []);
  const [fleetMachines, setFleetMachines] = useState<Machine[]>([]);
  const [existingUsersList, setExistingUsersList] = useState<User[]>([]);

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

  const [prevEffectiveOrgId, setPrevEffectiveOrgId] = useState(effectiveOrgId);
  if (effectiveOrgId !== prevEffectiveOrgId) {
    setPrevEffectiveOrgId(effectiveOrgId);
    if (effectiveOrgId && !selectedClientId) {
      setSelectedClientId(effectiveOrgId);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      existingClients && Array.isArray(existingClients) && existingClients.length > 0
        ? Promise.resolve(existingClients)
        : orgsApi.getAll(undefined, controller.signal).catch(() => []),
      machinesApi.getAll(undefined, controller.signal).catch(() => []),
      usersApi.getAll(undefined, controller.signal).catch(() => []),
    ])
      .then(([clientList, machineList, userList]) => {
        if (controller.signal.aborted) return;
        const safeClients = Array.isArray(clientList) ? clientList : [];
        setClients(safeClients.filter((c) => !c.is_deleted));
        setFleetMachines(Array.isArray(machineList) ? machineList : []);
        setExistingUsersList(Array.isArray(userList) ? userList : []);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error('Failed to load clients or machines for operator view:', err);
        }
      });
    return () => controller.abort();
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

    if (!selectedClientId) {
      setError('Please select a client organization to assign the operator.');
      return;
    }

    if (phoneNumber.trim()) {
      const phoneErr = validatePhoneNumberInput(phoneNumber);
      if (phoneErr) {
        setError(phoneErr);
        return;
      }
    }

    if (!password.trim()) {
      setError('Password is required.');
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
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-foreground-muted pt-1">
        <button
          type="button"
          onClick={onBack}
          className="hover:text-foreground cursor-pointer transition-colors flex items-center gap-1 font-medium p-1 -ml-1 rounded-md hover:bg-surface-subtle"
          title="Go back"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleGoHome}
          className="hover:text-foreground cursor-pointer transition-colors flex items-center gap-1 font-medium"
          title="Go to Home"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Home</span>
        </button>
        <span className="text-foreground-subtle">/</span>
        {backLabel && backLabel !== 'Home' && (
          <>
            <button
              type="button"
              onClick={onBack}
              className="hover:text-foreground cursor-pointer transition-colors flex items-center gap-1 font-medium"
            >
              <span>{backLabel}</span>
            </button>
            <span className="text-foreground-subtle">/</span>
          </>
        )}
        <span className="font-bold text-foreground">Add new operator</span>
      </nav>

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

      <form id="add-operator-full-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
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
            <OperatorIdentityFields
              firstName={firstName}
              lastName={lastName}
              email={email}
              phoneNumber={phoneNumber}
              cleanEmail={cleanEmail}
              isEmailDuplicate={isEmailDuplicate}
              isEmailFormatInvalid={isEmailFormatInvalid}
              duplicateUser={duplicateUser}
              duplicateClientEmail={duplicateClientEmail}
              onFirstNameChange={(v) => {
                setFirstName(v);
                if (error) setError(null);
              }}
              onLastNameChange={(v) => {
                setLastName(v);
                if (error) setError(null);
              }}
              onEmailChange={(v) => {
                setEmail(v);
                setEmailTouched(false);
                if (error) setError(null);
              }}
              onEmailBlur={() => {
                if (email.trim()) setEmailTouched(true);
              }}
              onPhoneNumberChange={(v) => {
                setPhoneNumber(v);
                if (error) setError(null);
              }}
            />

            <OperatorMachineSelector
              clients={clients}
              selectedClientId={selectedClientId}
              selectedClient={selectedClient}
              fallbackCompanyName={user?.company_name}
              isLocked={isLocked}
              clientMachines={clientMachines}
              onClientChange={(id) => {
                setSelectedClientId(id);
                if (error) setError(null);
              }}
            />
          </div>
        </div>

        <OperatorPasswordFields
          email={email}
          password={password}
          confirmPassword={confirmPassword}
          showPassword={showPassword}
          showConfirmPassword={showConfirmPassword}
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
