import React from 'react';
import { AlertCircle } from 'lucide-react';
import { formatABN } from '../../services/api';
import type { Organization } from '../../types';

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
}) => (
  <div className="bg-white rounded-2xl border border-border-default p-4 sm:p-6 shadow-2xs">
    <div className="border-b border-surface-hover pb-4 mb-6">
      <h2 className="text-base font-bold text-foreground tracking-tight">
        Client details
      </h2>
      <p className="text-xs text-foreground-muted mt-0.5">{subtitle}</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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

