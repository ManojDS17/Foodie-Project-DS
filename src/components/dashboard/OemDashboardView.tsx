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
import { MetricCard } from '../common/MetricCard';
import { FleetEnergyChart } from './FleetEnergyChart';
import { AddClientView } from '../clients/AddClientView';
import { AddMachineView } from '../machines/AddMachineView';
import { AddOperatorView } from '../operators/AddOperatorView';
import { Toast } from '../common/Toast';
import { useAuth } from '../../context/AuthContext';
import { useSilentRefresh } from '../../hooks';
import { dashboardApi, orgsApi, machinesApi } from '../../services/api';
import type { Organization, Machine, DashboardStats } from '../../types';

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

  const fetchData = async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      const [stats, orgList, machineList] = await Promise.all([
        dashboardApi.getStats().catch((err) => {
          console.error('Failed to load live dashboard stats:', err);
          return null;
        }),
        orgsApi.getAll().catch(() => []),
        machinesApi.getAll().catch(() => []),
      ]);

      if (stats) setDashboardStats(stats);
      setOrganizations(orgList);
      setMachines(machineList);
    } catch (err) {
      console.error('Error fetching OEM dashboard data:', err);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData(false);
  }, []);

  useSilentRefresh(() => fetchData(true), {
    intervalMs: 12000,
    enabled: !isAddClientOpen && !isAddMachineOpen && !isAddOperatorOpen,
  });

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
            fetchData();
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
            fetchData();
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
            fetchData();
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
          <p className="text-xs text-foreground-dim mt-0.5">
            Fleet overview across all clients · Live database &amp; telemetry
          </p>
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

        <MetricCard
          id="metric-energy"
          title="Energy consumed"
          value={dashboardStats ? dashboardStats.energy_consumed_today_kwh.toLocaleString() : '0'}
          unit="kWh"
          subtitle="Today, all machines"
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
              : 'All systems normal'
          }
          icon={Bell}
          iconVariant="danger"
        />

        <MetricCard
          id="metric-waste"
          title="Waste intake"
          value={dashboardStats ? dashboardStats.waste_intake_today_kg.toLocaleString() : '0'}
          unit="kg"
          subtitle="Load cell · today, all machines"
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
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-status-running-dot" />
                            <span>{client.status}</span>
                          </span>
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
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* 1. Machines Needing Attention (Live alerts & connectivity) */}
          <div className="bg-white rounded-xl border border-border-subtle p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-surface-hover">
              <h2 className="text-sm font-bold text-foreground">
                Machines needing attention
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

            {machines.length === 0 ? (
              <div className="py-6 text-center text-xs text-foreground-muted bg-surface-muted rounded-lg border border-border-default my-2">
                No machines currently in fleet.
              </div>
            ) : attentionMachines.length === 0 ? (
              <div className="py-6 text-center text-xs text-status-running-text bg-emerald-50/50 rounded-lg border border-emerald-100 my-2">
                ✓ All machines operating normally. No active alerts.
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
                        {m.client} · {m.issue}
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0 ${
                        m.variant === 'offline'
                          ? 'bg-slate-100 text-foreground-body border-slate-200'
                          : m.variant === 'high' || m.variant === 'danger'
                          ? 'bg-red-50 text-primary border-red-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          m.variant === 'offline'
                            ? 'bg-foreground-subtle'
                            : m.variant === 'high' || m.variant === 'danger'
                            ? 'bg-primary'
                            : 'bg-amber-500'
                        }`}
                      />
                      <span>{m.status}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Upcoming Maintenance (Live from maintenance_schedules table) */}
          <div className="bg-white rounded-xl border border-border-subtle p-5 shadow-xs">
            <div className="pb-3 border-b border-surface-hover">
              <h2 className="text-sm font-bold text-foreground">
                Upcoming maintenance
              </h2>
            </div>

            {upcomingMaintenance.length === 0 ? (
              <div className="py-6 text-center text-xs text-foreground-dim bg-gray-50/50 rounded-lg border border-gray-100 my-2">
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
                        className="font-bold text-primary underline hover:text-primary-hover block text-left"
                      >
                        {item.machine_code}
                      </button>
                      <div className="text-[11px] text-foreground-muted mt-0.5 truncate">
                        {item.client} · {item.task}
                      </div>
                    </div>

                    <span className="text-[11px] font-bold text-foreground flex-shrink-0">
                      {item.date}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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

