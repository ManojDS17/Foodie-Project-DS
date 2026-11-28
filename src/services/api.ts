import type {
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

export function clearLegacyAuthStorage(): void {
  try {
    localStorage.removeItem('foodie_jwt_token_v1');
    localStorage.removeItem('foodie_auth_user_v4');
    localStorage.removeItem('foodie_auth_user');
  } catch {}
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const primaryUrl = `${API_BASE_URL}${endpoint}`;
  let response: Response;

  try {
    response = await fetch(primaryUrl, {
      ...options,
      credentials: 'include',
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
          credentials: 'include',
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
      clearLegacyAuthStorage();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('foodie:unauthorized'));
        if (!endpoint.includes('/auth/me') && !endpoint.includes('/auth/logout') && !window.location.pathname.includes('/login')) {
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
    }
    let errorMsg = `Request failed with status ${response.status}`;
    if (data) {
      if (typeof data === 'string') {
        errorMsg = data;
      } else if (typeof data.detail === 'string') {
        errorMsg = data.detail;
      } else if (Array.isArray(data.detail)) {
        errorMsg = data.detail
          .map((item: any) => {
            if (typeof item === 'string') return item;
            if (item?.msg) return item.msg.replace(/^Value error,\s*/i, '');
            if (item?.message) return item.message;
            return JSON.stringify(item);
          })
          .filter(Boolean)
          .join(', ');
      } else if (data.detail && typeof data.detail === 'object') {
        errorMsg = data.detail.msg || data.detail.message || JSON.stringify(data.detail);
      } else if (typeof data.error === 'string') {
        errorMsg = data.error;
      } else if (typeof data.message === 'string') {
        errorMsg = data.message;
      }
    }
    throw new Error(errorMsg);
  }

  return (data || {}) as T;
}

export interface ListQueryParams {
  skip?: number;
  limit?: number;
  search?: string;
}

const buildListQueryString = (params?: ListQueryParams): string => {
  if (!params) return '';
  const q = new URLSearchParams();
  if (typeof params.skip === 'number') q.set('skip', String(params.skip));
  if (typeof params.limit === 'number') q.set('limit', String(params.limit));
  if (params.search && params.search.trim()) q.set('search', params.search.trim());
  const qs = q.toString();
  return qs ? `?${qs}` : '';
};

// ----------------------------------------------------------------------------
// AUTHENTICATION API (JWT Based)
// ----------------------------------------------------------------------------
export const authApi = {
  login: async (
    email: string,
    password: string,
    remember_me = true
  ): Promise<{ user: User; expires_at?: string | null }> => {
    clearLegacyAuthStorage();
    return request<{ user: User; expires_at?: string | null }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, remember_me }),
    });
  },

  getMe: async (signal?: AbortSignal): Promise<User & { expires_at?: string | null }> => {
    return request<User & { expires_at?: string | null }>('/auth/me', { signal });
  },

  forgotPassword: async (email: string): Promise<{ success: boolean; message: string; expires_in_minutes: number }> => {
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
    clearLegacyAuthStorage();
    try {
      await request<any>('/auth/logout', {
        method: 'POST',
      });
    } catch {
      // Ignored if offline or cookie already expired
    }
  },
};

// ----------------------------------------------------------------------------
// USERS API (Direct PostgreSQL / FastAPI CRUD)
// ----------------------------------------------------------------------------
export const usersApi = {
  getAll: async (params?: ListQueryParams, signal?: AbortSignal): Promise<User[]> => {
    return await request<User[]>(`/users${buildListQueryString(params)}`, { signal });
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
  getAll: async (params?: ListQueryParams, signal?: AbortSignal): Promise<Organization[]> => {
    return await request<Organization[]>(`/organizations${buildListQueryString(params)}`, { signal });
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
  clients: {
    id: string;
    client_code: string;
    company_name: string;
    contact_poc?: string;
    email?: string;
    phone_number?: string;
    status?: string;
  }[];
  machines: {
    id: string;
    machine_code: string;
    serial_number: string;
    model: string;
    location?: string;
    company_name?: string;
    status: string;
    connectivity_status?: string;
    temp?: string;
  }[];
  sites?: any[];
  users?: any[];
}

export const searchApi = {
  query: async (q: string, signal?: AbortSignal): Promise<SearchResults> => {
    if (!q.trim()) {
      return { clients: [], machines: [], sites: [], users: [] };
    }
    return await request<SearchResults>(`/search?q=${encodeURIComponent(q.trim())}`, { signal });
  },
};

// ----------------------------------------------------------------------------
// MACHINES API (Direct PostgreSQL / FastAPI Machine Onboarding & Leases)
// ----------------------------------------------------------------------------
export const machinesApi = {
  getAll: async (params?: ListQueryParams, signal?: AbortSignal): Promise<Machine[]> => {
    return await request<Machine[]>(`/machines${buildListQueryString(params)}`, { signal });
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
  getAll: async (
    params?: { organization_id?: string; operator_id?: string },
    signal?: AbortSignal
  ): Promise<OperatorMachineAssignment[]> => {
    const q = new URLSearchParams();
    if (params?.organization_id) q.set('organization_id', params.organization_id);
    if (params?.operator_id) q.set('operator_id', params.operator_id);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return await request<OperatorMachineAssignment[]>(`/machines/operator-assignments${qs}`, { signal });
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
  getStats: async (signal?: AbortSignal): Promise<DashboardStats> => {
    return await request<DashboardStats>('/dashboard/stats', { signal });
  },
};

// ----------------------------------------------------------------------------
// SHARED CSV EXPORT HELPERS (Excel Formula Neutralization + Blob Download)
// ----------------------------------------------------------------------------
const FORMULA_TRIGGER_REGEX = /^\s*[=+\-@\t\r]/;

export const sanitizeCsvCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '""';
  }
  let text = String(value);
  if (FORMULA_TRIGGER_REGEX.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
};

export const buildCsvContent = (rows: unknown[][]): string => {
  return rows.map((row) => row.map(sanitizeCsvCell).join(',')).join('\n');
};

export const downloadCsv = (filename: string, rows: unknown[][]): void => {
  const csvContent = buildCsvContent(rows);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ----------------------------------------------------------------------------
// SHARED VALIDATION & PASSWORD POLICY HELPERS
// ----------------------------------------------------------------------------
export const EMAIL_REGEX =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,63}$/;

export const sanitizePhoneNumber = (val: string): string => {
  if (!val) return '';
  const trimmedLeading = val.replace(/^\s+/, '');
  const hasLeadingPlus = trimmedLeading.startsWith('+');
  const digitsAndSpaces = trimmedLeading.replace(/[^0-9\s]/g, '').replace(/\s{2,}/g, ' ');
  const result = hasLeadingPlus ? `+${digitsAndSpaces}` : digitsAndSpaces;
  return result.slice(0, 15);
};

export const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  if (clean.startsWith('.') || clean.endsWith('.')) return false;
  if (clean.includes('..') || clean.includes('.@') || clean.includes('@.')) return false;
  return EMAIL_REGEX.test(clean);
};

export const validatePhoneNumberInput = (phone: string): string | null => {
  const trimmed = phone.trim();
  if (!trimmed) return null;

  if (/[^0-9+\s]/.test(trimmed)) {
    return 'Phone number can only contain numbers, spaces, and an optional leading plus sign (+). Symbols like -, (, ) are not allowed.';
  }
  if (trimmed.includes('+') && (!trimmed.startsWith('+') || (trimmed.match(/\+/g) || []).length > 1)) {
    return 'The plus sign (+) is only permitted at the beginning of the phone number.';
  }
  if (trimmed.length > 15) {
    return 'Phone number cannot exceed 15 characters.';
  }
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length < 7) {
    return 'Please enter a valid phone number with at least 7 digits (e.g. +61 400 000 000).';
  }
  if (digitsOnly.length > 15) {
    return 'Phone number cannot exceed 15 digits.';
  }
  return null;
};

export const limitToMaxWords = (val: string, maxWords: number): string => {
  const trimmed = val.trim();
  if (!trimmed) return val;
  const words = trimmed.split(/\s+/);
  if (words.length <= maxWords) return val;
  return words.slice(0, maxWords).join(' ');
};

export const formatABN = (val: string): string => {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
};

export const isValidABN = (val: string): boolean => {
  const digits = val.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const sum = digits.split('').reduce((acc, char, index) => {
    const digit = index === 0 ? parseInt(char, 10) - 1 : parseInt(char, 10);
    return acc + digit * weights[index];
  }, 0);
  return sum % 89 === 0;
};

export const validateLocationInput = (loc: string): string | null => {
  const clean = loc.trim();
  if (!clean) return 'Installation location is required.';
  if (clean.length < 3) return 'Installation location must be at least 3 characters.';
  if (clean.length > 100) return 'Installation location cannot exceed 100 characters.';
  if (/[<>{}]|--|\/\*|;/.test(clean)) {
    return 'Location cannot contain code symbols or SQL characters (e.g. <, >, ;, --).';
  }
  if (!/^[A-Za-z0-9\s,.\-#/()'&]+$/.test(clean)) {
    return 'Location can only contain letters, numbers, spaces, and standard address punctuation (e.g. commas, hyphens, periods, #).';
  }
  return null;
};

export const validateLocationDescription = (desc: string): string | null => {
  const clean = desc.trim();
  if (!clean) return null;
  if (clean.length > 300) return 'Location description cannot exceed 300 characters.';
  if (/[<>{}]|--|\/\*|;/.test(clean)) {
    return 'Location description cannot contain code tags or SQL characters (e.g. <, >, ;, --).';
  }
  return null;
};

export interface PasswordChecks {
  hasMinLength: boolean;
  hasMaxLength: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  passwordsMatch: boolean;
  isPolicyMet: boolean;
}

export const getPasswordChecks = (password: string, confirmPassword = ''): PasswordChecks => {
  const hasMinLength = password.length >= 12;
  const hasMaxLength = password.length <= 50;
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const passwordsMatch =
    password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  return {
    hasMinLength,
    hasMaxLength,
    hasNumber,
    hasSymbol,
    passwordsMatch,
    isPolicyMet: hasMinLength && hasMaxLength && hasNumber && hasSymbol,
  };
};

export const validatePasswordPolicy = (password: string, fieldName = 'Password'): string | null => {
  if (password.length < 12) {
    return `${fieldName} must be at least 12 characters long.`;
  }
  if (password.length > 50) {
    return `${fieldName} cannot exceed 50 characters.`;
  }
  if (!/\d/.test(password)) {
    return `${fieldName} must contain at least one number (0-9).`;
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return `${fieldName} must contain at least one special character / symbol.`;
  }
  return null;
};

export const getTodayIsoDate = (): string => new Date().toISOString().split('T')[0];

export const calculateOneYearLeaseEndDate = (startDateStr: string): string => {
  if (!startDateStr || !startDateStr.includes('-')) return '';
  try {
    const parts = startDateStr.split('-');
    if (parts.length !== 3) return '';
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (!y || !m || !d) return '';

    const targetYear = y + 1;
    const targetMonth = m;
    const targetDay = m === 2 && d === 29 ? 28 : d;

    return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
  } catch {
    return '';
  }
};

// ----------------------------------------------------------------------------
// SHARED DISPLAY FORMATTERS
// ----------------------------------------------------------------------------
export const formatLocation = (address?: string | null): string => {
  if (!address) return '—';
  const parts = address.split(',').map((p) => p.trim());
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1];
    const matchState = lastPart.match(/(QLD|SA|WA|VIC|TAS|NT|NSW|ACT)/i);
    const suburb = parts[parts.length - 2] || parts[0];
    if (matchState) {
      return `${suburb.replace(/(\d+)/g, '').trim()} ${matchState[0].toUpperCase()}`;
    }
    return `${suburb}, ${lastPart}`;
  }
  return address;
};

export const formatMachineLocation = (
  machine: Pick<Machine, 'organization_id' | 'lease_location_label' | 'location_label'>
): string => {
  if (machine.organization_id) {
    if (machine.lease_location_label && machine.lease_location_label.trim()) {
      return machine.lease_location_label.trim();
    }
    return '—';
  }
  if (machine.location_label && machine.location_label.trim()) {
    return machine.location_label.trim();
  }
  return '—';
};

export const formatDate = (dateStr?: string | null, fallback = '—'): string => {
  if (!dateStr) return fallback;
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export const formatDateTime = (dateStr?: string | null, fallback = 'Recently'): string => {
  if (!dateStr) return fallback;
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
};

export const getCompanyInitials = (name?: string | null): string => {
  if (!name) return 'CL';
  const clean = name.trim().split(/\s+/);
  if (clean.length === 1) return clean[0].substring(0, 2).toUpperCase();
  return (clean[0][0] + clean[1][0]).toUpperCase();
};

export const getUserInitials = (
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
): string => {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName && firstName.length >= 2) {
    return firstName.slice(0, 2).toUpperCase();
  }
  if (email && email.length >= 2) {
    return email.slice(0, 2).toUpperCase();
  }
  return 'U';
};

