import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { machinesApi, orgsApi } from '../../services/api';
import type { Machine, Organization } from '../../types';

const fetchMachinesPageBundle = async (isOem: boolean, signal?: AbortSignal) => {
  const [machineList, orgList] = await Promise.all([
    machinesApi.getAll(undefined, signal),
    isOem ? orgsApi.getAll(undefined, signal) : Promise.resolve([]),
  ]);
  return { machineList, orgList };
};

export interface UseMachinesListOptions {
  isOem: boolean;
  onToast: (toast: { message: string; type?: 'success' | 'error' | 'info' }) => void;
}

export function useMachinesList({ isOem, onToast }: UseMachinesListOptions) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearchQuery = searchParams.get('search') || searchParams.get('q') || '';
  const targetMachineParam = searchParams.get('select') || searchParams.get('serial');

  const [machines, setMachines] = useState<Machine[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [prevUrlSearch, setPrevUrlSearch] = useState(urlSearchQuery);
  const [searchQuery, setSearchQuery] = useState(() => urlSearchQuery);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [clientFilter, setClientFilter] = useState<string>('All clients');
  const [locationFilter, setLocationFilter] = useState<string>('All locations');
  const [showMoreFilters, setShowMoreFilters] = useState<boolean>(false);
  const [modelFilter, setModelFilter] = useState<string>('All');

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

  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [prevTargetMachineParam, setPrevTargetMachineParam] = useState<string | null>(
    targetMachineParam
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(
    async (showSpinner = false, signal?: AbortSignal) => {
      if (showSpinner) setIsLoading(true);
      try {
        const { machineList, orgList } = await fetchMachinesPageBundle(isOem, signal);
        if (signal?.aborted) return;
        setMachines(machineList);
        setOrganizations(orgList);
        setLoadError(null);
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal?.aborted) return;
        console.error('Failed to load fleet machines data:', err);
        setLoadError(err?.message || 'Unable to load fleet machines. Please try again.');
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [isOem]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchMachinesPageBundle(isOem, controller.signal)
      .then(({ machineList, orgList }) => {
        if (controller.signal.aborted) return;
        setMachines(machineList);
        setOrganizations(orgList);
        setLoadError(null);
      })
      .catch((err: any) => {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        console.error('Failed to load fleet machines data:', err);
        setLoadError(err?.message || 'Unable to load fleet machines. Please try again.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [isOem]);

  if (urlSearchQuery !== prevUrlSearch) {
    setPrevUrlSearch(urlSearchQuery);
    if (urlSearchQuery) {
      setSearchQuery(urlSearchQuery);
    }
  }

  if (targetMachineParam !== prevTargetMachineParam) {
    setPrevTargetMachineParam(targetMachineParam);
    if (!targetMachineParam) {
      setSelectedMachine(null);
    } else {
      const cached = machines.find(
        (m) =>
          m.id === targetMachineParam ||
          (m.serial_number &&
            m.serial_number.toLowerCase() === targetMachineParam.toLowerCase()) ||
          (m.machine_code &&
            m.machine_code.toLowerCase() === targetMachineParam.toLowerCase())
      );
      if (cached) setSelectedMachine(cached);
    }
  }

  useEffect(() => {
    if (!targetMachineParam) return;
    let isActive = true;

    machinesApi
      .getById(targetMachineParam)
      .then((verified) => {
        if (!isActive) return;
        setSelectedMachine(verified);
        setMachines((prev) => prev.map((m) => (m.id === verified.id ? verified : m)));
      })
      .catch((err: any) => {
        if (!isActive) return;
        setSelectedMachine(null);
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete('select');
          next.delete('serial');
          return next;
        });
        onToast({
          message: err?.message || 'Access denied: Machine not found or unauthorized.',
          type: 'error',
        });
      });

    return () => {
      isActive = false;
    };
  }, [targetMachineParam, setSearchParams, onToast]);

  const handleSelectMachine = useCallback(
    (machine: Machine) => {
      setSelectedMachine(machine);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('select', machine.id);
        return next;
      });
    },
    [setSearchParams]
  );

  const totalCount = machines.length;
  const runningCount = machines.filter(
    (m) => (m.operational_status || '').toLowerCase() === 'running'
  ).length;
  const idleCount = machines.filter(
    (m) => (m.operational_status || '').toLowerCase() === 'idle'
  ).length;
  const maintenanceCount = machines.filter(
    (m) => (m.operational_status || '').toLowerCase() === 'maintenance'
  ).length;

  const uniqueLocations = useMemo(() => {
    const locSet = new Set<string>();
    machines.forEach((m) => {
      if (m.organization_id) {
        if (m.lease_location_label?.trim()) locSet.add(m.lease_location_label.trim());
      } else if (isOem && m.location_label?.trim()) {
        locSet.add(m.location_label.trim());
      }
    });
    return Array.from(locSet).filter(Boolean);
  }, [machines, isOem]);

  const filteredMachines = useMemo(() => {
    return machines
      .filter((machine) => {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          (machine.machine_code || '').toLowerCase().includes(q) ||
          (machine.serial_number || '').toLowerCase().includes(q) ||
          (machine.model || '').toLowerCase().includes(q) ||
          (machine.company_name || '').toLowerCase().includes(q) ||
          (machine.location_label || '').toLowerCase().includes(q) ||
          (machine.lease_location_label || '').toLowerCase().includes(q) ||
          (machine.site_name || '').toLowerCase().includes(q);

        const opStatus = (machine.operational_status || 'Idle').toLowerCase();
        const connStatus = (machine.connectivity_status || 'Offline').toLowerCase();
        const matchesStatus =
          statusFilter === 'All' ||
          opStatus === statusFilter.toLowerCase() ||
          (statusFilter.toLowerCase() === 'offline' && connStatus === 'offline');

        const matchesClient =
          clientFilter === 'All clients' ||
          (machine.company_name &&
            machine.company_name.toLowerCase() === clientFilter.toLowerCase()) ||
          machine.organization_id === clientFilter;

        const effectiveLoc = machine.organization_id
          ? (machine.lease_location_label || '').toLowerCase()
          : isOem
          ? (machine.location_label || '').toLowerCase()
          : '';
        const matchesLocation =
          locationFilter === 'All locations' ||
          effectiveLoc.includes(locationFilter.toLowerCase());

        const matchesModel =
          modelFilter === 'All' || machine.model.toLowerCase() === modelFilter.toLowerCase();

        return (
          matchesSearch &&
          matchesStatus &&
          matchesClient &&
          matchesLocation &&
          matchesModel
        );
      })
      .sort((a, b) => {
        const dateA = new Date(a.created_at || '').getTime() || 0;
        const dateB = new Date(b.created_at || '').getTime() || 0;
        if (dateB !== dateA) return dateB - dateA;
        return (b.machine_code || '').localeCompare(a.machine_code || '', undefined, {
          numeric: true,
        });
      });
  }, [machines, searchQuery, statusFilter, clientFilter, locationFilter, modelFilter, isOem]);

  const totalItems = filteredMachines.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalItems);
  const paginatedMachines = filteredMachines.slice(startIndex, endIndex);

  const deleteMachine = async (deletingMachine: Machine | null, onCleared: () => void) => {
    if (!deletingMachine) return false;
    setIsDeleting(true);
    try {
      await machinesApi.delete(deletingMachine.id);
      setMachines((prev) => prev.filter((m) => m.id !== deletingMachine.id));
      if (selectedMachine?.id === deletingMachine.id) {
        setSelectedMachine(null);
      }
      onCleared();
      onToast({
        message: 'Machine removed from fleet inventory successfully.',
        type: 'info',
      });
      return true;
    } catch (err: any) {
      console.error('Failed to soft delete machine:', err);
      onToast({
        message:
          err?.message ||
          'Failed to delete machine. Machines assigned to clients cannot be removed.',
        type: 'error',
      });
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  const resetAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setClientFilter('All clients');
    setLocationFilter('All locations');
    setModelFilter('All');
    setCurrentPage(1);
  };

  return {
    targetMachineParam,
    setSearchParams,
    machines,
    setMachines,
    organizations,
    isLoading,
    loadError,
    totalCount,
    runningCount,
    idleCount,
    maintenanceCount,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    clientFilter,
    setClientFilter,
    locationFilter,
    setLocationFilter,
    showMoreFilters,
    setShowMoreFilters,
    modelFilter,
    setModelFilter,
    uniqueLocations,
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    totalItems,
    totalPages,
    startIndex,
    endIndex,
    paginatedMachines,
    selectedMachine,
    setSelectedMachine,
    isDeleting,
    fetchData,
    handleSelectMachine,
    deleteMachine,
    resetAllFilters,
  };
}

