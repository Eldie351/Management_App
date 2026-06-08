import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="w-64 border-r h-screen p-4 bg-white">
      <h1 className="text-2xl font-bold mb-8">
        OctoStock
      </h1>

      <nav className="space-y-2">
        <Link
          href="/dashboard"
          className="block rounded p-2 hover:bg-gray-100"
        >
          Dashboard
        </Link>

        <Link
          href="/products"
          className="block rounded p-2 hover:bg-gray-100"
        >
          Produits
        </Link>

        <Link
          href="/sales"
          className="block rounded p-2 hover:bg-gray-100"
        >
          Ventes
        </Link>

        {/* ONGLÈT DES STATISTIQUES GLOBALES */}
        <Link
          href="/stats"
          className="block rounded p-2 hover:bg-gray-100"
        >
          Statistiques
        </Link>

        <Link
          href="/profil"
          className="block rounded p-2 hover:bg-gray-100 font-medium text-gray-700"
        >
          Profil
        </Link>
      </nav>
    </aside>
  );
}
