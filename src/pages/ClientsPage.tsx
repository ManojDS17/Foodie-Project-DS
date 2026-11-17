import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  Plus,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Edit2,
  Download,
  Archive,
  RotateCcw,
  Trash2,
  Building2,
  RefreshCw,
  X,
} from 'lucide-react';
import { orgsApi, machinesApi, usersApi } from '../services/api';
import { useSilentRefresh } from '../hooks';
import { AddClientView } from '../components/clients/AddClientView';
import { EditClientView } from '../components/clients/EditClientView';
import { DeleteClientModal } from '../components/clients/DeleteClientModal';
import { AssignMachineView } from '../components/clients/AssignMachineView';
import { ClientDetailView } from '../components/clients/ClientDetailView';
import { RowActionMenu } from '../components/common/RowActionMenu';
import { Button } from '../components/common/ui';
import { Toast } from '../components/common/Toast';
import type { Organization, Machine, User } from '../types';

export const ClientsPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedClientIdFromUrl = searchParams.get('select');

  if (user && user.role !== 'OEM_MANAGER') {
    return <Navigate to="/" replace />;
  }

  // Live Data States
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [businessTypeFilter, setBusinessTypeFilter] = useState<string>('All');
  const [locationFilter, setLocationFilter] = useState<string>('All locations');

  // Row Selection State for Bulk Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  // Modals & Drawers States
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Organization | null>(null);
  const [deletingClient, setDeletingClient] = useState<Organization | null>(null);
  const [deletingClients, setDeletingClients] = useState<Organization[]>([]);
  const [selectedClient, setSelectedClient] = useState<Organization | null>(null);
  const [isAssignMachineOpen, setIsAssignMachineOpen] = useState(false);

  // Load live data from PostgreSQL API
  const fetchData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [orgList, machineList, userList] = await Promise.all([
        orgsApi.getAll().catch(() => []),
        machinesApi.getAll().catch(() => []),
        usersApi.getAll().catch(() => []),
      ]);
      setOrganizations(orgList);
      setMachines(machineList);
      setUsers(userList);
    } catch (err) {
      console.error('Failed to load clients data:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useSilentRefresh(() => fetchData(true), {
    intervalMs: 10000,
    enabled: !isAddClientOpen && !editingClient && !deletingClient && !isAssignMachineOpen,
  });

  useEffect(() => {
    if (!selectedClientIdFromUrl) return;

    if (organizations.length > 0) {
      const cached = organizations.find(
        (o) => o.id === selectedClientIdFromUrl || o.client_code === selectedClientIdFromUrl
      );
      if (cached) {
        setSelectedClient(cached);
      }
    }

    orgsApi
      .getById(selectedClientIdFromUrl)
      .then((verified) => {
        setSelectedClient(verified);
        setOrganizations((prev) =>
          prev.map((o) => (o.id === verified.id ? verified : o))
        );
      })
      .catch((err: any) => {
        setSelectedClient(null);
        setSearchParams({});
        setToast({
          message: err?.message || 'Access denied: Client not found or unauthorized.',
          type: 'error',
        });
      });
  }, [selectedClientIdFromUrl]);

  const handleSelectClient = async (client: Organization) => {
    setSelectedClient(client);
    setSearchParams({ select: client.id });
    try {
      const verified = await orgsApi.getById(client.id);
      setSelectedClient(verified);
      setOrganizations((prev) =>
        prev.map((o) => (o.id === verified.id ? verified : o))
      );
    } catch (err: any) {
      setSelectedClient(null);
      setSearchParams({});
      setToast({
        message: err?.message || 'Access denied or client not found.',
        type: 'error',
      });
    }
  };

  // Reset detail and modal views to show the clients list when clicking Clients in left menu
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
  }, [setSearchParams]);

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

  // Location Formatter: parses suburb & state (e.g. "Mount Isa QLD")
  const formatLocation = (address?: string): string => {
    if (!address) return '—';
    const parts = address.split(',').map((p) => p.trim());
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1];
      const matchState = lastPart.match(/(QLD|SA|WA|VIC|TAS|NT|NSW|ACT)/i);
      const suburb = parts[parts.length - 2] || parts[0];
      if (matchState) {
        return `${suburb.replace(/(\d+)/g, '').trim()} ${matchState[0].toUpperCase()}`;
      }
      return `${suburb}, ${lastPart}`;
    }
    return address;
  };

  // Date Formatter: "14 Oct 2026"
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Dynamic unique locations from client organizations
  const uniqueLocations = useMemo(() => {
    const locSet = new Set<string>();
    organizations.forEach((org) => {
      if (org.billing_address) locSet.add(org.billing_address);
      if (org.shipping_address) locSet.add(org.shipping_address);
    });
    return Array.from(locSet).filter(Boolean);
  }, [organizations]);

  // Filter Pipeline
  const filteredOrganizations = useMemo(() => {
    return organizations.filter((org) => {
      // 1. Search Query
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        org.client_code.toLowerCase().includes(q) ||
        org.company_name.toLowerCase().includes(q) ||
        (org.contact_poc && org.contact_poc.toLowerCase().includes(q)) ||
        (org.email && org.email.toLowerCase().includes(q)) ||
        (org.billing_address && org.billing_address.toLowerCase().includes(q));

      // 2. Status Filter
      const isInactive = !org.is_active || org.status === 'Inactive' || org.status === 'Archived';
      const matchesStatus =
        statusFilter === 'Inactive'
          ? isInactive
          : !isInactive;

      // 3. Business Type Filter
      const clientType = org.business_type || 'Corporate';
      const matchesType =
        businessTypeFilter === 'All' ||
        clientType.toLowerCase() === businessTypeFilter.toLowerCase();

      // 4. Site / Facility Location Filter
      const matchesLocation =
        locationFilter === 'All locations' ||
        (org.billing_address &&
          org.billing_address.toLowerCase().includes(locationFilter.toLowerCase())) ||
        (org.shipping_address &&
          org.shipping_address.toLowerCase().includes(locationFilter.toLowerCase()));

      return matchesSearch && matchesStatus && matchesType && matchesLocation;
    }).sort((a, b) => {
      const dateA = new Date(a.created_at || '').getTime() || 0;
      const dateB = new Date(b.created_at || '').getTime() || 0;
      if (dateB !== dateA) return dateB - dateA;
      return (b.client_code || '').localeCompare(a.client_code || '', undefined, { numeric: true });
    });
  }, [organizations, searchQuery, statusFilter, businessTypeFilter, locationFilter]);

  // Pagination Slice
  const totalItems = filteredOrganizations.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalItems);
  const paginatedClients = filteredOrganizations.slice(startIndex, endIndex);

  // Checkbox Selection Logic
  const isAllPageSelected =
    paginatedClients.length > 0 &&
    paginatedClients.every((c) => selectedIds.includes(c.id));

  const toggleSelectAll = () => {
    if (isAllPageSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !paginatedClients.some((c) => c.id === id))
      );
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

  // Bulk Export to CSV
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
      `"${c.company_name.replace(/"/g, '""')}"`,
      c.business_type || 'Corporate',
      c.contact_poc || '',
      c.email || '',
      c.phone_number || '',
      `"${(c.billing_address || '').replace(/"/g, '""')}"`,
      c.status || (c.is_active ? 'Active' : 'Inactive'),
      formatDate(c.created_at),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `powertech_clients_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkArchive = async () => {
    const selectedClients = organizations.filter((o) => selectedIds.includes(o.id));
    const targetStatus = statusFilter === 'Inactive' ? 'Active' : 'Inactive';
    const targetIsActive = targetStatus === 'Active';
    for (const c of selectedClients) {
      try {
        await orgsApi.update(c.id, { is_active: targetIsActive, status: targetStatus });
      } catch (err) {
        console.error('Error updating client status:', err);
      }
    }
    await fetchData();
    setSelectedIds([]);
    setToast({
      message: `Selected client(s) marked as ${targetStatus}.`,
      type: 'success',
    });
  };

  const handleUnassignMachine = async (machineId: string, terminationRemark?: string) => {
    try {
      await machinesApi.unassign(machineId, terminationRemark);
      await fetchData();
      setToast({
        message: 'Machine lease successfully terminated and returned to available fleet.',
        type: 'success',
      });
    } catch (err: any) {
      console.error('Failed to terminate machine lease:', err);
      setToast({
        message: err?.message || 'Failed to terminate machine lease.',
        type: 'error',
      });
    }
  };

  const handleToggleSelectedClientStatus = async () => {
    if (!selectedClient) return;
    const isCurrentlyInactive = !selectedClient.is_active || selectedClient.status === 'Inactive' || selectedClient.status === 'Archived';
    const nextIsActive = isCurrentlyInactive;
    const nextStatus = nextIsActive ? 'Active' : 'Inactive';

    if (!nextIsActive) {
      const clientMachines = machines.filter((m) => m.organization_id === selectedClient.id);
      if (clientMachines.length > 0) {
        setToast({
          message: `Cannot deactivate client: ${clientMachines.length} machine(s) are currently leased. Please terminate all machine leases first.`,
          type: 'error',
        });
        return;
      }
    }

    try {
      const updated = await orgsApi.update(selectedClient.id, {
        is_active: nextIsActive,
        status: nextStatus,
      });
      setSelectedClient(updated);
      setOrganizations((prev) =>
        prev.map((o) => (o.id === updated.id ? updated : o))
      );
      setToast({
        message: `Client ${selectedClient.company_name} status updated to ${nextStatus}.`,
        type: 'success',
      });
    } catch (err: any) {
      setToast({
        message: err?.message || 'Failed to update client status.',
        type: 'error',
      });
    }
  };

  const handleToggleArchive = async (client: Organization) => {
    setActiveMenuId(null);
    const isCurrentlyInactive = !client.is_active || client.status === 'Inactive' || client.status === 'Archived';
    const nextIsActive = isCurrentlyInactive;
    const nextStatus = nextIsActive ? 'Active' : 'Inactive';

    if (!nextIsActive) {
      const clientMachines = machines.filter((m) => m.organization_id === client.id);
      if (clientMachines.length > 0) {
        setToast({
          message: `Cannot deactivate client: ${clientMachines.length} machine(s) are currently leased. Please terminate all machine leases first.`,
          type: 'error',
        });
        return;
      }
    }

    try {
      await orgsApi.update(client.id, {
        is_active: nextIsActive,
        status: nextStatus,
      });

      setOrganizations((prev) =>
        prev.map((o) =>
          o.id === client.id ? { ...o, is_active: nextIsActive, status: nextStatus } : o
        )
      );

      if (selectedClient && selectedClient.id === client.id) {
        setSelectedClient({
          ...selectedClient,
          is_active: nextIsActive,
          status: nextStatus,
        });
      }

      setToast({
        message: `Client ${client.company_name} status updated to ${nextStatus}.`,
        type: 'success',
      });

      await fetchData();
    } catch (err: any) {
      setToast({
        message: err?.message || 'Failed to update client status.',
        type: 'error',
      });
    }
  };

  if (isAddClientOpen) {
    return (
      <div className="select-none">
        <AddClientView
          existingClients={organizations}
          onBack={() => setIsAddClientOpen(false)}
          onSuccess={(newOrg) => {
            fetchData();
            setIsAddClientOpen(false);
            setToast({
              message: `Client ${newOrg.company_name} (${newOrg.client_code}) added successfully!`,
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

  if (editingClient) {
    return (
      <div className="select-none">
        <EditClientView
          client={editingClient}
          existingClients={organizations}
          onBack={() => setEditingClient(null)}
          onSuccess={(updatedOrg) => {
            setOrganizations((prev) =>
              prev.map((o) => (o.id === updatedOrg.id ? updatedOrg : o))
            );
            if (selectedClient && selectedClient.id === updatedOrg.id) {
              setSelectedClient(updatedOrg);
            }
            setEditingClient(null);
            setToast({
              message: `Client ${updatedOrg.company_name} updated successfully!`,
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

  if (isAssignMachineOpen && selectedClient) {
    const clientMachines = machines.filter((m) => m.organization_id === selectedClient.id);
    return (
      <div className="select-none">
        <AssignMachineView
          client={selectedClient}
          assignedMachinesCount={clientMachines.length}
          onBack={() => setIsAssignMachineOpen(false)}
          onSuccess={() => {
            fetchData();
            setIsAssignMachineOpen(false);
            setToast({
              message: 'Machine(s) assigned to client successfully!',
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

  if (selectedClient) {
    return (
      <div className="select-none">
        <ClientDetailView
          client={selectedClient}
          machines={machines}
          users={users}
          onBack={() => {
            setSelectedClient(null);
            setSearchParams({});
          }}
          onEdit={() => setEditingClient(selectedClient)}
          onAssignMachine={() => setIsAssignMachineOpen(true)}
          onUnassignMachine={handleUnassignMachine}
          onDeleteClient={() => setDeletingClient(selectedClient)}
          onToggleStatus={handleToggleSelectedClientStatus}
        />

        <DeleteClientModal
          isOpen={Boolean(deletingClient)}
          client={deletingClient}
          onClose={() => setDeletingClient(null)}
          onSuccess={(deletedIds) => {
            setOrganizations((prev) => prev.filter((o) => !deletedIds.includes(o.id)));
            setSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(id)));
            setSelectedClient(null);
            setSearchParams({});
            fetchData();
            setToast({
              message: 'Client record archived and assigned machines unassigned successfully.',
              type: 'info',
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

  return (
    <div className="flex flex-col gap-5 max-w-[1400px] mx-auto select-none">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-[#171717] tracking-tight">
              Clients
            </h1>
            <button
              type="button"
              onClick={() => {
                fetchData();
              }}
              disabled={isLoading}
              title="Refresh clients list from PostgreSQL"
              className="p-1 rounded-lg text-[#888888] hover:text-[#171717] hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#E32032]' : ''}`} />
            </button>
          </div>
          <p className="text-xs text-[#666666] mt-0.5">
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

      {/* 2. Main White Card Container */}
      <div className="bg-white rounded-2xl border border-[#E3E4E6] p-5 shadow-xs overflow-hidden">
        {/* Top Filter Bar Row */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-[#888888] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search client ID, company or contact"
              className="w-full bg-[#F8F9FA] border border-[#E3E4E6] rounded-xl pl-9 pr-3.5 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#171717] focus:bg-white transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#888888] hover:text-[#171717]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {/* Status Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#666666] font-medium whitespace-nowrap">Status</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white border border-[#E3E4E6] rounded-xl px-3 py-2 text-xs font-bold text-[#171717] focus:outline-none focus:border-[#171717] cursor-pointer min-w-[90px]"
              >
                <option value="All">All</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            {/* Business Type Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#666666] font-medium whitespace-nowrap">Business type</span>
              <select
                value={businessTypeFilter}
                onChange={(e) => {
                  setBusinessTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white border border-[#E3E4E6] rounded-xl px-3 py-2 text-xs font-bold text-[#171717] focus:outline-none focus:border-[#171717] cursor-pointer min-w-[100px]"
              >
                <option value="All">All</option>
                <option value="Corporate">Corporate</option>
                <option value="Individual">Individual</option>
              </select>
            </div>

            {/* Location Dropdown (Facility Location wise) */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#666666] font-medium whitespace-nowrap">Location</span>
              <select
                value={locationFilter}
                onChange={(e) => {
                  setLocationFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white border border-[#E3E4E6] rounded-xl px-3 py-2 text-xs font-bold text-[#171717] focus:outline-none focus:border-[#171717] cursor-pointer max-w-[180px] truncate"
              >
                <option value="All locations">All locations</option>
                {uniqueLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc.length > 25 ? loc.slice(0, 25) + '...' : loc}
                  </option>
                ))}
              </select>
            </div>

            {/* More Filters Button */}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
              }}
              title="More filters"
              className="flex items-center gap-1.5 px-3 py-2 border border-[#E3E4E6] rounded-xl bg-white hover:bg-[#F8F9FA] text-xs font-semibold text-[#171717] transition-colors cursor-pointer select-none"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#666666]" />
              <span>More filters</span>
            </a>
          </div>
        </div>

        {/* 3. Selection Banner */}
        {selectedIds.length > 0 && (
          <div className="bg-[#FFF0F0] border border-[#FECACA] rounded-xl p-3 sm:px-4 sm:py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs my-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-4 h-4 rounded bg-[#E32032] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                  ✓
                </span>
                <span className="font-bold text-[#171717] truncate">
                  {selectedIds.length === 1
                    ? `1 client selected · ${organizations.find((o) => o.id === selectedIds[0])?.company_name || 'Client'}`
                    : `${selectedIds.length} clients selected`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-[#E32032] underline font-bold hover:text-[#C1121F] cursor-pointer whitespace-nowrap shrink-0"
              >
                Clear selection
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  handleExportData(organizations.filter((o) => selectedIds.includes(o.id)))
                }
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                Export data
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleBulkArchive}
                leftIcon={<Archive className="w-3.5 h-3.5" />}
              >
                {statusFilter === 'Inactive' ? 'Active' : 'Inactive'}
              </Button>

              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  const selectedObjs = organizations.filter((o) => selectedIds.includes(o.id));
                  setDeletingClients(selectedObjs);
                  setDeletingClient(selectedObjs.length === 1 ? selectedObjs[0] : null);
                }}
                leftIcon={<Trash2 className="w-3.5 h-3.5 text-[#E32032]" />}
              >
                Delete
              </Button>
            </div>
          </div>
        )}

        {/* 4. Clients Table */}
        <div className="overflow-x-auto mt-4 -mx-5 px-5 sm:mx-0 sm:px-0">
          <table className="w-full text-left border-collapse text-xs min-w-[750px]">
            <thead>
              <tr className="border-b border-[#E5E7EB] text-[11px] font-semibold text-[#6B7280]">
                {/* Select All Checkbox */}
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllPageSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-[#D1D5DB] text-[#E32032] focus:ring-[#E32032] cursor-pointer accent-[#E32032]"
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
            <tbody className="divide-y divide-[#F3F4F6]">
              {paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#666666]">
                    <Building2 className="w-8 h-8 text-[#CBD5E1] mx-auto mb-2" />
                    <p className="font-bold text-[#171717]">No clients match the current filters</p>
                    <p className="text-xs text-[#888888] mt-1">
                      Try clearing search or adjusting your status/location dropdowns.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedClients.map((client) => {
                  const isSelected = selectedIds.includes(client.id);
                  const clientMachineCount =
                    machines.filter((m) => m.organization_id === client.id).length;
                  const clientStatus =
                    client.status || (client.is_active ? 'Active' : 'Inactive');

                  return (
                    <tr
                      key={client.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-[#FFF5F5] hover:bg-[#FFEBEB]'
                          : 'hover:bg-[#F9FAFB]'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(client.id)}
                          className="w-4 h-4 rounded border-[#D1D5DB] text-[#E32032] focus:ring-[#E32032] cursor-pointer accent-[#E32032]"
                        />
                      </td>

                      {/* Client ID (Red Underlined Link) */}
                      <td className="py-3.5 px-3 whitespace-nowrap min-w-[100px]">
                        <button
                          type="button"
                          onClick={() => handleSelectClient(client)}
                          className="font-bold text-[#E32032] underline hover:text-[#C1121F] cursor-pointer text-left whitespace-nowrap font-mono inline-block break-keep"
                        >
                          {client.client_code}
                        </button>
                      </td>

                      {/* Company Name */}
                      <td className="py-3.5 px-3 font-bold text-[#171717]">
                        {client.company_name}
                      </td>

                      {/* Business Type */}
                      <td className="py-3.5 px-3 text-[#171717] whitespace-nowrap">
                        {client.business_type || 'Corporate'}
                      </td>

                      {/* Point of Contact */}
                      <td className="py-3.5 px-3 text-[#171717] whitespace-nowrap">
                        {client.contact_poc || 'Jordan Smith'}
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-3 text-[#171717]">
                        {formatLocation(client.billing_address)}
                      </td>

                      {/* Total Machines */}
                      <td className="py-3.5 px-3 text-center font-medium text-[#171717] whitespace-nowrap">
                        {clientMachineCount}
                      </td>

                      {/* Onboarding Date */}
                      <td className="py-3.5 px-3 text-[#6B7280] whitespace-nowrap">
                        {formatDate(client.onboarding_date || client.created_at)}
                      </td>

                      {/* Status Badge with Dot */}
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
                                ? 'bg-[#00C951]'
                                : clientStatus === 'Pending'
                                ? 'bg-amber-500'
                                : 'bg-slate-400'
                            }`}
                          />
                          <span>{clientStatus}</span>
                        </span>
                      </td>

                      {/* Actions Button & Dropdown Menu */}
                      <td className="py-3.5 px-3 text-right">
                        <RowActionMenu
                          isOpen={activeMenuId === client.id}
                          onToggle={() => setActiveMenuId(activeMenuId === client.id ? null : client.id)}
                          onClose={() => setActiveMenuId(null)}
                          buttonAriaLabel={`Actions for ${client.company_name}`}
                          width="w-48"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              handleSelectClient(client);
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-[#171717] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#6B7280]" />
                            <span>View client</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              setEditingClient(client);
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-[#171717] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-[#6B7280]" />
                            <span>Edit client</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              handleExportData([client]);
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-[#171717] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-[#6B7280]" />
                            <span>Export data</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleArchive(client)}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-[#171717] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                          >
                            {!client.is_active || client.status === 'Inactive' || client.status === 'Archived' ? (
                              <>
                                <RotateCcw className="w-3.5 h-3.5 text-[#00C951]" />
                                <span>Active</span>
                              </>
                            ) : (
                              <>
                                <Archive className="w-3.5 h-3.5 text-[#6B7280]" />
                                <span>Inactive</span>
                              </>
                            )}
                          </button>

                          <div className="border-t border-[#F3F4F6] my-1" />

                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              setDeletingClient(client);
                              setDeletingClients([]);
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-[#E32032] hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-[#E32032]" />
                            <span>Delete client</span>
                          </button>
                        </RowActionMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Pagination Footer */}
        <div className="pt-3.5 mt-3 border-t border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#6B7280] select-none">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span>Page</span>
              <span className="font-semibold text-[#171717] px-2 py-0.5 rounded border border-[#E5E7EB] bg-[#F9FAFB]">
                {currentPage}
              </span>
              <span>of {totalPages}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span>Rows per page</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setRowsPerPage(val);
                  setCurrentPage(1);
                  try {
                    localStorage.setItem('foodie_rows_per_page', String(val));
                  } catch {}
                }}
                className="px-2 py-0.5 rounded border border-[#E5E7EB] bg-white text-[#171717] font-semibold text-xs cursor-pointer focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="text-[11px] text-[#888888]">
              Showing {totalItems > 0 ? startIndex + 1 : 0}–{endIndex} of {totalItems} clients
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
              className="p-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#171717] hover:bg-[#F9FAFB] disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#171717] hover:bg-[#F9FAFB] disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
              const isActive = pageNum === currentPage;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-red-50 text-[#E32032] border border-red-200'
                      : 'border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#171717] hover:bg-[#F9FAFB]'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#171717] hover:bg-[#F9FAFB] disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#171717] hover:bg-[#F9FAFB] disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification Popup */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Delete Client Modal */}
      <DeleteClientModal
        isOpen={Boolean(deletingClient || deletingClients.length > 0)}
        client={deletingClient}
        selectedClients={deletingClients}
        onClose={() => {
          setDeletingClient(null);
          setDeletingClients([]);
        }}
        onSuccess={(deletedIds) => {
          setOrganizations((prev) => prev.filter((o) => !deletedIds.includes(o.id)));
          setSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(id)));
          fetchData();
          setToast({
            message: `Client record archived and assigned machines unassigned successfully.`,
            type: 'info',
          });
        }}
      />
    </div>
  );
};
