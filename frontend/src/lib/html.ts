const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Échappe les caractères spéciaux HTML. À utiliser pour toute valeur
 * (potentiellement fournie par un utilisateur) injectée dans une chaîne HTML
 * construite manuellement (ex. reçu imprimé via document.write).
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}
