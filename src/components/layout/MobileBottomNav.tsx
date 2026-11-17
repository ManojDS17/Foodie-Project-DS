import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Users, LayoutGrid, Bell, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const MobileBottomNav: React.FC = () => {
  const { user } = useAuth();
  const isOem = user?.role === 'OEM_MANAGER';

  const items = [
    { to: '/', label: 'Home', icon: Home, end: true },
    ...(isOem ? [{ to: '/clients', label: 'Clients', icon: Users, end: false }] : []),
    { to: '/machines', label: 'Machines', icon: LayoutGrid, end: false },
    { to: '/alerts', label: 'Alerts', icon: Bell, end: false, badge: 2 },
    { to: '/profile', label: 'Profile', icon: User, end: false },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E3E4E6] flex items-center justify-around py-1.5 px-2 shadow-lg select-none"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-150 relative cursor-pointer min-w-[56px] ${
                isActive
                  ? 'text-[#E32032] font-bold'
                  : 'text-[#666666] hover:text-[#171717]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 transition-transform duration-150 ${
                      isActive ? 'scale-110 stroke-[2.5]' : 'stroke-2'
                    }`}
                  />
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1 -right-2 bg-[#E32032] text-white text-[9px] font-extrabold w-3.5 h-3.5 rounded-full flex items-center justify-center leading-none">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-1 tracking-tight leading-none">
                  {item.label}
                </span>
                {isActive && (
                  <span className="w-1 h-1 rounded-full bg-[#E32032] mt-0.5" />
                )}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
};

