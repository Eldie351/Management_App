# OctoStock

OctoStock est une application SaaS de gestion de stock et de caisse destinée aux petits commerces multi-magasins (boutiques, pharmacies, supérettes, PME) : suivi de l'inventaire, enregistrement des ventes, réapprovisionnement, rapports et statistiques en temps réel.

Chaque **ADMIN** possède un ou plusieurs magasins et y affecte des **MANAGER**/**CASHIER** ; chaque compte n'a accès qu'aux magasins qu'il possède ou auxquels il est affecté (isolation multi-tenant stricte, cf. [Sécurité](#sécurité)).

## Sommaire

- [Stack technique](#stack-technique)
- [Fonctionnalités](#fonctionnalités)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Variables d'environnement](#variables-denvironnement)
- [Base de données (Prisma)](#base-de-données-prisma)
- [Lancer le projet](#lancer-le-projet)
- [Build de production](#build-de-production)
- [Structure du projet](#structure-du-projet)
- [API — vue d'ensemble](#api--vue-densemble)
- [Sécurité](#sécurité)
- [Documentation complémentaire](#documentation-complémentaire)

---

## Stack technique

**Backend** — `backend/`
- [NestJS 11](https://nestjs.com/) (TypeScript)
- [Prisma 7](https://www.prisma.io/) + PostgreSQL
- Authentification JWT (`@nestjs/passport`, `passport-jwt`), hash des mots de passe avec `bcrypt`
- Emails transactionnels via [Resend](https://resend.com/) (réinitialisation de mot de passe)
- Export de données en Excel (`exceljs`) et PDF (`pdfkit`)

**Frontend** — `frontend/`
- [Next.js 16](https://nextjs.org/) (App Router) + React 19
- Tailwind CSS 4, Radix UI, Recharts (graphiques), Zustand (état global)

## Fonctionnalités

- **Authentification & comptes** : inscription/connexion (JWT), mot de passe oublié / réinitialisation par email, gestion du personnel (MANAGER/CASHIER) par l'ADMIN.
- **Magasins** : création/édition/suppression de magasins, devise par magasin (XOF, EUR, USD, GBP, NGN), statistiques par magasin et par période.
- **Produits & stock** : création/édition/suppression (soft delete), catégories, fournisseurs, mouvements de stock (création, vente, réapprovisionnement, ajustement manuel), seuils d'alerte (minimum/sécurité/optimal) et suggestions de réapprovisionnement, export Excel/PDF de l'inventaire.
- **Ventes & caisse** : enregistrement de ventes avec génération de facture, historique des ventes et des reçus, impression de reçu.
- **Rapports & statistiques** : chiffre d'affaires, valeur d'inventaire, ventes par période (semaine/mois/année) avec drill-down par jour, performance par magasin, statistiques dédiées aux caissiers.
- **Notifications** : alertes de seuil de stock bas.
- **Taux de change** : conversion multi-devises avec cache et rafraîchissement automatique (cron) via une API externe (clé optionnelle).
- **Journal d'audit** : traçabilité des actions sensibles (création/modification/suppression de produits, ventes, etc.), consultable par l'ADMIN.

## Prérequis

- Node.js ≥ 20 (LTS recommandé)
- npm (des `package-lock.json` sont fournis pour le back et le front)
- PostgreSQL ≥ 13 (local, Docker, ou service managé type Neon/Supabase)
- Git

## Installation

```bash
git clone https://github.com/Eldie351/Management_App.git
cd Management_App
```

### 1) Backend

```bash
cd backend
npm install          # exécute aussi `prisma generate` via le hook postinstall
cp .env.example .env # puis renseignez les valeurs (voir tableau ci-dessous)
```

> Il n'existe pas encore de fichier `.env.example` versionné : créez `backend/.env` directement à partir du tableau des [variables d'environnement](#variables-denvironnement).

### 2) Frontend

```bash
cd ../frontend
npm install
```

Créez `frontend/.env.local` :

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Variables d'environnement

### Backend (`backend/.env`)

| Variable | Obligatoire | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Chaîne de connexion PostgreSQL, ex : `postgresql://user:password@localhost:5432/octostock` |
| `JWT_SECRET` | ✅ | Secret de signature des JWT. **Aucune valeur par défaut** : le serveur refuse de démarrer si elle est absente. Générez une valeur forte, ex : `openssl rand -base64 48` |
| `PORT` | non | Port d'écoute de l'API (défaut : `3001`) |
| `NODE_ENV` | non | `development` / `production`. Contrôle notamment si le lien de réinitialisation de mot de passe est renvoyé dans la réponse API |
| `FRONTEND_URL` | recommandé | Base URL du frontend, utilisée pour construire le lien de réinitialisation de mot de passe (ex : `http://localhost:3000`) |
| `RESEND_API_KEY` | non | Clé API [Resend](https://resend.com/) pour l'envoi réel des emails de réinitialisation. Sans clé, le lien est simplement affiché dans les logs serveur |
| `EMAIL_FROM` | non | Adresse d'expéditeur des emails (défaut : `Octostock <onboarding@resend.dev>`) |
| `SHOW_RESET_LINK` | non | `true` pour renvoyer le lien de réinitialisation dans la réponse API même en production (utile pour les démos, à désactiver sinon) |
| `OPENEXCHANGERATES_API_KEY` | non | Clé API pour les taux de change ([openexchangerates.org](https://openexchangerates.org/)). Sans clé, le service retombe sur l'API gratuite `exchangerate.host` |

### Frontend (`frontend/.env.local`)

| Variable | Obligatoire | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | recommandé | URL de base de l'API backend (défaut si absent : `http://localhost:3001`) |

## Base de données (Prisma)

Le schéma se trouve dans `backend/prisma/schema.prisma`, les migrations dans `backend/prisma/migrations/`.

```bash
cd backend

# Appliquer les migrations existantes (première installation / nouvelle machine)
npx prisma migrate deploy

# En développement, après une modification du schema :
npx prisma migrate dev --name ma_migration

# Regénérer le client Prisma si besoin (déjà fait par postinstall) :
npx prisma generate
```

Il n'y a pas de script de seed : le premier compte doit être créé via `POST /auth/register` (il reçoit le rôle `ADMIN` par défaut), puis cet ADMIN crée ses magasins et son personnel.

## Lancer le projet

Deux terminaux, à la racine du repo :

```bash
# Terminal 1 — backend (http://localhost:3001)
cd backend
npm run start:dev

# Terminal 2 — frontend (http://localhost:3000)
cd frontend
npm run dev
```

Ouvrez `http://localhost:3000`, créez un compte via la page d'inscription, puis créez un magasin en tant qu'ADMIN.

## Build de production

```bash
# Backend
cd backend
npm run build
npm run start:prod

# Frontend
cd frontend
npm run build
npm start
```

> Note : `frontend/next.config.ts` a `typescript.ignoreBuildErrors: true` — le build Next ignore les erreurs de typage. Pensez à lancer `npm run lint` / `tsc --noEmit` séparément en CI pour ne pas laisser passer de régressions silencieusement.

## Structure du projet

```
Management_App/
├── backend/                 # API NestJS
│   ├── prisma/               # schema.prisma + migrations
│   └── src/
│       ├── auth/              # login, register, reset password, JWT strategy/guard
│       ├── users/              # utilisateurs, magasins, produits, catégories, fournisseurs
│       │   └── stores/
│       ├── sales/             # ventes / facturation
│       ├── receipts/           # historique des reçus
│       ├── reports/            # KPIs, séries de ventes, performance magasins
│       ├── notifications/      # alertes de stock
│       ├── audit-log/          # journal d'audit
│       ├── exchange-rate/      # taux de change multi-devises
│       └── common/             # guards, decorators, utilitaires partagés (dont l'isolation multi-tenant)
└── frontend/                 # Application Next.js (App Router)
    └── src/
        ├── app/                # pages (products, sales, receipts, stats, stores, ...)
        ├── components/          # composants UI partagés
        └── lib/                 # helpers (auth, formatage, échappement HTML, ...)
```

## API — vue d'ensemble

Toutes les routes ci-dessous requièrent un header `Authorization: Bearer <token>` (obtenu via `/auth/login`), sauf mention contraire. L'accès est en plus restreint par rôle (`ADMIN` / `MANAGER` / `CASHIER`) et par magasin possédé/assigné.

| Domaine | Base | Exemples |
|---|---|---|
| Auth | `/auth` | `POST /register`, `POST /login`, `POST /forgot-password`, `POST /reset-password`, `GET /profil` |
| Utilisateurs | `/users` | `GET /me`, `POST /staff`, `GET /staff`, `PATCH /:id/role`, `DELETE /:id` |
| Magasins | `/stores` | `POST /`, `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `GET /:id/stats` |
| Produits | `/products` | `POST /`, `GET /store/:storeId`, `PATCH /:id`, `DELETE /:id`, `PATCH /:id/recharge`, `PATCH /:id/adjust`, `GET /low-stock`, `GET /out-of-stock`, `GET /store/:storeId/export/excel`, `GET /store/:storeId/export/pdf` |
| Catégories | `/categories` | `POST /`, `GET /store/:id`, `PATCH /:id`, `DELETE /:id` |
| Fournisseurs | `/suppliers` | `POST /`, `GET /`, `GET /store/:id`, `PATCH /:id`, `DELETE /:id` |
| Ventes | `/sales` | `POST /`, `GET /store/:storeId`, `GET /:id`, `DELETE /:id` |
| Reçus | `/receipts` | `GET /`, `GET /store/:storeId`, `GET /:id` |
| Rapports | `/reports` | `GET /kpis`, `GET /sales/series`, `GET /sales/day`, `GET /stores/performance`, `GET /cashiers/daily-products` |
| Notifications | `/notifications` | `GET /store/:storeId`, `PATCH /:id/read` |
| Taux de change | `/api/exchange-rates` | `GET /`, `GET /info`, `GET /convert`, `POST /refresh` (ADMIN) |
| Audit | `/audit-logs` | `GET /` (ADMIN) |

## Sécurité

L'isolation multi-tenant (un ADMIN/MANAGER/CASHIER n'accède qu'aux données de ses propres magasins) est centralisée dans `backend/src/common/utils/store-access.util.ts` et utilisée par l'ensemble des contrôleurs/services. Les correctifs récents notables :

- Suppression du secret JWT par défaut : `JWT_SECRET` est obligatoire, le serveur refuse de démarrer sinon.
- Vérification stricte d'appartenance au magasin sur toutes les routes magasins/produits/ventes/reçus/rapports (auparavant certains chemins laissaient un ADMIN accéder aux données d'un autre commerce).
- Vérification que `categoryId`/`supplierId` appartiennent bien au même magasin lors de la création/modification d'un produit.
- Blocage de la création d'un produit portant un nom déjà utilisé (non archivé) dans le même magasin.
- Authentification requise sur les endpoints de taux de change (`/refresh`, etc.), auparavant accessibles sans token.
- Correction d'une faille XSS stockée (nom client/produit injecté tel quel dans la fenêtre d'impression du reçu) et remplacement de `document.write` par un rendu DOM sûr.

Points connus à améliorer (aucun correctif appliqué à ce jour) :

- **Absence de rate limiting** sur `/auth/login`, `/auth/register`, `/auth/forgot-password` : rien n'empêche aujourd'hui une attaque par force brute ou credential stuffing. Recommandation : `@nestjs/throttler`.
- **CORS ouvert à toutes les origines** (`app.enableCors()` sans configuration) : à restreindre à l'origine du frontend en production.
- **Token de réinitialisation de mot de passe stocké en clair** dans la table `ResetToken` : un accès en lecture à la base suffirait à réinitialiser un mot de passe pendant la fenêtre de validité (30 min). Recommandation : stocker un hash (SHA-256) du token plutôt que sa valeur brute.
- Le lien de réinitialisation est systématiquement journalisé en clair dans les logs serveur (`console.log`), y compris en production — à réserver au mode debug.
- Le token JWT est stocké côté frontend dans `localStorage` : pratique standard pour une SPA, mais cela signifie qu'une XSS (même mineure) suffirait à voler la session d'un utilisateur ; à garder en tête vu les deux failles XSS déjà corrigées.
- Pas d'en-têtes de sécurité HTTP (`helmet`) sur l'API.

## Documentation complémentaire

- `docs/REPORTS_AND_RECEIPTS.md` — détail technique des modules Rapports & Reçus.
- `EXCHANGE_RATE_SETUP.md`, `IMPLEMENTATION_SUMMARY.md` — notes historiques sur la mise en place du système de taux de change (certaines variables d'environnement qui y sont décrites, comme `OPENEXCHANGERATES_API_KEY`, sont optionnelles dans l'implémentation actuelle ; d'autres exemples de ces fichiers sont obsolètes).

## Auteur

Kimberly Degnon

## Licence

Projet développé à des fins éducatives et entrepreneuriales.
