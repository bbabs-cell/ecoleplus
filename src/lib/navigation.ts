/**
 * Destination de redirection, ramenée à un chemin interne.
 *
 * Une destination venue de l'extérieur — paramètre d'URL, champ caché, lien
 * reçu par e-mail — ne doit jamais pouvoir pointer ailleurs que sur
 * l'application : sinon la page qui l'utilise devient un tremplin, et un lien
 * portant notre domaine mène chez un tiers.
 *
 * Sont refusés : une URL absolue (`https://…`), un chemin protocole-relatif
 * (`//hote`), un chemin de contrôle (`\\hote`, que certains navigateurs
 * normalisent en `//hote`) et tout ce qui ne commence pas par `/`.
 *
 * Ce module est sans import : il est utilisé côté serveur comme côté client.
 */
export function cheminInterne(valeur: unknown, defaut = '/tableau-de-bord'): string {
  if (typeof valeur !== 'string') return defaut;
  if (!valeur.startsWith('/')) return defaut;
  if (valeur.startsWith('//')) return defaut;
  if (valeur.startsWith('/\\')) return defaut;
  return valeur;
}
