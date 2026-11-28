import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Search,
  HelpCircle,
  Building2,
  Cpu,
  Loader2,
  X,
  ChevronRight,
  ChevronDown,
  User as UserIcon,
  Settings,
  LogOut,
  Menu,
} from 'lucide-react';
import { useAuth } from '../../hooks';
import { FoodieLogo } from '../common/FoodieLogo';
import { searchApi } from '../../services/api';
import type { SearchResults } from '../../services/api';
import type { UserRole } from '../../types';

const FAQ_ITEMS = [
  {
    q: 'How are operator machine permissions managed?',
    a: 'Operators are automatically linked to leased units in their organization. Site Admins and OEM Managers can assign or revoke machine access from Team Management or Client Details.',
  },
  {
    q: 'How long do login sessions stay active?',
    a: 'Authenticated sessions expire automatically after 15 minutes of inactivity. When your session times out, signing back in returns you directly to the page you were viewing.',
  },
  {
    q: 'What happens when a machine lease is terminated?',
    a: 'Terminating an active lease returns the machine to the available fleet and automatically revokes associated active operator assignments.',
  },
];

export interface HeaderProps {
  onOpenMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isOem = user?.role === 'OEM_MANAGER';

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // User Profile Dropdown & FAQ Modal State
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const userMenuContainerRef = useRef<HTMLDivElement>(null);

  // Debounced search query with AbortController cancellation
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await searchApi.query(trimmed, controller.signal);
        if (!controller.signal.aborted) {
          setResults(res);
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError' && !controller.signal.aborted) {
          console.error('Search query failed:', err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (!value.trim()) {
      setResults(null);
      setIsSearching(false);
      setIsOpen(false);
    } else {
      setIsSearching(true);
      setIsOpen(true);
    }
  };

  // Click outside listener to dismiss search dropdown and user menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
      if (userMenuContainerRef.current && !userMenuContainerRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setIsUserMenuOpen(false);
        setIsFaqOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const totalResultsCount =
    (results?.clients?.length || 0) +
    (results?.machines?.length || 0);

  const handleSelectClient = (clientId: string) => {
    setIsOpen(false);
    setSearchQuery('');
    setResults(null);
    navigate(`/clients?select=${encodeURIComponent(clientId)}`);
  };

  const handleSelectMachine = (machineId: string) => {
    setIsOpen(false);
    setSearchQuery('');
    setResults(null);
    navigate(`/machines?select=${encodeURIComponent(machineId)}`);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setResults(null);
    setIsOpen(false);
  };

  return (
    <header className="h-16 bg-surface-card border-b border-border-subtle px-3 sm:px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs select-none gap-2 sm:gap-4 w-full max-w-full">
      {/* Brand & Workspace Indicator */}
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="p-1.5 rounded-lg text-foreground hover:bg-surface-hover transition-colors md:hidden shrink-0 cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5 text-foreground" />
          </button>
        )}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <FoodieLogo size="sm" showEndorsement={true} />
          <div className="h-6 w-px bg-border-subtle hidden lg:block" />
          <div className="hidden lg:flex flex-col">
            <span className="text-[10px] text-foreground-dim font-bold uppercase leading-tight">
              {user?.role === 'OEM_MANAGER' ? 'Workspace' : 'Client Workspace'}
            </span>
            <span className="text-xs font-extrabold text-foreground leading-tight truncate max-w-[240px]">
              {user?.role === 'OEM_MANAGER'
                ? 'OEM Asset Manager'
                : (user?.company_name || 'Client Workspace')}
            </span>
          </div>
        </div>
        {user?.role !== 'OEM_MANAGER' && user?.company_name && (
          <div className="hidden sm:flex lg:hidden items-center gap-1.5 bg-surface-subtle border border-border-subtle px-2.5 py-1 rounded-full text-[11px] font-semibold text-foreground shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-status-running-dot shrink-0" />
            <span className="truncate max-w-[140px] font-bold">{user.company_name}</span>
          </div>
        )}
      </div>

      {/* Global Search Input */}
      <div ref={searchContainerRef} className="relative hidden md:block flex-1 max-w-xs lg:max-w-sm mx-2 md:mx-4 lg:mx-6 min-w-0">
        <div className="relative">
          {isSearching ? (
            <Loader2 className="w-4 h-4 text-primary absolute left-3 top-1/2 -translate-y-1/2 animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-foreground-dim absolute left-3 top-1/2 -translate-y-1/2" />
          )}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => {
              if (searchQuery.trim().length > 0) setIsOpen(true);
            }}
            placeholder="Search"
            className="bg-surface-subtle border border-border-subtle rounded-lg pl-9 pr-8 py-1.5 text-xs text-foreground focus:outline-none focus:border-foreground focus:bg-surface-card transition-all w-full placeholder:text-foreground-dim"
          />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-dim hover:text-foreground p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown Overlay */}
          {isOpen && searchQuery.trim().length > 0 && (
            <div className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] bg-surface-card border border-border-default rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-surface-hover">
              {/* Header summary */}
              <div className="px-3.5 py-2 bg-surface-muted flex items-center justify-between text-[11px] font-semibold text-foreground-muted">
                <span>Search Results</span>
                <span>{isSearching ? 'Searching...' : `${totalResultsCount} found`}</span>
              </div>

              {/* No Results State */}
              {!isSearching && totalResultsCount === 0 && (
                <div className="p-6 text-center">
                  <p className="text-xs font-bold text-foreground">No records matching "{searchQuery}"</p>
                  <p className="text-[11px] text-foreground-muted mt-1">
                    Try searching by Client name, Client code (e.g. CL-001), Machine code (e.g. MC-001), Serial number, or Model.
                  </p>
                </div>
              )}

              {/* Clients Section */}
              {results && results.clients && results.clients.length > 0 && (
                <div className="py-2">
                  <div className="px-3.5 py-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-foreground-muted">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-primary" />
                      Clients ({results.clients.length})
                    </span>
                    {user?.role === 'OEM_MANAGER' && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          setSearchQuery('');
                          navigate('/clients');
                        }}
                        className="text-primary hover:underline normal-case font-semibold text-xs cursor-pointer"
                      >
                        View all
                      </button>
                    )}
                  </div>
                  <div className="mt-1 divide-y divide-surface-muted">
                    {results.clients.map((client) => (
                      <div
                        key={client.id}
                        onClick={() => handleSelectClient(client.id)}
                        className="px-3.5 py-2.5 hover:bg-surface-muted cursor-pointer flex items-center justify-between transition-colors group"
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                              {client.company_name.replace(/^\[[A-Z0-9_-]+\]\s*/i, '')}
                            </span>
                            {user?.role === 'OEM_MANAGER' && client.client_code && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 border border-border-default text-foreground-body shrink-0 font-medium">
                                {client.client_code}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-foreground-muted truncate mt-0.5">
                            {client.contact_poc ? `POC: ${client.contact_poc}` : (client.email || client.phone_number || 'Client organization')}
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-foreground-subtle group-hover:text-foreground transition-colors shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Machines Section */}
              {results && results.machines && results.machines.length > 0 && (
                <div className="py-2">
                  <div className="px-3.5 py-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-foreground-muted">
                    <span className="flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-primary" />
                      Machines ({results.machines.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        setSearchQuery('');
                        navigate('/machines');
                      }}
                      className="text-primary hover:underline normal-case font-semibold text-xs cursor-pointer"
                    >
                      View all
                    </button>
                  </div>
                  <div className="mt-1 divide-y divide-surface-muted">
                    {results.machines.map((machine) => (
                      <div
                        key={machine.id}
                        onClick={() => handleSelectMachine(machine.id)}
                        className="px-3.5 py-2.5 hover:bg-surface-muted cursor-pointer flex items-center justify-between transition-colors group"
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-bold text-foreground group-hover:text-primary transition-colors">
                              {machine.machine_code || machine.serial_number}
                            </span>
                            <span className="text-[11px] font-medium text-foreground-body">
                              {machine.model}
                            </span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              machine.status === 'Running'
                                ? 'bg-status-running-bg text-status-running-text border-status-running-dot/30'
                                : machine.status === 'Machine not assigned'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : machine.status === 'Idle'
                                ? 'bg-status-idle-bg text-status-idle-text border-status-idle-dot/30'
                                : 'bg-surface-hover text-foreground-body border-border-default'
                            }`}>
                              {machine.status}
                            </span>
                          </div>
                          <span className="text-[11px] text-foreground-muted truncate mt-0.5">
                            {machine.company_name && machine.company_name !== 'Unassigned' ? `${machine.company_name} · ` : ''}{machine.location || 'Fleet'}
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-foreground-subtle group-hover:text-foreground transition-colors shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-3 shrink-0">
          {/* FAQ Pill Button */}
          <button
            type="button"
            onClick={() => setIsFaqOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-full border border-border-default bg-white hover:bg-surface-hover text-foreground text-xs font-semibold shadow-2xs transition-colors cursor-pointer shrink-0"
          >
            <span>FAQ</span>
            <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-foreground-body shrink-0" />
          </button>

          {/* Notifications Alert Bell */}
          <button
            type="button"
            onClick={() => navigate('/alerts')}
            className="relative p-1.5 sm:p-2 rounded-full text-foreground hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
            title="Alerts"
            aria-label="Alerts"
          >
            <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" />
          </button>

          {/* Vertical Divider */}
          <div className="h-5 sm:h-6 w-px bg-border-default mx-0.5 shrink-0 hidden sm:block" />

          {/* User Profile Pill & Dropdown */}
          <div ref={userMenuContainerRef} className="relative shrink-0">
            {(() => {
              const userInitials = user
                ? (`${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || 'U')
                : '—';
              const displayName = user
                ? (`${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User')
                : '—';
              const displayEmail = user?.email || '—';
              const roleTitleMap: Record<UserRole, string> = {
                OEM_MANAGER: 'OEM Asset Manager',
                SITE_ADMIN: 'Site Admin',
                OPERATOR: 'Operator',
              };
              const displayRole = user ? roleTitleMap[user.role] : 'Operator';
              const displayCompany = user?.role === 'OEM_MANAGER' ? 'PowerTech Energy' : (user?.company_name || 'Client Workspace');
              const displayRoleCompany = `${displayRole} · ${displayCompany}`;

              return (
                <>
                  <button
                    type="button"
                    onClick={() => setIsUserMenuOpen((prev) => !prev)}
                    className="flex items-center gap-1 sm:gap-2 p-1 rounded-xl hover:bg-surface-muted transition-colors cursor-pointer select-none text-left shrink-0"
                    aria-expanded={isUserMenuOpen}
                  >
                    {/* Soft pink/red avatar circle with dark red initials */}
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary-light text-primary text-xs font-bold flex items-center justify-center shrink-0">
                      {userInitials}
                    </div>
                    <div className="hidden lg:flex flex-col text-left">
                      <span className="text-xs font-bold text-foreground leading-tight">
                        {displayName}
                      </span>
                      <span className="text-[11px] text-foreground-muted leading-tight mt-0.5">
                        {displayRole}
                      </span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-foreground-muted transition-transform duration-150 shrink-0 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu Overlay matching the image */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-1.5rem)] bg-surface-card rounded-2xl border border-border-default shadow-xl py-3 z-50 text-left animate-in fade-in slide-in-from-top-1 duration-150">
                      {/* Top User Identity Section */}
                      <div className="px-4 py-1.5">
                        <div className="text-sm font-bold text-foreground">
                          {displayName}
                        </div>
                        <div className="text-xs text-foreground-muted mt-0.5 truncate">
                          {displayEmail}
                        </div>
                        <div className="text-xs text-foreground-muted mt-0.5 truncate">
                          {displayRoleCompany}
                        </div>
                      </div>

                      <div className="border-t border-border-default my-2" />

                      {/* Menu Items */}
                      <div className="px-1.5 flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            navigate('/profile');
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors cursor-pointer text-left"
                        >
                          <UserIcon className="w-4 h-4 text-foreground" />
                          <span>Profile</span>
                        </button>

                        {isOem && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              navigate('/settings');
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors cursor-pointer text-left"
                          >
                            <Settings className="w-4 h-4 text-foreground" />
                            <span>Settings</span>
                          </button>
                        )}

                        <div
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-foreground select-none pointer-events-none cursor-default text-left"
                        >
                          <div className="flex items-center gap-3">
                            <HelpCircle className="w-4 h-4 text-foreground-body" />
                            <span>FAQ</span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-border-default my-2" />

                      {/* Sign Out Link in Red */}
                      <div className="px-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            logout('manual');
                            navigate('/login?view=signed_out', { replace: true });
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold text-primary hover:bg-primary-light transition-colors cursor-pointer text-left"
                        >
                          <LogOut className="w-4 h-4 text-primary" />
                          <span>Sign out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* FAQ Modal Dialog */}
        {isFaqOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center z-[100] p-4 animate-in fade-in duration-150">
            <div className="bg-surface-card rounded-2xl border border-border-subtle shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-surface-muted">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Foodie Composter Knowledge & FAQ</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFaqOpen(false)}
                  className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {FAQ_ITEMS.map((item) => (
                  <div
                    key={item.q}
                    className="p-3.5 rounded-xl bg-surface-subtle border border-border-default"
                  >
                    <h4 className="font-bold text-foreground text-xs">{item.q}</h4>
                    <p className="text-foreground-muted text-xs mt-1 leading-relaxed">{item.a}</p>
                  </div>
                ))}
              </div>

              <div className="px-6 py-3.5 border-t border-border-subtle bg-surface-muted flex items-center justify-between">
                <span className="text-[11px] text-foreground-dim">PowerTech Energy Operations Support</span>
                <button
                  type="button"
                  onClick={() => setIsFaqOpen(false)}
                  className="px-4 py-2 bg-foreground hover:bg-black text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </header>
    );
  };

