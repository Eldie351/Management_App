export type AppRole = 'ADMIN' | 'MANAGER' | 'CASHIER';

const ROLE_STORAGE_KEY = 'user_role';
const USER_NAME_STORAGE_KEY = 'user_name';

export function normalizeRole(role?: string | null): AppRole | null {
  if (!role) return null;

  const normalized = role.toUpperCase();
  if (normalized === 'ADMIN' || normalized === 'MANAGER' || normalized === 'CASHIER') {
    return normalized;
  }

  return null;
}

export function getStoredUserRole(): AppRole | null {
  if (typeof window === 'undefined') return null;

  const storedRole = normalizeRole(localStorage.getItem(ROLE_STORAGE_KEY));
  if (storedRole) return storedRole;

  const token = localStorage.getItem('access_token');
  if (!token) return null;

  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalizedPayload));

    return normalizeRole(decoded.role || decoded.userRole || decoded.roles?.[0]);
  } catch {
    return null;
  }
}

export function getStoredUserName(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(USER_NAME_STORAGE_KEY) || '';
}

export function persistUserSession(data: { access_token: string; role?: string | null; name?: string | null }) {
  if (typeof window === 'undefined') return;

  localStorage.setItem('access_token', data.access_token);
  if (data.role) {
    localStorage.setItem(ROLE_STORAGE_KEY, data.role.toUpperCase());
  }
  if (data.name) {
    localStorage.setItem(USER_NAME_STORAGE_KEY, data.name);
  }
}

export function clearUserSession() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem('access_token');
  localStorage.removeItem(ROLE_STORAGE_KEY);
  localStorage.removeItem(USER_NAME_STORAGE_KEY);
}

export function getRoleLabel(role: AppRole | null | undefined) {
  switch (role) {
    case 'ADMIN':
      return 'Administrateur';
    case 'MANAGER':
      return 'Manager';
    case 'CASHIER':
      return 'Caissier';
    default:
      return 'Utilisateur';
  }
}

export function hasAccess(role: AppRole | null | undefined, allowedRoles: AppRole[]) {
  return Boolean(role && allowedRoles.includes(role));
}
