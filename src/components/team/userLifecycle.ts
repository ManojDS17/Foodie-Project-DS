import type { User } from '../../types';

export const getUserLifecycleStatus = (
  u: Pick<User, 'is_active' | 'last_login_at'>
): 'Active' | 'Pending' | 'Inactive' => {
  if (!u.is_active) return 'Inactive';
  if (!u.last_login_at) return 'Pending';
  return 'Active';
};

