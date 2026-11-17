import type {
  Site,
  User,
  UserCreateData,
  Organization,
  Machine,
  MachineModel,
  OrganizationCreateData,
  DashboardStats,
  OperatorMachineAssignment,
  OperatorMachineAssignmentCreateData,
} from '../types';

const getApiBaseUrl = (): string => {
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();
const TOKEN_KEY = 'foodie_jwt_token_v1';

export const tokenStorage = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string): void => localStorage.setItem(TOKEN_KEY, token),
  clear: (): void => localStorage.removeItem(TOKEN_KEY),
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStorage.get();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const primaryUrl = `${API_BASE_URL}${endpoint}`;
  let response: Response;

  try {
    response = await fetch(primaryUrl, {
      ...options,
      headers,
    });
  } catch (fetchErr: any) {
    let fallbackUrl: string | null = null;
    if (primaryUrl.startsWith('/api') && typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      fallbackUrl = `http://127.0.0.1:5000${primaryUrl}`;
    }

    if (fallbackUrl) {
      try {
        response = await fetch(fallbackUrl, {
          ...options,
          headers,
        });
      } catch {
        throw fetchErr;
      }
    } else {
      throw fetchErr;
    }
  }

  let data: any = null;
  try {
    const text = await response.text();
    if (text && text.trim().length > 0) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401 && !endpoint.includes('/auth/login')) {
      tokenStorage.clear();
      try {
        localStorage.removeItem('foodie_auth_user_v4');
        localStorage.removeItem('foodie_auth_user');
      } catch {}
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        const isExpired = sessionStorage.getItem('foodie_session_expired') === 'true';
        const expiredEmail = sessionStorage.getItem('foodie_expired_email');
        const isSignedOut = sessionStorage.getItem('foodie_signed_out') === 'true';

        if (isExpired) {
          window.location.href = `/login?view=expired${expiredEmail ? `&email=${encodeURIComponent(expiredEmail)}` : ''}`;
        } else if (isSignedOut) {
          window.location.href = '/login?view=signed_out';
        } else {
          window.location.href = '/login';
        }
      }
    }
    const errorMsg =
      data?.detail ||
      data?.error ||
      (typeof data === 'string' ? data : `Request failed with status ${response.status}`);
    throw new Error(errorMsg);
  }

  return (data || {}) as T;
}

// ----------------------------------------------------------------------------
// AUTHENTICATION API (JWT Based)
// ----------------------------------------------------------------------------
export const authApi = {
  login: async (email: string, password: string): Promise<{ token: string; user: User }> => {
    const res = await request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    tokenStorage.set(res.token);
    return res;
  },

  getMe: async (): Promise<User> => {
    return request<User>('/auth/me');
  },

  forgotPassword: async (email: string): Promise<{ success: boolean; message: string; email: string; expires_in_minutes: number; reset_url?: string }> => {
    return request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  verifyResetToken: async (token: string): Promise<{ valid: boolean; email: string }> => {
    return request('/auth/verify-reset-token', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  resetPassword: async (token: string, new_password: string): Promise<{ success: boolean; message: string }> => {
    return request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password }),
    });
  },

  logout: async () => {
    try {
      await request<any>('/auth/logout', { method: 'POST' });
    } catch {
      // Ignored if offline or token already expired
    } finally {
      tokenStorage.clear();
    }
  },
};

// ----------------------------------------------------------------------------
// SITES API
// ----------------------------------------------------------------------------
export const sitesApi = {
  getAll: async (): Promise<Site[]> => {
    return [];
  },

  create: async (_siteData: any): Promise<Site> => {
    return {} as Site;
  },

  update: async (_id: string, _updatedFields: any): Promise<Site> => {
    return {} as Site;
  },

  delete: async (_id: string): Promise<void> => { },
};

// ----------------------------------------------------------------------------
// USERS API (Direct PostgreSQL / FastAPI CRUD)
// ----------------------------------------------------------------------------
export const usersApi = {
  getAll: async (): Promise<User[]> => {
    return await request<User[]>('/users');
  },

  getById: async (id: string): Promise<User> => {
    return await request<User>(`/users/${id}`);
  },

  create: async (userData: UserCreateData): Promise<User> => {
    return await request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  update: async (id: string, updatedFields: Partial<User>): Promise<User> => {
    return await request<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updatedFields),
    });
  },

  delete: async (id: string): Promise<void> => {
    await request(`/users/${id}`, { method: 'DELETE' });
  },

  resendInvite: async (id: string): Promise<{ message: string }> => {
    return await request<{ message: string }>(`/users/${id}/resend-invite`, {
      method: 'POST',
    });
  },

  resetPassword: async (id: string): Promise<{ message: string }> => {
    return await request<{ message: string }>(`/users/${id}/reset-password`, {
      method: 'POST',
    });
  },
};

// ----------------------------------------------------------------------------
// ORGANIZATIONS API (Direct PostgreSQL / FastAPI)
// ----------------------------------------------------------------------------
export const orgsApi = {
  getAll: async (): Promise<Organization[]> => {
    return await request<Organization[]>('/organizations');
  },

  getNextCode: async (): Promise<{ next_code: string }> => {
    return await request<{ next_code: string }>('/organizations/next-code');
  },

  getById: async (id: string): Promise<Organization> => {
    return await request<Organization>(`/organizations/${id}`);
  },

  create: async (orgData: Partial<Organization> | OrganizationCreateData): Promise<Organization> => {
    return await request<Organization>('/organizations', {
      method: 'POST',
      body: JSON.stringify(orgData),
    });
  },

  update: async (id: string, updatedFields: Partial<Organization>): Promise<Organization> => {
    return await request<Organization>(`/organizations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updatedFields),
    });
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    return await request<{ success: boolean; message: string }>(`/organizations/${id}`, { method: 'DELETE' });
  },

  bulkDelete: async (ids: string[]): Promise<{ message: string; deleted_ids: string[] }> => {
    return await request('/organizations/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },
};

// ----------------------------------------------------------------------------
// SEARCH API (Multi-Entity Search across PostgreSQL)
// ----------------------------------------------------------------------------
export interface SearchResults {
  sites: { id: string; site_code: string; site_name: string; address: string; is_active: boolean }[];
  users: { id: string; first_name: string; last_name: string; email: string; role: string }[];
  machines: { id: string; model: string; location: string; status: string; temp: string }[];
}

export const searchApi = {
  query: async (q: string): Promise<SearchResults> => {
    if (!q.trim()) {
      return { sites: [], users: [], machines: [] };
    }
    return await request<SearchResults>(`/search?q=${encodeURIComponent(q.trim())}`);
  },
};

// ----------------------------------------------------------------------------
// MACHINES API (Direct PostgreSQL / FastAPI Machine Onboarding & Leases)
// ----------------------------------------------------------------------------
export const machinesApi = {
  getAll: async (): Promise<Machine[]> => {
    return await request<Machine[]>('/machines');
  },

  getNextCode: async (): Promise<{ next_code: string }> => {
    return await request<{ next_code: string }>('/machines/next-code');
  },

  getModels: async (): Promise<MachineModel[]> => {
    return await request<MachineModel[]>('/machines/models');
  },

  getById: async (id: string): Promise<Machine> => {
    return await request<Machine>(`/machines/${id}`);
  },

  create: async (machineData: any): Promise<Machine> => {
    return await request<Machine>('/machines', {
      method: 'POST',
      body: JSON.stringify(machineData),
    });
  },

  update: async (id: string, updatedFields: Partial<Machine>): Promise<Machine> => {
    return await request<Machine>(`/machines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updatedFields),
    });
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    return await request<{ success: boolean; message: string }>(`/machines/${id}`, { method: 'DELETE' });
  },

  unassign: async (id: string, termination_remark?: string): Promise<{ success: boolean; message: string; id: string }> => {
    return await request<{ success: boolean; message: string; id: string }>(`/machines/${id}/unassign`, {
      method: 'POST',
      body: JSON.stringify({ termination_remark: termination_remark || null }),
    });
  },

  terminateLease: async (id: string, termination_remark?: string): Promise<{ success: boolean; message: string; id: string }> => {
    return await request<{ success: boolean; message: string; id: string }>(`/machines/${id}/unassign`, {
      method: 'POST',
      body: JSON.stringify({ termination_remark: termination_remark || null }),
    });
  },
};

export const operatorAssignmentsApi = {
  getAll: async (params?: { organization_id?: string; operator_id?: string }): Promise<OperatorMachineAssignment[]> => {
    const q = new URLSearchParams();
    if (params?.organization_id) q.set('organization_id', params.organization_id);
    if (params?.operator_id) q.set('operator_id', params.operator_id);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return await request<OperatorMachineAssignment[]>(`/machines/operator-assignments${qs}`);
  },

  assign: async (data: OperatorMachineAssignmentCreateData): Promise<OperatorMachineAssignment> => {
    return await request<OperatorMachineAssignment>('/machines/operator-assignments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  revoke: async (assignmentId: string): Promise<{ success: boolean; message: string }> => {
    return await request<{ success: boolean; message: string }>(`/machines/operator-assignments/${assignmentId}/revoke`, {
      method: 'POST',
    });
  },
};

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    return await request<DashboardStats>('/dashboard/stats');
  },
};

