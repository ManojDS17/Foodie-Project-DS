import React, { useState } from 'react';
import {
  ArrowLeft,
  Save,
  Loader2,
  Mail,
  User as UserIcon,
  Phone,
  Building2,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import {
  usersApi,
  sanitizePhoneNumber,
  validatePhoneNumberInput,
  isValidEmail,
} from '../../services/api';
import { useAuth } from '../../hooks';
import type { User } from '../../types';

export interface EditUserViewProps {
  user: User;
  organizationName?: string;
  backLabel?: string;
  onBack: () => void;
  onSuccess: (updated: User) => void;
  onError: (msg: string) => void;
}

export const EditUserView: React.FC<EditUserViewProps> = ({
  user,
  organizationName,
  backLabel,
  onBack,
  onSuccess,
  onError,
}) => {
  const { user: currentUser } = useAuth();
  const [prevUser, setPrevUser] = useState(user);
  const [firstName, setFirstName] = useState(user.first_name || '');
  const [lastName, setLastName] = useState(user.last_name || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone_number || '');
  const [isActive, setIsActive] = useState(user.is_active ?? true);

  if (user !== prevUser) {
    setPrevUser(user);
    setFirstName(user.first_name || '');
    setLastName(user.last_name || '');
    setEmail(user.email || '');
    setPhone(user.phone_number || '');
    setIsActive(user.is_active ?? true);
  }

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const isEditingSelf = currentUser?.id === user.id;
  const isOem = currentUser?.role === 'OEM_MANAGER';
  const isEmailLocked = isEditingSelf && !isOem;

  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User';
  const isSiteAdmin = user.role === 'SITE_ADMIN';
  const roleLabel = isSiteAdmin ? 'Site Admin' : user.role === 'OEM_MANAGER' ? 'OEM Manager' : 'Operator';
  const orgName = organizationName || user.company_name || 'Client Organisation';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    if (!cleanFirst) {
      setFieldError('First name is required.');
      return;
    }

    if (!cleanEmail) {
      setFieldError('Email address is required.');
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setFieldError('Please enter a valid business email address (e.g. name@company.com or name@company.com.au).');
      return;
    }

    if (cleanPhone) {
      const phoneErr = validatePhoneNumberInput(cleanPhone);
      if (phoneErr) {
        setFieldError(phoneErr);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const updated = await usersApi.update(user.id, {
        first_name: cleanFirst,
        last_name: cleanLast,
        email: cleanEmail,
        phone_number: cleanPhone || undefined,
        is_active: isActive,
      });
      onSuccess(updated);
    } catch (err: any) {
      const msg = err.message || 'Failed to update user profile.';
      setFieldError(msg);
      onError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1000px] w-full min-w-0 mx-auto select-none pb-12">
      {/* 1. Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-foreground-muted pt-1">
        <button
          type="button"
          onClick={onBack}
          className="hover:text-foreground cursor-pointer transition-colors flex items-center gap-1 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{backLabel || 'Team'}</span>
        </button>
        <span>/</span>
        <button
          type="button"
          onClick={onBack}
          className="hover:text-foreground cursor-pointer transition-colors font-medium"
        >
          {fullName}
        </button>
        <span>/</span>
        <span className="font-bold text-foreground">Edit user</span>
      </nav>

      {/* 2. Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            Edit user
          </h1>
          <p className="text-xs text-foreground-muted mt-1">
            Update account information, email, and contact details for {fullName}.
          </p>
        </div>
      </div>

      {/* 3. Error Banner */}
      {fieldError && (
        <div className="p-3.5 rounded-xl border border-red-200 bg-primary-light text-xs text-status-fault-text flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-status-fault-text shrink-0" />
          <span>{fieldError}</span>
        </div>
      )}

      {/* 4. Form Container */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-border-default p-5 sm:p-7 shadow-2xs flex flex-col gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {/* First Name */}
          <div>
            <label className="block text-xs font-semibold text-foreground-body mb-1.5">
              First name <span className="text-status-fault-text">*</span>
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-foreground-subtle absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Priya"
                required
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-border-strong text-xs text-foreground focus:outline-none focus:border-foreground transition-all"
              />
            </div>
          </div>

          {/* Last Name */}
          <div>
            <label className="block text-xs font-semibold text-foreground-body mb-1.5">
              Last name
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-foreground-subtle absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Shah"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-border-strong text-xs text-foreground focus:outline-none focus:border-foreground transition-all"
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-semibold text-foreground-body mb-1.5">
              Email address <span className="text-status-fault-text">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-foreground-subtle absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldError && fieldError.toLowerCase().includes('email')) setFieldError(null);
                }}
                placeholder="e.g. user@organization.com"
                required
                disabled={isEmailLocked}
                className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl border text-xs transition-all ${
                  isEmailLocked
                    ? 'border-border-strong bg-surface-hover text-foreground-body cursor-not-allowed focus:outline-none'
                    : 'border-border-strong text-foreground focus:outline-none focus:border-foreground'
                }`}
              />
            </div>
            <p className="text-[11px] text-foreground-muted mt-1">
              {isEmailLocked
                ? 'Email address cannot be changed here. Contact your OEM manager to update.'
                : 'Must be a valid and unique business email address.'}
            </p>
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-xs font-semibold text-foreground-body mb-1.5">
              Phone number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-foreground-subtle absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(sanitizePhoneNumber(e.target.value));
                  if (fieldError && fieldError.includes('Phone number')) setFieldError(null);
                }}
                maxLength={15}
                placeholder="e.g. 0412 345 678"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-border-strong text-xs text-foreground focus:outline-none focus:border-foreground transition-all"
              />
            </div>
          </div>

          {/* Role (Read-only text, NOT a dropdown) */}
          <div>
            <label className="block text-xs font-semibold text-foreground-body mb-1.5">
              Role
            </label>
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-border-default bg-surface-muted text-xs">
              <ShieldCheck className="w-4 h-4 text-foreground-muted" />
              <span className="font-semibold text-foreground">{roleLabel}</span>
            </div>
          </div>

          {/* Organisation (Read-only) */}
          <div>
            <label className="block text-xs font-semibold text-foreground-body mb-1.5">
              Organisation
            </label>
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-border-default bg-surface-muted text-xs">
              <Building2 className="w-4 h-4 text-foreground-muted" />
              <span className="font-semibold text-foreground">{orgName}</span>
            </div>
          </div>
        </div>

        {/* Active Status */}
        <div className="pt-2 border-t border-surface-hover flex items-center gap-2.5">
          <input
            type="checkbox"
            id="userIsActiveToggle"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 rounded text-primary focus:ring-primary border-border-strong cursor-pointer"
          />
          <label htmlFor="userIsActiveToggle" className="text-xs font-semibold text-foreground-body cursor-pointer select-none">
            Active account status (allows login and platform access)
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-hover">
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl border border-border-strong text-xs font-semibold text-foreground-body hover:bg-surface-muted transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover active:bg-primary-hover transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5 text-white" />
            )}
            <span>Save changes</span>
          </button>
        </div>
      </form>
    </div>
  );
};
