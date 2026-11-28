import { useCallback, useEffect, useState } from 'react';
import {
  downloadCsv,
  operatorAssignmentsApi,
  usersApi,
} from '../../services/api';
import { useSilentRefresh } from '../../hooks';
import type {
  Machine,
  OperatorMachineAssignment,
  Organization,
  User,
} from '../../types';

export interface UseClientDetailDataOptions {
  client: Organization;
  machines: Machine[];
  users: User[];
  activeTab: 'MACHINES' | 'USERS';
  isModalOpen: boolean;
  onUpdateMachine?: (updated: Machine) => void;
  onToast: (toast: { message: string; type?: 'success' | 'error' | 'info' }) => void;
}

export function useClientDetailData({
  client,
  machines,
  users,
  activeTab,
  isModalOpen,
  onUpdateMachine,
  onToast,
}: UseClientDetailDataOptions) {
  const [prevUsers, setPrevUsers] = useState<User[]>(users);
  const [prevMachines, setPrevMachines] = useState<Machine[]>(machines);
  const [localMachines, setLocalMachines] = useState<Machine[]>(machines);
  const [localUsers, setLocalUsers] = useState<User[]>(users);
  const [operatorAssignments, setOperatorAssignments] = useState<OperatorMachineAssignment[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  if (users !== prevUsers) {
    setPrevUsers(users);
    setLocalUsers(users);
  }

  if (machines !== prevMachines) {
    setPrevMachines(machines);
    setLocalMachines(machines);
  }

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

  const fetchAssignments = useCallback(
    async (signal?: AbortSignal) => {
      if (!client.id) return;
      try {
        const data = await operatorAssignmentsApi.getAll(
          { organization_id: client.id },
          signal
        );
        if (signal?.aborted) return;
        setOperatorAssignments(data);
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal?.aborted) return;
        console.error('Failed to load operator assignments:', err);
      }
    },
    [client.id]
  );

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
      await Promise.all([refreshUsers(signal), fetchAssignments(signal)]);
    },
    { intervalMs: 8000, enabled: !isModalOpen }
  );

  const clientMachines = localMachines.filter((m) => m.organization_id === client.id);
  const clientUsers = localUsers.filter(
    (u) =>
      u.organization_id &&
      client?.id &&
      String(u.organization_id).trim().toLowerCase() ===
        String(client.id).trim().toLowerCase() &&
      !u.is_deleted
  );

  const runningCount = clientMachines.filter(
    (m) =>
      (m.operational_status || '').toLowerCase() === 'running' ||
      (m.connectivity_status || '').toLowerCase() === 'online'
  ).length;
  const idleCount = Math.max(0, clientMachines.length - runningCount);

  const adminCount = clientUsers.filter(
    (u) => u.role === 'SITE_ADMIN' || u.role === 'OEM_MANAGER'
  ).length;
  const operatorCount = Math.max(0, clientUsers.length - adminCount);
  const openAlertsCount = clientMachines.filter(
    (m) => (m.connectivity_status || '').toLowerCase() === 'offline'
  ).length;
  const energyReadings = clientMachines
    .map((m) => m.telemetry?.energy_used_today ?? m.telemetry?.energy_consumed_kwh)
    .filter((val): val is number => typeof val === 'number' && Number.isFinite(val));
  const energyConsumedTodayKwh =
    energyReadings.length > 0
      ? Number(energyReadings.reduce((acc, v) => acc + v, 0).toFixed(1))
      : null;

  const handleAssignedMachineUpdated = (
    updated: Machine,
    viewingMachine: Machine | null,
    setViewingMachine: (m: Machine | null) => void
  ) => {
    setLocalMachines((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    if (viewingMachine && viewingMachine.id === updated.id) {
      setViewingMachine(updated);
    }
    onUpdateMachine?.(updated);
    onToast({
      message: `Lease details for machine ${updated.serial_number || updated.machine_code} updated successfully.`,
      type: 'success',
    });
  };

  const handleConfirmRemoveUser = async (removingUser: User, onDone: () => void) => {
    try {
      setIsDeletingUser(true);
      await usersApi.update(removingUser.id, { is_active: false });
      onToast({ message: 'User marked as inactive.', type: 'success' });
      onDone();
      refreshUsers();
    } catch (err: any) {
      onToast({ message: err.message || 'Failed to update user status.', type: 'error' });
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleAssignOperatorMachine = async (data: {
    operator_id: string;
    machine_id: string;
    location?: string;
  }) => {
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
    } catch (err) {
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
    } catch (err) {
      await fetchAssignments();
      throw err;
    }
  };

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

  return {
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
  };
}

