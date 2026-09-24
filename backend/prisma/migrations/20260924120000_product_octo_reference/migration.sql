-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "storeNumber" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "productSeq" INTEGER NOT NULL DEFAULT 0;

-- Rang de chaque magasin chez son propriétaire, par ordre de création.
UPDATE "Store" s
SET "storeNumber" = r.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt", "id") AS rn
  FROM "Store"
) r
WHERE s."id" = r."id";

-- Renumérotation de tous les produits existants en OCTO-a-N : a = rang du
-- magasin sur 2 chiffres, N = rang de création du produit dans son magasin
-- (archivés compris, pour ne jamais réattribuer une référence). Passage par
-- une valeur temporaire pour ne pas heurter la contrainte unique
-- (sku, storeId) pendant la mise à jour.
UPDATE "Product" SET "sku" = 'TMP-' || "id";

UPDATE "Product" p
SET "sku" = 'OCTO-' || LPAD(s."storeNumber"::text, 2, '0') || '-' || r.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "storeId" ORDER BY "createdAt", "id") AS rn
  FROM "Product"
) r, "Store" s
WHERE p."id" = r."id" AND s."id" = p."storeId";

UPDATE "Store" s
SET "productSeq" = (SELECT COUNT(*) FROM "Product" p WHERE p."storeId" = s."id");

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "sku" SET NOT NULL;
