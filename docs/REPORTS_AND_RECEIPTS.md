# Documentation technique — Reports & Receipts

Ce document décrit les modules Rapports (`backend/src/reports/`) et Reçus (`backend/src/receipts/`) tels qu'implémentés actuellement.

## Fichiers concernés

Frontend
- `frontend/src/components/ReportsStats.tsx` — composant principal pour la page Rapports & Statistiques (Recharts + lucide-react)
- `frontend/src/app/stats/page.tsx` — page `/stats` (KPIs, séries de ventes, drill-down par jour)
- `frontend/src/app/stats/cashiers/page.tsx` — statistiques dédiées aux caissiers
- `frontend/src/app/receipts/page.tsx` — liste des reçus et impression de ticket
- `frontend/src/app/receipts/[id]/page.tsx` — détail/réimpression d'un reçu

Backend
- `backend/src/reports/reports.controller.ts`, `reports.service.ts`, `reports.module.ts`
- `backend/src/receipts/receipts.controller.ts`, `receipts.service.ts`, `receipts.module.ts`

## Il n'existe pas de modèle `Receipt` en base

Il n'y a pas de table `Receipt` dédiée dans `backend/prisma/schema.prisma`. Un "reçu" est simplement une **vente** (`model Sale`, avec ses `SaleItem`) : `ReceiptsService` interroge directement `prisma.sale.findMany()` / `findUnique()` et met en forme le résultat. Toute évolution du contenu d'un reçu (champs affichés, remise, etc.) passe donc par le modèle `Sale`, pas par un modèle séparé.

## Endpoints

Rapports (`/reports`, JWT requis, rôles ADMIN/MANAGER/CASHIER selon la route)
- `GET /reports/kpis?start=ISO&end=ISO&storeId=?`
  - Réponse : `{ totalRevenue: number, inventoryValue: number, currency: string }`
  - `totalRevenue` = somme des ventes dont `createdAt` est dans `[start, end]`.
  - `inventoryValue` = valeur du stock **à la date `end`**, reconstituée à partir des mouvements de stock (`StockMovement`, delta signé) cumulés jusqu'à cette date pour chaque produit, valorisée au prix de vente **actuel** du produit (il n'y a pas d'historique des prix en base — seule la quantité est reconstituée dans le temps).
- `GET /reports/sales-series` (alias `GET /reports/sales/series`) `?period=week|month|year&start=ISO&end=ISO&storeId=?`
  - Réponse : `[{ date: 'YYYY-MM-DD' | 'YYYY-MM', amount: number }, ...]`
- `GET /reports/sales/day?date=YYYY-MM-DD&storeId=?`
  - Réponse : `[{ id, productName, quantity, time, amount }, ...]`
- `GET /reports/stores-perf` (alias `GET /reports/stores/performance`) `?start=ISO&end=ISO&storeId=?`
  - Réponse : `[{ storeId, storeName, salesAmount, salesCount }, ...]`
- `GET /reports/cashiers/daily-products?start=ISO&end=ISO&storeId=?&userId=?`
  - Réponse : détail des ventes groupées par caissier, avec stock restant par produit.

Toutes les routes acceptent aussi `startDate`/`endDate` comme alias de `start`/`end`.

Reçus (`/receipts`, JWT requis, rôles ADMIN/MANAGER/CASHIER)
- `GET /receipts` — reçus de tous les magasins autorisés de l'utilisateur (jamais tous les magasins de l'application).
- `GET /receipts/store/:storeId` — reçus d'un magasin précis (accès vérifié).
- `GET /receipts/:id`
  - Réponse (exemple) :
  ```json
  {
    "id": 12,
    "invoiceNumber": "FAC-1234567890",
    "createdAt": "2026-08-01T10:00:00Z",
    "storeId": 1,
    "totalAmount": 4200,
    "subtotal": 4200,
    "discountType": null,
    "discountAmount": 0,
    "items": [{ "id": 1, "productId": 3, "product": { "name": "Sac" }, "quantity": 21, "unitPrice": 42, "total": 882 }]
  }
  ```

## Exemples d'appels (curl)

```bash
# KPIs
curl "${API}/reports/kpis?start=2026-08-01T00:00:00Z&end=2026-08-07T23:59:59Z" -H "Authorization: Bearer <token>"

# Séries de ventes
curl "${API}/reports/sales-series?period=week&start=2026-08-03T00:00:00Z&end=2026-08-09T23:59:59Z" -H "Authorization: Bearer <token>"

# Liste des reçus
curl "${API}/receipts" -H "Authorization: Bearer <token>"
```

## Points d'attention

- Les montants sont renvoyés en `number` (conversion depuis `Decimal`/`Float` Prisma) pour éviter des problèmes de sérialisation JSON côté frontend.
- Toutes les routes sont protégées par JWT et filtrées par magasin possédé/assigné (`assertStoreAccess` / `buildStoreIdWhere`, voir `backend/src/common/utils/store-access.util.ts`) — un ADMIN ne voit que ses propres magasins, jamais ceux d'un autre commerce.
- Le lieu affiché sur un reçu imprimé est celui renseigné sur la fiche magasin (`Store.location`), affiché tel quel — le frontend n'ajoute plus de mention de pays automatique.

## Tests / Validation manuelle

- `/stats` : changer de période (semaine/mois/année), naviguer sur une période passée où des ventes existent et vérifier que le chiffre d'affaires **et** la valeur d'inventaire changent en conséquence, drill-down sur un jour.
- `/products` : le compteur doit afficher `X / Y` ; créer un produit dont le nom reprend les mêmes mots qu'un produit existant dans un ordre différent doit afficher un avertissement (pas un blocage).
- `/receipts` et `/receipts/:id` : impression d'un ticket, vérifier que le lieu affiché correspond à celui du magasin.
