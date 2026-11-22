import React from 'react';

export type BadgeStatus = 'running' | 'idle' | 'maintenance' | 'fault' | 'offline' | 'active' | 'inactive';

interface StatusBadgeProps {
  status: BadgeStatus;
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const configMap: Record<BadgeStatus, { text: string; bg: string; dot: string; defaultLabel: string }> = {
    running: {
      text: 'text-status-running-text',
      bg: 'bg-status-running-bg',
      dot: 'bg-status-running-dot',
      defaultLabel: 'Running',
    },
    active: {
      text: 'text-status-running-text',
      bg: 'bg-status-running-bg',
      dot: 'bg-status-running-dot',
      defaultLabel: 'Active',
    },
    idle: {
      text: 'text-status-idle-text',
      bg: 'bg-status-idle-bg',
      dot: 'bg-status-idle-dot',
      defaultLabel: 'Idle',
    },
    maintenance: {
      text: 'text-status-maint-text',
      bg: 'bg-status-maint-bg',
      dot: 'bg-status-maint-dot',
      defaultLabel: 'Maintenance',
    },
    fault: {
      text: 'text-status-fault-text',
      bg: 'bg-status-fault-bg',
      dot: 'bg-status-fault-dot',
      defaultLabel: 'Fault',
    },
    offline: {
      text: 'text-status-offline-text',
      bg: 'bg-status-offline-bg',
      dot: 'bg-status-offline-dot',
      defaultLabel: 'Offline',
    },
    inactive: {
      text: 'text-status-offline-text',
      bg: 'bg-status-offline-bg',
      dot: 'bg-status-offline-dot',
      defaultLabel: 'Inactive',
    },
  };

  const current = configMap[status] || configMap.offline;
  const displayLabel = label || current.defaultLabel;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${current.bg} ${current.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
      <span>{displayLabel}</span>
    </span>
  );
};
