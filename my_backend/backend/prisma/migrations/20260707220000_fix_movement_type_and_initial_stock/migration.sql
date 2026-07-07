-- ============================================================
-- 1. Ajout de initialStock sur Product
--    On l'initialise avec la quantité actuelle pour les produits
--    déjà existants (meilleure valeur par défaut possible faute
--    d'historique), puis le champ ne sera plus jamais modifié
--    par l'application.
-- ============================================================
ALTER TABLE "Product" ADD COLUMN "initialStock" INTEGER NOT NULL DEFAULT 0;
UPDATE "Product" SET "initialStock" = "quantity";

-- ============================================================
-- 2. Correction de l'enum MovementType
--    Ancienne valeur en base : IN, OUT, ADJUSTMENT
--    Nouvelle valeur voulue  : CREATION, RECHARGE, SALE, ADJUSTMENT
--    Postgres ne permet pas de renommer/retirer des valeurs
--    d'un enum directement -> on recrée le type et on migre
--    les lignes existantes.
-- ============================================================
ALTER TYPE "MovementType" RENAME TO "MovementType_old";

CREATE TYPE "MovementType" AS ENUM ('CREATION', 'RECHARGE', 'SALE', 'ADJUSTMENT');

ALTER TABLE "StockMovement"
  ALTER COLUMN "type" TYPE "MovementType"
  USING (
    CASE "type"::text
      WHEN 'IN' THEN 'RECHARGE'
      WHEN 'OUT' THEN 'SALE'
      WHEN 'ADJUSTMENT' THEN 'ADJUSTMENT'
      ELSE 'ADJUSTMENT'
    END
  )::"MovementType";

DROP TYPE "MovementType_old";

-- ============================================================
-- 3. Sale : suppression de productName (on garde productId,
--    la relation vers Product suffit et reste correcte même
--    si le nom du produit change plus tard).
-- ============================================================
ALTER TABLE "Sale" DROP COLUMN "productName";

-- ============================================================
-- 4. Index pour accélérer les agrégations de la route
--    GET /products/:id/details (par productId et storeId).
-- ============================================================
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");
CREATE INDEX "StockMovement_storeId_idx" ON "StockMovement"("storeId");
CREATE INDEX "Sale_productId_idx" ON "Sale"("productId");
CREATE INDEX "Sale_storeId_idx" ON "Sale"("storeId");
