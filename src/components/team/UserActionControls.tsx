import React from 'react';
import { Cpu, Eye, Pencil, Trash2 } from 'lucide-react';
import type { User } from '../../types';
import { RowActionMenu } from '../common/RowActionMenu';
import { StatusBadge } from '../common/StatusBadge';
import { getUserLifecycleStatus } from './userLifecycle';

export const UserStatusBadge: React.FC<{ user: Pick<User, 'is_active' | 'last_login_at'>; size?: 'sm' | 'md' }> = ({
  user,
  size = 'md',
}) => {
  const status = getUserLifecycleStatus(user);
  if (status === 'Inactive') {
    return <StatusBadge status="inactive" label="Inactive" size={size} bordered />;
  }
  if (status === 'Pending') {
    return <StatusBadge status="pending" label="Pending" size={size} bordered pulse />;
  }
  return <StatusBadge status="active" label="Active" size={size} bordered />;
};

export interface UserRowActionsMenuProps {
  user: User;
  isOpen: boolean;
  removeLabel?: string;
  onToggle: () => void;
  onClose: () => void;
  onView: (user: User) => void;
  onEdit: (user: User) => void;
  onManageMachines: (user: User) => void;
  onRemove: (user: User) => void;
}

export const UserRowActionsMenu: React.FC<UserRowActionsMenuProps> = ({
  user,
  isOpen,
  removeLabel = 'Remove user',
  onToggle,
  onClose,
  onView,
  onEdit,
  onManageMachines,
  onRemove,
}) => (
  <RowActionMenu
    isOpen={isOpen}
    onToggle={onToggle}
    onClose={onClose}
    buttonAriaLabel={`Actions for ${user.first_name}`}
  >
    <button
      type="button"
      onClick={() => {
        onClose();
        onView(user);
      }}
      className="w-full px-3.5 py-2 text-left text-xs font-medium text-foreground-body hover:bg-surface-muted flex items-center gap-2 cursor-pointer transition-colors"
    >
      <Eye className="w-3.5 h-3.5 text-foreground-muted" />
      <span>View user</span>
    </button>

    <button
      type="button"
      onClick={() => {
        onClose();
        onEdit(user);
      }}
      className="w-full px-3.5 py-2 text-left text-xs font-medium text-foreground-body hover:bg-surface-muted flex items-center gap-2 cursor-pointer transition-colors"
    >
      <Pencil className="w-3.5 h-3.5 text-foreground-muted" />
      <span>Edit user</span>
    </button>

    {user.role === 'OPERATOR' && (
      <button
        type="button"
        onClick={() => {
          onClose();
          onManageMachines(user);
        }}
        className="w-full px-3.5 py-2 text-left text-xs font-medium text-foreground-body hover:bg-surface-muted flex items-center gap-2 cursor-pointer transition-colors"
      >
        <Cpu className="w-3.5 h-3.5 text-foreground-muted" />
        <span>Manage machines</span>
      </button>
    )}

    {user.role !== 'SITE_ADMIN' && (
      <>
        <div className="my-1 border-t border-surface-hover" />
        <button
          type="button"
          onClick={() => {
            onClose();
            onRemove(user);
          }}
          className="w-full px-3.5 py-2 text-left text-xs font-medium text-status-fault-text hover:bg-primary-light flex items-center gap-2 cursor-pointer transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5 text-status-fault-text" />
          <span>{removeLabel}</span>
        </button>
      </>
    )}
  </RowActionMenu>
);

