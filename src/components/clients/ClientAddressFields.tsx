import React from 'react';
import { AlertCircle } from 'lucide-react';
import { sanitizePhoneNumber } from '../../services/api';
import type { Organization } from '../../types';
import { ClientPasswordFields } from './ClientPasswordFields';

export interface ClientAddressFieldsProps {
  contactPoc: string;
  phoneNumber: string;
  email: string;
  website: string;
  billingAddress: string;
  shippingAddress: string;
  password: string;
  confirmPassword: string;
  showPassword: boolean;
  showConfirmPassword: boolean;
  isEmailDuplicate: boolean;
  isEmailFormatInvalid: boolean;
  duplicateClientByEmail?: Organization | null;
  onContactPocChange: (value: string) => void;
  onPhoneNumberChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onEmailBlur: () => void;
  onWebsiteChange: (value: string) => void;
  onBillingAddressChange: (value: string) => void;
  onShippingAddressChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onToggleShowPassword: () => void;
  onToggleShowConfirmPassword: () => void;
}

export const ClientAddressFields: React.FC<ClientAddressFieldsProps> = ({
  contactPoc,
  phoneNumber,
  email,
  website,
  billingAddress,
  shippingAddress,
  password,
  confirmPassword,
  showPassword,
  showConfirmPassword,
  isEmailDuplicate,
  isEmailFormatInvalid,
  duplicateClientByEmail,
  onContactPocChange,
  onPhoneNumberChange,
  onEmailChange,
  onEmailBlur,
  onWebsiteChange,
  onBillingAddressChange,
  onShippingAddressChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onToggleShowPassword,
  onToggleShowConfirmPassword,
}) => (
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
      <div>
        <label className="block text-xs font-semibold text-foreground mb-1.5">
          Point of contact <span className="text-status-fault-text">*</span>
        </label>
        <input
          type="text"
          value={contactPoc}
          onChange={(e) => onContactPocChange(e.target.value.slice(0, 50))}
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

      <div>
        <label className="block text-xs font-semibold text-foreground mb-1.5">
          Phone number
        </label>
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => onPhoneNumberChange(sanitizePhoneNumber(e.target.value))}
          maxLength={15}
          placeholder="e.g. +61 8 8200 1100"
          className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs font-mono"
        />
      </div>

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
          onChange={(e) => onEmailChange(e.target.value)}
          onBlur={onEmailBlur}
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

      <ClientPasswordFields
        password={password}
        confirmPassword={confirmPassword}
        showPassword={showPassword}
        showConfirmPassword={showConfirmPassword}
        onPasswordChange={onPasswordChange}
        onConfirmPasswordChange={onConfirmPasswordChange}
        onToggleShowPassword={onToggleShowPassword}
        onToggleShowConfirmPassword={onToggleShowConfirmPassword}
      />

      <div>
        <label className="block text-xs font-semibold text-foreground mb-1.5">
          Website
        </label>
        <input
          type="text"
          value={website}
          onChange={(e) => onWebsiteChange(e.target.value)}
          placeholder="e.g. https://company.com"
          className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs font-medium"
        />
      </div>

      <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Billing address <span className="text-status-fault-text">*</span>
          </label>
          <input
            type="text"
            value={billingAddress}
            onChange={(e) => onBillingAddressChange(e.target.value)}
            placeholder="e.g. Railway Ave, Mount Isa QLD 4825"
            className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Shipping address (optional)
          </label>
          <input
            type="text"
            value={shippingAddress}
            onChange={(e) => onShippingAddressChange(e.target.value)}
            placeholder="Leave blank or write 'Same as billing'"
            className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs"
          />
        </div>
      </div>
    </div>
  </div>
);

