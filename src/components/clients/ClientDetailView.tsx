import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MapPin,
  Calendar,
  Pencil,
  MoreHorizontal,
  LayoutGrid,
  Users,
  Bell,
  Zap,
  Plus,
  Trash2,
  Download,
  Archive,
  RotateCcw,
  Eye,
  Cpu,
} from 'lucide-react';
import { MachineDetailView } from '../machines/MachineDetailView';
import { TerminateLeaseModal } from './TerminateLeaseModal';
import { EditAssignedMachineModal } from './EditAssignedMachineModal';
import { AssignOperatorMachineModal } from '../operators/AssignOperatorMachineModal';
import { UserDetailView } from '../team/UserDetailView';
import { EditUserView } from '../team/EditUserView';
import { RemoveUserModal } from '../team/RemoveUserModal';
import { Toast, LoadErrorBanner } from '../common/Toast';
import { RowActionMenu } from '../common/RowActionMenu';
import {
  operatorAssignmentsApi,
  usersApi,
  downloadCsv,
  formatDate,
  formatLocation,
  getCompanyInitials,
} from '../../services/api';
import { useSilentRefresh } from '../../hooks';
import type { Organization, Machine, User, OperatorMachineAssignment } from '../../types';

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
  const [viewingMachine, setViewingMachine] = useState<Machine | null>(null);
  const [editingAssignedMachine, setEditingAssignedMachine] = useState<Machine | null>(null);
  const [prevUsers, setPrevUsers] = useState<User[]>(users);
  const [prevMachines, setPrevMachines] = useState<Machine[]>(machines);
  const [localMachines, setLocalMachines] = useState<Machine[]>(machines);
  const [terminatingMachine, setTerminatingMachine] = useState<Machine | null>(null);
  const [managingOperator, setManagingOperator] = useState<User | null>(null);
  const [operatorAssignments, setOperatorAssignments] = useState<OperatorMachineAssignment[]>([]);

  const [localUsers, setLocalUsers] = useState<User[]>(users);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [removingUser, setRemovingUser] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [activeUserMenuId, setActiveUserMenuId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

  const userActionMenuRef = useRef<HTMLDivElement>(null);

  if (users !== prevUsers) {
    setPrevUsers(users);
    setLocalUsers(users);
  }

  if (machines !== prevMachines) {
    setPrevMachines(machines);
    setLocalMachines(machines);
  }

  const handleAssignedMachineUpdated = (updated: Machine) => {
    setLocalMachines((prev) =>
      prev.map((m) => (m.id === updated.id ? updated : m))
    );
    if (viewingMachine && viewingMachine.id === updated.id) {
      setViewingMachine(updated);
    }
    if (onUpdateMachine) {
      onUpdateMachine(updated);
    }
    setToast({
      message: `Lease details for machine ${updated.serial_number || updated.machine_code} updated successfully.`,
      type: 'success',
    });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userActionMenuRef.current && !userActionMenuRef.current.contains(e.target as Node)) {
        setActiveUserMenuId(null);
      }
    };
    if (activeUserMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeUserMenuId]);

  const refreshUsers = useCallback(async (signal?: AbortSignal) => {
    try {
      const allUsers = await usersApi.getAll(undefined, signal);
      if (signal?.aborted) return;
      setLocalUsers(allUsers);
      setLoadError(null);
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) return;
      console.error('Failed to refresh users:', err);
      setLoadError(err?.message || 'Failed to load client team data.');
    }
  }, []);

  const handleConfirmRemoveUser = async () => {
    if (!removingUser) return;
    try {
      setIsDeletingUser(true);
      await usersApi.update(removingUser.id, { is_active: false });
      setToast({ message: 'User marked as inactive.', type: 'success' });
      setRemovingUser(null);
      refreshUsers();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to update user status.', type: 'error' });
    } finally {
      setIsDeletingUser(false);
    }
  };

  const fetchAssignments = useCallback(async (signal?: AbortSignal) => {
    if (!client.id) return;
    try {
      const data = await operatorAssignmentsApi.getAll({ organization_id: client.id }, signal);
      if (signal?.aborted) return;
      setOperatorAssignments(data);
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) return;
      console.error('Failed to load operator assignments:', err);
    }
  }, [client]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      usersApi.getAll(undefined, controller.signal),
      operatorAssignmentsApi.getAll({ organization_id: client.id }, controller.signal),
    ])
      .then(([allUsers, assignments]) => {
        if (controller.signal.aborted) return;
        setLocalUsers(allUsers);
        setOperatorAssignments(assignments);
        setLoadError(null);
      })
      .catch((err: any) => {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        console.error('Failed to load client team data:', err);
        setLoadError(err?.message || 'Failed to load client team data.');
      });
    return () => controller.abort();
  }, [client.id]);

  useEffect(() => {
    if (activeTab !== 'USERS') return;
    const controller = new AbortController();
    Promise.all([
      usersApi.getAll(undefined, controller.signal),
      operatorAssignmentsApi.getAll({ organization_id: client.id }, controller.signal),
    ])
      .then(([allUsers, assignments]) => {
        if (controller.signal.aborted) return;
        setLocalUsers(allUsers);
        setOperatorAssignments(assignments);
        setLoadError(null);
      })
      .catch((err: any) => {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        console.error('Failed to load client team data:', err);
        setLoadError(err?.message || 'Failed to load client team data.');
      });
    return () => controller.abort();
  }, [activeTab, client.id]);

  useSilentRefresh(
    async (signal) => {
      await Promise.all([
        refreshUsers(signal),
        fetchAssignments(signal),
      ]);
    },
    {
      intervalMs: 8000,
      enabled: !editingUser && !removingUser && !terminatingMachine && !managingOperator,
    }
  );

  const handleAssignOperatorMachine = async (data: { operator_id: string; machine_id: string; location?: string }) => {
    try {
      const res = await operatorAssignmentsApi.assign(data);
      if (res) {
        setOperatorAssignments((prev) => {
          const filtered = prev.filter(
            (a) => !(a.operator_id === data.operator_id && a.machine_id === data.machine_id)
          );
          return [res, ...filtered];
        });
      }
      await fetchAssignments();
    } catch (err: any) {
      await fetchAssignments();
      throw err;
    }
  };

  const handleRevokeOperatorMachine = async (assignmentId: string) => {
    try {
      setOperatorAssignments((prev) =>
        prev.map((a) => (a.id === assignmentId ? { ...a, status: 'Revoked' } : a))
      );
      await operatorAssignmentsApi.revoke(assignmentId);
      await fetchAssignments();
    } catch (err: any) {
      await fetchAssignments();
      throw err;
    }
  };

  const headerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setIsHeaderMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getModelCapacity = (model: string, capacity?: string | null): string => {
    if (capacity && capacity.trim()) return capacity;
    if (model.includes('1000')) return '1000 kg/day';
    if (model.includes('500')) return '500 kg/day';
    if (model.includes('100')) return '100 kg/day';
    if (model.includes('25')) return '25 kg/day';
    return '100 kg/day';
  };

  const clientMachines = localMachines.filter((m) => m.organization_id === client.id);
  const clientUsers = localUsers.filter(
    (u) =>
      u.organization_id &&
      client?.id &&
      String(u.organization_id).trim().toLowerCase() === String(client.id).trim().toLowerCase() &&
      !u.is_deleted
  );

  const runningMachines = clientMachines.filter(
    (m) =>
      (m.operational_status || '').toLowerCase() === 'running' ||
      (m.connectivity_status || '').toLowerCase() === 'online'
  );
  const runningCount = runningMachines.length;
  const idleCount = Math.max(0, clientMachines.length - runningCount);

  const adminUsers = clientUsers.filter(
    (u) => u.role === 'SITE_ADMIN' || u.role === 'OEM_MANAGER'
  );
  const adminCount = adminUsers.length;
  const operatorCount = Math.max(0, clientUsers.length - adminCount);

  const offlineMachines = clientMachines.filter(
    (m) => (m.connectivity_status || '').toLowerCase() === 'offline'
  );
  const openAlertsCount = offlineMachines.length > 0 ? offlineMachines.length : 0;

  const totalEnergyKwh = clientMachines.length > 0 ? clientMachines.length * 17 : 0;

  const handleExportDetails = () => {
    const rows: unknown[][] = [
      ['Field', 'Value'],
      ['Client ID', client.client_code],
      ['Company Name', client.company_name],
      ['Business Type', client.business_type || 'Corporate'],
      ['Tax ID', client.tax_id || ''],
      ['Onboarding Date', client.onboarding_date || client.created_at],
      ['Comms Preference', client.comms_preference || 'Phone'],
      ['Payment Terms', client.payment_terms || '14 days'],
      ['Contact POC', client.contact_poc || ''],
      ['Email', client.email || ''],
      ['Phone', client.phone_number || ''],
      ['Website', client.website || ''],
      ['Billing Address', client.billing_address || ''],
      ['Assigned Machines', clientMachines.length],
    ];
    downloadCsv(`${client.client_code}_details_${Date.now()}.csv`, rows);
  };

  const clientStatus = client.status || (client.is_active ? 'Active' : 'Inactive');

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
            if (viewingUser?.id === updated.id) {
              setViewingUser(updated);
            }
            refreshUsers();
            setToast({ message: 'User updated successfully.', type: 'success' });
          }}
          onError={(msg) => setToast({ message: msg, type: 'error' })}
        />
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    );
  }

  if (viewingUser) {
    const operatorActiveAssignments = operatorAssignments
      .filter(
        (a) =>
          String(a.operator_id || '').trim().toLowerCase() === String(viewingUser.id || '').trim().toLowerCase() &&
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
            onConfirm={handleConfirmRemoveUser}
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
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
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
          onEdit={(m) => {
            setEditingAssignedMachine(m);
          }}
          onDelete={() => {}}
        />
        {editingAssignedMachine && (
          <EditAssignedMachineModal
            isOpen={Boolean(editingAssignedMachine)}
            machine={editingAssignedMachine}
            clientName={client.company_name}
            onClose={() => setEditingAssignedMachine(null)}
            onSuccess={handleAssignedMachineUpdated}
          />
        )}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
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

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={onEdit}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold border border-border-strong text-foreground-body hover:bg-surface-muted flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
          >
            <Pencil className="w-3.5 h-3.5 text-foreground-body" />
            <span>Edit client</span>
          </button>

          <div className="relative" ref={headerMenuRef}>
            <button
              type="button"
              onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
              className="p-2 rounded-lg text-xs font-medium border border-border-strong text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors cursor-pointer shadow-2xs"
              aria-label="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isHeaderMenuOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white border border-border-default rounded-xl shadow-lg z-30 py-1 divide-y divide-surface-hover">
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      handleExportDetails();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs text-foreground-body hover:bg-surface-muted flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-foreground-muted" />
                    <span>Export client details</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      const isCurrentlyActive = client.is_active && client.status !== 'Inactive' && client.status !== 'Archived';
                      if (isCurrentlyActive && clientMachines.length > 0) {
                        setToast({
                          message: `Cannot deactivate client: ${client.company_name} currently has ${clientMachines.length} machine(s) leased. Please terminate all machine leases before deactivating.`,
                          type: 'error',
                        });
                        return;
                      }
                      onToggleStatus();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs text-foreground-body hover:bg-surface-muted flex items-center gap-2 cursor-pointer"
                  >
                    {!client.is_active || client.status === 'Inactive' || client.status === 'Archived' ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5 text-status-running-text" />
                        <span>Active</span>
                      </>
                    ) : (
                      <>
                        <Archive className="w-3.5 h-3.5 text-foreground-muted" />
                        <span>Inactive</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      onDeleteClient();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs text-primary hover:bg-primary-light flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-primary" />
                    <span>Delete client</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
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
            {clientMachines.length}
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
            {clientUsers.length}
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
          <div className="flex items-baseline mt-2">
            <span className="text-2xl sm:text-3xl font-bold text-foreground">{totalEnergyKwh}</span>
            <span className="text-xs sm:text-sm font-semibold text-foreground ml-1.5">kWh</span>
          </div>
          <div className="text-[11px] sm:text-xs text-foreground-muted mt-1 truncate">
            {clientMachines.length === 2 ? 'Today, both machines' : 'Today, across assigned fleet'}
          </div>
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

        {activeTab === 'MACHINES' && (
          <div>
            <div className="p-6 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">Machines</h3>
                <p className="text-xs text-foreground-muted mt-0.5">
                  Foodie machines leased to this client and their live status.
                </p>
              </div>

              <button
                type="button"
                onClick={onAssignMachine}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-primary hover:bg-primary-hover text-white flex items-center gap-1.5 shadow-2xs self-start sm:self-auto cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Assign machine</span>
              </button>
            </div>

            {clientMachines.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-surface-hover flex items-center justify-center text-foreground-subtle mx-auto mb-3">
                  <LayoutGrid className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-foreground">No machines assigned</h4>
                <p className="text-xs text-foreground-muted mt-1 max-w-sm mx-auto">
                  This client currently has no Foodie machines mapped. Click "Assign machine" above to lease units.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto pb-16">
                <table className="w-full text-xs text-left min-w-[700px]">
                  <thead>
                    <tr className="border-b border-border-default bg-surface-muted text-foreground-muted font-semibold">
                      <th className="py-3 px-6">Serial Number</th>
                      <th className="py-3 px-6">Model</th>
                      <th className="py-3 px-6">Location</th>
                      <th className="py-3 px-6">Lease start date</th>
                      <th className="py-3 px-6">Machine status</th>
                      <th className="py-3 px-6">Connectivity</th>
                      <th className="py-3 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default">
                    {clientMachines.map((m) => {
                      const isOnline = (m.connectivity_status || '').toLowerCase() === 'online';
                      const isRunning =
                        (m.operational_status || '').toLowerCase() === 'running' || isOnline;

                      return (
                        <tr key={m.id} className="hover:bg-surface-muted transition-colors">
                          <td className="py-4 px-6 font-bold text-primary">
                            <button
                              type="button"
                              onClick={() => setViewingMachine(m)}
                              className="underline hover:text-primary-hover cursor-pointer"
                            >
                              {m.serial_number || m.machine_code}
                            </button>
                          </td>

                          <td className="py-4 px-6">
                            <div className="font-bold text-foreground">{m.model}</div>
                            <div className="text-[11px] text-foreground-muted">
                              {getModelCapacity(m.model, m.capacity)}
                            </div>
                          </td>

                          <td className="py-4 px-6 text-foreground">
                            {m.lease_location_label?.trim() || '—'}
                          </td>

                          <td className="py-4 px-6 text-foreground">
                            {formatDate(m.lease_start_date || m.created_at)}
                          </td>

                          <td className="py-4 px-6">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                                isRunning
                                  ? 'bg-status-running-bg text-status-running-text border-status-running-dot/30'
                                  : 'bg-status-idle-bg text-status-idle-text border-status-idle-dot/30'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isRunning ? 'bg-status-running-dot' : 'bg-status-idle-dot'
                                }`}
                              />
                              <span>{isRunning ? 'Running' : 'Idle'}</span>
                            </span>
                          </td>

                          <td className="py-4 px-6">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                                isOnline
                                  ? 'bg-status-running-bg text-status-running-text border-status-running-dot/30'
                                  : 'bg-primary-light text-status-fault-text border-primary-border'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isOnline ? 'bg-status-running-dot' : 'bg-status-fault-dot'
                                }`}
                              />
                              <span>{isOnline ? 'Online' : 'Offline'}</span>
                            </span>
                          </td>

                          <td className="py-4 px-6 text-right">
                            <RowActionMenu
                              isOpen={activeMachineMenuId === m.id}
                              onToggle={() =>
                                setActiveMachineMenuId(
                                  activeMachineMenuId === m.id ? null : m.id
                                )
                              }
                              onClose={() => setActiveMachineMenuId(null)}
                              width="w-44"
                              buttonAriaLabel={`Actions for ${m.machine_code || m.serial_number}`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMachineMenuId(null);
                                  setEditingAssignedMachine(m);
                                }}
                                className="w-full px-3.5 py-2 text-left text-xs font-semibold text-foreground-body hover:bg-surface-muted transition-colors cursor-pointer"
                              >
                                Edit lease details
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMachineMenuId(null);
                                  setViewingMachine(m);
                                }}
                                className="w-full px-3.5 py-2 text-left text-xs font-semibold text-foreground-body hover:bg-surface-muted transition-colors cursor-pointer"
                              >
                                View machine
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMachineMenuId(null);
                                  setTerminatingMachine(m);
                                }}
                                className="w-full px-3.5 py-2 text-left text-xs font-semibold text-primary hover:bg-primary-light transition-colors cursor-pointer"
                              >
                                Terminate lease
                              </button>
                            </RowActionMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'USERS' && (
          <div>
            <div className="p-6 pb-4">
              <h3 className="text-sm font-bold text-foreground">Users</h3>
              <p className="text-xs text-foreground-muted mt-0.5">
                Authorized personnel with access to this client's Foodie composter fleet.
              </p>
            </div>

            {clientUsers.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-surface-hover flex items-center justify-center text-foreground-subtle mx-auto mb-3">
                  <Users className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-foreground">No users assigned</h4>
                <p className="text-xs text-foreground-muted mt-1 max-w-sm mx-auto">
                  Personnel can be added in User Management to grant access to this organization.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto pb-12">
                <table className="w-full text-xs text-left min-w-[750px]">
                  <thead>
                    <tr className="border-b border-border-default bg-surface-muted text-foreground-muted font-semibold">
                      <th className="py-3 px-6">Name</th>
                      <th className="py-3 px-6">Email</th>
                      <th className="py-3 px-6">Phone number</th>
                      <th className="py-3 px-6">Role</th>
                      <th className="py-3 px-6">Assigned machines</th>
                      <th className="py-3 px-6">Status</th>
                      <th className="py-3 px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default">
                    {clientUsers.map((u) => {
                      const userAssignments = operatorAssignments.filter(
                        (a) =>
                          String(a.operator_id || '').trim().toLowerCase() === String(u.id || '').trim().toLowerCase() &&
                          a.status === 'Active'
                      );

                      return (
                        <tr key={u.id} className="hover:bg-surface-muted transition-colors">
                          <td className="py-4 px-6 font-bold text-foreground">
                            <button
                              type="button"
                              onClick={() => setViewingUser(u)}
                              className="hover:underline text-left cursor-pointer font-bold text-foreground"
                            >
                              {u.first_name} {u.last_name}
                            </button>
                          </td>
                          <td className="py-4 px-6 text-foreground-muted">{u.email}</td>
                          <td className="py-4 px-6 text-foreground-muted">{u.phone_number || '—'}</td>
                          <td className="py-4 px-6">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-surface-hover text-foreground-body border border-border-default">
                              {u.role === 'SITE_ADMIN'
                                ? 'Site Admin'
                                : u.role === 'OPERATOR'
                                ? 'Operator'
                                : u.role}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            {u.role === 'OPERATOR' ? (
                              userAssignments.length === 0 ? (
                                <span className="text-foreground-subtle text-xs">No machines assigned</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {userAssignments.map((a) => (
                                    <span
                                      key={a.id}
                                      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-red-50 text-primary border border-red-100"
                                    >
                                      {a.machine_code || a.serial_number}
                                    </span>
                                  ))}
                                </div>
                              )
                            ) : (
                              <span className="text-foreground-muted text-xs font-medium">All fleet access</span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            {(() => {
                              if (!u.is_active) {
                                return (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-surface-hover text-foreground-muted border border-border-default">
                                    <span className="w-1.5 h-1.5 rounded-full bg-foreground-subtle" />
                                    <span>Inactive</span>
                                  </span>
                                );
                              }
                              if (!u.last_login_at) {
                                return (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    <span>Pending</span>
                                  </span>
                                );
                              }
                              return (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-status-running-bg text-status-running-text border border-status-running-dot/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-status-running-dot" />
                                  <span>Active</span>
                                </span>
                              );
                            })()}
                          </td>
                          <td className="py-4 px-6 text-right relative">
                            <div className="inline-flex items-center gap-2 text-left justify-end">
                              <RowActionMenu
                                isOpen={activeUserMenuId === u.id}
                                onToggle={() => setActiveUserMenuId(activeUserMenuId === u.id ? null : u.id)}
                                onClose={() => setActiveUserMenuId(null)}
                                buttonAriaLabel={`Actions for ${u.first_name}`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveUserMenuId(null);
                                    setViewingUser(u);
                                  }}
                                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-foreground-body hover:bg-surface-muted flex items-center gap-2 cursor-pointer transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5 text-foreground-muted" />
                                  <span>View user</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveUserMenuId(null);
                                    setEditingUser(u);
                                  }}
                                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-foreground-body hover:bg-surface-muted flex items-center gap-2 cursor-pointer transition-colors"
                                >
                                  <Pencil className="w-3.5 h-3.5 text-foreground-muted" />
                                  <span>Edit user</span>
                                </button>

                                {u.role === 'OPERATOR' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveUserMenuId(null);
                                      setManagingOperator(u);
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-foreground-body hover:bg-surface-muted flex items-center gap-2 cursor-pointer transition-colors"
                                  >
                                    <Cpu className="w-3.5 h-3.5 text-foreground-muted" />
                                    <span>Manage machines</span>
                                  </button>
                                )}

                                {u.role !== 'SITE_ADMIN' && (
                                  <>
                                    <div className="my-1 border-t border-surface-hover" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveUserMenuId(null);
                                        setRemovingUser(u);
                                      }}
                                      className="w-full px-3.5 py-2 text-left text-xs font-medium text-status-fault-text hover:bg-primary-light flex items-center gap-2 cursor-pointer transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-status-fault-text" />
                                      <span>Remove from team</span>
                                    </button>
                                  </>
                                )}
                              </RowActionMenu>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <EditAssignedMachineModal
        isOpen={Boolean(editingAssignedMachine)}
        machine={editingAssignedMachine}
        clientName={client.company_name}
        onClose={() => setEditingAssignedMachine(null)}
        onSuccess={handleAssignedMachineUpdated}
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
          onConfirm={handleConfirmRemoveUser}
          isDeleting={isDeletingUser}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};
