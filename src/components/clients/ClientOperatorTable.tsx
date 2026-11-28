import React from 'react';
import { Users } from 'lucide-react';
import type { OperatorMachineAssignment, User } from '../../types';
import { UserRowActionsMenu, UserStatusBadge } from '../team/UserActionControls';

export interface ClientOperatorTableProps {
  users: User[];
  operatorAssignments: OperatorMachineAssignment[];
  activeUserMenuId: string | null;
  onToggleMenu: (userId: string | null) => void;
  onViewUser: (user: User) => void;
  onEditUser: (user: User) => void;
  onManageMachines: (user: User) => void;
  onRemoveUser: (user: User) => void;
}

export const ClientOperatorTable: React.FC<ClientOperatorTableProps> = ({
  users,
  operatorAssignments,
  activeUserMenuId,
  onToggleMenu,
  onViewUser,
  onEditUser,
  onManageMachines,
  onRemoveUser,
}) => (
  <div>
    <div className="p-6 pb-4">
      <h3 className="text-sm font-bold text-foreground">Users</h3>
      <p className="text-xs text-foreground-muted mt-0.5">
        Authorized personnel with access to this client's Foodie composter fleet.
      </p>
    </div>

    {users.length === 0 ? (
      <div className="p-12 text-center">
        <div className="w-12 h-12 rounded-xl bg-surface-hover flex items-center justify-center text-foreground-subtle mx-auto mb-3">
          <Users className="w-6 h-6" />
        </div>
        <h4 className="text-xs font-bold text-foreground">No users assigned</h4>
        <p className="text-xs text-foreground-muted mt-1 max-w-sm mx-auto">
          Personnel can be added in User Management to grant access to this organization.
        </p>
      </div>
    ) : (
      <div className="overflow-x-auto pb-12">
        <table className="w-full text-xs text-left min-w-[750px]">
          <thead>
            <tr className="border-b border-border-default bg-surface-muted text-foreground-muted font-semibold">
              <th className="py-3 px-6">Name</th>
              <th className="py-3 px-6">Email</th>
              <th className="py-3 px-6">Phone number</th>
              <th className="py-3 px-6">Role</th>
              <th className="py-3 px-6">Assigned machines</th>
              <th className="py-3 px-6">Status</th>
              <th className="py-3 px-6 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {users.map((u) => {
              const userAssignments = operatorAssignments.filter(
                (a) =>
                  String(a.operator_id || '').trim().toLowerCase() ===
                    String(u.id || '').trim().toLowerCase() &&
                  a.status === 'Active'
              );

              return (
                <tr key={u.id} className="hover:bg-surface-muted transition-colors">
                  <td className="py-4 px-6 font-bold text-foreground">
                    <button
                      type="button"
                      onClick={() => onViewUser(u)}
                      className="hover:underline text-left cursor-pointer font-bold text-foreground"
                    >
                      {u.first_name} {u.last_name}
                    </button>
                  </td>
                  <td className="py-4 px-6 text-foreground-muted">{u.email}</td>
                  <td className="py-4 px-6 text-foreground-muted">{u.phone_number || '—'}</td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-surface-hover text-foreground-body border border-border-default">
                      {u.role === 'SITE_ADMIN'
                        ? 'Site Admin'
                        : u.role === 'OPERATOR'
                        ? 'Operator'
                        : u.role}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    {u.role === 'OPERATOR' ? (
                      userAssignments.length === 0 ? (
                        <span className="text-foreground-subtle text-xs">No machines assigned</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {userAssignments.map((a) => (
                            <span
                              key={a.id}
                              className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-red-50 text-primary border border-red-100"
                            >
                              {a.machine_code || a.serial_number}
                            </span>
                          ))}
                        </div>
                      )
                    ) : (
                      <span className="text-foreground-muted text-xs font-medium">All fleet access</span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <UserStatusBadge user={u} size="sm" />
                  </td>
                  <td className="py-4 px-6 text-right relative">
                    <div className="inline-flex items-center gap-2 text-left justify-end">
                      <UserRowActionsMenu
                        user={u}
                        isOpen={activeUserMenuId === u.id}
                        removeLabel="Remove from team"
                        onToggle={() => onToggleMenu(activeUserMenuId === u.id ? null : u.id)}
                        onClose={() => onToggleMenu(null)}
                        onView={onViewUser}
                        onEdit={onEditUser}
                        onManageMachines={onManageMachines}
                        onRemove={onRemoveUser}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

