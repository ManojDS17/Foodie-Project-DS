import React from 'react';

export type BadgeStatus =
  | 'running'
  | 'idle'
  | 'maintenance'
  | 'fault'
  | 'offline'
  | 'active'
  | 'inactive'
  | 'pending'
  | 'danger'
  | 'warning';

interface StatusBadgeProps {
  status: BadgeStatus;
  label?: string;
  size?: 'sm' | 'md';
  bordered?: boolean;
  pulse?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  bordered = false,
  pulse = false,
}) => {
  const configMap: Record<
    BadgeStatus,
    { text: string; bg: string; dot: string; border: string; defaultLabel: string }
  > = {
    running: {
      text: 'text-status-running-text',
      bg: 'bg-status-running-bg',
      dot: 'bg-status-running-dot',
      border: 'border-status-running-dot/30',
      defaultLabel: 'Running',
    },
    active: {
      text: 'text-status-running-text',
      bg: 'bg-status-running-bg',
      dot: 'bg-status-running-dot',
      border: 'border-status-running-dot/30',
      defaultLabel: 'Active',
    },
    idle: {
      text: 'text-status-idle-text',
      bg: 'bg-status-idle-bg',
      dot: 'bg-status-idle-dot',
      border: 'border-status-idle-dot/30',
      defaultLabel: 'Idle',
    },
    pending: {
      text: 'text-amber-700',
      bg: 'bg-amber-50',
      dot: 'bg-amber-500',
      border: 'border-amber-200',
      defaultLabel: 'Pending',
    },
    warning: {
      text: 'text-amber-700',
      bg: 'bg-amber-50',
      dot: 'bg-amber-500',
      border: 'border-amber-200',
      defaultLabel: 'Attention',
    },
    maintenance: {
      text: 'text-status-maint-text',
      bg: 'bg-status-maint-bg',
      dot: 'bg-status-maint-dot',
      border: 'border-status-maint-dot/30',
      defaultLabel: 'Maintenance',
    },
    fault: {
      text: 'text-status-fault-text',
      bg: 'bg-status-fault-bg',
      dot: 'bg-status-fault-dot',
      border: 'border-status-fault-dot/30',
      defaultLabel: 'Fault',
    },
    danger: {
      text: 'text-primary',
      bg: 'bg-red-50',
      dot: 'bg-primary',
      border: 'border-red-200',
      defaultLabel: 'Alert',
    },
    offline: {
      text: 'text-status-offline-text',
      bg: 'bg-status-offline-bg',
      dot: 'bg-status-offline-dot',
      border: 'border-slate-200',
      defaultLabel: 'Offline',
    },
    inactive: {
      text: 'text-foreground-muted',
      bg: 'bg-surface-hover',
      dot: 'bg-foreground-subtle',
      border: 'border-border-default',
      defaultLabel: 'Inactive',
    },
  };

  const current = configMap[status] || configMap.offline;
  const displayLabel = label || current.defaultLabel;
  const paddingClass =
    size === 'sm' ? 'px-2.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  const borderClass = bordered ? `border ${current.border}` : '';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${paddingClass} ${current.bg} ${current.text} ${borderClass} shrink-0`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${current.dot} ${pulse ? 'animate-pulse' : ''}`}
      />
      <span>{displayLabel}</span>
    </span>
  );
};
