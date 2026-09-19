/**
 * Erreur d'autorisation côté serveur.
 *
 * Isolée dans son propre module pour que `erreurs.ts` puisse la reconnaître
 * sans dépendre de `permissions.ts`, qui lui charge le contexte de session.
 *
 * Le message s'adresse à l'utilisateur : il nomme le refus, jamais la table,
 * la policy ou la requête en cause (règles de code, 9).
 */
export class ErreurPermission extends Error {
  readonly permission: string;

  constructor(permission: string) {
    super("Vous n'avez pas l'autorisation d'effectuer cette action.");
    this.name = 'ErreurPermission';
    this.permission = permission;
  }
}
