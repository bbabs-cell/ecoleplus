/**
 * Utilitaires de présentation des fichiers.
 *
 * Module volontairement SANS AUCUN IMPORT : il traverse la frontière
 * serveur/client. Le placer dans `services/fichiers.ts` entraînerait
 * `next/headers` dans le paquet du navigateur — la même erreur que
 * `services/formulaire.ts` évite depuis la phase 1.
 */

/** Taille lisible, sans prétendre à une précision que l'octet ne porte pas. */
export function tailleLisible(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}
