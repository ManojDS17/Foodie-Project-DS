import React, { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home,
  Users,
  LayoutGrid,
  Leaf,
  FileText,
  Bell,
  Settings,
  User,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { FoodieLogo } from '../common/FoodieLogo';

export interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MobileDrawerItem {
  to: string;
  label: string;
  icon: any;
  end?: boolean;
  disabled?: boolean;
  badge?: string;
  alertCount?: number;
}

export const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const userRole = user?.role || 'OPERATOR';
  const isOem = userRole === 'OEM_MANAGER';

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const navItems: MobileDrawerItem[] = [
    { to: '/', label: 'Home', icon: Home, end: true },
    ...(isOem ? [{ to: '/clients', label: 'Clients', icon: Users }] : []),
    { to: '/machines', label: 'Machines', icon: LayoutGrid },
    ...(userRole === 'SITE_ADMIN' ? [{ to: '/team', label: 'Team', icon: Users }] : []),
    ...(userRole !== 'OPERATOR' ? [{ to: '/sustainability', label: 'Sustainability', icon: Leaf, badge: 'P2' }] : []),
    { to: '/reports', label: 'Reports', icon: FileText },
    { to: '/alerts', label: 'Alerts', icon: Bell, alertCount: 2 },
    ...(isOem ? [{ to: '/settings', label: 'Settings', icon: Settings }] : []),
    { to: '/profile', label: 'Profile', icon: User },
  ];

  const userInitials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : 'PS';
  const displayName = user
    ? `${user.first_name} ${user.last_name}`
    : 'User';
  const roleDisplay = user?.role === 'OEM_MANAGER'
    ? 'OEM Asset Manager'
    : user?.role === 'SITE_ADMIN'
    ? 'Site Admin'
    : 'Facility Operator';

  return (
    <div
      className={`fixed inset-0 z-50 md:hidden transition-opacity duration-300 select-none ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      aria-modal="true"
      role="dialog"
      aria-hidden={!isOpen}
      {...(!isOpen ? { inert: true } : {})}
    >
      {/* Backdrop Overlay */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
      />

      {/* Slide-out Drawer Panel */}
      <div
        className={`absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-white shadow-2xl flex flex-col justify-between transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Header */}
        <div className="p-4 border-b border-border-subtle flex items-center justify-between">
          <FoodieLogo size="sm" showEndorsement={true} />
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="p-4 bg-surface-subtle border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-light text-primary font-bold text-sm flex items-center justify-center shrink-0">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-foreground truncate">{displayName}</div>
              <div className="text-[11px] text-foreground-muted truncate mt-0.5">{roleDisplay}</div>
              {user?.company_name && (
                <div className="text-[10px] text-foreground-dim font-mono truncate mt-0.5">
                  {user.company_name}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Items List */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;

            if (item.disabled) {
              return (
                <div
                  key={item.label}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-foreground-subtle opacity-50 cursor-not-allowed select-none"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0 text-foreground-subtle" />
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[9px] font-bold text-foreground-dim bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md uppercase">
                    Soon
                  </span>
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-primary-light text-primary border border-primary-border'
                      : 'text-foreground-body hover:text-foreground hover:bg-surface-subtle'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[9px] font-extrabold text-foreground-dim bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
                {item.alertCount && (
                  <span className="bg-primary text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full leading-none">
                    {item.alertCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-border-subtle flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onClose();
              logout('manual');
              navigate('/login?view=signed_out', { replace: true });
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-status-fault-text hover:bg-status-fault-bg transition-colors w-full cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

