import React from 'react';
import { Archive, Download, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import type { Organization } from '../../types';
import { Button } from '../common/ui';

export interface ClientListToolbarProps {
  searchQuery: string;
  statusFilter: string;
  businessTypeFilter: string;
  locationFilter: string;
  showMoreFilters: boolean;
  machineFilter: 'All' | 'WithMachines' | 'NoMachines';
  uniqueLocations: string[];
  selectedIds: string[];
  organizations: Organization[];
  onSearchChange: (q: string) => void;
  onStatusChange: (status: string) => void;
  onBusinessTypeChange: (type: string) => void;
  onLocationChange: (loc: string) => void;
  onToggleMoreFilters: () => void;
  onMachineFilterChange: (filter: 'All' | 'WithMachines' | 'NoMachines') => void;
  onResetFilters: () => void;
  onClearSelection: () => void;
  onBulkExport: () => void;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
}

export const ClientListToolbar: React.FC<ClientListToolbarProps> = ({
  searchQuery,
  statusFilter,
  businessTypeFilter,
  locationFilter,
  showMoreFilters,
  machineFilter,
  uniqueLocations,
  selectedIds,
  organizations,
  onSearchChange,
  onStatusChange,
  onBusinessTypeChange,
  onLocationChange,
  onToggleMoreFilters,
  onMachineFilterChange,
  onResetFilters,
  onClearSelection,
  onBulkExport,
  onBulkArchive,
  onBulkDelete,
}) => (
  <>
    <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
      <div className="relative flex-1 min-w-[240px]">
        <Search className="w-4 h-4 text-foreground-dim absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search client ID, company or contact"
          className="w-full bg-surface-subtle border border-border-subtle rounded-xl pl-9 pr-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-foreground focus:bg-white transition-colors"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-dim hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground-muted font-medium whitespace-nowrap">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="bg-white border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-foreground cursor-pointer min-w-[90px]"
          >
            <option value="All">All</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground-muted font-medium whitespace-nowrap">Business type</span>
          <select
            value={businessTypeFilter}
            onChange={(e) => onBusinessTypeChange(e.target.value)}
            className="bg-white border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-foreground cursor-pointer min-w-[100px]"
          >
            <option value="All">All</option>
            <option value="Corporate">Corporate</option>
            <option value="Individual">Individual</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground-muted font-medium whitespace-nowrap">Location</span>
          <select
            value={locationFilter}
            onChange={(e) => onLocationChange(e.target.value)}
            className="bg-white border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-foreground cursor-pointer max-w-[180px] truncate"
          >
            <option value="All locations">All locations</option>
            {uniqueLocations.map((loc) => (
              <option key={loc} value={loc}>
                {loc.length > 25 ? loc.slice(0, 25) + '...' : loc}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onToggleMoreFilters}
          aria-expanded={showMoreFilters}
          className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold transition-colors cursor-pointer select-none ${
            showMoreFilters || machineFilter !== 'All'
              ? 'border-primary bg-primary-light text-primary'
              : 'border-border-subtle bg-white hover:bg-surface-subtle text-foreground'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>More filters</span>
        </button>
      </div>
    </div>

    {showMoreFilters && (
      <div className="pt-3 mt-3 border-t border-surface-hover flex flex-wrap items-center gap-4 text-xs animate-in slide-in-from-top-2 duration-200">
        <div className="flex items-center gap-2">
          <span className="text-foreground-muted font-medium">Fleet assignment:</span>
          <div className="flex items-center gap-1.5">
            {[
              { value: 'All', label: 'All clients' },
              { value: 'WithMachines', label: 'With machines' },
              { value: 'NoMachines', label: 'No machines' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  onMachineFilterChange(opt.value as 'All' | 'WithMachines' | 'NoMachines')
                }
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                  machineFilter === opt.value
                    ? 'bg-primary text-white'
                    : 'bg-surface-hover text-foreground-body hover:bg-border-default'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {(searchQuery ||
          statusFilter !== 'All' ||
          businessTypeFilter !== 'All' ||
          locationFilter !== 'All locations' ||
          machineFilter !== 'All') && (
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

    {selectedIds.length > 0 && (
      <div className="bg-primary-light border border-primary-border rounded-xl p-3 sm:px-4 sm:py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs my-4 animate-in fade-in duration-150">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-4 h-4 rounded bg-primary text-white flex items-center justify-center text-[10px] font-bold shrink-0">
              ✓
            </span>
            <span className="font-bold text-foreground truncate">
              {selectedIds.length === 1
                ? `1 client selected · ${organizations.find((o) => o.id === selectedIds[0])?.company_name || 'Client'}`
                : `${selectedIds.length} clients selected`}
            </span>
          </div>
          <button
            type="button"
            onClick={onClearSelection}
            className="text-primary underline font-bold hover:text-primary-hover cursor-pointer whitespace-nowrap shrink-0"
          >
            Clear selection
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onBulkExport}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            Export data
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={onBulkArchive}
            leftIcon={<Archive className="w-3.5 h-3.5" />}
          >
            {statusFilter === 'Inactive' ? 'Active' : 'Inactive'}
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={onBulkDelete}
            leftIcon={<Trash2 className="w-3.5 h-3.5 text-primary" />}
          >
            Delete
          </Button>
        </div>
      </div>
    )}
  </>
);

