import React from 'react';
import { Building2 } from 'lucide-react';
import { formatDate, formatLocation } from '../../services/api';
import type { Machine, Organization } from '../../types';
import { PaginationBar } from '../common/RowActionMenu';
import { ClientRowActions } from './ClientRowActions';

export interface ClientTableProps {
  clients: Organization[];
  machines: Machine[];
  selectedIds: string[];
  isAllPageSelected: boolean;
  activeMenuId: string | null;
  currentPage: number;
  totalPages: number;
  rowsPerPage: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  onToggleSelectAll: () => void;
  onToggleSelectRow: (id: string) => void;
  onToggleMenu: (id: string | null) => void;
  onSelectClient: (client: Organization) => void;
  onEditClient: (client: Organization) => void;
  onExportClient: (client: Organization) => void;
  onToggleStatus: (client: Organization) => void;
  onDeleteClient: (client: Organization) => void;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;
}

export const ClientTable: React.FC<ClientTableProps> = ({
  clients,
  machines,
  selectedIds,
  isAllPageSelected,
  activeMenuId,
  currentPage,
  totalPages,
  rowsPerPage,
  totalItems,
  startIndex,
  endIndex,
  onToggleSelectAll,
  onToggleSelectRow,
  onToggleMenu,
  onSelectClient,
  onEditClient,
  onExportClient,
  onToggleStatus,
  onDeleteClient,
  onPageChange,
  onRowsPerPageChange,
}) => (
  <>
    <div className="overflow-x-auto mt-4 -mx-5 px-5 sm:mx-0 sm:px-0">
      <table className="w-full text-left border-collapse text-xs min-w-[750px]">
        <thead>
          <tr className="border-b border-border-default text-[11px] font-semibold text-foreground-muted">
            <th className="py-3 px-3 w-10 text-center">
              <input
                type="checkbox"
                checked={isAllPageSelected}
                onChange={onToggleSelectAll}
                className="w-4 h-4 rounded border-border-strong text-primary focus:ring-primary cursor-pointer accent-primary"
              />
            </th>
            <th className="py-3 px-3 whitespace-nowrap min-w-[100px]">Client ID</th>
            <th className="py-3 px-3">Company name</th>
            <th className="py-3 px-3 whitespace-nowrap">Business type</th>
            <th className="py-3 px-3 whitespace-nowrap">Point of contact</th>
            <th className="py-3 px-3">Location</th>
            <th className="py-3 px-3 text-center whitespace-nowrap">Total machines</th>
            <th className="py-3 px-3 whitespace-nowrap">Onboarding date</th>
            <th className="py-3 px-3 whitespace-nowrap">Status</th>
            <th className="py-3 px-3 text-right whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-hover">
          {clients.length === 0 ? (
            <tr>
              <td colSpan={10} className="py-12 text-center text-foreground-muted">
                <Building2 className="w-8 h-8 text-foreground-subtle mx-auto mb-2" />
                <p className="font-bold text-foreground">No clients match the current filters</p>
                <p className="text-xs text-foreground-dim mt-1">
                  Try clearing search or adjusting your status/location dropdowns.
                </p>
              </td>
            </tr>
          ) : (
            clients.map((client) => {
              const isSelected = selectedIds.includes(client.id);
              const clientMachineCount = machines.filter(
                (m) => m.organization_id === client.id
              ).length;
              const clientStatus = client.status || (client.is_active ? 'Active' : 'Inactive');

              return (
                <tr
                  key={client.id}
                  className={`transition-colors ${
                    isSelected
                      ? 'bg-primary-light hover:bg-primary-light'
                      : 'hover:bg-surface-muted'
                  }`}
                >
                  <td className="py-3.5 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelectRow(client.id)}
                      className="w-4 h-4 rounded border-border-strong text-primary focus:ring-primary cursor-pointer accent-primary"
                    />
                  </td>

                  <td className="py-3.5 px-3 whitespace-nowrap min-w-[100px]">
                    <button
                      type="button"
                      onClick={() => onSelectClient(client)}
                      className="font-bold text-primary underline hover:text-primary-hover cursor-pointer text-left whitespace-nowrap font-mono inline-block break-keep"
                    >
                      {client.client_code}
                    </button>
                  </td>

                  <td className="py-3.5 px-3 font-bold text-foreground">
                    {client.company_name}
                  </td>

                  <td className="py-3.5 px-3 text-foreground whitespace-nowrap">
                    {client.business_type || 'Corporate'}
                  </td>

                  <td className="py-3.5 px-3 text-foreground whitespace-nowrap">
                    {client.contact_poc || '—'}
                  </td>

                  <td className="py-3.5 px-3 text-foreground">
                    {formatLocation(client.billing_address)}
                  </td>

                  <td className="py-3.5 px-3 text-center font-medium text-foreground whitespace-nowrap">
                    {clientMachineCount}
                  </td>

                  <td className="py-3.5 px-3 text-foreground-muted whitespace-nowrap">
                    {formatDate(client.onboarding_date || client.created_at)}
                  </td>

                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                        clientStatus === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : clientStatus === 'Pending'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          clientStatus === 'Active'
                            ? 'bg-status-running-dot'
                            : clientStatus === 'Pending'
                            ? 'bg-amber-500'
                            : 'bg-slate-400'
                        }`}
                      />
                      <span>{clientStatus}</span>
                    </span>
                  </td>

                  <td className="py-3.5 px-3 text-right">
                    <ClientRowActions
                      client={client}
                      isOpen={activeMenuId === client.id}
                      onToggle={() =>
                        onToggleMenu(activeMenuId === client.id ? null : client.id)
                      }
                      onClose={() => onToggleMenu(null)}
                      onView={() => onSelectClient(client)}
                      onEdit={() => onEditClient(client)}
                      onExport={() => onExportClient(client)}
                      onToggleStatus={() => onToggleStatus(client)}
                      onDelete={() => onDeleteClient(client)}
                    />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>

    <PaginationBar
      variant="clients"
      currentPage={currentPage}
      totalPages={totalPages}
      rowsPerPage={rowsPerPage}
      totalItems={totalItems}
      startIndex={startIndex}
      endIndex={endIndex}
      itemLabel="clients"
      onPageChange={onPageChange}
      onRowsPerPageChange={onRowsPerPageChange}
    />
  </>
);

