import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  User as UserIcon,
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

  const activities = useMemo(() => {
    const list: Array<{ icon: any; title: string; time: string }> = [];
    if (user.last_login_at) {
      list.push({
        icon: UserIcon,
        title: 'Signed in to portal',
        time: formatDateTime(user.last_login_at),
      });
    }
    if (user.created_at) {
      list.push({
        icon: CheckCircle2,
        title: 'Account created & provisioned',
        time: formatDateTime(user.created_at),
      });
    }
    return list;
  }, [user.last_login_at, user.created_at]);

  return (
    <div className="flex flex-col gap-5 max-w-[1400px] w-full min-w-0 mx-auto select-none pb-12">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-foreground-muted pt-1">
        <button
          type="button"
          onClick={onBack}
          className="hover:text-foreground cursor-pointer transition-colors flex items-center gap-1 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{backLabel || 'Team'}</span>
        </button>
        <span>/</span>
        <span className="font-bold text-foreground">{fullName}</span>
      </nav>

      <div className="bg-white rounded-2xl border border-border-default p-4 sm:p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-primary-light text-status-fault-text font-bold text-lg flex items-center justify-center border border-primary-border shrink-0">
            {initials}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                {fullName}
              </h1>

              {isSiteAdmin ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-light text-status-fault-text border border-primary-border">
                  Site Admin
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-hover text-foreground-body border border-border-default">
                  {roleLabel}
                </span>
              )}

              {(() => {
                if (!user.is_active) {
                  return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-hover text-foreground-muted border border-border-default">
                      <span className="w-1.5 h-1.5 rounded-full bg-foreground-subtle" />
                      Inactive
                    </span>
                  );
                }
                if (!user.last_login_at) {
                  return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Pending
                    </span>
                  );
                }
                return (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-status-running-bg text-status-running-text border border-status-running-dot/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-status-running-dot" />
                    Active
                  </span>
                );
              })()}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground-muted">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-foreground-subtle" />
                <span>{user.email}</span>
              </span>

              {user.phone_number && (
                <span className="flex items-center gap-1.5 font-mono text-foreground-body">
                  <Phone className="w-3.5 h-3.5 text-foreground-subtle" />
                  <span>{user.phone_number}</span>
                </span>
              )}

              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-foreground-subtle" />
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
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border-strong bg-white text-xs font-semibold text-foreground hover:bg-surface-muted active:bg-surface-hover transition-colors cursor-pointer shadow-2xs"
            >
              <Cpu className="w-3.5 h-3.5 text-foreground-muted" />
              <span>Manage machines</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onEdit(user)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border-strong bg-white text-xs font-semibold text-foreground hover:bg-surface-muted active:bg-surface-hover transition-colors cursor-pointer shadow-2xs"
          >
            <Pencil className="w-3.5 h-3.5 text-foreground-muted" />
            <span>Edit user</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label="More user options"
            className="p-2 rounded-xl border border-border-strong bg-white text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors cursor-pointer shadow-2xs"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-white border border-border-default shadow-lg py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                disabled
                className="w-full px-3.5 py-2 text-left text-xs font-medium text-foreground-subtle opacity-60 cursor-not-allowed flex items-center gap-2 select-none"
              >
                <Lock className="w-3.5 h-3.5 text-foreground-subtle" />
                <span>Reset password</span>
              </button>

              {user.role !== 'SITE_ADMIN' && (
                <>
                  <div className="my-1 border-t border-surface-hover" />
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onRemove(user);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-status-fault-text hover:bg-primary-light flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-status-fault-text" />
                    <span>Remove from team</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-border-default p-5 sm:p-6 shadow-2xs flex flex-col">
          <h2 className="text-sm sm:text-base font-bold text-foreground mb-5">
            User details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-xs">
            <div>
              <span className="text-foreground-muted block text-[11px] mb-1">Full name</span>
              <span className="font-semibold text-foreground">{fullName}</span>
            </div>

            <div>
              <span className="text-foreground-muted block text-[11px] mb-1">Email</span>
              <span className="font-semibold text-foreground break-all">{user.email}</span>
            </div>

            <div>
              <span className="text-foreground-muted block text-[11px] mb-1">Phone</span>
              <span className="font-semibold text-foreground font-mono">
                {user.phone_number || '—'}
              </span>
            </div>

            <div>
              <span className="text-foreground-muted block text-[11px] mb-1">Role</span>
              <span className="font-semibold text-foreground">{roleLabel}</span>
            </div>

            <div>
              <span className="text-foreground-muted block text-[11px] mb-1">Organisation</span>
              <span className="font-semibold text-foreground">{orgName}</span>
            </div>

            <div>
              <span className="text-foreground-muted block text-[11px] mb-1">Status</span>
              <span className="font-semibold text-foreground">
                {!user.is_active ? 'Inactive' : !user.last_login_at ? 'Pending' : 'Active'}
              </span>
            </div>

            <div>
              <span className="text-foreground-muted block text-[11px] mb-1">Joined</span>
              <span className="font-semibold text-foreground">{joinedDate}</span>
            </div>

            {user.role === 'OPERATOR' && (
              <div className="sm:col-span-2 pt-2 border-t border-surface-hover">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-foreground-muted text-[11px] font-medium">Assigned machines</span>
                  {onManageMachines && (
                    <button
                      type="button"
                      onClick={() => onManageMachines(user)}
                      className="text-xs font-semibold text-primary hover:underline cursor-pointer"
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
                        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-red-50 text-primary border border-red-100"
                      >
                        {mCode}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-foreground-subtle text-xs">No machines assigned</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border-default p-5 sm:p-6 shadow-2xs flex flex-col">
          <h2 className="text-sm sm:text-base font-bold text-foreground mb-5">
            Recent activity
          </h2>

          <div className="divide-y divide-surface-hover -my-1">
            {activities.length > 0 ? (
              activities.map((act, idx) => {
                const IconComp = act.icon;
                return (
                  <div key={idx} className="py-3 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-surface-hover text-foreground-body flex items-center justify-center shrink-0">
                      <IconComp className="w-4 h-4 text-foreground-muted" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground leading-tight">
                        {act.title}
                      </p>
                      <span className="text-[11px] text-foreground-muted mt-0.5 block">
                        {act.time}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-6 text-center text-xs text-foreground-muted">
                No recent activity recorded for this user.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
