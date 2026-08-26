'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Reveal from '@/components/Reveal';
import BrowserFrame from '@/components/BrowserFrame';
import Lightbox from '@/components/Lightbox';
import {
  Boxes,
  Warehouse,
  Package,
  ShoppingCart,
  BarChart3,
  ReceiptText,
  BellRing,
  ShieldCheck,
  FileSpreadsheet,
  Users,
  UserCog,
  ArrowRight,
  Check,
  Crown,
  ShoppingBag,
} from 'lucide-react';

const featureGrid = [
  {
    icon: Warehouse,
    accent: 'bg-indigo-50 text-indigo-600',
    title: 'Multi-entrepôts',
    description: "Gérez autant de magasins ou d'entrepôts que nécessaire, chacun avec sa propre devise et son propre inventaire.",
  },
  {
    icon: Package,
    accent: 'bg-violet-50 text-violet-600',
    title: 'Suivi de stock en temps réel',
    description: 'Chaque vente met à jour la quantité disponible instantanément, magasin par magasin.',
  },
  {
    icon: BellRing,
    accent: 'bg-amber-50 text-amber-600',
    title: 'Alertes de seuil',
    description: "Stock faible ou rupture : les produits concernés remontent automatiquement, sans avoir à les chercher.",
  },
  {
    icon: ShoppingCart,
    accent: 'bg-emerald-50 text-emerald-600',
    title: 'Ventes & encaissement',
    description: 'Enregistrez une vente en quelques clics, la caisse déduit le stock et archive la transaction.',
  },
  {
    icon: ReceiptText,
    accent: 'bg-blue-50 text-blue-600',
    title: 'Reçus & historique',
    description: 'Chaque vente génère un reçu numéroté, consultable et imprimable à tout moment.',
  },
  {
    icon: BarChart3,
    accent: 'bg-rose-50 text-rose-600',
    title: 'Rapports & analyses',
    description: "Chiffre d'affaires, valeur d'inventaire et performance par magasin, visualisés sur la période de votre choix.",
  },
  {
    icon: ShieldCheck,
    accent: 'bg-indigo-50 text-indigo-600',
    title: 'Rôles & permissions',
    description: 'Administrateur, Manager ou Caissier : chacun accède uniquement à ce dont il a besoin.',
  },
  {
    icon: FileSpreadsheet,
    accent: 'bg-teal-50 text-teal-600',
    title: 'Export Excel & PDF',
    description: "Sortez vos données d'inventaire et vos rapports en un clic pour les partager ou les archiver.",
  },
];

const roles = [
  {
    icon: Crown,
    label: 'Administrateur',
    accent: 'bg-indigo-500 text-white',
    description: "Vue complète sur l'activité de l'entreprise.",
    perms: ['Crée et supprime les entrepôts', "Gère les comptes managers et caissiers", 'Accès à tous les rapports', 'Export Excel & PDF'],
  },
  {
    icon: UserCog,
    label: 'Manager',
    accent: 'bg-violet-500 text-white',
    description: "Pilote un ou plusieurs magasins au quotidien.",
    perms: ['Gère les produits et les ventes', 'Consulte les rapports de ses magasins', "Suit les alertes de stock", 'Historique des transactions'],
  },
  {
    icon: ShoppingBag,
    label: 'Caissier',
    accent: 'bg-emerald-500 text-white',
    description: 'Se concentre sur la vente en point de caisse.',
    perms: ['Enregistre les ventes', 'Consulte le catalogue produits', 'Suit ses propres statistiques', 'Retrouve ses reçus émis'],
  },
];

const steps = [
  {
    number: '01',
    title: 'Créez vos entrepôts',
    description: 'Un par boutique ou par point de stockage, avec sa localisation et sa devise.',
  },
  {
    number: '02',
    title: 'Importez vos produits',
    description: 'Renseignez quantités et seuils d\u2019alerte pour chaque article suivi.',
  },
  {
    number: '03',
    title: 'Vendez et suivez en temps réel',
    description: 'Chaque vente met à jour le stock et alimente vos rapports automatiquement.',
  },
];

const navLinks = [
  { href: '#tableau-de-bord', label: 'Tableau de bord' },
  { href: '#rapports', label: 'Rapports' },
  { href: '#transactions', label: 'Transactions' },
  { href: '#fonctionnalites', label: 'Fonctionnalités' },
  { href: '#roles', label: 'Rôles' },
];

export default function LandingPage() {
  const router = useRouter();
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  return (
    <div className="min-h-screen bg-white">
      {/* HEADER */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-lg bg-indigo-500 text-white">
              <Boxes size={22} />
            </span>
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              Octo<span className="text-indigo-600">Stock</span>
            </span>
          </div>

          <nav className="hidden flex-1 items-center justify-center gap-8 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-500 transition-colors hover:text-indigo-600"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Button variant="ghost" onClick={() => router.push('/login')} className="font-medium">
              Connexion
            </Button>
            <Button onClick={() => router.push('/register')} className="bg-indigo-600 font-medium hover:bg-indigo-700">
              Créer un compte
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 -z-10 flex justify-center blur-3xl"
        >
          <div className="aspect-[1200/500] w-[1200px] bg-gradient-to-tr from-indigo-200 via-violet-100 to-transparent opacity-60" />
        </div>

        <div className="mx-auto max-w-5xl px-6 pt-16 pb-8 text-center md:pt-24">
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-700">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-600">
              <span className="size-1.5 rounded-full bg-indigo-500" />
              Gestion de stock multi-entrepôts
            </span>
          </div>

          <h1 className="animate-in fade-in slide-in-from-bottom-3 duration-700 delay-100 fill-mode-both mx-auto mt-5 max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 md:text-6xl">
            Prenez le contrôle total de vos entrepôts et marchandises
          </h1>
          <p className="animate-in fade-in slide-in-from-bottom-3 duration-700 delay-200 fill-mode-both mx-auto mt-5 max-w-2xl text-lg text-slate-500 md:text-xl">
            Suivez vos stocks, enregistrez vos ventes et analysez vos performances financières depuis une interface unique, magasin par magasin.
          </p>

          <div className="animate-in fade-in slide-in-from-bottom-3 duration-700 delay-300 fill-mode-both mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              onClick={() => router.push('/register')}
              className="h-12 w-full bg-indigo-600 text-base font-semibold shadow-md shadow-indigo-200 transition-transform hover:scale-[1.02] hover:bg-indigo-700 sm:w-56"
            >
              Démarrer gratuitement
              <ArrowRight className="size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push('/login')}
              className="h-12 w-full border-slate-200 bg-white text-base font-medium shadow-sm sm:w-56"
            >
              Découvrir l'interface
            </Button>
          </div>
        </div>

        {/* FLOATING PRODUCT SHOT */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500 fill-mode-both mx-auto max-w-6xl px-4 pb-20 sm:px-6 md:pb-28">
          <div className="animate-float">
            <BrowserFrame
              src="/screenshots/dashboard.png"
              alt="Tableau de bord OctoStock"
              priority
              onClick={() => setLightbox({ src: '/screenshots/dashboard.png', alt: 'Tableau de bord OctoStock' })}
            />
          </div>
        </div>
      </section>

      {/* FEATURE TOUR */}
      <section className="mx-auto max-w-[1400px] space-y-28 px-4 py-8 sm:px-6 md:py-16">
        {/* 1. Dashboard — image offset left */}
        <div id="tableau-de-bord" className="scroll-mt-24">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Tableau de bord</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Toute votre activité, résumée en un coup d'œil
            </h2>
            <p className="mt-4 text-slate-500">
              Entrepôts actifs, produits suivis, stock faible et ruptures : le tableau de bord affiche
              les chiffres qui comptent dès la connexion, adaptés au rôle de chaque utilisateur.
            </p>
            <ul className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2">
              {['Vue consolidée de tous vos magasins', 'Alertes de stock faible et de rupture séparées', 'Création rapide d\u2019un nouvel entrepôt'].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                  <Check className="size-4 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={100} className="mt-10 md:w-[94%]">
            <BrowserFrame
              src="/screenshots/dashboard.png"
              alt="Tableau de bord OctoStock avec entrepôts et alertes de stock"
              onClick={() =>
                setLightbox({ src: '/screenshots/dashboard.png', alt: 'Tableau de bord OctoStock avec entrepôts et alertes de stock' })
              }
            />
          </Reveal>
        </div>

        {/* 2. Reports — image offset right */}
        <div id="rapports" className="scroll-mt-24">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Rapports & statistiques</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Des chiffres qui parlent argent, pas juste des quantités
            </h2>
            <p className="mt-4 text-slate-500">
              Chiffre d'affaires réel, valeur d'inventaire et historique des ventes par jour, mois ou
              année. Comparez la performance de chaque magasin sur la période de votre choix.
            </p>
            <ul className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2">
              {['Chiffre d\u2019affaires et valeur de stock en temps réel', 'Historique des ventes filtrable par période', 'Répartition des ventes magasin par magasin'].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                  <Check className="size-4 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={100} className="mt-10 md:ml-auto md:w-[94%]">
            <BrowserFrame
              src="/screenshots/reports.png"
              alt="Rapports et statistiques OctoStock avec historique des ventes"
              onClick={() =>
                setLightbox({ src: '/screenshots/reports.png', alt: 'Rapports et statistiques OctoStock avec historique des ventes' })
              }
            />
          </Reveal>
        </div>

        {/* 3. Transactions — image offset left */}
        <div id="transactions" className="scroll-mt-24">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Transactions</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Chaque vente, jusqu'au reçu, retrouvable en un instant
            </h2>
            <p className="mt-4 text-slate-500">
              L'historique des reçus liste chaque transaction avec son numéro de facture, le caissier
              concerné et le montant, avec une recherche instantanée.
            </p>
            <ul className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2">
              {['Numérotation automatique des factures', 'Recherche par numéro, caissier ou produit', 'Reçu consultable et imprimable à tout moment'].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                  <Check className="size-4 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={100} className="mt-10 md:w-[94%]">
            <BrowserFrame
              src="/screenshots/transactions.png"
              alt="Historique des reçus et transactions OctoStock"
              onClick={() => setLightbox({ src: '/screenshots/transactions.png', alt: 'Historique des reçus et transactions OctoStock' })}
            />
          </Reveal>
        </div>

        {/* 4. Cashier stats — image offset right */}
        <div id="suivi-caissiers" className="scroll-mt-24">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Suivi par caissier</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Un rapport quotidien pour chaque membre de l'équipe
            </h2>
            <p className="mt-4 text-slate-500">
              Ventes totales, articles vendus et valeur du stock restant, regroupés par caissier et par
              reçu, pour un suivi d'équipe transparent au jour le jour.
            </p>
            <ul className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2">
              {['Ventes et quantités par caissier', 'Détail produit par produit vendu', 'Filtrage par magasin et par période'].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                  <Check className="size-4 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={100} className="mt-10 md:ml-auto md:w-[94%]">
            <BrowserFrame
              src="/screenshots/cashier-stats.png"
              alt="Statistiques caissiers OctoStock"
              onClick={() => setLightbox({ src: '/screenshots/cashier-stats.png', alt: 'Statistiques caissiers OctoStock' })}
            />
          </Reveal>
        </div>
      </section>

      {/* FEATURE GRID RECAP */}
      <section id="fonctionnalites" className="scroll-mt-24 bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Fonctionnalités</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Tout ce qu'il faut pour piloter votre stock
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featureGrid.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <Reveal key={feature.title} delay={(i % 4) * 75}>
                  <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-lg motion-reduce:hover:translate-y-0">
                    <span className={`flex size-11 items-center justify-center rounded-xl ${feature.accent}`}>
                      <Icon className="size-5" />
                    </span>
                    <h3 className="mt-4 font-semibold text-slate-900">{feature.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{feature.description}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ROLES */}
      <section id="roles" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Rôles & permissions</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Un accès pensé pour chaque métier
          </h2>
          <p className="mt-4 text-slate-500">
            Administrateur, Manager ou Caissier : chaque compte voit exactement ce dont il a besoin,
            rien de plus.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {roles.map((role, i) => {
            const Icon = role.icon;
            return (
              <Reveal key={role.label} delay={i * 100}>
                <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <span className={`flex size-11 items-center justify-center rounded-xl ${role.accent}`}>
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-slate-900">{role.label}</h3>
                  <p className="mt-1 text-sm text-slate-500">{role.description}</p>
                  <ul className="mt-5 space-y-2.5 border-t border-slate-100 pt-5">
                    {role.perms.map((perm) => (
                      <li key={perm} className="flex items-start gap-2 text-sm text-slate-600">
                        <Check className="mt-0.5 size-4 shrink-0 text-indigo-500" />
                        {perm}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Mise en route</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Démarrez en trois étapes
            </h2>
          </Reveal>

          <div className="relative mt-14 grid gap-10 md:grid-cols-3">
            <div
              aria-hidden
              className="absolute top-6 right-[16.5%] left-[16.5%] hidden h-px bg-slate-200 md:block"
            />
            {steps.map((step, i) => (
              <Reveal key={step.number} delay={i * 120} className="relative text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full border-4 border-slate-50 bg-indigo-600 font-mono text-sm font-bold text-white">
                  {step.number}
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-1.5 text-sm text-slate-500">{step.description}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-[#12142B] px-8 py-16 text-center">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-indigo-500/20 via-transparent to-violet-500/20"
            />
            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-300">
                <Users className="size-3.5" />
                Pour toute votre équipe
              </span>
              <h2 className="mx-auto mt-5 max-w-xl text-3xl font-bold tracking-tight text-white md:text-4xl">
                Prêt à reprendre le contrôle de votre stock ?
              </h2>
              <p className="mx-auto mt-4 max-w-md text-slate-400">
                Créez votre premier entrepôt et commencez à suivre vos produits dès aujourd'hui.
              </p>
              <Button
                size="lg"
                onClick={() => router.push('/register')}
                className="mt-8 h-12 bg-indigo-500 px-8 text-base font-semibold shadow-lg shadow-indigo-950/50 transition-transform hover:scale-[1.02] hover:bg-indigo-400"
              >
                Créer mon compte
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200/60 bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-500 text-white">
              <Boxes size={15} />
            </span>
            <span className="font-bold tracking-tight text-slate-900">
              Octo<span className="text-indigo-600">Stock</span>
            </span>
          </div>
          <p className="text-sm text-slate-400">© 2026 OctoStock. Tous droits réservés.</p>
          <div className="flex gap-6 text-sm text-slate-400">
            <span className="cursor-pointer hover:text-slate-600">Conditions</span>
            <span className="cursor-pointer hover:text-slate-600">Confidentialité</span>
          </div>
        </div>
      </footer>

      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
    </div>
  );
}
