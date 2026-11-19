import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { MachineDetailView } from '../machines/MachineDetailView';
import { TerminateLeaseModal } from './TerminateLeaseModal';
import { AssignOperatorMachineModal } from '../operators/AssignOperatorMachineModal';
import { UserDetailView } from '../team/UserDetailView';
import { EditUserView } from '../team/EditUserView';
import { RemoveUserModal } from '../team/RemoveUserModal';
import { Toast } from '../common/Toast';
import { RowActionMenu } from '../common/RowActionMenu';
import { operatorAssignmentsApi, usersApi } from '../../services/api';
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
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'MACHINES' | 'USERS'>('MACHINES');
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [activeMachineMenuId, setActiveMachineMenuId] = useState<string | null>(null);
  const [viewingMachine, setViewingMachine] = useState<Machine | null>(null);
  const [terminatingMachine, setTerminatingMachine] = useState<Machine | null>(null);
  const [managingOperator, setManagingOperator] = useState<User | null>(null);
  const [operatorAssignments, setOperatorAssignments] = useState<OperatorMachineAssignment[]>([]);

  const [localUsers, setLocalUsers] = useState<User[]>(users);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [removingUser, setRemovingUser] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [activeUserMenuId, setActiveUserMenuId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

  const userActionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalUsers(users);
  }, [users]);

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

  const refreshUsers = async () => {
    try {
      const allUsers = await usersApi.getAll();
      setLocalUsers(allUsers);
    } catch (err) {
      console.error('Failed to refresh users:', err);
    }
  };

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

  const fetchAssignments = async () => {
    if (!client?.id) return;
    try {
      const data = await operatorAssignmentsApi.getAll({ organization_id: client.id });
      setOperatorAssignments(data);
    } catch (err) {
      console.error('Failed to load operator assignments:', err);
    }
  };

  useEffect(() => {
    fetchAssignments();
    refreshUsers();
  }, [client.id]);

  useEffect(() => {
    if (activeTab === 'USERS') {
      refreshUsers();
      fetchAssignments();
    }
  }, [activeTab]);

  useSilentRefresh(
    async () => {
      await Promise.all([
        refreshUsers(),
        fetchAssignments(),
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

  const getInitials = (name: string): string => {
    if (!name) return 'CL';
    const clean = name.trim().split(/\s+/);
    if (clean.length === 1) return clean[0].substring(0, 2).toUpperCase();
    return (clean[0][0] + clean[1][0]).toUpperCase();
  };

  const getModelCapacity = (model: string, capacity?: string | null): string => {
    if (capacity && capacity.trim()) return capacity;
    if (model.includes('1000')) return '1000 kg/day';
    if (model.includes('500')) return '500 kg/day';
    if (model.includes('100')) return '100 kg/day';
    if (model.includes('25')) return '25 kg/day';
    return '100 kg/day';
  };

  const clientMachines = machines.filter((m) => m.organization_id === client.id);
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
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        'Field,Value',
        `Client ID,"${client.client_code}"`,
        `Company Name,"${client.company_name.replace(/"/g, '""')}"`,
        `Business Type,"${client.business_type || 'Corporate'}"`,
        `Tax ID,"${client.tax_id || ''}"`,
        `Onboarding Date,"${client.onboarding_date || client.created_at}"`,
        `Comms Preference,"${client.comms_preference || 'Phone'}"`,
        `Payment Terms,"${client.payment_terms || '14 days'}"`,
        `Contact POC,"${client.contact_poc || ''}"`,
        `Email,"${client.email || ''}"`,
        `Phone,"${client.phone_number || ''}"`,
        `Website,"${client.website || ''}"`,
        `Billing Address,"${(client.billing_address || '').replace(/"/g, '""')}"`,
        `Assigned Machines,"${clientMachines.length}"`,
      ].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${client.client_code}_details_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          onBack={() => setViewingMachine(null)}
          onEdit={(m) => {
            navigate(`/machines?search=${encodeURIComponent(m.serial_number || m.machine_code)}`);
          }}
          onDelete={() => {}}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-[1400px] mx-auto select-none">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#6B7280] pt-1">
        <button
          type="button"
          onClick={onBack}
          className="hover:text-[#111827] cursor-pointer transition-colors"
        >
          Clients
        </button>
        <span className="text-[#9CA3AF]">/</span>
        <span className="font-bold text-[#111827]">{client.company_name}</span>
      </nav>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#F3F4F6] text-[#111827] font-bold text-xl flex items-center justify-center border border-[#E5E7EB] shrink-0">
            {getInitials(client.company_name)}
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
                {client.company_name}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  clientStatus === 'Active'
                    ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
                    : clientStatus === 'Pending'
                    ? 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]'
                    : 'bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    clientStatus === 'Active'
                      ? 'bg-[#10B981]'
                      : clientStatus === 'Pending'
                      ? 'bg-[#F59E0B]'
                      : 'bg-[#9CA3AF]'
                  }`}
                />
                <span>{clientStatus}</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-[#6B7280] mt-1.5">
              <span>{client.client_code}</span>
              <span>{client.business_type || 'Corporate'}</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#9CA3AF]" />
                <span>{formatLocation(client.billing_address)}</span>
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#9CA3AF]" />
                <span>Onboarded {formatDate(client.onboarding_date || client.created_at)}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={onEdit}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold border border-[#D1D5DB] text-[#374151] hover:bg-[#F9FAFB] flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
          >
            <Pencil className="w-3.5 h-3.5 text-[#374151]" />
            <span>Edit client</span>
          </button>

          <div className="relative" ref={headerMenuRef}>
            <button
              type="button"
              onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
              className="p-2 rounded-lg text-xs font-medium border border-[#D1D5DB] text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB] transition-colors cursor-pointer shadow-2xs"
              aria-label="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isHeaderMenuOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white border border-[#E5E7EB] rounded-xl shadow-lg z-30 py-1 divide-y divide-[#F3F4F6]">
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      handleExportDetails();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs text-[#374151] hover:bg-[#F9FAFB] flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#6B7280]" />
                    <span>Export client details</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      const isCurrentlyActive = client.is_active && client.status !== 'Inactive' && client.status !== 'Archived';
                      if (isCurrentlyActive && clientMachines.length > 0) {
                        alert(`Cannot deactivate client: ${client.company_name} currently has ${clientMachines.length} machine(s) leased. Please terminate all machine leases before deactivating.`);
                        return;
                      }
                      onToggleStatus();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs text-[#374151] hover:bg-[#F9FAFB] flex items-center gap-2 cursor-pointer"
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
                </div>
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      onDeleteClient();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs text-[#E32032] hover:bg-[#FEF2F2] flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[#E32032]" />
                    <span>Delete client</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-3.5 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#6B7280]">Machines</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#F3F4F6] flex items-center justify-center text-[#4B5563]">
              <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#111827] mt-2">
            {clientMachines.length}
          </div>
          <div className="text-[11px] sm:text-xs text-[#6B7280] mt-1 truncate">
            {runningCount} running · {idleCount} idle
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-3.5 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#6B7280]">Users</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#F3F4F6] flex items-center justify-center text-[#4B5563]">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#111827] mt-2">
            {clientUsers.length}
          </div>
          <div className="text-[11px] sm:text-xs text-[#6B7280] mt-1 truncate">
            {adminCount} Site Admin · {operatorCount} Operators
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-3.5 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#6B7280]">Open alerts</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#FEE2E2] flex items-center justify-center text-[#E32032]">
              <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#E32032]" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#E32032] mt-2">
            {openAlertsCount}
          </div>
          <div className="text-[11px] sm:text-xs text-[#6B7280] mt-1 truncate">
            {openAlertsCount > 0 ? 'Action required on offline unit' : 'No active alerts'}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-3.5 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#6B7280]">Energy consumed</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#F3F4F6] flex items-center justify-center text-[#4B5563]">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="flex items-baseline mt-2">
            <span className="text-2xl sm:text-3xl font-bold text-[#111827]">{totalEnergyKwh}</span>
            <span className="text-xs sm:text-sm font-semibold text-[#111827] ml-1.5">kWh</span>
          </div>
          <div className="text-[11px] sm:text-xs text-[#6B7280] mt-1 truncate">
            {clientMachines.length === 2 ? 'Today, both machines' : 'Today, across assigned fleet'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 shadow-2xs">
          <h2 className="text-sm font-bold text-[#111827] mb-5 tracking-tight">
            Client details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-6">
            <div>
              <span className="block text-xs text-[#6B7280]">Account number / Client ID</span>
              <span className="block text-xs sm:text-sm font-semibold text-[#111827] mt-1">
                {client.client_code}
              </span>
            </div>

            <div>
              <span className="block text-xs text-[#6B7280]">Full name / Company name</span>
              <span className="block text-xs sm:text-sm font-semibold text-[#111827] mt-1">
                {client.company_name}
              </span>
            </div>

            <div>
              <span className="block text-xs text-[#6B7280]">Business type</span>
              <span className="block text-xs sm:text-sm font-semibold text-[#111827] mt-1">
                {client.business_type || 'Corporate'}
              </span>
            </div>

            <div>
              <span className="block text-xs text-[#6B7280]">Tax ID (ABN / GST)</span>
              <span className="block text-xs sm:text-sm font-semibold text-[#111827] mt-1">
                {client.tax_id || '—'}
              </span>
            </div>

            <div>
              <span className="block text-xs text-[#6B7280]">Onboarding date</span>
              <span className="block text-xs sm:text-sm font-semibold text-[#111827] mt-1">
                {formatDate(client.onboarding_date || client.created_at)}
              </span>
            </div>

            <div>
              <span className="block text-xs text-[#6B7280]">Comms preference</span>
              <span className="block text-xs sm:text-sm font-semibold text-[#111827] mt-1">
                {client.comms_preference || 'Email'}
              </span>
            </div>

            <div>
              <span className="block text-xs text-[#6B7280]">Payment terms</span>
              <span className="block text-xs sm:text-sm font-semibold text-[#111827] mt-1">
                {client.payment_terms || '30 days'}
              </span>
            </div>

            <div>
              <span className="block text-xs text-[#6B7280]">Preferred currency</span>
              <span className="block text-xs sm:text-sm font-semibold text-[#111827] mt-1">
                {client.preferred_currency || 'AUD'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 shadow-2xs">
          <h2 className="text-sm font-bold text-[#111827] mb-5 tracking-tight">
            Contact details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-6">
            <div>
              <span className="block text-xs text-[#6B7280]">Point of contact</span>
              <span className="block text-xs sm:text-sm font-semibold text-[#111827] mt-1">
                {client.contact_poc || '—'}
              </span>
            </div>

            <div>
              <span className="block text-xs text-[#6B7280]">Phone number</span>
              <span className="block text-xs sm:text-sm font-semibold text-[#111827] mt-1">
                {client.phone_number || '—'}
              </span>
            </div>

            <div>
              <span className="block text-xs text-[#6B7280]">Email</span>
              {client.email ? (
                <a
                  href={`mailto:${client.email}`}
                  className="block text-xs sm:text-sm font-semibold text-[#111827] hover:text-[#E32032] mt-1 transition-colors"
                >
                  {client.email}
                </a>
              ) : (
                <span className="block text-xs sm:text-sm font-semibold text-[#111827] mt-1">—</span>
              )}
            </div>

            <div>
              <span className="block text-xs text-[#6B7280]">Website</span>
              <span className="block text-xs sm:text-sm font-semibold text-[#111827] mt-1">
                {client.website || '—'}
              </span>
            </div>

            <div>
              <span className="block text-xs text-[#6B7280]">Billing address</span>
              <span className="block text-xs sm:text-sm font-semibold text-[#111827] mt-1">
                {client.billing_address || '—'}
              </span>
            </div>

            <div>
              <span className="block text-xs text-[#6B7280]">Shipping address</span>
              <span className="block text-xs sm:text-sm font-semibold text-[#111827] mt-1">
                {client.shipping_address || '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-2xs">
        <div className="border-b border-[#E5E7EB] px-6 flex items-center gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('MACHINES')}
            className={`py-4 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
              activeTab === 'MACHINES'
                ? 'border-[#E32032] text-[#E32032]'
                : 'border-transparent text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Machines</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                activeTab === 'MACHINES'
                  ? 'bg-[#FEE2E2] text-[#E32032]'
                  : 'bg-[#F3F4F6] text-[#6B7280]'
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
                ? 'border-[#E32032] text-[#E32032]'
                : 'border-transparent text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                activeTab === 'USERS'
                  ? 'bg-[#FEE2E2] text-[#E32032]'
                  : 'bg-[#F3F4F6] text-[#6B7280]'
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
                <h3 className="text-sm font-bold text-[#111827]">Machines</h3>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Foodie machines leased to this client and their live status.
                </p>
              </div>

              <button
                type="button"
                onClick={onAssignMachine}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#E32032] hover:bg-[#C1121F] text-white flex items-center gap-1.5 shadow-2xs self-start sm:self-auto cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Assign machine</span>
              </button>
            </div>

            {clientMachines.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-[#F3F4F6] flex items-center justify-center text-[#9CA3AF] mx-auto mb-3">
                  <LayoutGrid className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-[#111827]">No machines assigned</h4>
                <p className="text-xs text-[#6B7280] mt-1 max-w-sm mx-auto">
                  This client currently has no Foodie machines mapped. Click "Assign machine" above to lease units.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto pb-16">
                <table className="w-full text-xs text-left min-w-[700px]">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280] font-semibold">
                      <th className="py-3 px-6">Serial Number</th>
                      <th className="py-3 px-6">Model</th>
                      <th className="py-3 px-6">Location</th>
                      <th className="py-3 px-6">Lease start date</th>
                      <th className="py-3 px-6">Machine status</th>
                      <th className="py-3 px-6">Connectivity</th>
                      <th className="py-3 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {clientMachines.map((m) => {
                      const isOnline = (m.connectivity_status || '').toLowerCase() === 'online';
                      const isRunning =
                        (m.operational_status || '').toLowerCase() === 'running' || isOnline;

                      return (
                        <tr key={m.id} className="hover:bg-[#F9FAFB] transition-colors">
                          <td className="py-4 px-6 font-bold text-[#E32032]">
                            <button
                              type="button"
                              onClick={() => navigate(`/machines?select=${m.id}`)}
                              className="underline hover:text-[#C1121F] cursor-pointer"
                            >
                              {m.serial_number || m.machine_code}
                            </button>
                          </td>

                          <td className="py-4 px-6">
                            <div className="font-bold text-[#111827]">{m.model}</div>
                            <div className="text-[11px] text-[#6B7280]">
                              {getModelCapacity(m.model, m.capacity)}
                            </div>
                          </td>

                          <td className="py-4 px-6 text-[#111827]">
                            {m.location_label || m.site_name || '—'}
                          </td>

                          <td className="py-4 px-6 text-[#111827]">
                            {formatDate(m.lease_start_date || m.created_at)}
                          </td>

                          <td className="py-4 px-6">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                                isRunning
                                  ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
                                  : 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isRunning ? 'bg-[#10B981]' : 'bg-[#F59E0B]'
                                }`}
                              />
                              <span>{isRunning ? 'Running' : 'Idle'}</span>
                            </span>
                          </td>

                          <td className="py-4 px-6">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                                isOnline
                                  ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
                                  : 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isOnline ? 'bg-[#10B981]' : 'bg-[#EF4444]'
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
                                  setViewingMachine(m);
                                }}
                                className="w-full px-3.5 py-2 text-left text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                              >
                                View machine
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMachineMenuId(null);
                                  setTerminatingMachine(m);
                                }}
                                className="w-full px-3.5 py-2 text-left text-xs font-semibold text-[#E32032] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
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
              <h3 className="text-sm font-bold text-[#111827]">Users</h3>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Authorized personnel with access to this client's Foodie composter fleet.
              </p>
            </div>

            {clientUsers.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-[#F3F4F6] flex items-center justify-center text-[#9CA3AF] mx-auto mb-3">
                  <Users className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-[#111827]">No users assigned</h4>
                <p className="text-xs text-[#6B7280] mt-1 max-w-sm mx-auto">
                  Personnel can be added in User Management to grant access to this organization.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto pb-12">
                <table className="w-full text-xs text-left min-w-[750px]">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280] font-semibold">
                      <th className="py-3 px-6">Name</th>
                      <th className="py-3 px-6">Email</th>
                      <th className="py-3 px-6">Phone number</th>
                      <th className="py-3 px-6">Role</th>
                      <th className="py-3 px-6">Assigned machines</th>
                      <th className="py-3 px-6">Status</th>
                      <th className="py-3 px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {clientUsers.map((u) => {
                      const userAssignments = operatorAssignments.filter(
                        (a) =>
                          String(a.operator_id || '').trim().toLowerCase() === String(u.id || '').trim().toLowerCase() &&
                          a.status === 'Active'
                      );

                      return (
                        <tr key={u.id} className="hover:bg-[#F9FAFB] transition-colors">
                          <td className="py-4 px-6 font-bold text-[#111827]">
                            <button
                              type="button"
                              onClick={() => setViewingUser(u)}
                              className="hover:underline text-left cursor-pointer font-bold text-[#111827]"
                            >
                              {u.first_name} {u.last_name}
                            </button>
                          </td>
                          <td className="py-4 px-6 text-[#6B7280]">{u.email}</td>
                          <td className="py-4 px-6 text-[#6B7280]">{u.phone_number || '—'}</td>
                          <td className="py-4 px-6">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]">
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
                                <span className="text-[#9CA3AF] text-xs">No machines assigned</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {userAssignments.map((a) => (
                                    <span
                                      key={a.id}
                                      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-red-50 text-[#E32032] border border-red-100"
                                    >
                                      {a.machine_code || a.serial_number}
                                    </span>
                                  ))}
                                </div>
                              )
                            ) : (
                              <span className="text-[#6B7280] text-xs font-medium">All fleet access</span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            {u.is_active ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                                <span>Active</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF]" />
                                <span>Inactive</span>
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right relative">
                            <div className="inline-flex items-center gap-2 text-left justify-end">
                              {u.role === 'OPERATOR' && (
                                <button
                                  type="button"
                                  onClick={() => setManagingOperator(u)}
                                  className="px-2.5 py-1 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-xs font-semibold text-[#374151] transition-colors cursor-pointer"
                                >
                                  Manage machines
                                </button>
                              )}

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
                                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-[#374151] hover:bg-[#F9FAFB] flex items-center gap-2 cursor-pointer transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5 text-[#6B7280]" />
                                  <span>View user</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveUserMenuId(null);
                                    setEditingUser(u);
                                  }}
                                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-[#374151] hover:bg-[#F9FAFB] flex items-center gap-2 cursor-pointer transition-colors"
                                >
                                  <Pencil className="w-3.5 h-3.5 text-[#6B7280]" />
                                  <span>Edit user</span>
                                </button>

                                {u.role !== 'SITE_ADMIN' && (
                                  <>
                                    <div className="my-1 border-t border-[#F3F4F6]" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveUserMenuId(null);
                                        setRemovingUser(u);
                                      }}
                                      className="w-full px-3.5 py-2 text-left text-xs font-medium text-[#DC2626] hover:bg-[#FEF2F2] flex items-center gap-2 cursor-pointer transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
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
