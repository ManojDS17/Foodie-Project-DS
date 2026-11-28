import React from 'react';
import { Building2, Cpu, ShieldCheck } from 'lucide-react';
import type { Machine, Organization } from '../../types';

export interface OperatorMachineSelectorProps {
  clients: Organization[];
  selectedClientId: string;
  selectedClient?: Organization;
  fallbackCompanyName?: string | null;
  isLocked: boolean;
  clientMachines: Machine[];
  onClientChange: (clientId: string) => void;
}

export const OperatorMachineSelector: React.FC<OperatorMachineSelectorProps> = ({
  clients,
  selectedClientId,
  selectedClient,
  fallbackCompanyName,
  isLocked,
  clientMachines,
  onClientChange,
}) => {
  const displayCompanyName = (
    selectedClient?.company_name ||
    fallbackCompanyName ||
    'Assigned Client Organization'
  ).replace(/^\[[A-Z0-9_-]+\]\s*/i, '');

  return (
    <div className="md:col-span-2 lg:col-span-3">
      <label className="block text-xs font-semibold text-foreground mb-1.5">
        Assign to client organization <span className="text-status-fault-text">*</span>
      </label>
      {isLocked ? (
        <input
          type="text"
          value={displayCompanyName}
          disabled
          readOnly
          className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-surface-muted text-foreground-body text-xs font-medium cursor-not-allowed select-none focus:outline-none"
        />
      ) : (
        <select
          value={selectedClientId}
          onChange={(e) => onClientChange(e.target.value)}
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

      {selectedClientId && (
        <div className="mt-4 p-4 bg-surface-subtle rounded-xl border border-border-default animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-foreground" />
              <span className="text-xs font-bold text-foreground">
                {(selectedClient?.company_name || fallbackCompanyName || '').replace(/^\[[A-Z0-9_-]+\]\s*/i, '')}
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
                        {m.connectivity_status || 'Offline'}
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
  );
};

