import React, { useState } from 'react';
import { LayoutGrid, Users } from 'lucide-react';
import { MachineDetailView } from '../machines/MachineDetailView';
import { TerminateLeaseModal } from './TerminateLeaseModal';
import { EditAssignedMachineModal } from './EditAssignedMachineModal';
import { AssignOperatorMachineModal } from '../operators/AssignOperatorMachineModal';
import { UserDetailView } from '../team/UserDetailView';
import { EditUserView } from '../team/EditUserView';
import { RemoveUserModal } from '../team/RemoveUserModal';
import { Toast, LoadErrorBanner } from '../common/Toast';
import type { Organization, Machine, User } from '../../types';
import { ClientSummaryHeader } from './ClientSummaryHeader';
import { ClientMachineTable } from './ClientMachineTable';
import { ClientOperatorTable } from './ClientOperatorTable';
import { useClientDetailData } from './useClientDetailData';

export interface ClientDetailViewProps {
  client: Organization;
  machines: Machine[];
  users: User[];
  onBack: () => void;
  onEdit: () => void;
  onAssignMachine: () => void;
  onUnassignMachine: (machineId: string, terminationRemark?: string) => Promise<void>;
  onDeleteClient: () => void;
  onToggleStatus: () => Promise<void>;
  onUpdateMachine?: (updatedMachine: Machine) => void;
}

export const ClientDetailView: React.FC<ClientDetailViewProps> = ({
  client,
  machines,
  users,
  onBack,
  onEdit,
  onAssignMachine,
  onUnassignMachine,
  onDeleteClient,
  onToggleStatus,
  onUpdateMachine,
}) => {
  const [activeTab, setActiveTab] = useState<'MACHINES' | 'USERS'>('MACHINES');
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [activeMachineMenuId, setActiveMachineMenuId] = useState<string | null>(null);
  const [activeUserMenuId, setActiveUserMenuId] = useState<string | null>(null);
  const [viewingMachine, setViewingMachine] = useState<Machine | null>(null);
  const [editingAssignedMachine, setEditingAssignedMachine] = useState<Machine | null>(null);
  const [terminatingMachine, setTerminatingMachine] = useState<Machine | null>(null);
  const [managingOperator, setManagingOperator] = useState<User | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [removingUser, setRemovingUser] = useState<User | null>(null);
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

  const {
    clientMachines,
    clientUsers,
    operatorAssignments,
    loadError,
    isDeletingUser,
    runningCount,
    idleCount,
    adminCount,
    operatorCount,
    openAlertsCount,
    energyConsumedTodayKwh,
    refreshUsers,
    fetchAssignments,
    handleAssignedMachineUpdated,
    handleConfirmRemoveUser,
    handleAssignOperatorMachine,
    handleRevokeOperatorMachine,
    handleExportDetails,
  } = useClientDetailData({
    client,
    machines,
    users,
    activeTab,
    isModalOpen: Boolean(editingUser || removingUser || terminatingMachine || managingOperator),
    onUpdateMachine,
    onToast: setToast,
  });

  if (editingUser) {
    return (
      <div className="select-none">
        <EditUserView
          user={editingUser}
          organizationName={client.company_name}
          backLabel={client.company_name}
          onBack={() => setEditingUser(null)}
          onSuccess={(updated) => {
            setEditingUser(null);
            if (viewingUser?.id === updated.id) setViewingUser(updated);
            refreshUsers();
            setToast({ message: 'User updated successfully.', type: 'success' });
          }}
          onError={(msg) => setToast({ message: msg, type: 'error' })}
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  if (viewingUser) {
    const operatorActiveAssignments = operatorAssignments
      .filter(
        (a) =>
          String(a.operator_id || '').trim().toLowerCase() ===
            String(viewingUser.id || '').trim().toLowerCase() &&
          a.status === 'Active'
      )
      .map((a) => a.machine_code || a.serial_number || '')
      .filter(Boolean);

    return (
      <div className="select-none">
        <UserDetailView
          user={viewingUser}
          organizationName={client.company_name}
          backLabel={client.company_name}
          assignedMachines={operatorActiveAssignments}
          onBack={() => setViewingUser(null)}
          onEdit={(u) => setEditingUser(u)}
          onRemove={(u) => setRemovingUser(u)}
          onManageMachines={(u) => setManagingOperator(u)}
          onToast={(msg, type) => setToast({ message: msg, type })}
        />
        {removingUser && (
          <RemoveUserModal
            user={removingUser}
            isOpen={Boolean(removingUser)}
            onClose={() => setRemovingUser(null)}
            onConfirm={() => handleConfirmRemoveUser(removingUser, () => setRemovingUser(null))}
            isDeleting={isDeletingUser}
          />
        )}
        {managingOperator && (
          <AssignOperatorMachineModal
            isOpen={Boolean(managingOperator)}
            operator={managingOperator}
            clientMachines={clientMachines}
            existingAssignments={operatorAssignments}
            onClose={() => setManagingOperator(null)}
            onAssign={handleAssignOperatorMachine}
            onRevoke={handleRevokeOperatorMachine}
          />
        )}
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  if (viewingMachine) {
    return (
      <div className="select-none">
        <MachineDetailView
          machine={viewingMachine}
          backLabel={client.company_name}
          onBack={() => setViewingMachine(null)}
          onEdit={(m) => setEditingAssignedMachine(m)}
          onDelete={() => {}}
        />
        {editingAssignedMachine && (
          <EditAssignedMachineModal
            isOpen={Boolean(editingAssignedMachine)}
            machine={editingAssignedMachine}
            clientName={client.company_name}
            onClose={() => setEditingAssignedMachine(null)}
            onSuccess={(updated) =>
              handleAssignedMachineUpdated(updated, viewingMachine, setViewingMachine)
            }
          />
        )}
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-[1400px] mx-auto select-none">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-foreground-muted pt-1">
        <button
          type="button"
          onClick={onBack}
          className="hover:text-foreground cursor-pointer transition-colors"
        >
          Clients
        </button>
        <span className="text-foreground-subtle">/</span>
        <span className="font-bold text-foreground">{client.company_name}</span>
      </nav>

      {loadError && (
        <LoadErrorBanner
          message={loadError}
          onRetry={() => {
            refreshUsers();
            fetchAssignments();
          }}
        />
      )}

      <ClientSummaryHeader
        client={client}
        assignedMachinesCount={clientMachines.length}
        runningCount={runningCount}
        idleCount={idleCount}
        totalUsersCount={clientUsers.length}
        adminCount={adminCount}
        operatorCount={operatorCount}
        openAlertsCount={openAlertsCount}
        energyConsumedTodayKwh={energyConsumedTodayKwh}
        isHeaderMenuOpen={isHeaderMenuOpen}
        onToggleHeaderMenu={() => setIsHeaderMenuOpen((p) => !p)}
        onCloseHeaderMenu={() => setIsHeaderMenuOpen(false)}
        onEdit={onEdit}
        onExportDetails={handleExportDetails}
        onToggleStatus={onToggleStatus}
        onCannotDeactivate={(msg) => setToast({ message: msg, type: 'error' })}
        onDeleteClient={onDeleteClient}
      />

      <div className="bg-white rounded-2xl border border-border-default overflow-hidden shadow-2xs">
        <div className="border-b border-border-default px-6 flex items-center gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('MACHINES')}
            className={`py-4 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
              activeTab === 'MACHINES'
                ? 'border-primary text-primary'
                : 'border-transparent text-foreground-muted hover:text-foreground'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Machines</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                activeTab === 'MACHINES'
                  ? 'bg-primary-light text-primary'
                  : 'bg-surface-hover text-foreground-muted'
              }`}
            >
              {clientMachines.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('USERS')}
            className={`py-4 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
              activeTab === 'USERS'
                ? 'border-primary text-primary'
                : 'border-transparent text-foreground-muted hover:text-foreground'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                activeTab === 'USERS'
                  ? 'bg-primary-light text-primary'
                  : 'bg-surface-hover text-foreground-muted'
              }`}
            >
              {clientUsers.length}
            </span>
          </button>
        </div>

        {activeTab === 'MACHINES' ? (
          <ClientMachineTable
            machines={clientMachines}
            activeMachineMenuId={activeMachineMenuId}
            onToggleMenu={setActiveMachineMenuId}
            onAssignMachine={onAssignMachine}
            onViewMachine={setViewingMachine}
            onEditLease={setEditingAssignedMachine}
            onTerminateLease={setTerminatingMachine}
          />
        ) : (
          <ClientOperatorTable
            users={clientUsers}
            operatorAssignments={operatorAssignments}
            activeUserMenuId={activeUserMenuId}
            onToggleMenu={setActiveUserMenuId}
            onViewUser={setViewingUser}
            onEditUser={setEditingUser}
            onManageMachines={setManagingOperator}
            onRemoveUser={setRemovingUser}
          />
        )}
      </div>

      <EditAssignedMachineModal
        isOpen={Boolean(editingAssignedMachine)}
        machine={editingAssignedMachine}
        clientName={client.company_name}
        onClose={() => setEditingAssignedMachine(null)}
        onSuccess={(updated) =>
          handleAssignedMachineUpdated(updated, viewingMachine, setViewingMachine)
        }
      />

      <TerminateLeaseModal
        isOpen={Boolean(terminatingMachine)}
        machine={terminatingMachine}
        clientName={client.company_name}
        onClose={() => setTerminatingMachine(null)}
        onConfirm={async (id, remark) => {
          await onUnassignMachine(id, remark);
          setTerminatingMachine(null);
        }}
      />

      <AssignOperatorMachineModal
        isOpen={Boolean(managingOperator)}
        operator={managingOperator}
        clientMachines={clientMachines}
        existingAssignments={operatorAssignments}
        onClose={() => setManagingOperator(null)}
        onAssign={handleAssignOperatorMachine}
        onRevoke={handleRevokeOperatorMachine}
      />

      {removingUser && (
        <RemoveUserModal
          user={removingUser}
          isOpen={Boolean(removingUser)}
          onClose={() => setRemovingUser(null)}
          onConfirm={() => handleConfirmRemoveUser(removingUser, () => setRemovingUser(null))}
          isDeleting={isDeletingUser}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};
