# Management_App
# OctoStock

OctoStock est une application SaaS de gestion de stock et de caisse destinée aux petits commerces, boutiques, pharmacies, supérettes et PME.

L'objectif est de fournir une solution simple, rapide et accessible permettant aux commerçants de suivre leurs stocks, enregistrer leurs ventes et consulter leurs statistiques en temps réel.

---

## Résumé des modifications récentes (Ajouts par Copilot)

Sur la branche `feature/reports-stats-prisma-nextjs` j'ai intégré plusieurs fonctionnalités front + back pour la page "Rapports & Statistiques" ainsi que l'historique des reçus :

- Frontend (Next.js / Tailwind):
  - Composant interactif `ReportsStats` (frontend/src/components/ReportsStats.tsx) :
    - KPIs (Chiffre d'Affaires, Valeur d'Inventaire)
    - Histogramme des ventes (Semaine/Mois/Année) avec drill-down jour
    - Donut chart : performance des magasins (clic → /stores/[id]/stats)
    - Skeletons pendant chargement et messages "Aucune donnée disponible"
  - Intégration page statistiques : `frontend/src/app/stats/page.tsx` (usage du composant)
  - Affichage du nombre total de produits sur la page produits : `frontend/src/app/products/page.tsx`
  - Nouvelle page Historique des reçus :
    - Liste : `frontend/src/app/receipts/page.tsx`
    - Détail : `frontend/src/app/receipts/[id]/page.tsx`

- Backend (NestJS / Prisma):
  - Module Reports (controller/service/module) : `backend/src/reports/*`
    - Endpoints exposés utilisés par le frontend:
      - GET /api/reports/kpis?start=ISO&end=ISO
      - GET /api/reports/sales/series?period=week|month|year&start=ISO&end=ISO
      - GET /api/reports/sales/day?date=YYYY-MM-DD
      - GET /api/reports/stores?start=ISO&end=ISO
  - Module Receipts (controller/service/module) : `backend/src/receipts/*`
    - Endpoints :
      - GET /receipts
      - GET /receipts/store/:storeId
      - GET /receipts/:id
  - `backend/src/prisma/prisma.service.ts` (singleton Prisma wrapper)
  - Correction du cron d'ExchangeRate pour éviter exécutions concurrentes
  - Corrections et sécurisation des requêtes SQL raw (paramétrage)

- Branche contenant les changements : `feature/reports-stats-prisma-nextjs`
  - Plusieurs commits dont :
    - chore(reports): integrate reports into frontend and backend structure
    - fix(reports): make store select clickable and use safe parameterized raw queries for sales series
    - fix(exchange-rate): prevent concurrent cron executions by adding isRunning guard
    - feat(receipts): add receipts endpoints and frontend detail page

---

## Guide rapide - exécution locale (dev)

Prérequis : Node >= 16, pnpm/npm, PostgreSQL (ou DB compatible), git

1) Récupérer la branche de travail :

```bash
git fetch origin
git checkout feature/reports-stats-prisma-nextjs
```

2) Installer dépendances

- Frontend
```bash
cd frontend
npm install
```

- Backend
```bash
cd backend
npm install
```

3) Variables d'environnement (exemples)

- Frontend: `frontend/.env.local`
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

- Backend: `backend/.env`
```
DATABASE_URL=postgresql://user:password@localhost:5432/octostock
JWT_SECRET=your_jwt_secret
```

4) Prisma (si vous avez modifié le schema)

```bash
cd backend
npx prisma generate
# si vous avez ajouté les modèles Receipt, créer une migration:
# npx prisma migrate dev --name add_receipts
```

5) Lancer les services

- Backend (dev)
```bash
cd backend
npm run start:dev
```

- Frontend (dev)
```bash
cd frontend
npm run dev
# ouvrez http://localhost:3000
```

6) Pages à tester

- /stats → page Rapports & Statistiques
- /products → inventaire (vérifier le compteur total produits)
- /receipts → liste des reçus
- /receipts/[id] → détail d'un reçu

---

## Endpoints (récapitulatif)

Rapports (backend):
- GET /api/reports/kpis?start=ISO&end=ISO
  - Response: { totalRevenue: number, inventoryValue: number, currency: string }
- GET /api/reports/sales/series?period=week|month|year&start=ISO&end=ISO
  - Response: [{ date: 'YYYY-MM-DD'|'YYYY-MM', amount: number }, ...]
- GET /api/reports/sales/day?date=YYYY-MM-DD
  - Response: [{ id, productName, quantity, time, amount }, ...]
- GET /api/reports/stores?start=ISO&end=ISO
  - Response: [{ storeId, storeName, salesAmount }, ...]

Reçus (backend):
- GET /receipts
- GET /receipts/store/:storeId
- GET /receipts/:id

(Remarques: les réponses convertissent les `Decimal` Prisma en `number` pour faciliter l'affichage.)

---

## Notes opérationnelles & sécurité

- Les requêtes raw SQL incluent des fonctions Postgres (date_trunc, to_char, ::numeric). Si votre base est MySQL, adaptez les requêtes.
- Les endpoints doivent être protégés par des guards/auth (JWT). Le frontend envoie un token depuis localStorage; le backend doit valider.
- Limitez les périodes demandées côté serveur pour éviter de lourdes agrégations (ex: max 2 ans).
- Les modifications sont sur une branche feature : testez en local et/ou via une PR preview avant de merger en production.

---

## Documentation détaillée

Voir `docs/REPORTS_AND_RECEIPTS.md` pour la description technique complète (endpoints, exemples d'API, snippet Prisma schema pour Receipt, instructions de migration, mapping des composants frontend).

---

## Auteur

Kimberly Degnon

---

## Licence

Projet développé à des fins éducatives et entrepreneuriales.
