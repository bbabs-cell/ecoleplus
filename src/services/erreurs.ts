import { ErreurPermission } from '@/services/erreur-permission';

export type { EtatFormulaire } from '@/services/formulaire';

interface ErreurPostgrest {
  message?: string;
  code?: string;
}

function estErreurPostgrest(valeur: unknown): valeur is ErreurPostgrest {
  return typeof valeur === 'object' && valeur !== null && 'message' in valeur;
}

/**
 * Traduit une erreur base en message destiné à l'utilisateur.
 *
 * Les exceptions levées par les migrations portent le préfixe `ECOLEPLUS_` et
 * un texte déjà rédigé pour être lu : on le reprend tel quel. Tout le reste est
 * remplacé par un message neutre — un détail de contrainte, de table ou de
 * requête renseignerait un attaquant sur le schéma (règles de code, 9).
 */
export function messageErreur(erreur: unknown): string {
  if (erreur instanceof ErreurPermission) {
    return erreur.message;
  }

  if (estErreurPostgrest(erreur)) {
    const brut = erreur.message ?? '';

    const attendue = brut.match(/ECOLEPLUS_[A-Z_]+:\s*(.+)/);
    if (attendue?.[1]) {
      return attendue[1].trim();
    }

    switch (erreur.code) {
      case '42501':
        return "Vous n'avez pas l'autorisation d'effectuer cette action.";
      case '23505':
        return 'Cette valeur est déjà utilisée.';
      case '23503':
        return "L'élément référencé n'existe pas ou ne vous est pas accessible.";
      case '23514':
        return 'Une des valeurs saisies est invalide.';
      default:
        break;
    }
  }

  // Trace côté serveur uniquement : l'utilisateur ne doit rien en voir.
  console.error('[ecoleplus] erreur non traduite', erreur);
  return "L'opération n'a pas pu aboutir. Réessayez, ou contactez un administrateur si le problème persiste.";
}

/** Aplatit les erreurs Zod en une entrée par champ, pour l'affichage. */
export function champsInvalides(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): Record<string, string> {
  const champs: Record<string, string> = {};
  for (const probleme of issues) {
    const cle = String(probleme.path[0] ?? '');
    if (cle && !champs[cle]) champs[cle] = probleme.message;
  }
  return champs;
}
