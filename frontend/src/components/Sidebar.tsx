'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import { usePathname } from 'next/navigation';
import { Menu, X, LayoutDashboard, Package, ShoppingCart, BarChart3, User } from 'lucide-react';

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const pathname = usePathname();

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

          <nav className="space-y-1">
            <Link
              href="/dashboard"
              className={`flex items-center space-x-3 rounded-lg p-2.5 text-sm font-medium transition-all ${
                pathname === '/dashboard' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <LayoutDashboard size={18} className={pathname === '/dashboard' ? 'text-blue-500' : 'text-gray-400'} />
              <span>Dashboard</span>
            </Link>

            <Link
              href="/products"
              className={`flex items-center space-x-3 rounded-lg p-2.5 text-sm font-medium transition-all ${
                pathname === '/products' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Package size={18} className={pathname === '/products' ? 'text-blue-500' : 'text-gray-400'} />
              <span>Produits</span>
            </Link>

            <Link
              href="/sales"
              className={`flex items-center space-x-3 rounded-lg p-2.5 text-sm font-medium transition-all ${
                pathname === '/sales' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ShoppingCart size={18} className={pathname === '/sales' ? 'text-blue-500' : 'text-gray-400'} />
              <span>Ventes</span>
            </Link>

            <Link
              href="/stats"
              className={`flex items-center space-x-3 rounded-lg p-2.5 text-sm font-medium transition-all ${
                pathname === '/stats' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <BarChart3 size={18} className={pathname === '/stats' ? 'text-blue-500' : 'text-gray-400'} />
              <span>Statistiques</span>
            </Link>

            <Link
              href="/profil"
              className={`flex items-center space-x-3 rounded-lg p-2.5 text-sm font-medium transition-all ${
                pathname === '/profil' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <User size={18} className={pathname === '/profil' ? 'text-blue-500' : 'text-gray-400'} />
              <span>Profil</span>
            </Link>
          </nav>
        </div>
      </aside>

      {/* 3. ESPACEUR STRUCTUREL */}
      <div className={`hidden md:block transition-all duration-300 shrink-0 ${isOpen ? 'w-64' : 'w-0'}`} />
    </>
  );
}
