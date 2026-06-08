import { Sidebar } from "@/components/Sidebar";
import { DashboardCard } from "@/components/DashboardCard";

export default function DashboardPage() {
  return (
    <div className="flex">
      <Sidebar />

      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-8">
          Dashboard
        </h1>

        <div className="grid grid-cols-3 gap-4">
          <DashboardCard
            title="Chiffre d'affaires"
            value="250 000 FCFA"
          />

          <DashboardCard
            title="Produits"
            value="124"
          />

          <DashboardCard
            title="Ventes"
            value="32"
          />
        </div>
      </main>
    </div>
  );
}