import { redirect } from 'next/navigation';
import { contexteSession, type ContexteSession } from '@/services/session';
import { ErreurPermission } from '@/services/erreur-permission';

export { ErreurPermission };

export function aLaPermission(contexte: ContexteSession | null, cle: string): boolean {
  return contexte?.permissions.has(cle) ?? false;
}

/** Contexte d'une session rattachée à une organisation active, ou redirection. */
export type ContexteOrganisation = ContexteSession & {
  organisation: NonNullable<ContexteSession['organisation']>;
  reglages: NonNullable<ContexteSession['reglages']>;
  adhesion: NonNullable<ContexteSession['adhesion']>;
};

export async function exigerOrganisation(): Promise<ContexteOrganisation> {
  const contexte = await contexteSession();

  if (!contexte) redirect('/connexion');
  if (!contexte.organisation || !contexte.reglages || !contexte.adhesion) redirect('/bienvenue');

  return contexte as ContexteOrganisation;
}

/**
 * Garde serveur à placer en tête de toute Server Action ou page sensible.
 *
 * Doublon volontaire de RLS : masquer un bouton ne protège rien, et une Server
 * Action est une route HTTP appelable directement (CLAUDE.md, règle 1).
 */
export async function exigerPermission(cle: string): Promise<ContexteOrganisation> {
  const contexte = await exigerOrganisation();

  if (!contexte.permissions.has(cle)) {
    throw new ErreurPermission(cle);
  }

  return contexte;
}
