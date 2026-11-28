import React from 'react';
import { AlertCircle } from 'lucide-react';
import { sanitizePhoneNumber } from '../../services/api';
import type { Organization, User } from '../../types';

export interface OperatorIdentityFieldsProps {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  cleanEmail: string;
  isEmailDuplicate: boolean;
  isEmailFormatInvalid: boolean;
  duplicateUser?: User | null;
  duplicateClientEmail?: Organization | null;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onEmailBlur: () => void;
  onPhoneNumberChange: (value: string) => void;
}

export const OperatorIdentityFields: React.FC<OperatorIdentityFieldsProps> = ({
  firstName,
  lastName,
  email,
  phoneNumber,
  cleanEmail,
  isEmailDuplicate,
  isEmailFormatInvalid,
  duplicateUser,
  duplicateClientEmail,
  onFirstNameChange,
  onLastNameChange,
  onEmailChange,
  onEmailBlur,
  onPhoneNumberChange,
}) => (
  <>
    <div>
      <label className="block text-xs font-semibold text-foreground mb-1.5">
        First name <span className="text-status-fault-text">*</span>
      </label>
      <input
        type="text"
        value={firstName}
        onChange={(e) => onFirstNameChange(e.target.value)}
        placeholder="e.g. Alex"
        className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs font-medium"
        required
      />
    </div>

    <div>
      <label className="block text-xs font-semibold text-foreground mb-1.5">
        Last name <span className="text-status-fault-text">*</span>
      </label>
      <input
        type="text"
        value={lastName}
        onChange={(e) => onLastNameChange(e.target.value)}
        placeholder="e.g. Rivera"
        className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs font-medium"
        required
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
      <div className="relative">
        <input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          onBlur={onEmailBlur}
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

    <div>
      <label className="block text-xs font-semibold text-foreground mb-1.5">
        Phone number
      </label>
      <input
        type="text"
        value={phoneNumber}
        onChange={(e) => onPhoneNumberChange(sanitizePhoneNumber(e.target.value))}
        maxLength={15}
        placeholder="e.g. +61 8 8200 1100"
        className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-white text-foreground focus:outline-none focus:border-foreground text-xs font-mono"
      />
    </div>
  </>
);

