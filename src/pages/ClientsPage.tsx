import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { useAuth } from '../hooks';
import { AddClientView } from '../components/clients/AddClientView';
import { EditClientView } from '../components/clients/EditClientView';
import { DeleteClientModal } from '../components/clients/DeleteClientModal';
import { AssignMachineView } from '../components/clients/AssignMachineView';
import { ClientDetailView } from '../components/clients/ClientDetailView';
import { ClientListToolbar } from '../components/clients/ClientListToolbar';
import { ClientTable } from '../components/clients/ClientTable';
import { useClientsList } from '../components/clients/useClientsList';
import { Button } from '../components/common/ui';
import { Toast, LoadErrorBanner } from '../components/common/Toast';
import type { Organization } from '../types';

export const ClientsPage: React.FC = () => {
  const { user } = useAuth();
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Organization | null>(null);
  const [deletingClient, setDeletingClient] = useState<Organization | null>(null);
  const [deletingClients, setDeletingClients] = useState<Organization[]>([]);
  const [isAssignMachineOpen, setIsAssignMachineOpen] = useState(false);

  const list = useClientsList({
    pauseRefresh: Boolean(
      isAddClientOpen || editingClient || deletingClient || isAssignMachineOpen
    ),
    onToast: setToast,
  });

  const [prevUrlClientId, setPrevUrlClientId] = useState<string | null>(
    list.selectedClientIdFromUrl
  );
  if (list.selectedClientIdFromUrl !== prevUrlClientId) {
    setPrevUrlClientId(list.selectedClientIdFromUrl);
    if (list.selectedClientIdFromUrl) {
      setIsAddClientOpen(false);
      setEditingClient(null);
      setDeletingClient(null);
      setIsAssignMachineOpen(false);
    }
  }

  const { setSelectedClient, setSearchParams } = list;

  useEffect(() => {
    const handleResetView = () => {
      setSelectedClient(null);
      setEditingClient(null);
      setIsAddClientOpen(false);
      setIsAssignMachineOpen(false);
      setDeletingClient(null);
      setDeletingClients([]);
      setSearchParams({});
    };

    window.addEventListener('foodie:reset-clients-view', handleResetView);
    return () => window.removeEventListener('foodie:reset-clients-view', handleResetView);
  }, [setSelectedClient, setSearchParams]);

  if (user && user.role !== 'OEM_MANAGER') {
    return <Navigate to="/" replace />;
  }

  if (isAddClientOpen) {
    return (
      <div className="select-none">
        <AddClientView
          existingClients={list.organizations}
          onBack={() => setIsAddClientOpen(false)}
          onSuccess={(newOrg) => {
            list.fetchData();
            setIsAddClientOpen(false);
            setToast({
              message: `Client ${newOrg.company_name} (${newOrg.client_code}) added successfully!`,
              type: 'success',
            });
          }}
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  if (editingClient) {
    return (
      <div className="select-none">
        <EditClientView
          client={editingClient}
          existingClients={list.organizations}
          onBack={() => setEditingClient(null)}
          onSuccess={(updatedOrg) => {
            list.setOrganizations((prev) =>
              prev.map((o) => (o.id === updatedOrg.id ? updatedOrg : o))
            );
            if (list.selectedClient && list.selectedClient.id === updatedOrg.id) {
              list.setSelectedClient(updatedOrg);
            }
            setEditingClient(null);
            setToast({
              message: `Client ${updatedOrg.company_name} updated successfully!`,
              type: 'success',
            });
          }}
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  if (isAssignMachineOpen && list.selectedClient) {
    const clientMachines = list.machines.filter(
      (m) => m.organization_id === list.selectedClient!.id
    );
    return (
      <div className="select-none">
        <AssignMachineView
          client={list.selectedClient}
          assignedMachinesCount={clientMachines.length}
          onBack={() => setIsAssignMachineOpen(false)}
          onSuccess={() => {
            list.fetchData();
            setIsAssignMachineOpen(false);
            setToast({
              message: 'Machine(s) assigned to client successfully!',
              type: 'success',
            });
          }}
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  if (list.selectedClient) {
    return (
      <div className="select-none">
        <ClientDetailView
          client={list.selectedClient}
          machines={list.machines}
          users={list.users}
          onBack={() => {
            list.setSelectedClient(null);
            list.setSearchParams({});
          }}
          onEdit={() => setEditingClient(list.selectedClient)}
          onAssignMachine={() => setIsAssignMachineOpen(true)}
          onUnassignMachine={list.handleUnassignMachine}
          onDeleteClient={() => setDeletingClient(list.selectedClient)}
          onToggleStatus={() => list.handleToggleClientStatus(list.selectedClient!)}
          onUpdateMachine={(updated) =>
            list.setMachines((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
          }
        />

        <DeleteClientModal
          isOpen={Boolean(deletingClient)}
          client={deletingClient}
          machines={list.machines}
          onClose={() => setDeletingClient(null)}
          onSuccess={(deletedIds) => {
            list.setOrganizations((prev) => prev.filter((o) => !deletedIds.includes(o.id)));
            list.setSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(id)));
            list.setSelectedClient(null);
            list.setSearchParams({});
            list.fetchData();
            setToast({
              message: 'Client record deleted successfully.',
              type: 'info',
            });
          }}
        />

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-[1400px] mx-auto select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              Clients
            </h1>
            <button
              type="button"
              onClick={() => list.fetchData(true)}
              disabled={list.isLoading}
              title="Refresh clients list from PostgreSQL"
              className="p-1 rounded-lg text-foreground-dim hover:text-foreground hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${list.isLoading ? 'animate-spin text-primary' : ''}`} />
            </button>
          </div>
          <p className="text-xs text-foreground-muted mt-0.5">
            Every client account and the Foodie machines assigned to it.
          </p>
        </div>

        <Button
          onClick={() => setIsAddClientOpen(true)}
          variant="primary"
          size="md"
          leftIcon={<Plus className="w-4 h-4 text-white" />}
          className="self-start sm:self-auto"
        >
          Add client
        </Button>
      </div>

      {list.loadError && (
        <LoadErrorBanner message={list.loadError} onRetry={() => list.fetchData(true)} />
      )}

      <div className="bg-white rounded-2xl border border-border-subtle p-5 shadow-xs overflow-hidden">
        <ClientListToolbar
          searchQuery={list.searchQuery}
          statusFilter={list.statusFilter}
          businessTypeFilter={list.businessTypeFilter}
          locationFilter={list.locationFilter}
          showMoreFilters={list.showMoreFilters}
          machineFilter={list.machineFilter}
          uniqueLocations={list.uniqueLocations}
          selectedIds={list.selectedIds}
          organizations={list.organizations}
          onSearchChange={(q) => {
            list.setSearchQuery(q);
            list.setCurrentPage(1);
          }}
          onStatusChange={(s) => {
            list.setStatusFilter(s);
            list.setCurrentPage(1);
          }}
          onBusinessTypeChange={(t) => {
            list.setBusinessTypeFilter(t);
            list.setCurrentPage(1);
          }}
          onLocationChange={(l) => {
            list.setLocationFilter(l);
            list.setCurrentPage(1);
          }}
          onToggleMoreFilters={() => list.setShowMoreFilters((prev) => !prev)}
          onMachineFilterChange={(f) => {
            list.setMachineFilter(f);
            list.setCurrentPage(1);
          }}
          onResetFilters={list.resetAllFilters}
          onClearSelection={() => list.setSelectedIds([])}
          onBulkExport={() =>
            list.handleExportData(
              list.organizations.filter((o) => list.selectedIds.includes(o.id))
            )
          }
          onBulkArchive={list.handleBulkArchive}
          onBulkDelete={() => {
            const selectedObjs = list.organizations.filter((o) =>
              list.selectedIds.includes(o.id)
            );
            setDeletingClients(selectedObjs);
            setDeletingClient(selectedObjs.length === 1 ? selectedObjs[0] : null);
          }}
        />

        <ClientTable
          clients={list.paginatedClients}
          machines={list.machines}
          selectedIds={list.selectedIds}
          isAllPageSelected={list.isAllPageSelected}
          activeMenuId={activeMenuId}
          currentPage={list.currentPage}
          totalPages={list.totalPages}
          rowsPerPage={list.rowsPerPage}
          totalItems={list.totalItems}
          startIndex={list.startIndex}
          endIndex={list.endIndex}
          onToggleSelectAll={list.toggleSelectAll}
          onToggleSelectRow={list.toggleSelectRow}
          onToggleMenu={setActiveMenuId}
          onSelectClient={list.handleSelectClient}
          onEditClient={setEditingClient}
          onExportClient={(client) => list.handleExportData([client])}
          onToggleStatus={(client) => {
            setActiveMenuId(null);
            list.handleToggleClientStatus(client);
          }}
          onDeleteClient={(client) => {
            setDeletingClient(client);
            setDeletingClients([]);
          }}
          onPageChange={list.setCurrentPage}
          onRowsPerPageChange={(val) => {
            list.setRowsPerPage(val);
            list.setCurrentPage(1);
          }}
        />
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <DeleteClientModal
        isOpen={Boolean(deletingClient || deletingClients.length > 0)}
        client={deletingClient}
        selectedClients={deletingClients}
        machines={list.machines}
        onClose={() => {
          setDeletingClient(null);
          setDeletingClients([]);
        }}
        onSuccess={(deletedIds) => {
          list.setOrganizations((prev) => prev.filter((o) => !deletedIds.includes(o.id)));
          list.setSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(id)));
          list.fetchData();
          setToast({
            message: 'Client record deleted successfully.',
            type: 'info',
          });
        }}
      />
    </div>
  );
};
