import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { User } from '../../types';

export interface RemoveUserModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}

export const RemoveUserModal: React.FC<RemoveUserModalProps> = ({
  user,
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
}) => {
  if (!isOpen || !user) return null;

  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-border-default shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150 p-6 flex flex-col gap-4">
        <div className="w-12 h-12 rounded-full bg-primary-light text-status-fault-text flex items-center justify-center border border-primary-border">
          <AlertTriangle className="w-6 h-6 text-status-fault-text" />
        </div>

        <div>
          <h3 className="text-base font-bold text-foreground">
            Remove {fullName} from team?
          </h3>
          <p className="text-xs text-foreground-muted mt-1.5 leading-relaxed">
            This user will be marked as Inactive and will lose dashboard access. You can reactivate their account at any time from Edit user.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl border border-border-strong text-xs font-semibold text-foreground-body hover:bg-surface-muted transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl bg-status-fault-dot text-white text-xs font-semibold hover:bg-status-fault-dot transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Remove from team</span>
          </button>
        </div>
      </div>
    </div>
  );
};
