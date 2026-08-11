import Link from 'next/link';
import React from 'react';

export default function Menu() {
  return (
    <header className="w-full bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <Link href="/" className="text-lg font-bold text-slate-800">
              Management App
            </Link>
            <nav className="hidden md:flex space-x-2">
              <Link href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900 px-2 py-1 rounded-md">Dashboard</Link>
              <Link href="/sales" className="text-sm text-slate-600 hover:text-slate-900 px-2 py-1 rounded-md">Ventes</Link>
              <Link href="/receipts" className="text-sm text-slate-600 hover:text-slate-900 px-2 py-1 rounded-md">Tickets</Link>
              <Link href="/stats" className="text-sm text-slate-700 font-semibold px-2 py-1 rounded-md">Rapports</Link>
              <Link href="/products" className="text-sm text-slate-600 hover:text-slate-900 px-2 py-1 rounded-md">Produits</Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button className="hidden sm:inline-flex items-center px-3 py-1.5 border rounded-md text-sm bg-slate-50 hover:bg-slate-100">
              <span className="text-slate-700">Mon Compte</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
