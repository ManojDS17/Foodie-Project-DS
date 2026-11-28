import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Plus,
  Users,
} from 'lucide-react';
import {
  usersApi,
  orgsApi,
  machinesApi,
  operatorAssignmentsApi,
  getUserInitials,
} from '../services/api';
import { useAuth, useSilentRefresh } from '../hooks';
import { AddOperatorView } from '../components/operators/AddOperatorView';
import { UserDetailView } from '../components/team/UserDetailView';
import { EditUserView } from '../components/team/EditUserView';
import { RemoveUserModal } from '../components/team/RemoveUserModal';
import { AssignOperatorMachineModal } from '../components/operators/AssignOperatorMachineModal';
import {
  UserRowActionsMenu,
  UserStatusBadge,
} from '../components/team/UserActionControls';
import { getUserLifecycleStatus } from '../components/team/userLifecycle';
import { Toast, LoadErrorBanner } from '../components/common/Toast';
import type { User, Organization, Machine, OperatorMachineAssignment } from '../types';

const fetchTeamBundle = async (signal?: AbortSignal) => {
  const [userList, orgList, machineList, assignmentList] = await Promise.all([
    usersApi.getAll(undefined, signal),
    orgsApi.getAll(undefined, signal),
    machinesApi.getAll(undefined, signal),
    operatorAssignmentsApi.getAll(undefined, signal),
  ]);
  return {
    users: Array.isArray(userList) ? userList : [],
    organizations: Array.isArray(orgList) ? orgList : [],
    machines: Array.isArray(machineList) ? machineList : [],
    assignments: Array.isArray(assignmentList) ? assignmentList : [],
  };
};

export const TeamPage: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [operatorAssignments, setOperatorAssignments] = useState<OperatorMachineAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAddOperatorOpen, setIsAddOperatorOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [removingUser, setRemovingUser] = useState<User | null>(null);
  const [managingOperator, setManagingOperator] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [openMenuUserId, setOpenMenuUserId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | 'SITE_ADMIN' | 'OPERATOR'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive' | 'Pending'>('All');

  const fetchUsers = useCallback(async (showSpinner = false, signal?: AbortSignal) => {
    try {
      if (showSpinner) setIsLoading(true);
      const bundle = await fetchTeamBundle(signal);
      if (signal?.aborted) return;
      setUsers(bundle.users);
      setOrganizations(bundle.organizations);
      setMachines(bundle.machines);
      setOperatorAssignments(bundle.assignments);
      setLoadError(null);

      setViewingUser((curr) => {
        if (!curr) return null;
        return bundle.users.find((u) => u.id === curr.id) || curr;
      });
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) return;
      console.error('Failed to load team members:', err);
      setLoadError(err?.message || 'Unable to load team members. Please try again.');
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchTeamBundle(controller.signal)
      .then((bundle) => {
        if (controller.signal.aborted) return;
        setUsers(bundle.users);
        setOrganizations(bundle.organizations);
        setMachines(bundle.machines);
        setOperatorAssignments(bundle.assignments);
        setLoadError(null);
      })
      .catch((err: any) => {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        console.error('Failed to load team members:', err);
        setLoadError(err?.message || 'Unable to load team members. Please try again.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const handleReset = () => {
      setViewingUser(null);
      setEditingUser(null);
      setIsAddOperatorOpen(false);
    };
    window.addEventListener('foodie:reset-team-view', handleReset);
    return () => {
      window.removeEventListener('foodie:reset-team-view', handleReset);
    };
  }, []);

  useSilentRefresh((signal) => fetchUsers(false, signal), {
    intervalMs: 12000,
    enabled: !isAddOperatorOpen && !editingUser && !removingUser && !managingOperator,
  });

  const handleConfirmRemove = async () => {
    if (!removingUser) return;
    try {
      setIsDeletingUser(true);
      await usersApi.update(removingUser.id, { is_active: false });
      setToast({ message: 'User marked as inactive.', type: 'success' });
      setRemovingUser(null);
      fetchUsers(true);
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to remove user.', type: 'error' });
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Filter pipeline
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // 1. Search Query
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
        const email = (u.email || '').toLowerCase();
        const phone = (u.phone_number || '').toLowerCase();
        if (!fullName.includes(q) && !email.includes(q) && !phone.includes(q)) {
          return false;
        }
      }

      // 2. Role Filter
      if (roleFilter !== 'All' && u.role !== roleFilter) {
        return false;
      }

      // 3. Status Filter
      if (statusFilter !== 'All') {
        const userStatus = getUserLifecycleStatus(u);
        if (userStatus !== statusFilter) {
          return false;
        }
      }

      return true;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const clientName =
    user?.company_name ||
    organizations.find((o) => o.id === user?.organization_id)?.company_name ||
    'Client Organisation';

  const viewingUserMachines = useMemo(() => {
    if (!viewingUser) return [];
    if (viewingUser.role === 'OPERATOR') {
      return operatorAssignments
        .filter(
          (a) =>
            String(a.operator_id || '').trim().toLowerCase() === String(viewingUser.id || '').trim().toLowerCase() &&
            a.status === 'Active'
        )
        .map((a) => a.machine_code || a.serial_number || a.machine_id)
        .filter(Boolean);
    }

    // Site Admin has access to all machines in their organization
    const orgId = viewingUser.organization_id || user?.organization_id;
    if (orgId) {
      return machines
        .filter((m) => m.organization_id === orgId && !m.is_deleted)
        .map((m) => m.machine_code || m.serial_number)
        .filter(Boolean);
    }
    return [];
  }, [viewingUser, operatorAssignments, machines, user?.organization_id]);

  const managingOrgId = managingOperator?.organization_id || viewingUser?.organization_id || user?.organization_id;
  const availableClientMachines = useMemo(() => {
    if (!managingOrgId) return [];
    return machines.filter((m) => m.organization_id === managingOrgId && !m.is_deleted);
  }, [machines, managingOrgId]);

  const handleAssignOperatorMachine = async (data: { operator_id: string; machine_id: string; location?: string }) => {
    try {
      const newAssignment = await operatorAssignmentsApi.assign(data);
      if (newAssignment) {
        setOperatorAssignments((prev) => {
          const filtered = prev.filter(
            (a) => !(a.operator_id === data.operator_id && a.machine_id === data.machine_id)
          );
          return [newAssignment, ...filtered];
        });
      }
      await fetchUsers(true);
      setToast({ message: 'Machine assigned to operator successfully.', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to assign machine.', type: 'error' });
      await fetchUsers(true);
      throw err;
    }
  };

  const handleRevokeOperatorMachine = async (assignmentId: string) => {
    try {
      setOperatorAssignments((prev) =>
        prev.map((a) => (a.id === assignmentId ? { ...a, status: 'Revoked' } : a))
      );
      await operatorAssignmentsApi.revoke(assignmentId);
      await fetchUsers(true);
      setToast({ message: 'Machine assignment revoked successfully.', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to revoke assignment.', type: 'error' });
      await fetchUsers(true);
      throw err;
    }
  };

  if (isAddOperatorOpen) {
    return (
      <div className="select-none">
        <AddOperatorView
          existingClients={organizations}
          initialClientId={user?.organization_id || undefined}
          isClientLocked={true}
          backLabel="Team"
          onBack={() => setIsAddOperatorOpen(false)}
          onSuccess={(newOp) => {
            setIsAddOperatorOpen(false);
            fetchUsers(true);
            setToast({
              message: `Operator ${newOp.first_name} ${newOp.last_name} added successfully!`,
              type: 'success',
            });
          }}
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

  if (editingUser) {
    return (
      <div className="select-none">
        <EditUserView
          user={editingUser}
          organizationName={clientName}
          onBack={() => setEditingUser(null)}
          onSuccess={(updated) => {
            setEditingUser(null);
            if (viewingUser?.id === updated.id) {
              setViewingUser(updated);
            }
            fetchUsers(true);
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
    return (
      <div className="select-none">
        <UserDetailView
          user={viewingUser}
          organizationName={clientName}
          assignedMachines={viewingUserMachines}
          onBack={() => setViewingUser(null)}
          onEdit={(u) => setEditingUser(u)}
          onRemove={(u) => setRemovingUser(u)}
          onManageMachines={(u) => setManagingOperator(u)}
          onToast={(msg, type) => setToast({ message: msg, type })}
        />

        <AssignOperatorMachineModal
          isOpen={Boolean(managingOperator)}
          operator={managingOperator}
          clientMachines={availableClientMachines}
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
            onConfirm={handleConfirmRemove}
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
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] w-full min-w-0 mx-auto pb-12 select-none">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            Team
          </h1>
          <p className="text-xs text-foreground-muted mt-1">
            People who can access {clientName} on Foodie Dashboard.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOperatorOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary-hover active:bg-primary-hover transition-all cursor-pointer shadow-2xs self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-white" />
          <span>Add operator</span>
        </button>
      </div>

      {/* 2. Main Content Card */}
      {loadError && (
        <LoadErrorBanner message={loadError} onRetry={() => fetchUsers(true)} />
      )}
      <div className="bg-white rounded-2xl border border-border-default shadow-2xs overflow-hidden">
        {/* Filter Controls Row */}
        <div className="p-4 sm:p-5 border-b border-surface-hover flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-foreground-subtle absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name or email"
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-border-strong bg-white text-xs text-foreground placeholder:text-foreground-subtle focus:outline-none focus:border-foreground transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Role Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground-muted font-medium shrink-0">Role</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-border-strong bg-white text-xs font-medium text-foreground focus:outline-none focus:border-foreground cursor-pointer min-w-[120px]"
              >
                <option value="All">All</option>
                <option value="SITE_ADMIN">Site Admin</option>
                <option value="OPERATOR">Operator</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground-muted font-medium shrink-0">Status</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-border-strong bg-white text-xs font-medium text-foreground focus:outline-none focus:border-foreground cursor-pointer min-w-[120px]"
              >
                <option value="All">All</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3. Team Members Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-surface-hover text-[11px] font-semibold text-foreground-muted bg-surface-muted">
                <th className="py-3 px-4 sm:px-6">Name</th>
                <th className="py-3 px-4 sm:px-6">Email</th>
                <th className="py-3 px-4 sm:px-6">Phone</th>
                <th className="py-3 px-4 sm:px-6">Role</th>
                <th className="py-3 px-4 sm:px-6">Status</th>
                <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-hover text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-foreground-subtle">
                    Loading team members...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center text-foreground-subtle">
                        <Users className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-semibold text-foreground">
                        {searchQuery || roleFilter !== 'All' || statusFilter !== 'All'
                          ? 'No matching team members found'
                          : 'No team members added yet'}
                      </span>
                      <p className="text-[11px] text-foreground-muted max-w-sm">
                        {searchQuery || roleFilter !== 'All' || statusFilter !== 'All'
                          ? 'Try clearing your search or status filter to see all team members.'
                          : 'Add your first operator to grant them access to this facility.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Team Member';
                  const initials = getUserInitials(u.first_name, u.last_name, u.email);
                  const isSiteAdmin = u.role === 'SITE_ADMIN';

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-surface-muted transition-colors group"
                    >
                      {/* Name with initials avatar */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <button
                          type="button"
                          onClick={() => setViewingUser(u)}
                          className="flex items-center gap-3 text-left hover:underline cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-full bg-surface-hover text-foreground-body font-semibold text-xs flex items-center justify-center shrink-0 border border-border-default">
                            {initials}
                          </div>
                          <span className="font-semibold text-foreground">
                            {fullName}
                          </span>
                        </button>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 sm:px-6 text-foreground-muted font-normal">
                        {u.email}
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4 sm:px-6 text-foreground font-mono">
                        {u.phone_number || '—'}
                      </td>

                      {/* Role badge */}
                      <td className="py-3.5 px-4 sm:px-6">
                        {isSiteAdmin ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-light text-status-fault-text border border-primary-border">
                            Site Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-hover text-foreground-body border border-border-default">
                            Operator
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <UserStatusBadge user={u} />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <div className="inline-flex items-center gap-2 text-left justify-end">
                          <UserRowActionsMenu
                            user={u}
                            isOpen={openMenuUserId === u.id}
                            removeLabel="Remove user"
                            onToggle={() => setOpenMenuUserId(openMenuUserId === u.id ? null : u.id)}
                            onClose={() => setOpenMenuUserId(null)}
                            onView={setViewingUser}
                            onEdit={setEditingUser}
                            onManageMachines={setManagingOperator}
                            onRemove={setRemovingUser}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AssignOperatorMachineModal
        isOpen={Boolean(managingOperator)}
        operator={managingOperator}
        clientMachines={availableClientMachines}
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
          onConfirm={handleConfirmRemove}
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
