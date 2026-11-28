import React from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import type { Organization } from '../../types';

export interface MachineListToolbarProps {
  isOem: boolean;
  searchQuery: string;
  statusFilter: string;
  clientFilter: string;
  locationFilter: string;
  showMoreFilters: boolean;
  modelFilter: string;
  organizations: Organization[];
  uniqueLocations: string[];
  onSearchChange: (q: string) => void;
  onStatusChange: (status: string) => void;
  onClientChange: (client: string) => void;
  onLocationChange: (loc: string) => void;
  onToggleMoreFilters: () => void;
  onModelFilterChange: (model: string) => void;
  onResetFilters: () => void;
}

export const MachineListToolbar: React.FC<MachineListToolbarProps> = ({
  isOem,
  searchQuery,
  statusFilter,
  clientFilter,
  locationFilter,
  showMoreFilters,
  modelFilter,
  organizations,
  uniqueLocations,
  onSearchChange,
  onStatusChange,
  onClientChange,
  onLocationChange,
  onToggleMoreFilters,
  onModelFilterChange,
  onResetFilters,
}) => (
  <div className="bg-white rounded-xl border border-border-subtle p-3 shadow-xs flex flex-col gap-3">
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div className="relative flex-1">
        <Search className="w-4 h-4 text-foreground-subtle absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search serial number, client or model"
          className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-border-default bg-surface-muted text-foreground placeholder:text-foreground-subtle text-xs focus:outline-none focus:border-foreground focus:bg-white transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-subtle hover:text-foreground cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-foreground-muted font-medium text-[11px]">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-border-default bg-white text-foreground font-semibold text-xs cursor-pointer focus:outline-none focus:border-foreground"
          >
            <option value="All">All</option>
            <option value="Running">Running</option>
            <option value="Idle">Idle</option>
            <option value="Maintenance">Maintenance</option>
          </select>
        </div>

        {isOem && (
          <div className="flex items-center gap-1.5">
            <span className="text-foreground-muted font-medium text-[11px]">Client</span>
            <select
              value={clientFilter}
              onChange={(e) => onClientChange(e.target.value)}
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

        <div className="flex items-center gap-1.5">
          <span className="text-foreground-muted font-medium text-[11px]">Location</span>
          <select
            value={locationFilter}
            onChange={(e) => onLocationChange(e.target.value)}
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

        <button
          type="button"
          onClick={onToggleMoreFilters}
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

    {showMoreFilters && (
      <div className="pt-3 border-t border-surface-hover flex flex-wrap items-center gap-4 text-xs animate-in slide-in-from-top-2 duration-200">
        <div className="flex items-center gap-2">
          <span className="text-foreground-muted font-medium">Model filter:</span>
          <div className="flex items-center gap-1.5">
            {['All', 'Foodie F25', 'Foodie F100', 'Foodie F500', 'Foodie F1000'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onModelFilterChange(m)}
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
            onClick={onResetFilters}
            className="text-xs text-primary font-semibold hover:underline cursor-pointer ml-auto"
          >
            Reset all filters
          </button>
        )}
      </div>
    )}
  </div>
);

