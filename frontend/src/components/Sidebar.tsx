'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart3,
  User,
  AlertTriangle,
  Users,
  ReceiptText,
  Boxes,
  LogOut,
  Ticket,
} from 'lucide-react';
import { getStoredUserRole, getStoredUserName, getRoleLabel, clearUserSession, type AppRole } from '@/lib/auth';
import TentacleField from '@/components/TentacleField';

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  group: string;
};

const adminItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Général' },
  { href: '/products', label: 'Produits', icon: Package, group: 'Général' },
  { href: '/sales', label: 'Ventes', icon: ShoppingCart, group: 'Général' },
  { href: '/receipts', label: 'Transactions', icon: ReceiptText, group: 'Général' },
  { href: '/staff', label: 'Staff', icon: Users, group: 'Gestion' },
  { href: '/stats', label: 'Rapports', icon: BarChart3, group: 'Gestion' },
  { href: '/alerts', label: 'Alertes', icon: AlertTriangle, group: 'Gestion' },
  { href: '/tickets', label: 'Tickets', icon: Ticket, group: 'Gestion' },
  { href: '/profil', label: 'Profil', icon: User, group: 'Compte' },
];

const managerItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Général' },
  { href: '/products', label: 'Produits', icon: Package, group: 'Général' },
  { href: '/sales', label: 'Ventes', icon: ShoppingCart, group: 'Général' },
  { href: '/receipts', label: 'Transactions', icon: ReceiptText, group: 'Général' },
  { href: '/stats', label: 'Rapports', icon: BarChart3, group: 'Gestion' },
  { href: '/alerts', label: 'Alertes', icon: AlertTriangle, group: 'Gestion' },
  { href: '/tickets', label: 'Tickets', icon: Ticket, group: 'Gestion' },
  { href: '/profil', label: 'Profil', icon: User, group: 'Compte' },
];

const cashierItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Général' },
  { href: '/products', label: 'Produits', icon: Package, group: 'Général' },
  { href: '/sales', label: 'Ventes', icon: ShoppingCart, group: 'Général' },
  { href: '/receipts', label: 'Transactions', icon: ReceiptText, group: 'Général' },
  { href: '/alerts', label: 'Alertes', icon: AlertTriangle, group: 'Suivi' },
  { href: '/tickets', label: 'Tickets', icon: Ticket, group: 'Suivi' },
  { href: '/stats/cashiers', label: 'Stats Caissiers', icon: BarChart3, group: 'Suivi' },
  { href: '/profil', label: 'Profil', icon: User, group: 'Suivi' },
];

function groupItems(items: NavItem[]) {
  const order: string[] = [];
  const map = new Map<string, NavItem[]>();
  for (const item of items) {
    if (!map.has(item.group)) {
      map.set(item.group, []);
      order.push(item.group);
    }
    map.get(item.group)!.push(item);
  }
  return order.map((group) => ({ group, items: map.get(group)! }));
}

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<AppRole | null>(null);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    setRole(getStoredUserRole());
    setUserName(getStoredUserName());
  }, []);

  const items = role === 'CASHIER' ? cashierItems : role === 'MANAGER' ? managerItems : adminItems;
  const groups = groupItems(items);

  const initials =
    (userName || 'U')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U';

  const handleLogout = () => {
    clearUserSession();
    router.push('/login');
  };

  return (
    <>
      <aside
        className={`fixed top-0 left-0 z-40 flex h-screen flex-col overflow-hidden border-r border-white/5 bg-[#211A44] text-slate-300 shadow-xl transition-[width] duration-300 ease-in-out
          ${isOpen ? 'w-80' : 'w-24'}`}
      >
        <TentacleField variant="dark" />

        {/* LOGO + COLLAPSE TOGGLE */}
        <div className={`relative z-10 flex h-20 shrink-0 items-center border-b border-white/5 ${isOpen ? 'justify-between px-6' : 'justify-center px-2'}`}>
          <div
            className={`flex items-center gap-3 overflow-hidden ${isOpen ? '' : 'justify-center'}`}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white">
              <Boxes size={20} />
            </span>
            {isOpen && (
              <span className="truncate text-2xl font-bold tracking-tight text-white">
                Octo<span className="text-blue-600">Stock</span>
              </span>
            )}
          </div>
          {isOpen && (
            <button
              onClick={() => setIsOpen(false)}
              className="btn-tactile rounded-md p-2 text-slate-400 hover:bg-white/10 hover:text-white"
              title="Réduire le menu"
            >
              <ChevronsLeft size={18} />
            </button>
          )}
        </div>

        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="btn-tactile relative z-10 mx-auto mt-4 flex size-10 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white"
            title="Agrandir le menu"
          >
            <ChevronsRight size={18} />
          </button>
        )}

        {/* SESSION BADGE */}
        {isOpen && (
          <div className="relative z-10 mx-6 mt-5 rounded-xl border border-indigo-400/20 bg-indigo-500/10 px-4 py-3.5 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Session</p>
            <p className="mt-1.5 truncate text-base font-semibold text-white">{getRoleLabel(role)}</p>
            <p className="text-sm text-slate-400">Accès adapté à votre rôle</p>
          </div>
        )}

        {/* NAV */}
        <nav className="relative z-10 flex-1 space-y-6 overflow-y-auto px-4 py-6">
          {groups.map(({ group, items: groupNav }) => (
            <div key={group}>
              {isOpen && (
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {group}
                </p>
              )}
              <div className="space-y-1">
                {groupNav.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.href ||
                    (item.href !== '/dashboard' && pathname?.startsWith(item.href + '/'));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      className={`btn-tactile group relative flex items-center overflow-hidden rounded-lg text-[15px] font-medium
                        ${isOpen ? 'gap-3.5 px-3 py-2.5' : 'justify-center py-3'}
                        ${active
                          ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-950/50'
                          : 'text-slate-300 hover:bg-[color-mix(in_oklch,white,var(--brand-teal)_20%)]/10 hover:text-white'}`}
                    >
                      {active && (
                        <span className="absolute inset-y-1 left-0 w-1 rounded-full bg-teal-300" />
                      )}
                      <Icon size={20} className={active ? 'text-white' : 'text-slate-400 transition-colors group-hover:text-teal-300'} />
                      {isOpen && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* ACCOUNT FOOTER */}
        <div className="relative z-10 shrink-0 border-t border-white/5 p-4">
          <div className={`flex items-center rounded-lg ${isOpen ? 'gap-3 p-2.5' : 'justify-center py-2'}`}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-semibold text-indigo-300">
              {initials}
            </span>
            {isOpen && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-white">{userName || 'Utilisateur'}</p>
                <p className="truncate text-sm text-slate-500">{getRoleLabel(role)}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              title="Déconnexion"
              className={`btn-tactile shrink-0 rounded-md p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 ${isOpen ? '' : 'hidden'}`}
            >
              <LogOut size={18} />
            </button>
          </div>
          {!isOpen && (
            <button
              onClick={handleLogout}
              title="Déconnexion"
              className="btn-tactile mx-auto mt-1 flex size-10 items-center justify-center rounded-md text-slate-400 hover:bg-rose-500/10 hover:text-rose-400"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </aside>

      {/* SPACER */}
      <div className={`hidden shrink-0 transition-[width] duration-300 ease-in-out md:block ${isOpen ? 'w-80' : 'w-24'}`} />
    </>
  );
}
