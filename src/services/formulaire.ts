/**
 * État d'un formulaire piloté par une Server Action.
 *
 * Ce module est volontairement sans aucun import : il traverse la frontière
 * serveur/client, et la moindre dépendance serveur entraînerait `next/headers`
 * dans le paquet du navigateur.
 */
export type EtatFormulaire =
  | { statut: 'inactif' }
  | { statut: 'erreur'; message: string; champs?: Record<string, string> }
  | { statut: 'succes'; message: string; donnees?: Record<string, string> };

export const ETAT_INITIAL: EtatFormulaire = { statut: 'inactif' };
