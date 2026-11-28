import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  downloadCsv,
  formatDate,
  machinesApi,
  orgsApi,
  usersApi,
} from '../../services/api';
import { useSilentRefresh } from '../../hooks';
import type { Machine, Organization, User } from '../../types';

const fetchClientsPageBundle = async (signal?: AbortSignal) => {
  const [orgList, machineList, userList] = await Promise.all([
    orgsApi.getAll(undefined, signal),
    machinesApi.getAll(undefined, signal),
    usersApi.getAll(undefined, signal),
  ]);
  return { orgList, machineList, userList };
};

export interface UseClientsListOptions {
  pauseRefresh: boolean;
  onToast: (toast: { message: string; type?: 'success' | 'error' | 'info' }) => void;
}

export function useClientsList({ pauseRefresh, onToast }: UseClientsListOptions) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedClientIdFromUrl = searchParams.get('select');

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [businessTypeFilter, setBusinessTypeFilter] = useState<string>('All');
  const [locationFilter, setLocationFilter] = useState<string>('All locations');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [machineFilter, setMachineFilter] = useState<'All' | 'WithMachines' | 'NoMachines'>('All');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('foodie_rows_per_page');
      if (saved) {
        const parsed = Number(saved);
        if ([5, 10, 20, 25, 50, 100].includes(parsed)) return parsed;
      }
    } catch {}
    return 10;
  });

  const [selectedClient, setSelectedClient] = useState<Organization | null>(null);
  const [prevSelectedClientId, setPrevSelectedClientId] = useState<string | null>(
    selectedClientIdFromUrl
  );

  const fetchData = useCallback(async (showSpinner = false, signal?: AbortSignal) => {
    if (showSpinner) setIsLoading(true);
    try {
      const { orgList, machineList, userList } = await fetchClientsPageBundle(signal);
      if (signal?.aborted) return;
      setOrganizations(orgList);
      setMachines(machineList);
      setUsers(userList);
      setLoadError(null);
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) return;
      console.error('Failed to load clients data:', err);
      setLoadError(err?.message || 'Unable to load client organizations. Please try again.');
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchClientsPageBundle(controller.signal)
      .then(({ orgList, machineList, userList }) => {
        if (controller.signal.aborted) return;
        setOrganizations(orgList);
        setMachines(machineList);
        setUsers(userList);
        setLoadError(null);
      })
      .catch((err: any) => {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        console.error('Failed to load clients data:', err);
        setLoadError(err?.message || 'Unable to load client organizations. Please try again.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  useSilentRefresh((signal) => fetchData(false, signal), {
    intervalMs: 10000,
    enabled: !pauseRefresh,
  });

  if (selectedClientIdFromUrl !== prevSelectedClientId) {
    setPrevSelectedClientId(selectedClientIdFromUrl);
    if (!selectedClientIdFromUrl) {
      setSelectedClient(null);
    } else {
      const cached = organizations.find(
        (o) => o.id === selectedClientIdFromUrl || o.client_code === selectedClientIdFromUrl
      );
      if (cached) setSelectedClient(cached);
    }
  }

  useEffect(() => {
    if (!selectedClientIdFromUrl) return;
    let isActive = true;

    orgsApi
      .getById(selectedClientIdFromUrl)
      .then((verified) => {
        if (!isActive) return;
        setSelectedClient(verified);
        setOrganizations((prev) => prev.map((o) => (o.id === verified.id ? verified : o)));
      })
      .catch((err: any) => {
        if (!isActive) return;
        setSelectedClient(null);
        setSearchParams({});
        onToast({
          message: err?.message || 'Access denied: Client not found or unauthorized.',
          type: 'error',
        });
      });

    return () => {
      isActive = false;
    };
  }, [selectedClientIdFromUrl, setSearchParams, onToast]);

  const handleSelectClient = useCallback(
    (client: Organization) => {
      setSelectedClient(client);
      setSearchParams({ select: client.id });
    },
    [setSearchParams]
  );

  const uniqueLocations = useMemo(() => {
    const locSet = new Set<string>();
    organizations.forEach((org) => {
      if (org.billing_address) locSet.add(org.billing_address);
      if (org.shipping_address) locSet.add(org.shipping_address);
    });
    return Array.from(locSet).filter(Boolean);
  }, [organizations]);

  const filteredOrganizations = useMemo(() => {
    return organizations
      .filter((org) => {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          org.client_code.toLowerCase().includes(q) ||
          org.company_name.toLowerCase().includes(q) ||
          (org.contact_poc && org.contact_poc.toLowerCase().includes(q)) ||
          (org.email && org.email.toLowerCase().includes(q)) ||
          (org.billing_address && org.billing_address.toLowerCase().includes(q));

        const isInactive =
          !org.is_active || org.status === 'Inactive' || org.status === 'Archived';
        let matchesStatus = true;
        if (statusFilter === 'Active') matchesStatus = !isInactive;
        else if (statusFilter === 'Inactive') matchesStatus = isInactive;

        const clientType = org.business_type || 'Corporate';
        const matchesType =
          businessTypeFilter === 'All' ||
          clientType.toLowerCase() === businessTypeFilter.toLowerCase();

        const matchesLocation =
          locationFilter === 'All locations' ||
          (org.billing_address &&
            org.billing_address.toLowerCase().includes(locationFilter.toLowerCase())) ||
          (org.shipping_address &&
            org.shipping_address.toLowerCase().includes(locationFilter.toLowerCase()));

        const orgMachineCount = machines.filter((m) => m.organization_id === org.id).length;
        const matchesMachineFilter =
          machineFilter === 'All' ||
          (machineFilter === 'WithMachines' ? orgMachineCount > 0 : orgMachineCount === 0);

        return (
          matchesSearch &&
          matchesStatus &&
          matchesType &&
          matchesLocation &&
          matchesMachineFilter
        );
      })
      .sort((a, b) => {
        const dateA = new Date(a.created_at || '').getTime() || 0;
        const dateB = new Date(b.created_at || '').getTime() || 0;
        if (dateB !== dateA) return dateB - dateA;
        return (b.client_code || '').localeCompare(a.client_code || '', undefined, {
          numeric: true,
        });
      });
  }, [
    organizations,
    machines,
    searchQuery,
    statusFilter,
    businessTypeFilter,
    locationFilter,
    machineFilter,
  ]);

  const totalItems = filteredOrganizations.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalItems);
  const paginatedClients = filteredOrganizations.slice(startIndex, endIndex);

  const isAllPageSelected =
    paginatedClients.length > 0 && paginatedClients.every((c) => selectedIds.includes(c.id));

  const toggleSelectAll = () => {
    if (isAllPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !paginatedClients.some((c) => c.id === id)));
    } else {
      const pageIds = paginatedClients.map((c) => c.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExportData = (exportItems: Organization[]) => {
    if (exportItems.length === 0) return;
    const headers = [
      'Client ID',
      'Company Name',
      'Business Type',
      'Contact POC',
      'Email',
      'Phone',
      'Location',
      'Status',
      'Onboarding Date',
    ];
    const rows = exportItems.map((c) => [
      c.client_code,
      c.company_name,
      c.business_type || 'Corporate',
      c.contact_poc || '',
      c.email || '',
      c.phone_number || '',
      c.billing_address || '',
      c.status || (c.is_active ? 'Active' : 'Inactive'),
      formatDate(c.created_at),
    ]);
    downloadCsv(`powertech_clients_export_${Date.now()}.csv`, [headers, ...rows]);
  };

  const handleBulkArchive = async () => {
    const selectedClients = organizations.filter((o) => selectedIds.includes(o.id));
    const targetStatus = statusFilter === 'Inactive' ? 'Active' : 'Inactive';
    const targetIsActive = targetStatus === 'Active';
    let failCount = 0;
    for (const c of selectedClients) {
      try {
        await orgsApi.update(c.id, { is_active: targetIsActive, status: targetStatus });
      } catch (err) {
        failCount++;
        console.error('Error updating client status:', err);
      }
    }
    await fetchData();
    setSelectedIds([]);
    if (failCount > 0) {
      onToast({
        message: `${selectedClients.length - failCount} updated, ${failCount} could not be updated (e.g. active machine leases exist).`,
        type: 'error',
      });
    } else {
      onToast({
        message: `Selected client(s) marked as ${targetStatus}.`,
        type: 'success',
      });
    }
  };

  const handleUnassignMachine = async (machineId: string, terminationRemark?: string) => {
    try {
      await machinesApi.unassign(machineId, terminationRemark);
      await fetchData();
      onToast({
        message: 'Machine lease successfully terminated and returned to available fleet.',
        type: 'success',
      });
    } catch (err: any) {
      console.error('Failed to terminate machine lease:', err);
      onToast({
        message: err?.message || 'Failed to terminate machine lease.',
        type: 'error',
      });
    }
  };

  const handleToggleClientStatus = async (target: Organization) => {
    const isCurrentlyInactive =
      !target.is_active || target.status === 'Inactive' || target.status === 'Archived';
    const nextIsActive = isCurrentlyInactive;
    const nextStatus = nextIsActive ? 'Active' : 'Inactive';

    if (!nextIsActive) {
      const leasedCount = machines.filter((m) => m.organization_id === target.id).length;
      if (leasedCount > 0) {
        onToast({
          message: `Cannot deactivate client: ${leasedCount} machine(s) are currently leased. Please terminate all machine leases first.`,
          type: 'error',
        });
        return;
      }
    }

    try {
      const updated = await orgsApi.update(target.id, {
        is_active: nextIsActive,
        status: nextStatus,
      });
      setOrganizations((prev) =>
        prev.map((o) =>
          o.id === target.id ? { ...o, is_active: nextIsActive, status: nextStatus } : o
        )
      );
      if (selectedClient && selectedClient.id === target.id) {
        setSelectedClient(updated);
      }
      const freshUsers = await usersApi.getAll().catch(() => []);
      setUsers(freshUsers);
      onToast({
        message: `Client ${target.company_name} status updated to ${nextStatus}.`,
        type: 'success',
      });
      await fetchData();
    } catch (err: any) {
      onToast({
        message: err?.message || 'Failed to update client status.',
        type: 'error',
      });
    }
  };

  const resetAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setBusinessTypeFilter('All');
    setLocationFilter('All locations');
    setMachineFilter('All');
    setCurrentPage(1);
  };

  return {
    selectedClientIdFromUrl,
    setSearchParams,
    organizations,
    setOrganizations,
    machines,
    setMachines,
    users,
    isLoading,
    loadError,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    businessTypeFilter,
    setBusinessTypeFilter,
    locationFilter,
    setLocationFilter,
    showMoreFilters,
    setShowMoreFilters,
    machineFilter,
    setMachineFilter,
    uniqueLocations,
    selectedIds,
    setSelectedIds,
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    totalItems,
    totalPages,
    startIndex,
    endIndex,
    paginatedClients,
    isAllPageSelected,
    selectedClient,
    setSelectedClient,
    fetchData,
    handleSelectClient,
    toggleSelectAll,
    toggleSelectRow,
    handleExportData,
    handleBulkArchive,
    handleUnassignMachine,
    handleToggleClientStatus,
    resetAllFilters,
  };
}

