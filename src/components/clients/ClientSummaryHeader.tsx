import React from 'react';
import { Bell, Calendar, LayoutGrid, MapPin, Users, Zap } from 'lucide-react';
import { formatDate, formatLocation, getCompanyInitials } from '../../services/api';
import type { Organization } from '../../types';
import { ClientDetailActionMenu } from './ClientDetailActionMenu';

export interface ClientSummaryHeaderProps {
  client: Organization;
  assignedMachinesCount: number;
  runningCount: number;
  idleCount: number;
  totalUsersCount: number;
  adminCount: number;
  operatorCount: number;
  openAlertsCount: number;
  energyConsumedTodayKwh?: number | null;
  isHeaderMenuOpen: boolean;
  onToggleHeaderMenu: () => void;
  onCloseHeaderMenu: () => void;
  onEdit: () => void;
  onExportDetails: () => void;
  onToggleStatus: () => void;
  onCannotDeactivate: (message: string) => void;
  onDeleteClient: () => void;
}

export const ClientSummaryHeader: React.FC<ClientSummaryHeaderProps> = ({
  client,
  assignedMachinesCount,
  runningCount,
  idleCount,
  totalUsersCount,
  adminCount,
  operatorCount,
  openAlertsCount,
  energyConsumedTodayKwh = null,
  isHeaderMenuOpen,
  onToggleHeaderMenu,
  onCloseHeaderMenu,
  onEdit,
  onExportDetails,
  onToggleStatus,
  onCannotDeactivate,
  onDeleteClient,
}) => {
  const clientStatus = client.status || (client.is_active ? 'Active' : 'Inactive');

  return (
    <>
      <div className="bg-white rounded-2xl border border-border-default p-4 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-surface-hover text-foreground font-bold text-xl flex items-center justify-center border border-border-default shrink-0">
            {getCompanyInitials(client.company_name)}
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                {client.company_name}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  clientStatus === 'Active'
                    ? 'bg-status-running-bg text-status-running-text border-status-running-dot/30'
                    : clientStatus === 'Pending'
                    ? 'bg-status-idle-bg text-status-idle-text border-status-idle-dot/30'
                    : 'bg-surface-hover text-foreground-muted border-border-default'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    clientStatus === 'Active'
                      ? 'bg-status-running-dot'
                      : clientStatus === 'Pending'
                      ? 'bg-status-idle-dot'
                      : 'bg-foreground-subtle'
                  }`}
                />
                <span>{clientStatus}</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-foreground-muted mt-1.5">
              <span>{client.client_code}</span>
              <span>{client.business_type || 'Corporate'}</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-foreground-subtle" />
                <span>{formatLocation(client.billing_address)}</span>
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-foreground-subtle" />
                <span>Onboarded {formatDate(client.onboarding_date || client.created_at)}</span>
              </span>
            </div>
          </div>
        </div>

        <ClientDetailActionMenu
          client={client}
          assignedMachinesCount={assignedMachinesCount}
          isOpen={isHeaderMenuOpen}
          onToggle={onToggleHeaderMenu}
          onClose={onCloseHeaderMenu}
          onEdit={onEdit}
          onExportDetails={onExportDetails}
          onToggleStatus={onToggleStatus}
          onCannotDeactivate={onCannotDeactivate}
          onDeleteClient={onDeleteClient}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-border-default p-3.5 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground-muted">Machines</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-surface-hover flex items-center justify-center text-foreground-body">
              <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-foreground mt-2">
            {assignedMachinesCount}
          </div>
          <div className="text-[11px] sm:text-xs text-foreground-muted mt-1 truncate">
            {runningCount} running · {idleCount} idle
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border-default p-3.5 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground-muted">Users</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-surface-hover flex items-center justify-center text-foreground-body">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-foreground mt-2">
            {totalUsersCount}
          </div>
          <div className="text-[11px] sm:text-xs text-foreground-muted mt-1 truncate">
            {adminCount} Site Admin · {operatorCount} Operators
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border-default p-3.5 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground-muted">Open alerts</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary-light flex items-center justify-center text-primary">
              <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-primary mt-2">
            {openAlertsCount}
          </div>
          <div className="text-[11px] sm:text-xs text-foreground-muted mt-1 truncate">
            {openAlertsCount > 0 ? 'Action required on offline unit' : 'No active alerts'}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border-default p-3.5 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground-muted">Energy consumed</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-surface-hover flex items-center justify-center text-foreground-body">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          {typeof energyConsumedTodayKwh === 'number' ? (
            <>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-2xl sm:text-3xl font-bold text-foreground">
                  {energyConsumedTodayKwh.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-foreground-muted">kWh</span>
              </div>
              <div className="text-[11px] sm:text-xs text-foreground-muted mt-1 truncate">
                Today, assigned machines
              </div>
            </>
          ) : (
            <>
              <div className="flex items-baseline mt-2">
                <span className="text-lg sm:text-xl font-bold text-foreground-muted">Not connected</span>
              </div>
              <div className="text-[11px] sm:text-xs text-foreground-muted mt-1 truncate">
                Hardware telemetry unavailable
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-border-default p-4 sm:p-6 shadow-2xs">
          <h2 className="text-sm font-bold text-foreground mb-5 tracking-tight">
            Client details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-6">
            <div>
              <span className="block text-xs text-foreground-muted">Account number / Client ID</span>
              <span className="block text-xs sm:text-sm font-semibold text-foreground mt-1">
                {client.client_code}
              </span>
            </div>
            <div>
              <span className="block text-xs text-foreground-muted">Full name / Company name</span>
              <span className="block text-xs sm:text-sm font-semibold text-foreground mt-1">
                {client.company_name}
              </span>
            </div>
            <div>
              <span className="block text-xs text-foreground-muted">Business type</span>
              <span className="block text-xs sm:text-sm font-semibold text-foreground mt-1">
                {client.business_type || 'Corporate'}
              </span>
            </div>
            <div>
              <span className="block text-xs text-foreground-muted">Tax ID (ABN / GST)</span>
              <span className="block text-xs sm:text-sm font-semibold text-foreground mt-1">
                {client.tax_id || '—'}
              </span>
            </div>
            <div>
              <span className="block text-xs text-foreground-muted">Onboarding date</span>
              <span className="block text-xs sm:text-sm font-semibold text-foreground mt-1">
                {formatDate(client.onboarding_date || client.created_at)}
              </span>
            </div>
            <div>
              <span className="block text-xs text-foreground-muted">Comms preference</span>
              <span className="block text-xs sm:text-sm font-semibold text-foreground mt-1">
                {client.comms_preference || 'Email'}
              </span>
            </div>
            <div>
              <span className="block text-xs text-foreground-muted">Payment terms</span>
              <span className="block text-xs sm:text-sm font-semibold text-foreground mt-1">
                {client.payment_terms || '30 days'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border-default p-4 sm:p-6 shadow-2xs">
          <h2 className="text-sm font-bold text-foreground mb-5 tracking-tight">
            Contact details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-6">
            <div>
              <span className="block text-xs text-foreground-muted">Point of contact</span>
              <span className="block text-xs sm:text-sm font-semibold text-foreground mt-1">
                {client.contact_poc || '—'}
              </span>
            </div>
            <div>
              <span className="block text-xs text-foreground-muted">Phone number</span>
              <span className="block text-xs sm:text-sm font-semibold text-foreground mt-1">
                {client.phone_number || '—'}
              </span>
            </div>
            <div>
              <span className="block text-xs text-foreground-muted">Email</span>
              {client.email ? (
                <a
                  href={`mailto:${client.email}`}
                  className="block text-xs sm:text-sm font-semibold text-foreground hover:text-primary mt-1 transition-colors"
                >
                  {client.email}
                </a>
              ) : (
                <span className="block text-xs sm:text-sm font-semibold text-foreground mt-1">—</span>
              )}
            </div>
            <div>
              <span className="block text-xs text-foreground-muted">Website</span>
              <span className="block text-xs sm:text-sm font-semibold text-foreground mt-1">
                {client.website || '—'}
              </span>
            </div>
            <div>
              <span className="block text-xs text-foreground-muted">Billing address</span>
              <span className="block text-xs sm:text-sm font-semibold text-foreground mt-1">
                {client.billing_address || '—'}
              </span>
            </div>
            <div>
              <span className="block text-xs text-foreground-muted">Shipping address</span>
              <span className="block text-xs sm:text-sm font-semibold text-foreground mt-1">
                {client.shipping_address || '—'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

