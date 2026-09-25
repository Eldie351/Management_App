// Recherche de produits par désignation, référence OCTO-a-N ou description.

type SearchableProduct = {
  name?: string | null;
  sku?: string | null;
  description?: string | null;
};

// Ramène une référence à ses seuls caractères alphanumériques, pour que
// « octo 01 1 », « OCTO011 » ou « octo-01-1 » retrouvent OCTO-01-1.
const compact = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

export function matchesProductQuery(product: SearchableProduct, rawQuery: string) {
  const query = rawQuery.toLowerCase().trim();
  if (!query) return true;
  const compactQuery = compact(query);
  return Boolean(
    product.name?.toLowerCase().includes(query) ||
      product.description?.toLowerCase().includes(query) ||
      product.sku?.toLowerCase().includes(query) ||
      (compactQuery && product.sku && compact(product.sku).includes(compactQuery)),
  );
}

/**
 * Filtre les produits puis place en tête celui dont la référence correspond
 * exactement : taper OCTO-01-1 le fait passer devant OCTO-01-10, OCTO-01-11…
 */
export function searchProducts<T extends SearchableProduct>(products: T[], rawQuery: string): T[] {
  const matches = products.filter((p) => matchesProductQuery(p, rawQuery));
  const compactQuery = compact(rawQuery);
  if (!compactQuery) return matches;
  const exact = matches.filter((p) => p.sku && compact(p.sku) === compactQuery);
  if (exact.length === 0) return matches;
  return [...exact, ...matches.filter((p) => !exact.includes(p))];
}
