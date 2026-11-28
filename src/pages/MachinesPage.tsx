import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../hooks';
import { AddMachineView } from '../components/machines/AddMachineView';
import { MachineDetailView } from '../components/machines/MachineDetailView';
import { EditMachineView } from '../components/machines/EditMachineView';
import { DeleteMachineModal } from '../components/machines/DeleteMachineModal';
import { MachineListToolbar } from '../components/machines/MachineListToolbar';
import { MachineTable } from '../components/machines/MachineTable';
import { useMachinesList } from '../components/machines/useMachinesList';
import { Button } from '../components/common/ui';
import { Toast, LoadErrorBanner } from '../components/common/Toast';
import type { Machine } from '../types';

export const MachinesPage: React.FC = () => {
  const { user } = useAuth();
  const isOem = user?.role === 'OEM_MANAGER';
  const isOperator = user?.role === 'OPERATOR';

  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isAddMachineOpen, setIsAddMachineOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [deletingMachine, setDeletingMachine] = useState<Machine | null>(null);

  const list = useMachinesList({ isOem, onToast: setToast });
  const { targetMachineParam, setSelectedMachine, setSearchParams } = list;

  const [prevTargetParam, setPrevTargetParam] = useState<string | null>(targetMachineParam);
  if (targetMachineParam !== prevTargetParam) {
    setPrevTargetParam(targetMachineParam);
    if (targetMachineParam) {
      setIsAddMachineOpen(false);
      setEditingMachine(null);
      setDeletingMachine(null);
    }
  }

  useEffect(() => {
    const handleResetView = () => {
      setSelectedMachine(null);
      setEditingMachine(null);
      setIsAddMachineOpen(false);
      setDeletingMachine(null);
      setSearchParams({});
    };

    window.addEventListener('foodie:reset-machines-view', handleResetView);
    return () => window.removeEventListener('foodie:reset-machines-view', handleResetView);
  }, [setSelectedMachine, setSearchParams]);

  if (isAddMachineOpen) {
    return (
      <div className="select-none">
        <AddMachineView
          onBack={() => setIsAddMachineOpen(false)}
          onSuccess={(newMachine) => {
            list.setMachines((prev) => [newMachine, ...prev]);
            setIsAddMachineOpen(false);
            setToast({
              message: `Machine ${newMachine.serial_number || newMachine.machine_code} added successfully!`,
              type: 'success',
            });
          }}
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  if (editingMachine) {
    return (
      <div className="select-none">
        <EditMachineView
          machine={editingMachine}
          organizations={list.organizations}
          onBack={() => setEditingMachine(null)}
          onSuccess={(updated) => {
            list.setMachines((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
            if (list.selectedMachine && list.selectedMachine.id === updated.id) {
              list.setSelectedMachine(updated);
            }
            setEditingMachine(null);
            setToast({
              message: `Machine ${updated.serial_number || updated.machine_code} updated successfully!`,
              type: 'success',
            });
          }}
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  if (list.selectedMachine) {
    return (
      <div className="select-none">
        <MachineDetailView
          machine={list.selectedMachine}
          onBack={() => {
            list.setSelectedMachine(null);
            list.setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.delete('select');
              next.delete('serial');
              return next;
            });
          }}
          onEdit={(m) => setEditingMachine(m)}
          onDelete={(m) => setDeletingMachine(m)}
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <DeleteMachineModal
          isOpen={!!deletingMachine}
          machine={deletingMachine}
          onClose={() => setDeletingMachine(null)}
          onConfirm={() => list.deleteMachine(deletingMachine, () => setDeletingMachine(null))}
          isDeleting={list.isDeleting}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-[1400px] mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            {isOem ? 'All machines' : 'My machines'}
          </h1>
          <p className="text-xs text-foreground-dim mt-0.5">
            {isOem
              ? 'Every Foodie machine across all clients.'
              : `Commercial composter units assigned to ${user?.company_name || 'your facility'}.`}
          </p>
        </div>

        {isOem && (
          <div className="flex items-center gap-2.5">
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsAddMachineOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5 text-white" />}
            >
              Add machine
            </Button>
          </div>
        )}
      </div>

      {list.loadError && (
        <LoadErrorBanner message={list.loadError} onRetry={() => list.fetchData(true)} />
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-xl border border-border-subtle p-4 flex items-center shadow-xs">
          <span className="text-2xl font-extrabold text-foreground tracking-tight">
            {list.totalCount}
          </span>
          <span className="text-xs text-foreground-muted font-medium ml-2.5">Machines</span>
        </div>

        <div className="bg-white rounded-xl border border-border-subtle p-4 flex items-center shadow-xs">
          <span className="text-2xl font-extrabold text-foreground tracking-tight">
            {list.runningCount}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-status-running-bg text-status-running-text border border-status-running-dot/30 ml-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-status-running-dot" />
            <span>Running</span>
          </span>
        </div>

        <div className="bg-white rounded-xl border border-border-subtle p-4 flex items-center shadow-xs">
          <span className="text-2xl font-extrabold text-foreground tracking-tight">
            {list.idleCount}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-status-idle-bg text-status-idle-text border border-status-idle-dot/30 ml-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Idle</span>
          </span>
        </div>

        <div className="bg-white rounded-xl border border-border-subtle p-4 flex items-center shadow-xs">
          <span className="text-2xl font-extrabold text-foreground tracking-tight">
            {list.maintenanceCount}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-status-maint-bg text-status-maint-text border border-status-maint-dot/30 ml-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>Maintenance</span>
          </span>
        </div>
      </div>

      <MachineListToolbar
        isOem={isOem}
        searchQuery={list.searchQuery}
        statusFilter={list.statusFilter}
        clientFilter={list.clientFilter}
        locationFilter={list.locationFilter}
        showMoreFilters={list.showMoreFilters}
        modelFilter={list.modelFilter}
        organizations={list.organizations}
        uniqueLocations={list.uniqueLocations}
        onSearchChange={(q) => {
          list.setSearchQuery(q);
          list.setCurrentPage(1);
        }}
        onStatusChange={(s) => {
          list.setStatusFilter(s);
          list.setCurrentPage(1);
        }}
        onClientChange={(c) => {
          list.setClientFilter(c);
          list.setCurrentPage(1);
        }}
        onLocationChange={(l) => {
          list.setLocationFilter(l);
          list.setCurrentPage(1);
        }}
        onToggleMoreFilters={() => list.setShowMoreFilters((prev) => !prev)}
        onModelFilterChange={(m) => {
          list.setModelFilter(m);
          list.setCurrentPage(1);
        }}
        onResetFilters={list.resetAllFilters}
      />

      <MachineTable
        machines={list.paginatedMachines}
        isLoading={list.isLoading}
        isOem={isOem}
        isOperator={isOperator}
        activeMenuId={activeMenuId}
        currentPage={list.currentPage}
        totalPages={list.totalPages}
        rowsPerPage={list.rowsPerPage}
        totalItems={list.totalItems}
        startIndex={list.startIndex}
        endIndex={list.endIndex}
        onToggleMenu={setActiveMenuId}
        onSelectMachine={list.handleSelectMachine}
        onEditMachine={setEditingMachine}
        onDeleteMachine={setDeletingMachine}
        onPageChange={list.setCurrentPage}
        onRowsPerPageChange={(val) => {
          list.setRowsPerPage(val);
          list.setCurrentPage(1);
        }}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <DeleteMachineModal
        isOpen={!!deletingMachine}
        machine={deletingMachine}
        onClose={() => setDeletingMachine(null)}
        onConfirm={() => list.deleteMachine(deletingMachine, () => setDeletingMachine(null))}
        isDeleting={list.isDeleting}
      />
    </div>
  );
};
