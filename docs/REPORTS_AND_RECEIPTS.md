# Documentation technique — Reports & Receipts

Ce document décrit les ajouts effectués sur la branche `feature/reports-stats-prisma-nextjs` : composants frontend, endpoints backend et modèles Prisma recommandés.

## Fichiers ajoutés / modifiés (principaux)

Frontend
- frontend/src/components/ReportsStats.tsx — composant principal pour la page Rapports & Statistiques (Recharts + lucide-react)
- frontend/src/app/stats/page.tsx — intégration du composant sur la page /stats
- frontend/src/app/products/page.tsx — affichage du compteur total produits (X / Y)
- frontend/src/app/receipts/page.tsx — page liste des reçus
- frontend/src/app/receipts/[id]/page.tsx — page détail reçu

Backend
- backend/src/reports/reports.controller.ts
- backend/src/reports/reports.service.ts
- backend/src/reports/reports.module.ts
- backend/src/receipts/receipts.controller.ts
- backend/src/receipts/receipts.service.ts
- backend/src/receipts/receipts.module.ts
- backend/src/prisma/prisma.service.ts
- backend/src/exchange-rate/exchange-rate-cron.service.ts (protection contre exécutions concurrentes)

## Endpoints et shapes JSON

Rapports
- GET /api/reports/kpis?start=ISO&end=ISO
  - Response: { totalRevenue: number, inventoryValue: number, currency: string }

- GET /api/reports/sales/series?period=week|month|year&start=ISO&end=ISO
  - Response: [{ date: 'YYYY-MM-DD'|'YYYY-MM', amount: number }, ...]

- GET /api/reports/sales/day?date=YYYY-MM-DD
  - Response: [{ id, productName, quantity, time, amount }, ...]

- GET /api/reports/stores?start=ISO&end=ISO
  - Response: [{ storeId, storeName, salesAmount }, ...]

Receipts
- GET /receipts
- GET /receipts/store/:storeId
- GET /receipts/:id
  - Receipt response (example):
  {
    id: string,
    createdAt: string,
    supplierName?: string,
    storeId?: string,
    totalAmount: number,
    currency?: string,
    items: [{ id, productId?, productName?, quantity: number, unitPrice: number }]
  }

## Exemples d'appels (curl)

- KPIs
```bash
curl "${API}/api/reports/kpis?start=2026-08-01T00:00:00Z&end=2026-08-07T23:59:59Z" -H "Authorization: Bearer <token>"
```

- Sales series
```bash
curl "${API}/api/reports/sales/series?period=week&start=2026-08-03T00:00:00Z&end=2026-08-09T23:59:59Z" -H "Authorization: Bearer <token>"
```

- Receipts list
```bash
curl "${API}/receipts" -H "Authorization: Bearer <token>"
```

## Snippet Prisma (schema.prisma) recommandé pour Receipts

```prisma
model Receipt {
  id           String       @id @default(cuid())
  createdAt    DateTime     @default(now())
  supplierName String?
  storeId      String?
  totalAmount  Decimal      @default(0)
  currency     String?      @default("XOF")
  items        ReceiptItem[]
}

model ReceiptItem {
  id          String   @id @default(cuid())
  receiptId   String
  productId   String?
  productName String?
  quantity    Int
  unitPrice   Decimal
  receipt     Receipt  @relation(fields: [receiptId], references: [id])
}
```

Après avoir ajouté ce modèle :
```bash
cd backend
npx prisma generate
npx prisma migrate dev --name add_receipts
```

## Points d'attention

- Les requêtes SQL raw dans `reports.service.ts` utilisent des fonctions Postgres (`date_trunc`, `to_char`) — si vous utilisez MySQL adaptez ces queries.
- Les montants sont renvoyés sous forme `number` (conversion depuis Decimal) pour éviter des problèmes JSON côté frontend.
- Protégez les endpoints via des Guards (JWT) en production.
- Limitez la période d'agrégation pour éviter des requêtes lourdes.

## Tests / Validation

- Vérifier la page `/stats` : testez changement de période, drill-down sur un jour, et clic sur part du donut (redirige vers /stores/[id]/stats).
- Vérifier `/products` : le compteur doit afficher `X / Y`.
- Vérifier `/receipts` et `/receipts/:id`.

---

Si vous voulez que j'ajoute une section supplémentaire (ex: diagramme d'architecture, diagramme de flux, checklist de déploiement CI/CD), je peux la préparer et la pousser sur la même branche.
