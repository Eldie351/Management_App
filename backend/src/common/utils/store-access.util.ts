import { ForbiddenException } from '@nestjs/common';

/**
 * =========================================================================
 * POURQUOI CE FICHIER EXISTE
 * =========================================================================
 * Avant, chaque contrôleur (stores, products, sales, reports, receipts...)
 * définissait sa PROPRE copie de "checkStoreAccess" / "getStoreFilter", et
 * TOUTES faisaient la même erreur :
 *
 *     if (user.role === UserRole.ADMIN) return; // accès à TOUT autorisé
 *
 * Ce raccourci suppose qu'il n'existe qu'un seul ADMIN "super-utilisateur"
 * dans toute l'application. Or le schéma (ownedStores, createdById,
 * storeAssignments) montre clairement une architecture multi-commerces :
 * chaque ADMIN est le propriétaire de SES magasins, pas de tous les magasins
 * de tous les clients de l'app.
 *
 * Conséquence concrète du bug : n'importe quel ADMIN pouvait lire, modifier
 * ou supprimer les magasins/produits/ventes/rapports d'un AUTRE commerce en
 * devinant simplement un ID dans l'URL.
 *
 * Ce fichier centralise la bonne logique UNE seule fois : un utilisateur a
 * accès à un magasin s'il le POSSÈDE (ADMIN) ou s'il y est AFFECTÉ
 * (MANAGER/CASHIER). Aucun rôle n'a de passe-droit implicite.
 * =========================================================================
 */

/**
 * Retourne la liste de tous les IDs de magasins auxquels cet utilisateur a
 * légitimement accès, tous rôles confondus :
 *  - magasins qu'il possède (ADMIN, via `ownedStores`)
 *  - son magasin principal assigné (`assignedStoreId`)
 *  - ses magasins secondaires (`storeAssignments`)
 */
export function getAllowedStoreIds(user: any): number[] {
  if (!user) return [];

  const rawIds = [
    user.assignedStoreId,
    ...(user.ownedStoreIds ?? user.ownedStores?.map((s: any) => s?.id ?? s) ?? []),
    ...(user.assignedStoreIds ??
      user.storeAssignments?.map((a: any) => a?.storeId ?? a?.store?.id ?? a) ??
      []),
  ];

  return Array.from(
    new Set(
      rawIds
        .map((id: any) => Number(id))
        .filter((id: number): id is number => Number.isInteger(id) && id > 0),
    ),
  );
}

/**
 * Vérifie qu'un utilisateur a accès à un magasin donné et lève une
 * ForbiddenException sinon. AUCUN rôle ne contourne cette vérification :
 * un ADMIN n'a accès qu'à SES magasins (ceux qu'il possède), exactement
 * comme un MANAGER/CASHIER n'a accès qu'aux siens.
 */
export function assertStoreAccess(
  user: any,
  storeId: number | string | undefined | null,
  message = "Vous n'avez pas accès à ce magasin.",
): void {
  const targetId = Number(storeId);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    throw new ForbiddenException(message);
  }

  const allowed = getAllowedStoreIds(user);
  if (!allowed.includes(targetId)) {
    throw new ForbiddenException(message);
  }
}

/**
 * Construit une clause Prisma `where` sécurisée pour filtrer par magasin(s)
 * autorisé(s). À utiliser dans les services quand on liste des ressources
 * (produits, ventes...) sans forcément cibler un magasin précis.
 *
 * - Si `requestedStoreId` est fourni : vérifie l'accès et restreint à ce seul ID.
 * - Sinon : restreint à TOUS les magasins autorisés de l'utilisateur.
 * - Si l'utilisateur n'a accès à AUCUN magasin : renvoie un filtre qui ne
 *   matche jamais rien (id: -1), plutôt que de renvoyer tout par défaut.
 */
export function buildStoreWhere(
  user: any,
  requestedStoreId?: number | string,
): { id: number } | { id: { in: number[] } } {
  const allowed = getAllowedStoreIds(user);

  if (requestedStoreId !== undefined && requestedStoreId !== null && requestedStoreId !== '') {
    const parsed = Number(requestedStoreId);
    if (Number.isInteger(parsed) && allowed.includes(parsed)) {
      return { id: parsed };
    }
    return { id: -1 }; // demandé mais non autorisé => aucun résultat
  }

  if (allowed.length === 0) {
    return { id: -1 };
  }

  return { id: { in: allowed } };
}

/**
 * Même logique que `buildStoreWhere`, mais pour les modèles où l'on filtre
 * directement sur une colonne scalaire `storeId` (Sale, Product...) plutôt
 * que sur une relation `store`. Exemple :
 *   this.prisma.sale.findMany({ where: { ...buildStoreIdWhere(user, storeId) } })
 */
export function buildStoreIdWhere(
  user: any,
  requestedStoreId?: number | string,
): { storeId: number } | { storeId: { in: number[] } } {
  const clause = buildStoreWhere(user, requestedStoreId);
  return 'id' in clause && typeof clause.id === 'number'
    ? { storeId: clause.id }
    : { storeId: (clause as { id: { in: number[] } }).id };
}
