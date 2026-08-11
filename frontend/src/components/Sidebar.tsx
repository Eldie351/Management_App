'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import { usePathname } from 'next/navigation';
import { Menu, X, LayoutDashboard, Package, ShoppingCart, BarChart3, User, AlertTriangle, Store, Users, Settings, ReceiptText } from 'lucide-react';
import { getStoredUserRole, getRoleLabel, type AppRole } from '@/lib/auth';

const adminItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/products', label: 'Produits', icon: Package },
  { href: '/sales', label: 'Ventes', icon: ShoppingCart },
  { href: '/staff', label: 'Staff', icon: Users },
  { href: '/stats', label: 'Rapports', icon: BarChart3 },
  { href: '/alerts', label: 'Alertes', icon: AlertTriangle },
  { href: '/profil', label: 'Profil', icon: User },
];

const managerItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/products', label: 'Produits', icon: Package },
  { href: '/sales', label: 'Ventes', icon: ShoppingCart },
  { href: '/stats', label: 'Rapports', icon: BarChart3 },
  { href: '/alerts', label: 'Alertes', icon: AlertTriangle },
  { href: '/profil', label: 'Profil', icon: User },
];

const cashierItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/products', label: 'Produits', icon: Package },
  { href: '/sales', label: 'Ventes', icon: ShoppingCart },
  { href: '/profil', label: 'Profil', icon: User },
];

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const pathname = usePathname();
  const [role, setRole] = useState<AppRole | null>(null);

  useEffect(() => {
    setRole(getStoredUserRole());
  }, []);

  // Effet pour appliquer un espace de sécurité automatique (Ouvert et Fermé)
  useEffect(() => {
    const mainContent = document.querySelector('main');
    if (mainContent) {
      mainContent.style.transition = 'padding-left 300ms ease';
      
      if (!isOpen) {
        mainContent.style.paddingLeft = '5.5rem'; 
      } else {
        mainContent.style.paddingLeft = '3rem'; 
      }
    }
  }, [isOpen]);

  return (
    <>
      {/* 1. LE BOUTON BURGER (FIXÉ EN HAUT À GAUCHE) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-5 left-4 z-50 p-2 rounded-lg bg-white border border-gray-200 shadow-sm text-gray-700 hover:bg-gray-50 focus:outline-none transition-all duration-200"
        title={isOpen ? "Masquer le menu" : "Afficher le menu"}
      >
        {isOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* 2. LA BARRE LATÉRALE */}
      <aside 
        className={`fixed top-0 left-0 h-screen border-r bg-white p-4 pt-20 transition-all duration-300 z-40 flex flex-col justify-between shadow-sm
          ${isOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full'}`}
      >
        <div className={isOpen ? 'block animate-in fade-in duration-300' : 'hidden'}>
          
          {/* 📌 CORRECTION : LE TITRE "OCTOSTOCK" CONDUIT MAINTENANT À LA PAGE D'ACCUEIL */}
          <h1 className="text-2xl font-bold mb-8 px-2 tracking-tight text-gray-900">
            <Link 
              href="/" 
              className="hover:text-blue-600 transition-colors inline-block"
              title="Retour à la vitrine d'accueil"
            >
              Octo<span className="text-blue-600">Stock</span>
            </Link>
          </h1>

          <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Session</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{getRoleLabel(role)}</p>
            <p className="text-xs text-gray-500">Accès adapté à votre rôle</p>
          </div>

          <nav className="space-y-1">
            {(role === 'CASHIER' ? cashierItems : role === 'MANAGER' ? managerItems : adminItems).map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-3 rounded-lg p-2.5 text-sm font-medium transition-all ${
                    active ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={18} className={active ? 'text-blue-500' : 'text-gray-400'} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* 3. ESPACEUR STRUCTUREL */}
      <div className={`hidden md:block transition-all duration-300 shrink-0 ${isOpen ? 'w-64' : 'w-0'}`} />
    </>
  );
}
