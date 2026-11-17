import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Users,
  LayoutGrid,
  Leaf,
  FileText,
  Bell,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { BRAND_ASSETS } from '../../config/brandConfig';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  badge?: string;
  disabled?: boolean;
}

export const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const userRole = user?.role || 'OPERATOR';

  // Navigation Items per role:
  // - OEM_MANAGER: Home, Clients, Machines, Sustainability (P2), Reports, Alerts, Settings
  // - SITE_ADMIN: Home, Machines, Team, Sustainability (P2), Reports, Alerts, Settings
  // - OPERATOR: Home, Machines, Reports, Alerts, Settings
  const navItems: NavItem[] = [
    { to: '/', label: 'Home', icon: Home, end: true },
    ...(userRole === 'OEM_MANAGER' ? [{ to: '/clients', label: 'Clients', icon: Users }] : []),
    { to: '/machines', label: 'Machines', icon: LayoutGrid },
    ...(userRole === 'SITE_ADMIN' ? [{ to: '/team', label: 'Team', icon: Users }] : []),
    ...(userRole !== 'OPERATOR' ? [{ to: '/sustainability', label: 'Sustainability', icon: Leaf, badge: 'P2' }] : []),
    { to: '/reports', label: 'Reports', icon: FileText },
    { to: '/alerts', label: 'Alerts', icon: Bell },
    ...(userRole === 'OEM_MANAGER' ? [{ to: '/settings', label: 'Settings', icon: Settings }] : []),
  ];

  return (
    <aside className="w-[70px] sm:w-[84px] bg-white border-r border-[#E3E4E6] flex flex-col items-center justify-between py-3 sm:py-4 h-screen sticky top-0 flex-shrink-0 z-[60] select-none">
      {/* Navigation Items (Stacked vertically with icons above labels) */}
      <nav className="flex flex-col items-center gap-3 w-full px-2 overflow-y-auto pt-1">
        {navItems.map((item) => {
          const Icon = item.icon;

          if (item.disabled) {
            return (
              <div
                key={item.label}
                title="Team management (Disabled)"
                className="w-full flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors duration-150 relative cursor-not-allowed border border-transparent text-[#9CA3AF] opacity-50 select-none hover:bg-transparent"
              >
                <div className="relative">
                  <Icon className="w-5 h-5 text-[#9CA3AF]" />
                </div>
                <span className="text-[10px] font-semibold mt-1 tracking-tight text-center leading-tight">
                  {item.label}
                </span>
              </div>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => {
                if (item.to === '/clients') {
                  window.dispatchEvent(new CustomEvent('foodie:reset-clients-view'));
                }
                if (item.to === '/machines') {
                  window.dispatchEvent(new CustomEvent('foodie:reset-machines-view'));
                }
              }}
              className={({ isActive }) =>
                `w-full flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors duration-150 relative cursor-pointer border ${isActive
                  ? 'bg-red-50 text-[#E32032] border-red-200 shadow-2xs'
                  : 'border-transparent text-[#666666] hover:text-[#171717] hover:bg-[#F8F9FA]'
                }`
              }
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {item.badge && (
                  <span className="absolute -top-1.5 -right-3 text-[9px] font-extrabold text-[#888888] bg-slate-100 border border-slate-200 px-1 rounded-full leading-tight">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold mt-1 tracking-tight text-center leading-tight">
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>

      <div className="flex flex-col items-center justify-center py-3 border-t border-[#E3E4E6] w-full px-2">
        <img
          src={BRAND_ASSETS.powertechIcon}
          alt="PowerTech Energy"
          className="w-7 h-7 object-contain opacity-95 hover:opacity-100 transition-opacity"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
    </aside>
  );
};
