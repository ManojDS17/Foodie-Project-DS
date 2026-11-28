import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  LayoutGrid,
  Zap,
  Bell,
  Leaf,
  Plus,
  UserPlus,
  ArrowRight,
} from 'lucide-react';
import { MetricCard, TelemetryMetricCard } from '../common/MetricCard';
import { FleetEnergyChart, DashboardSidePanels } from './FleetEnergyChart';
import { StatusBadge } from '../common/StatusBadge';
import { AddClientView } from '../clients/AddClientView';
import { AddMachineView } from '../machines/AddMachineView';
import { AddOperatorView } from '../operators/AddOperatorView';
import { Toast, LoadErrorBanner } from '../common/Toast';
import { useAuth, useSilentRefresh } from '../../hooks';
import { dashboardApi, orgsApi, machinesApi } from '../../services/api';
import type { Organization, Machine, DashboardStats } from '../../types';

const fetchOemDashboardBundle = async (signal?: AbortSignal) => {
  const [stats, orgList, machineList] = await Promise.all([
    dashboardApi.getStats(signal),
    orgsApi.getAll(undefined, signal),
    machinesApi.getAll(undefined, signal),
  ]);
  return { stats, orgList, machineList };
};

export const OemDashboardView: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Modals & Drawers state
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isAddMachineOpen, setIsAddMachineOpen] = useState(false);
  const [isAddOperatorOpen, setIsAddOperatorOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

  // Live PostgreSQL & Telemetry Data State
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDashboard = async (signal?: AbortSignal) => {
    try {
      const { stats, orgList, machineList } = await fetchOemDashboardBundle(signal);
      if (signal?.aborted) return;
      setDashboardStats(stats);
      setOrganizations(orgList);
      setMachines(machineList);
      setLoadError(null);
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) return;
      console.error('Error fetching OEM dashboard data:', err);
      setLoadError(err?.message || 'Unable to load dashboard telemetry. Please try again.');
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchOemDashboardBundle(controller.signal)
      .then(({ stats, orgList, machineList }) => {
        if (controller.signal.aborted) return;
        setDashboardStats(stats);
        setOrganizations(orgList);
        setMachines(machineList);
        setLoadError(null);
      })
      .catch((err: any) => {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        console.error('Error fetching OEM dashboard data:', err);
        setLoadError(err?.message || 'Unable to load dashboard telemetry. Please try again.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const handleResetHome = () => {
      setIsAddClientOpen(false);
      setIsAddMachineOpen(false);
      setIsAddOperatorOpen(false);
    };
    window.addEventListener('foodie:reset-home-view', handleResetHome);
    return () => window.removeEventListener('foodie:reset-home-view', handleResetHome);
  }, []);

  useSilentRefresh((signal) => loadDashboard(signal), {
    intervalMs: 12000,
    enabled: !isAddClientOpen && !isAddMachineOpen && !isAddOperatorOpen,
  });

  const handleRetryLoad = () => {
    setIsLoading(true);
    setLoadError(null);
    loadDashboard();
  };

  const recentClients = dashboardStats?.recent_clients || [];
  const attentionMachines = (dashboardStats?.attention_machines || []).slice().sort((a, b) =>
    (b.machine_code || '').localeCompare(a.machine_code || '', undefined, { numeric: true, sensitivity: 'base' })
  );
  const upcomingMaintenance = dashboardStats?.upcoming_maintenance || [];

  if (isAddClientOpen) {
    return (
      <div className="select-none">
        <AddClientView
          existingClients={organizations}
          onBack={() => setIsAddClientOpen(false)}
          onSuccess={(newOrg) => {
            loadDashboard();
            setIsAddClientOpen(false);
            setToast({
              message: `Client ${newOrg.company_name} (${newOrg.client_code}) added successfully!`,
              type: 'success',
            });
          }}
        />
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    );
  }

  if (isAddMachineOpen) {
    return (
      <div className="select-none">
        <AddMachineView
          onBack={() => setIsAddMachineOpen(false)}
          onSuccess={(newMachine) => {
            loadDashboard();
            setIsAddMachineOpen(false);
            setToast({
              message: `Machine ${newMachine.serial_number || newMachine.machine_code} added successfully!`,
              type: 'success',
            });
          }}
        />
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    );
  }

  if (isAddOperatorOpen) {
    return (
      <div className="select-none">
        <AddOperatorView
          existingClients={organizations}
          onBack={() => setIsAddOperatorOpen(false)}
          onSuccess={(newOperator) => {
            loadDashboard();
            setIsAddOperatorOpen(false);
            setToast({
              message: `Operator ${newOperator.first_name} ${newOperator.last_name || ''} registered successfully!`,
              type: 'success',
            });
          }}
        />
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-[1400px] w-full min-w-0 mx-auto pb-10">
      {/* Top Welcome Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            Welcome, {user ? `${user.first_name} ${user.last_name}` : 'PowerTech Admin'}
          </h1>
        </div>

        {/* Action Buttons: + Add client & + Add machine & + Add operator */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => setIsAddClientOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-border-strong bg-white text-foreground hover:bg-surface-muted transition-all cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-foreground" />
            <span>Add client</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddMachineOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-border-strong bg-white text-foreground hover:bg-surface-muted transition-all cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-foreground" />
            <span>Add machine</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddOperatorOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-primary hover:bg-primary-hover text-white transition-all cursor-pointer shadow-2xs"
          >
            <UserPlus className="w-3.5 h-3.5 text-white" />
            <span>Add operator</span>
          </button>
        </div>
      </div>

      {loadError && <LoadErrorBanner message={loadError} onRetry={handleRetryLoad} />}

      {/* 5 Top Metric Cards Row (Live computed PostgreSQL aggregates) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <MetricCard
          id="metric-clients"
          title="Clients"
          value={dashboardStats ? dashboardStats.total_clients : organizations.length}
          subtitle={
            dashboardStats
              ? `${dashboardStats.clients_onboarded_this_month} onboarded this month`
              : 'All active accounts'
          }
          icon={Users}
          onClick={() => navigate('/clients')}
        />

        <MetricCard
          id="metric-machines"
          title="Machines"
          value={dashboardStats ? dashboardStats.total_machines : machines.length}
          subtitle={
            dashboardStats
              ? `${dashboardStats.online_machines} online · ${dashboardStats.offline_machines} offline`
              : 'Fleet status'
          }
          icon={LayoutGrid}
          onClick={() => navigate('/machines')}
        />

        <TelemetryMetricCard
          id="metric-energy"
          title="Energy consumed"
          telemetryConnected={dashboardStats?.telemetry_connected}
          value={dashboardStats?.energy_consumed_today_kwh}
          unit="kWh"
          connectedSubtitle="Today, all machines"
          icon={Zap}
        />

        <MetricCard
          id="metric-alerts"
          title="Open alerts"
          value={dashboardStats ? dashboardStats.open_alerts_count : 0}
          valueColor="text-primary"
          subtitle={
            dashboardStats && dashboardStats.open_alerts_count > 0
              ? `Across ${dashboardStats.alert_clients_count} client${dashboardStats.alert_clients_count === 1 ? '' : 's'}`
              : 'No active alerts reported'
          }
          icon={Bell}
          iconVariant="danger"
        />

        <TelemetryMetricCard
          id="metric-waste"
          title="Waste intake"
          telemetryConnected={dashboardStats?.telemetry_connected}
          value={dashboardStats?.waste_intake_today_kg}
          unit="kg"
          connectedSubtitle="Today, all machines"
          icon={Leaf}
          iconVariant="success"
        />
      </div>

      {/* Main 2-Column Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (67% Width): Energy usage + Recently onboarded clients */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          {/* 1. Live 14-Day Fleet Energy Usage Smooth Area Curve Chart */}
          <FleetEnergyChart data={dashboardStats?.energy_history_14d || []} />

          {/* 2. Recently Onboarded Clients Table (Live from PostgreSQL) */}
          <div className="bg-white rounded-xl border border-border-subtle p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-surface-hover">
              <h2 className="text-sm font-bold text-foreground">
                Recently onboarded clients
              </h2>
              <button
                type="button"
                onClick={() => navigate('/clients')}
                className="group text-xs font-bold text-primary flex items-center gap-1 cursor-pointer"
              >
                <span className="group-hover:underline">All clients</span>
                <ArrowRight className="w-3.5 h-3.5 inline-block shrink-0 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>

            <div className="overflow-x-auto mt-2">
              {recentClients.length === 0 ? (
                <div className="py-8 text-center text-foreground-dim text-xs">
                  {isLoading
                    ? 'Loading live clients...'
                    : 'No clients onboarded yet. Click "Add client" above to onboard your first client.'}
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs min-w-[520px]">
                  <thead>
                    <tr className="border-b border-border-default text-[11px] font-bold text-foreground-muted">
                      <th className="py-2.5 px-3 font-semibold">Client ID</th>
                      <th className="py-2.5 px-3 font-semibold">Company name</th>
                      <th className="py-2.5 px-3 font-semibold">Onboarding date</th>
                      <th className="py-2.5 px-3 font-semibold">Machines</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-hover">
                    {recentClients.map((client) => (
                      <tr
                        key={client.id}
                        onClick={() => navigate(`/clients?select=${client.id}`)}
                        className="hover:bg-surface-muted transition-colors cursor-pointer"
                      >
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-primary underline hover:text-primary-hover">
                            {client.client_code}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-foreground">
                          {client.company_name}
                        </td>
                        <td className="py-2.5 px-3 text-foreground-muted">
                          {client.onboard_date}
                        </td>
                        <td className="py-2.5 px-3 text-foreground font-medium">
                          {client.machines_count}
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge
                            status={client.status?.toLowerCase() === 'inactive' ? 'inactive' : 'active'}
                            label={client.status}
                            size="sm"
                            bordered
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (33% Width): Machines needing attention + Upcoming maintenance */}
        <DashboardSidePanels
          totalMachines={machines.length}
          attentionMachines={attentionMachines}
          upcomingMaintenance={upcomingMaintenance}
          showClientInSubtitle={true}
          attentionActionLabel="All machines"
          onAttentionAction={() => navigate('/machines')}
          onNavigateMachine={(id) => navigate(id ? `/machines?select=${id}` : '/machines')}
          emptyMachinesMessage="No machines currently in fleet."
          healthyMachinesMessage="✓ All machines operating normally. No active alerts."
        />
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

