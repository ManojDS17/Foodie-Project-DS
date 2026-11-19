import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Mail,
  Phone,
  Clock,
  Pencil,
  MoreHorizontal,
  Trash2,
  Lock,
  CheckCircle2,
  Zap,
  User as UserIcon,
  FileText,
  Cpu,
} from 'lucide-react';
import type { User } from '../../types';

export interface UserDetailViewProps {
  user: User;
  organizationName?: string;
  backLabel?: string;
  assignedMachines?: string[];
  onBack: () => void;
  onEdit: (user: User) => void;
  onRemove: (user: User) => void;
  onManageMachines?: (user: User) => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const UserDetailView: React.FC<UserDetailViewProps> = ({
  user,
  organizationName,
  backLabel,
  assignedMachines,
  onBack,
  onEdit,
  onRemove,
  onManageMachines,
  onToast: _onToast,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Team Member';

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

  const initials = getInitials(user.first_name, user.last_name, user.email);

  const formatDateTime = (dateStr?: string | null): string => {
    if (!dateStr) return 'Recently';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateOnly = (dateStr?: string | null): string => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const isSiteAdmin = user.role === 'SITE_ADMIN';
  const roleLabel = isSiteAdmin ? 'Site Admin' : user.role === 'OEM_MANAGER' ? 'OEM Manager' : 'Operator';
  const orgName = organizationName || user.company_name || 'Client Organisation';
  const joinedDate = formatDateOnly(user.created_at);
  const lastActiveStr = formatDateTime(user.last_login_at || user.updated_at || user.created_at);

  const activities = [
    {
      icon: CheckCircle2,
      title: 'Resolved alert on C112 · Moisture below threshold',
      time: '14 Oct 2026, 8:10 am',
    },
    {
      icon: Zap,
      title: 'Viewed energy for C112',
      time: '14 Oct 2026, 7:58 am',
    },
    {
      icon: UserIcon,
      title: 'Signed in',
      time: lastActiveStr,
    },
    {
      icon: FileText,
      title: 'Downloaded weekly report',
      time: '13 Oct 2026, 4:40 pm',
    },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-[1400px] w-full min-w-0 mx-auto select-none pb-12">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#6B7280] pt-1">
        <button
          type="button"
          onClick={onBack}
          className="hover:text-[#111827] cursor-pointer transition-colors flex items-center gap-1 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{backLabel || 'Team'}</span>
        </button>
        <span>/</span>
        <span className="font-bold text-[#111827]">{fullName}</span>
      </nav>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-[#FFE4E6] text-[#E11D48] font-bold text-lg flex items-center justify-center border border-[#FECDD3] shrink-0">
            {initials}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
                {fullName}
              </h1>

              {isSiteAdmin ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFF1F2] text-[#E11D48] border border-[#FFE4E6]">
                  Site Admin
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]">
                  {roleLabel}
                </span>
              )}

              {user.is_active ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EAFBF1] text-[#059669]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F3F4F6] text-[#6B7280]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF]" />
                  Inactive
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6B7280]">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#9CA3AF]" />
                <span>{user.email}</span>
              </span>

              {user.phone_number && (
                <span className="flex items-center gap-1.5 font-mono text-[#374151]">
                  <Phone className="w-3.5 h-3.5 text-[#9CA3AF]" />
                  <span>{user.phone_number}</span>
                </span>
              )}

              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#9CA3AF]" />
                <span>Last active {lastActiveStr}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 relative self-start md:self-auto" ref={menuRef}>
          {user.role === 'OPERATOR' && onManageMachines && (
            <button
              type="button"
              onClick={() => onManageMachines(user)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#D1D5DB] bg-white text-xs font-semibold text-[#111827] hover:bg-[#F9FAFB] active:bg-[#F3F4F6] transition-colors cursor-pointer shadow-2xs"
            >
              <Cpu className="w-3.5 h-3.5 text-[#6B7280]" />
              <span>Manage machines</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onEdit(user)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#D1D5DB] bg-white text-xs font-semibold text-[#111827] hover:bg-[#F9FAFB] active:bg-[#F3F4F6] transition-colors cursor-pointer shadow-2xs"
          >
            <Pencil className="w-3.5 h-3.5 text-[#6B7280]" />
            <span>Edit user</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label="More user options"
            className="p-2 rounded-xl border border-[#D1D5DB] bg-white text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB] transition-colors cursor-pointer shadow-2xs"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-white border border-[#E5E7EB] shadow-lg py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                disabled
                className="w-full px-3.5 py-2 text-left text-xs font-medium text-[#9CA3AF] opacity-60 cursor-not-allowed flex items-center gap-2 select-none"
              >
                <Lock className="w-3.5 h-3.5 text-[#9CA3AF]" />
                <span>Reset password</span>
              </button>

              {user.role !== 'SITE_ADMIN' && (
                <>
                  <div className="my-1 border-t border-[#F3F4F6]" />
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onRemove(user);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-[#DC2626] hover:bg-[#FEF2F2] flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                    <span>Remove from team</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 sm:p-6 shadow-2xs flex flex-col">
          <h2 className="text-sm sm:text-base font-bold text-[#111827] mb-5">
            User details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-xs">
            <div>
              <span className="text-[#6B7280] block text-[11px] mb-1">Full name</span>
              <span className="font-semibold text-[#111827]">{fullName}</span>
            </div>

            <div>
              <span className="text-[#6B7280] block text-[11px] mb-1">Email</span>
              <span className="font-semibold text-[#111827] break-all">{user.email}</span>
            </div>

            <div>
              <span className="text-[#6B7280] block text-[11px] mb-1">Phone</span>
              <span className="font-semibold text-[#111827] font-mono">
                {user.phone_number || '—'}
              </span>
            </div>

            <div>
              <span className="text-[#6B7280] block text-[11px] mb-1">Role</span>
              <span className="font-semibold text-[#111827]">{roleLabel}</span>
            </div>

            <div>
              <span className="text-[#6B7280] block text-[11px] mb-1">Organisation</span>
              <span className="font-semibold text-[#111827]">{orgName}</span>
            </div>

            <div>
              <span className="text-[#6B7280] block text-[11px] mb-1">Status</span>
              <span className="font-semibold text-[#111827]">
                {user.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div>
              <span className="text-[#6B7280] block text-[11px] mb-1">Joined</span>
              <span className="font-semibold text-[#111827]">{joinedDate}</span>
            </div>

            {user.role === 'OPERATOR' && (
              <div className="sm:col-span-2 pt-2 border-t border-[#F3F4F6]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[#6B7280] text-[11px] font-medium">Assigned machines</span>
                  {onManageMachines && (
                    <button
                      type="button"
                      onClick={() => onManageMachines(user)}
                      className="text-xs font-semibold text-[#E32032] hover:underline cursor-pointer"
                    >
                      Manage machines
                    </button>
                  )}
                </div>
                {assignedMachines && assignedMachines.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {assignedMachines.map((mCode, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-red-50 text-[#E32032] border border-red-100"
                      >
                        {mCode}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[#9CA3AF] text-xs">No machines assigned</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 sm:p-6 shadow-2xs flex flex-col">
          <h2 className="text-sm sm:text-base font-bold text-[#111827] mb-5">
            Recent activity
          </h2>

          <div className="divide-y divide-[#F3F4F6] -my-1">
            {activities.map((act, idx) => {
              const IconComp = act.icon;
              return (
                <div key={idx} className="py-3 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F3F4F6] text-[#4B5563] flex items-center justify-center shrink-0">
                    <IconComp className="w-4 h-4 text-[#6B7280]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#111827] leading-tight">
                      {act.title}
                    </p>
                    <span className="text-[11px] text-[#6B7280] mt-0.5 block">
                      {act.time}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
