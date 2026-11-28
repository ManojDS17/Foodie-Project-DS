import React from 'react';
import { StatusBadge, type BadgeStatus } from '../common/StatusBadge';

export interface ConnectivityBadgeProps {
  connectivityStatus?: string | null;
  size?: 'sm' | 'md';
  offlineVariant?: 'neutral' | 'fault';
}

export const ConnectivityBadge: React.FC<ConnectivityBadgeProps> = ({
  connectivityStatus,
  size = 'sm',
  offlineVariant = 'neutral',
}) => {
  const isOnline = (connectivityStatus || '').toLowerCase() === 'online';
  if (isOnline) {
    return <StatusBadge status="running" label="Online" size={size} bordered />;
  }
  return (
    <StatusBadge
      status={offlineVariant === 'fault' ? 'fault' : 'offline'}
      label="Offline"
      size={size}
      bordered
    />
  );
};

export interface OperationalStatusBadgeProps {
  operationalStatus?: string | null;
  size?: 'sm' | 'md';
}

const OP_STATUS_MAP: Record<string, BadgeStatus> = {
  running: 'running',
  idle: 'idle',
  maintenance: 'maintenance',
  halted: 'fault',
  fault: 'fault',
};

export const OperationalStatusBadge: React.FC<OperationalStatusBadgeProps> = ({
  operationalStatus,
  size = 'sm',
}) => {
  const label = operationalStatus || 'Idle';
  const mapped: BadgeStatus = OP_STATUS_MAP[label.toLowerCase()] || 'inactive';
  return <StatusBadge status={mapped} label={label} size={size} bordered />;
};

