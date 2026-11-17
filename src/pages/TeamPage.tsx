import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Plus,
  MoreHorizontal,
  Users,
  Eye,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usersApi, orgsApi } from '../services/api';
import { useSilentRefresh } from '../hooks';
import { AddOperatorView } from '../components/operators/AddOperatorView';
import { UserDetailView } from '../components/team/UserDetailView';
import { EditUserView } from '../components/team/EditUserView';
import { RemoveUserModal } from '../components/team/RemoveUserModal';
import { Toast } from '../components/common/Toast';
import type { User, Organization } from '../types';

export const TeamPage: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOperatorOpen, setIsAddOperatorOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [removingUser, setRemovingUser] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [openMenuUserId, setOpenMenuUserId] = useState<string | null>(null);

  const actionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setOpenMenuUserId(null);
      }
    };
    if (openMenuUserId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuUserId]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | 'SITE_ADMIN' | 'OPERATOR'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive' | 'Pending'>('All');

  const fetchUsers = async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      const [userList, orgList] = await Promise.all([
        usersApi.getAll().catch(() => []),
        orgsApi.getAll().catch(() => []),
      ]);
      setUsers(userList);
      setOrganizations(orgList);
      if (viewingUser) {
        const refreshed = userList.find((u) => u.id === viewingUser.id);
        if (refreshed) setViewingUser(refreshed);
      }
    } catch (err) {
      console.error('Failed to load team members:', err);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(false);
  }, []);

  useSilentRefresh(() => fetchUsers(true), {
    intervalMs: 12000,
    enabled: !isAddOperatorOpen && !editingUser && !removingUser,
  });

  const getInitials = (firstName?: string, lastName?: string, email?: string): string => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName && firstName.length >= 2) {
      return firstName.slice(0, 2).toUpperCase();
    }
    if (email && email.length >= 2) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  const getStatusBadge = (u: User) => {
    if (!u.is_active) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B7280]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF]"></span>
          Inactive
        </span>
      );
    }
    if (!u.last_login_at) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D97706]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]"></span>
          Pending
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#059669]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
        Active
      </span>
    );
  };

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
      // Exclude logged-in Site Admin from team list
      if (user?.id && u.id === user.id) {
        return false;
      }

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
      if (statusFilter === 'Active' && (!u.is_active || !u.last_login_at)) {
        return false;
      }
      if (statusFilter === 'Inactive' && u.is_active) {
        return false;
      }
      if (statusFilter === 'Pending' && (!u.is_active || Boolean(u.last_login_at))) {
        return false;
      }

      return true;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

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

  const clientName =
    user?.company_name ||
    organizations.find((o) => o.id === user?.organization_id)?.company_name ||
    'Green Valley Foods Pty Ltd';

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
          onBack={() => setViewingUser(null)}
          onEdit={(u) => setEditingUser(u)}
          onRemove={(u) => setRemovingUser(u)}
          onToast={(msg, type) => setToast({ message: msg, type })}
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
          <h1 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
            Team
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            People who can access {clientName} on Foodie Dashboard.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOperatorOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#E32032] text-white hover:bg-[#D11A2A] active:bg-[#B91826] transition-all cursor-pointer shadow-2xs self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-white" />
          <span>Add operator</span>
        </button>
      </div>

      {/* 2. Main Content Card */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs overflow-hidden">
        {/* Filter Controls Row */}
        <div className="p-4 sm:p-5 border-b border-[#F3F4F6] flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name or email"
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[#D1D5DB] bg-white text-xs text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#111827] transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Role Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#6B7280] font-medium shrink-0">Role</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-[#D1D5DB] bg-white text-xs font-medium text-[#111827] focus:outline-none focus:border-[#111827] cursor-pointer min-w-[120px]"
              >
                <option value="All">All</option>
                <option value="SITE_ADMIN">Site Admin</option>
                <option value="OPERATOR">Operator</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#6B7280] font-medium shrink-0">Status</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-[#D1D5DB] bg-white text-xs font-medium text-[#111827] focus:outline-none focus:border-[#111827] cursor-pointer min-w-[120px]"
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
              <tr className="border-b border-[#F3F4F6] text-[11px] font-semibold text-[#6B7280] bg-[#F9FAFB]">
                <th className="py-3 px-4 sm:px-6">Name</th>
                <th className="py-3 px-4 sm:px-6">Email</th>
                <th className="py-3 px-4 sm:px-6">Phone</th>
                <th className="py-3 px-4 sm:px-6">Role</th>
                <th className="py-3 px-4 sm:px-6">Status</th>
                <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6] text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-[#9CA3AF]">
                    Loading team members...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#9CA3AF]">
                        <Users className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-semibold text-[#111827]">
                        {searchQuery || roleFilter !== 'All' || statusFilter !== 'All'
                          ? 'No matching team members found'
                          : 'No team members added yet'}
                      </span>
                      <p className="text-[11px] text-[#6B7280] max-w-sm">
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
                  const initials = getInitials(u.first_name, u.last_name, u.email);
                  const isSiteAdmin = u.role === 'SITE_ADMIN';

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-[#F9FAFB] transition-colors group"
                    >
                      {/* Name with initials avatar */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <button
                          type="button"
                          onClick={() => setViewingUser(u)}
                          className="flex items-center gap-3 text-left hover:underline cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-full bg-[#F3F4F6] text-[#374151] font-semibold text-xs flex items-center justify-center shrink-0 border border-[#E5E7EB]">
                            {initials}
                          </div>
                          <span className="font-semibold text-[#111827]">
                            {fullName}
                          </span>
                        </button>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 sm:px-6 text-[#6B7280] font-normal">
                        {u.email}
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4 sm:px-6 text-[#111827] font-mono">
                        {u.phone_number || '—'}
                      </td>

                      {/* Role badge */}
                      <td className="py-3.5 px-4 sm:px-6">
                        {isSiteAdmin ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFF1F2] text-[#E11D48] border border-[#FFE4E6]">
                            Site Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]">
                            Operator
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 sm:px-6">
                        {getStatusBadge(u)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 sm:px-6 text-right relative">
                        <div
                          className="inline-block text-left"
                          ref={openMenuUserId === u.id ? actionMenuRef : null}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuUserId((prev) => (prev === u.id ? null : u.id));
                            }}
                            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors cursor-pointer inline-flex items-center justify-center"
                            aria-label="Actions"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>

                          {openMenuUserId === u.id && (
                            <div className="absolute right-4 top-10 w-44 rounded-xl bg-white border border-[#E5E7EB] shadow-lg py-1 z-30 animate-in fade-in zoom-in-95 duration-100 text-left">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuUserId(null);
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
                                  setOpenMenuUserId(null);
                                  setEditingUser(u);
                                }}
                                className="w-full px-3.5 py-2 text-left text-xs font-medium text-[#374151] hover:bg-[#F9FAFB] flex items-center gap-2 cursor-pointer transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5 text-[#6B7280]" />
                                <span>Edit user</span>
                              </button>

                              <div className="my-1 border-t border-[#F3F4F6]" />

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuUserId(null);
                                  setRemovingUser(u);
                                }}
                                className="w-full px-3.5 py-2 text-left text-xs font-medium text-[#DC2626] hover:bg-[#FEF2F2] flex items-center gap-2 cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                                <span>Remove from team</span>
                              </button>
                            </div>
                          )}
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
