export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET n'est pas défini. Définissez cette variable d'environnement avant de démarrer l'application.",
    );
  }
  return secret;
}
