import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  SlidersHorizontal,
  Eye,
  Edit2,
  Trash2,
  Cpu,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  machinesApi,
  orgsApi,
  formatDate,
  formatMachineLocation as formatLocation,
} from '../services/api';
import { useAuth } from '../hooks';
import { AddMachineView } from '../components/machines/AddMachineView';
import { MachineDetailView } from '../components/machines/MachineDetailView';
import { EditMachineView } from '../components/machines/EditMachineView';
import { DeleteMachineModal } from '../components/machines/DeleteMachineModal';
import { RowActionMenu, PaginationBar } from '../components/common/RowActionMenu';
import { Button } from '../components/common/ui';
import { Toast, LoadErrorBanner } from '../components/common/Toast';
import type { Machine, Organization } from '../types';

const fetchMachinesPageBundle = async (isOem: boolean, signal?: AbortSignal) => {
  const [machineList, orgList] = await Promise.all([
    machinesApi.getAll(undefined, signal),
    isOem ? orgsApi.getAll(undefined, signal) : Promise.resolve([]),
  ]);
  return { machineList, orgList };
};

export const MachinesPage: React.FC = () => {
  const { user } = useAuth();
  const isOem = user?.role === 'OEM_MANAGER';
  const isOperator = user?.role === 'OPERATOR';
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearchQuery = searchParams.get('search') || searchParams.get('q') || '';

  // Live PostgreSQL Data States
  const [machines, setMachines] = useState<Machine[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

  // Search & Filter States
  const [prevUrlSearch, setPrevUrlSearch] = useState(urlSearchQuery);
  const [searchQuery, setSearchQuery] = useState(() => urlSearchQuery);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [clientFilter, setClientFilter] = useState<string>('All clients');
  const [locationFilter, setLocationFilter] = useState<string>('All locations');
  const [showMoreFilters, setShowMoreFilters] = useState<boolean>(false);
  const [modelFilter, setModelFilter] = useState<string>('All');

  // Pagination State
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

  // Row Actions Dropdown Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  // Drawers & Modals State
  const [isAddMachineOpen, setIsAddMachineOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [deletingMachine, setDeletingMachine] = useState<Machine | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load live data from PostgreSQL API (only fetch organizations for OEM_MANAGER to prevent Operator 403s)
  const fetchData = useCallback(async (showSpinner = false, signal?: AbortSignal) => {
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
  }, [isOem]);

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

  // Reset drawer views to show the machines list when clicking Machines in left menu
  useEffect(() => {
    const handleResetView = () => {
      setSelectedMachine(null);
      setEditingMachine(null);
      setIsAddMachineOpen(false);
      setDeletingMachine(null);
      setSearchParams({});
    };

    window.addEventListener('foodie:reset-machines-view', handleResetView);
    return () => window.removeEventListener('foodie:reset-machines-view', handleResetView);
  }, [setSearchParams]);

  if (urlSearchQuery !== prevUrlSearch) {
    setPrevUrlSearch(urlSearchQuery);
    if (urlSearchQuery) {
      setSearchQuery(urlSearchQuery);
    }
  }

  const targetMachineParam = searchParams.get('select') || searchParams.get('serial');
  const [prevTargetMachineParam, setPrevTargetMachineParam] = useState<string | null>(targetMachineParam);

  if (targetMachineParam !== prevTargetMachineParam) {
    setPrevTargetMachineParam(targetMachineParam);
    if (!targetMachineParam) {
      setSelectedMachine(null);
    } else {
      setIsAddMachineOpen(false);
      setEditingMachine(null);
      setDeletingMachine(null);
      const cached = machines.find(
        (m) =>
          m.id === targetMachineParam ||
          (m.serial_number && m.serial_number.toLowerCase() === targetMachineParam.toLowerCase()) ||
          (m.machine_code && m.machine_code.toLowerCase() === targetMachineParam.toLowerCase())
      );
      if (cached) {
        setSelectedMachine(cached);
      }
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
        setMachines((prev) =>
          prev.map((m) => (m.id === verified.id ? verified : m))
        );
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
        setToast({
          message: err?.message || 'Access denied: Machine not found or unauthorized.',
          type: 'error',
        });
      });

    return () => {
      isActive = false;
    };
  }, [targetMachineParam, setSearchParams]);

  const handleSelectMachine = (machine: Machine) => {
    setSelectedMachine(machine);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('select', machine.id);
      return next;
    });
  };

  // Click outside listener for the row action menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute dynamic top metric card counts from real database data
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

  // Unique locations / sites from fleet
  const uniqueLocations = useMemo(() => {
    const locSet = new Set<string>();
    machines.forEach((m) => {
      const isAssigned = Boolean(m.organization_id);
      if (isAssigned) {
        if (m.lease_location_label?.trim()) locSet.add(m.lease_location_label.trim());
      } else if (isOem) {
        if (m.location_label?.trim()) locSet.add(m.location_label.trim());
      }
    });
    return Array.from(locSet).filter(Boolean);
  }, [machines, isOem]);

  // Filter Pipeline
  const filteredMachines = useMemo(() => {
    return machines.filter((machine) => {
      // 1. Search Query
      const q = searchQuery.toLowerCase().trim();
      const code = (machine.machine_code || '').toLowerCase();
      const serial = (machine.serial_number || '').toLowerCase();
      const model = (machine.model || '').toLowerCase();
      const client = (machine.company_name || '').toLowerCase();
      const location = (machine.location_label || '').toLowerCase();
      const leaseLocation = (machine.lease_location_label || '').toLowerCase();
      const site = (machine.site_name || '').toLowerCase();

      const matchesSearch =
        !q ||
        code.includes(q) ||
        serial.includes(q) ||
        model.includes(q) ||
        client.includes(q) ||
        location.includes(q) ||
        leaseLocation.includes(q) ||
        site.includes(q);

      // 2. Status Filter
      const opStatus = (machine.operational_status || 'Idle').toLowerCase();
      const connStatus = (machine.connectivity_status || 'Offline').toLowerCase();
      const matchesStatus =
        statusFilter === 'All' ||
        opStatus === statusFilter.toLowerCase() ||
        (statusFilter.toLowerCase() === 'offline' && connStatus === 'offline');

      // 3. Client Filter
      const matchesClient =
        clientFilter === 'All clients' ||
        (machine.company_name &&
          machine.company_name.toLowerCase() === clientFilter.toLowerCase()) ||
        machine.organization_id === clientFilter;

      // 4. Site / Location Filter (Site wise)
      const effectiveLoc = machine.organization_id
        ? (machine.lease_location_label || '').toLowerCase()
        : isOem
        ? (machine.location_label || '').toLowerCase()
        : '';
      const matchesLocation =
        locationFilter === 'All locations' ||
        effectiveLoc.includes(locationFilter.toLowerCase());

      // 5. Model Filter
      const matchesModel =
        modelFilter === 'All' ||
        machine.model.toLowerCase() === modelFilter.toLowerCase();

      return (
        matchesSearch &&
        matchesStatus &&
        matchesClient &&
        matchesLocation &&
        matchesModel
      );
    }).sort((a, b) => {
      const dateA = new Date(a.created_at || '').getTime() || 0;
      const dateB = new Date(b.created_at || '').getTime() || 0;
      if (dateB !== dateA) return dateB - dateA;
      return (b.machine_code || '').localeCompare(a.machine_code || '', undefined, { numeric: true });
    });
  }, [
    machines,
    searchQuery,
    statusFilter,
    clientFilter,
    locationFilter,
    modelFilter,
    isOem,
  ]);

  // Pagination Slice
  const totalItems = filteredMachines.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalItems);
  const paginatedMachines = filteredMachines.slice(startIndex, endIndex);

  // Soft Delete handler
  const handleConfirmDelete = async (): Promise<boolean> => {
    if (!deletingMachine) return false;
    setIsDeleting(true);
    try {
      await machinesApi.delete(deletingMachine.id);
      setMachines((prev) => prev.filter((m) => m.id !== deletingMachine.id));
      if (selectedMachine?.id === deletingMachine.id) {
        setSelectedMachine(null);
      }
      setDeletingMachine(null);
      setToast({
        message: 'Machine removed from fleet inventory successfully.',
        type: 'info',
      });
      return true;
    } catch (err: any) {
      console.error('Failed to soft delete machine:', err);
      setToast({
        message: err?.message || 'Failed to delete machine. Machines assigned to clients cannot be removed.',
        type: 'error',
      });
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  if (isAddMachineOpen) {
    return (
      <div className="select-none">
        <AddMachineView
          onBack={() => setIsAddMachineOpen(false)}
          onSuccess={(newMachine) => {
            setMachines((prev) => [newMachine, ...prev]);
            setIsAddMachineOpen(false);
            setToast({
              message: `Machine ${newMachine.serial_number || newMachine.machine_code} added successfully!`,
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

  if (editingMachine) {
    return (
      <div className="select-none">
        <EditMachineView
          machine={editingMachine}
          organizations={organizations}
          onBack={() => setEditingMachine(null)}
          onSuccess={(updated) => {
            setMachines((prev) =>
              prev.map((m) => (m.id === updated.id ? updated : m))
            );
            if (selectedMachine && selectedMachine.id === updated.id) {
              setSelectedMachine(updated);
            }
            setEditingMachine(null);
            setToast({
              message: `Machine ${updated.serial_number || updated.machine_code} updated successfully!`,
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

  if (selectedMachine) {
    return (
      <div className="select-none">
        <MachineDetailView
          machine={selectedMachine}
          onBack={() => {
            setSelectedMachine(null);
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.delete('select');
              next.delete('serial');
              return next;
            });
          }}
          onEdit={(m) => setEditingMachine(m)}
          onDelete={(m) => setDeletingMachine(m)}
        />
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
        <DeleteMachineModal
          isOpen={!!deletingMachine}
          machine={deletingMachine}
          onClose={() => setDeletingMachine(null)}
          onConfirm={handleConfirmDelete}
          isDeleting={isDeleting}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-[1400px] mx-auto pb-10">
      {/* 1. Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            {isOem ? 'All machines' : 'My machines'}
          </h1>
          <p className="text-xs text-foreground-dim mt-0.5">
            {isOem
              ? 'Every Foodie machine across all clients.'
              : `Commercial composter units assigned to ${user?.company_name || 'your facility'}.`}
          </p>
        </div>

        {/* Action Button: + Add machine (OEM only) */}
        {isOem && (
          <div className="flex items-center gap-2.5">
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsAddMachineOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5 text-white" />}
            >
              Add machine
            </Button>
          </div>
        )}
      </div>

      {loadError && (
        <LoadErrorBanner message={loadError} onRetry={() => fetchData(true)} />
      )}

      {/* 2. Top Metric Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Card 1: Total Machines */}
        <div className="bg-white rounded-xl border border-border-subtle p-4 flex items-center shadow-xs">
          <span className="text-2xl font-extrabold text-foreground tracking-tight">
            {totalCount}
          </span>
          <span className="text-xs text-foreground-muted font-medium ml-2.5">
            Machines
          </span>
        </div>

        {/* Card 2: Running Machines */}
        <div className="bg-white rounded-xl border border-border-subtle p-4 flex items-center shadow-xs">
          <span className="text-2xl font-extrabold text-foreground tracking-tight">
            {runningCount}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-status-running-bg text-status-running-text border border-status-running-dot/30 ml-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-status-running-dot" />
            <span>Running</span>
          </span>
        </div>

        {/* Card 3: Idle Machines */}
        <div className="bg-white rounded-xl border border-border-subtle p-4 flex items-center shadow-xs">
          <span className="text-2xl font-extrabold text-foreground tracking-tight">
            {idleCount}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-status-idle-bg text-status-idle-text border border-status-idle-dot/30 ml-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Idle</span>
          </span>
        </div>

        {/* Card 4: Maintenance Machines */}
        <div className="bg-white rounded-xl border border-border-subtle p-4 flex items-center shadow-xs">
          <span className="text-2xl font-extrabold text-foreground tracking-tight">
            {maintenanceCount}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-status-maint-bg text-status-maint-text border border-status-maint-dot/30 ml-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>Maintenance</span>
          </span>
        </div>
      </div>

      {/* 3. Search & Filter Bar Container */}
      <div className="bg-white rounded-xl border border-border-subtle p-3 shadow-xs flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-foreground-subtle absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search serial number, client or model"
              className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-border-default bg-surface-muted text-foreground placeholder:text-foreground-subtle text-xs focus:outline-none focus:border-foreground focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-subtle hover:text-foreground cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns Row */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {/* Status Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-foreground-muted font-medium text-[11px]">Status</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-border-default bg-white text-foreground font-semibold text-xs cursor-pointer focus:outline-none focus:border-foreground"
              >
                <option value="All">All</option>
                <option value="Running">Running</option>
                <option value="Idle">Idle</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>

            {/* Client Dropdown (OEM only) */}
            {isOem && (
              <div className="flex items-center gap-1.5">
                <span className="text-foreground-muted font-medium text-[11px]">Client</span>
                <select
                  value={clientFilter}
                  onChange={(e) => {
                    setClientFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-border-default bg-white text-foreground font-semibold text-xs cursor-pointer focus:outline-none focus:border-foreground max-w-[180px] truncate"
                >
                  <option value="All clients">All clients</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.company_name}>
                      {org.company_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Location Dropdown (Site / Location wise) */}
            <div className="flex items-center gap-1.5">
              <span className="text-foreground-muted font-medium text-[11px]">Location</span>
              <select
                value={locationFilter}
                onChange={(e) => {
                  setLocationFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-border-default bg-white text-foreground font-semibold text-xs cursor-pointer focus:outline-none focus:border-foreground max-w-[180px] truncate"
              >
                <option value="All locations">All locations</option>
                {uniqueLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* More filters Button */}
            <button
              type="button"
              onClick={() => setShowMoreFilters((prev) => !prev)}
              aria-expanded={showMoreFilters}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold shadow-2xs cursor-pointer select-none transition-colors ${
                showMoreFilters || modelFilter !== 'All'
                  ? 'border-primary bg-primary-light text-primary'
                  : 'border-border-default bg-white hover:bg-surface-subtle text-foreground'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>More filters</span>
            </button>
          </div>
        </div>

        {/* Expandable More Filters Row */}
        {showMoreFilters && (
          <div className="pt-3 border-t border-surface-hover flex flex-wrap items-center gap-4 text-xs animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
              <span className="text-foreground-muted font-medium">Model filter:</span>
              <div className="flex items-center gap-1.5">
                {['All', 'Foodie F25', 'Foodie F100', 'Foodie F500', 'Foodie F1000'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setModelFilter(m);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                      modelFilter === m
                        ? 'bg-primary text-white'
                        : 'bg-surface-hover text-foreground-body hover:bg-border-default'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {(searchQuery ||
              statusFilter !== 'All' ||
              clientFilter !== 'All clients' ||
              locationFilter !== 'All locations' ||
              modelFilter !== 'All') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('All');
                  setClientFilter('All clients');
                  setLocationFilter('All locations');
                  setModelFilter('All');
                  setCurrentPage(1);
                }}
                className="text-xs text-primary font-semibold hover:underline cursor-pointer ml-auto"
              >
                Reset all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. Machines Main Data Table & Mobile Cards */}
      <div className="bg-white rounded-xl border border-border-subtle shadow-xs overflow-hidden">
        {/* Mobile View: Dedicated Thumb-Friendly Machine Cards (< md) */}
        <div className="md:hidden divide-y divide-surface-hover">
          {isLoading ? (
            <div className="py-10 text-center text-foreground-muted">
              <div className="flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                <span>Loading fleet machines from database...</span>
              </div>
            </div>
          ) : paginatedMachines.length === 0 ? (
            <div className="py-10 text-center text-foreground-muted px-4">
              <Cpu className="w-8 h-8 text-foreground-subtle mx-auto mb-2" />
              <p className="font-bold text-foreground">No machines match current filters</p>
              <p className="text-xs text-foreground-dim mt-1">
                Try clearing search or adjusting your status, client, or location dropdowns.
              </p>
            </div>
          ) : (
            paginatedMachines.map((m) => {
              const isOnline = m.connectivity_status?.toLowerCase() === 'online';
              const opStatus = m.operational_status || 'Idle';

              return (
                <div
                  key={m.id}
                  className="p-3.5 hover:bg-surface-muted transition-colors flex flex-col gap-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <button
                        type="button"
                        onClick={() => handleSelectMachine(m)}
                        className="font-mono font-bold text-sm text-primary underline hover:text-primary-hover cursor-pointer text-left"
                      >
                        {m.machine_code || m.serial_number}
                      </button>
                      <div className="text-xs font-semibold text-foreground mt-0.5">
                        {m.model} {m.capacity ? `· ${m.capacity}` : ''}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          isOnline
                            ? 'bg-status-running-bg text-status-running-text border-status-running-dot/30'
                            : 'bg-surface-hover text-foreground-body border-border-default'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isOnline ? 'bg-status-running-dot' : 'bg-foreground-subtle'
                          }`}
                        />
                        <span>{isOnline ? 'Online' : 'Offline'}</span>
                      </span>

                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          opStatus === 'Running'
                            ? 'bg-status-running-bg text-status-running-text border-status-running-dot/30'
                            : opStatus === 'Idle'
                            ? 'bg-status-idle-bg text-status-idle-text border-status-idle-dot/30'
                            : opStatus === 'Maintenance'
                            ? 'bg-status-maint-bg text-status-maint-text border-status-maint-dot/30'
                            : 'bg-surface-hover text-foreground-body border-border-default'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            opStatus === 'Running'
                              ? 'bg-status-running-dot'
                              : opStatus === 'Idle'
                              ? 'bg-amber-500'
                              : opStatus === 'Maintenance'
                              ? 'bg-blue-500'
                              : 'bg-foreground-subtle'
                          }`}
                        />
                        <span>{opStatus}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-foreground-muted">
                    {isOem ? (
                      <span>Client: <strong className="text-foreground">{m.company_name || 'Unassigned'}</strong></span>
                    ) : isOperator ? (
                      <span>Total batches: <strong className="text-foreground">{m.total_batches ?? '—'}</strong></span>
                    ) : null}
                    <span>{formatLocation(m)}</span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-surface-hover">
                    <button
                      type="button"
                      onClick={() => handleSelectMachine(m)}
                      className="px-3 py-1.5 rounded-lg border border-border-strong text-xs font-semibold text-foreground hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-foreground-muted" />
                      <span>View details</span>
                    </button>
                    {isOem && (
                      <button
                        type="button"
                        onClick={() => setEditingMachine(m)}
                        className="px-3 py-1.5 rounded-lg border border-border-strong text-xs font-semibold text-foreground hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-foreground-muted" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop / Tablet View: Full Table (>= md) */}
        <div className="hidden md:block overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-left border-collapse text-xs min-w-[750px]">
            <thead>
              <tr className="border-b border-border-default bg-surface-muted text-[11px] font-bold text-foreground-muted">
                <th className="py-3 px-4 font-semibold">Serial Number</th>
                <th className="py-3 px-4 font-semibold">Model</th>
                {isOem && (
                  <th className="py-3 px-4 font-semibold">Client</th>
                )}
                {isOperator && (
                  <th className="py-3 px-4 font-semibold">Total batches</th>
                )}
                <th className="py-3 px-4 font-semibold">Location</th>
                <th className="py-3 px-4 font-semibold">Lease start date</th>
                <th className="py-3 px-4 font-semibold">Connectivity</th>
                <th className="py-3 px-4 font-semibold">Machine status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-hover">
              {isLoading ? (
                <tr>
                  <td colSpan={isOem || isOperator ? 8 : 7} className="py-12 text-center text-foreground-muted">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                      <span>Loading fleet machines from database...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedMachines.length === 0 ? (
                <tr>
                  <td colSpan={isOem || isOperator ? 8 : 7} className="py-12 text-center text-foreground-muted">
                    <Cpu className="w-8 h-8 text-foreground-subtle mx-auto mb-2" />
                    <p className="font-bold text-foreground">No machines match current filters</p>
                    <p className="text-xs text-foreground-dim mt-1">
                      Try clearing search or adjusting your status, client, or location dropdowns.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedMachines.map((m) => {
                  const isOnline = m.connectivity_status?.toLowerCase() === 'online';
                  const opStatus = m.operational_status || 'Idle';

                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-surface-muted transition-colors"
                    >
                      {/* Serial Number (Clickable in red underline) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleSelectMachine(m)}
                          className="font-bold text-primary underline hover:text-primary-hover cursor-pointer whitespace-nowrap font-mono inline-block"
                        >
                          {m.machine_code || m.serial_number}
                        </button>
                      </td>

                      {/* Model & Capacity */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-foreground">{m.model}</div>
                        {m.capacity && (
                          <div className="text-[11px] text-foreground-muted mt-0.5">
                            {m.capacity}
                          </div>
                        )}
                      </td>

                      {/* Client (OEM only) */}
                      {isOem && (
                        <td className="py-3 px-4 font-bold text-foreground">
                          {m.company_name || 'Unassigned'}
                        </td>
                      )}

                      {/* Total Batches (Operator only) */}
                      {isOperator && (
                        <td className="py-3 px-4 font-semibold text-foreground">
                          {m.total_batches ?? '—'}
                        </td>
                      )}

                      {/* Location */}
                      <td className="py-3 px-4 text-foreground">
                        {formatLocation(m)}
                      </td>

                      {/* Lease start date */}
                      <td className="py-3 px-4 text-foreground">
                        {formatDate(m.lease_start_date)}
                      </td>

                      {/* Connectivity */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            isOnline
                              ? 'bg-status-running-bg text-status-running-text border-status-running-dot/30'
                              : 'bg-surface-hover text-foreground-body border-border-default'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isOnline ? 'bg-status-running-dot' : 'bg-foreground-subtle'
                            }`}
                          />
                          <span>{isOnline ? 'Online' : 'Offline'}</span>
                        </span>
                      </td>

                      {/* Machine status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            opStatus === 'Running'
                              ? 'bg-status-running-bg text-status-running-text border-status-running-dot/30'
                              : opStatus === 'Idle'
                              ? 'bg-status-idle-bg text-status-idle-text border-status-idle-dot/30'
                              : opStatus === 'Maintenance'
                              ? 'bg-status-maint-bg text-status-maint-text border-status-maint-dot/30'
                              : 'bg-surface-hover text-foreground-body border-border-default'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              opStatus === 'Running'
                                ? 'bg-status-running-dot'
                                : opStatus === 'Idle'
                                ? 'bg-amber-500'
                                : opStatus === 'Maintenance'
                                ? 'bg-blue-500'
                                : 'bg-foreground-subtle'
                            }`}
                          />
                          <span>{opStatus}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <RowActionMenu
                          isOpen={activeMenuId === m.id}
                          onToggle={() => setActiveMenuId(activeMenuId === m.id ? null : m.id)}
                          onClose={() => setActiveMenuId(null)}
                          buttonAriaLabel={`Actions for ${m.machine_code || m.serial_number}`}
                          width="w-44"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectMachine(m);
                              setActiveMenuId(null);
                            }}
                            className="w-full px-3.5 py-2 text-left text-xs font-semibold text-foreground hover:bg-surface-muted flex items-center gap-2.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-foreground-muted" />
                            <span>View details</span>
                          </button>

                          {isOem && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMachine(m);
                                  setActiveMenuId(null);
                                }}
                                className="w-full px-3.5 py-2 text-left text-xs font-semibold text-foreground hover:bg-surface-muted flex items-center gap-2.5 cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-foreground-muted" />
                                <span>Edit machine</span>
                              </button>

                              <div className="border-t border-surface-hover my-1" />

                              <button
                                type="button"
                                onClick={() => {
                                  setDeletingMachine(m);
                                  setActiveMenuId(null);
                                }}
                                className="w-full px-3.5 py-2 text-left text-xs font-semibold text-primary hover:bg-red-50 flex items-center gap-2.5 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-primary" />
                                <span>Delete machine</span>
                              </button>
                            </>
                          )}
                        </RowActionMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Pagination & Footer */}
        <PaginationBar
          variant="machines"
          currentPage={currentPage}
          totalPages={totalPages}
          rowsPerPage={rowsPerPage}
          totalItems={totalItems}
          startIndex={startIndex}
          endIndex={endIndex}
          itemLabel="machines"
          onPageChange={setCurrentPage}
          onRowsPerPageChange={(val) => {
            setRowsPerPage(val);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Toast Notification Popup */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <DeleteMachineModal
        isOpen={!!deletingMachine}
        machine={deletingMachine}
        onClose={() => setDeletingMachine(null)}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
};
