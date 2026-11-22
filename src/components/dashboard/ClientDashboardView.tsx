import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Zap,
  Bell,
  Leaf,
  Cpu,
  RefreshCw,
  Eye,
  ArrowRight,
} from 'lucide-react';
import { MetricCard } from '../common/MetricCard';
import { FleetEnergyChart } from './FleetEnergyChart';
import { MachineDetailView } from '../machines/MachineDetailView';
import { RowActionMenu } from '../common/RowActionMenu';
import { useAuth } from '../../context/AuthContext';
import { useSilentRefresh } from '../../hooks';
import { dashboardApi, machinesApi } from '../../services/api';
import type { Machine, DashboardStats } from '../../types';

export const ClientDashboardView: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOperator = user?.role === 'OPERATOR';

  // State
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const fetchData = async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      const [stats, machineList] = await Promise.all([
        dashboardApi.getStats().catch((err) => {
          console.error('Failed to load client stats:', err);
          return null;
        }),
        machinesApi.getAll().catch((err) => {
          console.error('Failed to load client machines:', err);
          return [];
        }),
      ]);

      if (stats) setDashboardStats(stats);
      setMachines(
        [...machineList].sort((a, b) => {
          const dateA = new Date(a.created_at || '').getTime() || 0;
          const dateB = new Date(b.created_at || '').getTime() || 0;
          if (dateB !== dateA) return dateB - dateA;
          return (b.machine_code || '').localeCompare(a.machine_code || '', undefined, { numeric: true });
        })
      );
    } catch (err) {
      console.error('Error fetching client dashboard data:', err);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData(false);
  }, []);

  useSilentRefresh(() => fetchData(true), {
    intervalMs: 12000,
    enabled: !selectedMachine,
  });

  const totalMachines = machines.length;

  const formatMachineLocation = (machine: Machine): string => {
    if (machine.lease_location_label && machine.lease_location_label.trim()) {
      return machine.lease_location_label.trim();
    }
    return '—';
  };

  const runningMachines = machines.filter(
    (m) => (m.operational_status || '').toLowerCase() === 'running'
  ).length;
  const idleMachines = machines.filter(
    (m) => (m.operational_status || '').toLowerCase() === 'idle'
  ).length;
  const haltedMachines = machines.filter((m) => {
    const s = (m.operational_status || '').toLowerCase();
    return s === 'halted' || s === 'fault' || s === 'offline' || s === 'maintenance';
  }).length;

  const attentionMachines = dashboardStats?.attention_machines || [];
  const upcomingMaintenance = dashboardStats?.upcoming_maintenance || [];
  const openAlerts = dashboardStats?.open_alerts_count || 0;

  if (selectedMachine) {
    return (
      <div className="select-none">
        <MachineDetailView
          machine={selectedMachine}
          onBack={() => setSelectedMachine(null)}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-[1400px] w-full min-w-0 mx-auto pb-10">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-b border-border-subtle pb-4 min-w-0">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-foreground tracking-tight">
            Welcome, {user?.first_name ? `${user.first_name}` : (user?.company_name || 'Operator')}
          </h1>
          <p className="text-xs text-foreground-muted mt-0.5">
            {user?.company_name ? `${user.company_name} · Operations Overview` : 'Operations Overview'}
          </p>
        </div>
      </div>

      {/* 4 Top Metric Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
        <MetricCard
          id="client-metric-machines"
          title="Machines"
          value={totalMachines}
          subtitle={`${runningMachines} running · ${idleMachines} idle · ${haltedMachines} halted`}
          icon={LayoutGrid}
          onClick={() => navigate('/machines')}
        />

        <MetricCard
          id="client-metric-energy"
          title="Energy consumed"
          value={dashboardStats ? dashboardStats.energy_consumed_today_kwh.toLocaleString() : '0'}
          unit="kWh"
          subtitle="Today, my machines"
          icon={Zap}
        />

        <MetricCard
          id="client-metric-alerts"
          title="Open alerts"
          value={openAlerts}
          valueColor="text-primary"
          subtitle="Last updated 30 min ago"
          icon={Bell}
          iconVariant="danger"
          onClick={() => navigate('/alerts')}
        />

        <MetricCard
          id="client-metric-output"
          title="Output produced"
          value={dashboardStats ? dashboardStats.compost_produced_today_kg.toLocaleString() : '0'}
          unit="kg"
          subtitle="Load cell · last 30 min"
          icon={Leaf}
          iconVariant="success"
        />
      </div>

      {/* Main 2-Column Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (8 cols): Energy Chart & Assigned Machines */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          {/* 1. Live Energy Usage Chart */}
          <FleetEnergyChart data={dashboardStats?.energy_history_14d || []} />

          {/* 2. Machines Main Card */}
          <div className="bg-white rounded-xl border border-border-subtle p-3.5 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-surface-hover">
              <h2 className="text-sm font-bold text-foreground">
                Machines
              </h2>
              <button
                type="button"
                onClick={() => navigate('/machines')}
                className="group text-xs font-bold text-primary flex items-center gap-1 cursor-pointer"
              >
                <span className="group-hover:underline">All machines</span>
                <ArrowRight className="w-3.5 h-3.5 inline-block shrink-0 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>

            {isLoading ? (
              <div className="py-8 text-center text-foreground-dim text-xs flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                <span>Loading assigned equipment...</span>
              </div>
            ) : machines.length === 0 ? (
              <div className="py-10 text-center text-xs">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-foreground-dim">
                  <Cpu className="w-5 h-5" />
                </div>
                <p className="font-bold text-foreground">No composter units assigned yet</p>
                <p className="text-foreground-dim mt-1 max-w-sm mx-auto">
                  PowerTech Energy is provisioning equipment for your facility.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile View: Dedicated Equipment Cards (< md) */}
                <div className="md:hidden divide-y divide-surface-hover mt-1">
                  {machines.map((m) => {
                    const opStatus = m.operational_status || 'Idle';
                    const batches = (m as any).total_batches ?? '—';

                    return (
                      <div
                        key={m.id}
                        className="py-3.5 hover:bg-surface-muted transition-colors rounded-xl flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <button
                              type="button"
                              onClick={() => setSelectedMachine(m)}
                              className="font-mono font-bold text-sm text-primary underline hover:text-primary-hover cursor-pointer"
                            >
                              {m.machine_code || m.serial_number}
                            </button>
                            <div className="text-xs font-semibold text-foreground mt-0.5">
                              {m.model} · {m.capacity || '25 kg/day'}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                opStatus === 'Running'
                                  ? 'bg-status-running-bg text-status-running-text border-status-running-dot/30'
                                  : opStatus === 'Idle'
                                  ? 'bg-status-idle-bg text-status-idle-text border-status-idle-dot/30'
                                  : 'bg-red-50 text-primary border-red-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  opStatus === 'Running'
                                    ? 'bg-status-running-dot'
                                    : opStatus === 'Idle'
                                    ? 'bg-amber-500'
                                    : 'bg-primary'
                                }`}
                              />
                              <span>{opStatus}</span>
                            </span>
                            <RowActionMenu
                              isOpen={activeMenuId === `mob-${m.id}`}
                              onToggle={() =>
                                setActiveMenuId(activeMenuId === `mob-${m.id}` ? null : `mob-${m.id}`)
                              }
                              onClose={() => setActiveMenuId(null)}
                              width="w-40"
                              buttonAriaLabel={`Actions for ${m.machine_code || m.serial_number}`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setSelectedMachine(m);
                                }}
                                className="w-full px-3.5 py-2 text-left text-xs font-semibold text-foreground hover:bg-surface-muted flex items-center gap-2 cursor-pointer transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5 text-foreground-muted" />
                                <span>View machine</span>
                              </button>
                            </RowActionMenu>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-foreground-muted pt-0.5">
                          <span>Location: <strong className="text-foreground">{formatMachineLocation(m)}</strong></span>
                          {isOperator && (
                            <span>Total batches: <strong className="text-foreground">{batches}</strong></span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop / Tablet View: Full Data Table (>= md) */}
                <div className="hidden md:block overflow-x-auto mt-2">
                  <table className="w-full text-left border-collapse text-xs min-w-[650px]">
                    <thead>
                      <tr className="border-b border-border-default text-[11px] font-bold text-foreground-muted">
                        <th className="py-2.5 px-3 font-semibold">Serial Number</th>
                        <th className="py-2.5 px-3 font-semibold">Model</th>
                        {isOperator && (
                          <th className="py-2.5 px-3 font-semibold">Total batches</th>
                        )}
                        <th className="py-2.5 px-3 font-semibold">Location</th>
                        <th className="py-2.5 px-3 font-semibold">Machine status</th>
                        <th className="py-2.5 px-3 font-semibold text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-hover">
                      {machines.map((m) => {
                        const opStatus = m.operational_status || 'Idle';
                        const batches = (m as any).total_batches ?? '—';

                        return (
                          <tr
                            key={m.id}
                            className="hover:bg-surface-muted transition-colors"
                          >
                            <td className="py-2.5 px-3 font-mono font-bold">
                              <button
                                type="button"
                                onClick={() => setSelectedMachine(m)}
                                className="text-primary underline hover:text-primary-hover cursor-pointer"
                              >
                                {m.machine_code || m.serial_number}
                              </button>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-foreground">{m.model}</div>
                              <div className="text-[11px] text-foreground-muted">{m.capacity || '25 kg/day'}</div>
                            </td>
                            {isOperator && (
                              <td className="py-2.5 px-3 font-semibold text-foreground">
                                {batches}
                              </td>
                            )}
                            <td className="py-2.5 px-3 text-foreground">
                              {formatMachineLocation(m)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                                  opStatus === 'Running'
                                    ? 'bg-status-running-bg text-status-running-text border-status-running-dot/30'
                                    : opStatus === 'Idle'
                                    ? 'bg-status-idle-bg text-status-idle-text border-status-idle-dot/30'
                                    : 'bg-red-50 text-primary border-red-200'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    opStatus === 'Running'
                                      ? 'bg-status-running-dot'
                                      : opStatus === 'Idle'
                                      ? 'bg-amber-500'
                                      : 'bg-primary'
                                  }`}
                                />
                                <span>{opStatus}</span>
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center">
                                <RowActionMenu
                                  isOpen={activeMenuId === m.id}
                                  onToggle={() =>
                                    setActiveMenuId(activeMenuId === m.id ? null : m.id)
                                  }
                                  onClose={() => setActiveMenuId(null)}
                                  width="w-40"
                                  buttonAriaLabel={`Actions for ${m.machine_code || m.serial_number}`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      setSelectedMachine(m);
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-foreground hover:bg-surface-muted flex items-center gap-2 cursor-pointer transition-colors"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-foreground-muted" />
                                    <span>View machine</span>
                                  </button>
                                </RowActionMenu>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Attention Items & Maintenance Card */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* 1. Machines Needing Attention */}
          <div className="bg-white rounded-xl border border-border-subtle p-3.5 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-surface-hover">
              <h2 className="text-sm font-bold text-foreground">
                Machines needing attention
              </h2>
              <button
                type="button"
                onClick={() => navigate('/alerts')}
                className="group text-xs font-bold text-primary flex items-center gap-1 cursor-pointer"
              >
                <span className="group-hover:underline">Alerts</span>
                <ArrowRight className="w-3.5 h-3.5 inline-block shrink-0 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>

            {totalMachines === 0 ? (
              <div className="py-6 text-center text-xs text-foreground-muted bg-surface-muted rounded-xl border border-border-default my-2">
                No machines are currently assigned.
              </div>
            ) : attentionMachines.length === 0 ? (
              <div className="py-6 text-center text-xs text-status-running-text bg-emerald-50/50 rounded-xl border border-emerald-100 my-2">
                ✓ All assigned machines operating normally. No active alerts.
              </div>
            ) : (
              <div className="divide-y divide-surface-hover mt-1">
                {attentionMachines.map((m) => (
                  <div key={m.id} className="py-3 flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/machines?select=${m.id}`)}
                        className="font-bold text-primary underline hover:text-primary-hover block text-left cursor-pointer"
                      >
                        {m.machine_code}
                      </button>
                      <div className="text-[11px] text-foreground-muted mt-0.5 truncate">
                        {m.issue}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-primary border border-red-200 shrink-0">
                      {m.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Upcoming Maintenance */}
          <div className="bg-white rounded-xl border border-border-subtle p-3.5 sm:p-5 shadow-xs">
              <div className="pb-3 border-b border-surface-hover">
                <h2 className="text-sm font-bold text-foreground">
                  Upcoming maintenance
                </h2>
              </div>

              {upcomingMaintenance.length === 0 ? (
                <div className="py-6 text-center text-xs text-foreground-dim bg-gray-50/50 rounded-xl border border-gray-100 my-2">
                  No maintenance scheduled for the next 30 days.
                </div>
              ) : (
                <div className="divide-y divide-surface-hover mt-1">
                  {upcomingMaintenance.map((item) => (
                    <div key={item.id} className="py-3 flex items-center justify-between text-xs">
                      <div className="min-w-0 pr-2">
                        <button
                          type="button"
                          onClick={() => navigate('/machines')}
                          className="font-bold text-primary underline hover:text-primary-hover block text-left cursor-pointer"
                        >
                          {item.machine_code}
                        </button>
                        <div className="text-[11px] text-foreground-muted mt-0.5 truncate">
                          {item.task}
                        </div>
                      </div>

                      <span className="text-[11px] font-bold text-foreground shrink-0">
                        {item.date}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
};
