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

  // Recherche sur 'access_token' ou fallback sur 'token'
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
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

  // 1. OBLIGATOIRE : Nettoyer l'ancienne session avant d'enregistrer la nouvelle
  clearUserSession();

  // 2. Stocker le token sous les 2 clés standards pour éviter toute fuite avec Axios/Fetch
  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('token', data.access_token);

  // 3. Stocker le rôle (ou nettoyer si absent)
  if (data.role) {
    localStorage.setItem(ROLE_STORAGE_KEY, data.role.toUpperCase());
  }

  // 4. Stocker le nom (ou nettoyer si absent)
  if (data.name) {
    localStorage.setItem(USER_NAME_STORAGE_KEY, data.name);
  }
}

export function clearUserSession() {
  if (typeof window === 'undefined') return;

  // Nettoyage complet de toutes les clés de session
  localStorage.removeItem('access_token');
  localStorage.removeItem('token');
  localStorage.removeItem(ROLE_STORAGE_KEY);
  localStorage.removeItem(USER_NAME_STORAGE_KEY);
  localStorage.removeItem('user');

  // Purge du sessionStorage au cas où Axios/SWR l'utiliserait en cache
  sessionStorage.clear();
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