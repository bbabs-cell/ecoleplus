'use server';

import { redirect } from 'next/navigation';
import { clientServeur } from '@/lib/supabase/server';
import { contexteSession } from '@/services/session';
import { messageErreur } from '@/services/erreurs';
import type { EtatFormulaire } from '@/services/formulaire';

/**
 * Accepte une invitation.
 *
 * Toute la vérification est en base : jeton, expiration, statut et
 * correspondance de l'adresse e-mail (migration 0007). Cette action ne fait que
 * transmettre le jeton et rafraîchir la session.
 */
export async function accepterInvitationAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const contexte = await contexteSession();
  const jeton = String(donnees.get('jeton') ?? '');

  if (!contexte) {
    redirect(`/connexion?suite=${encodeURIComponent(`/invitation/${jeton}`)}`);
  }

  if (!jeton) {
    return { statut: 'erreur', message: 'Lien d\'invitation incomplet.' };
  }

  const supabase = await clientServeur();
  const { error } = await supabase.rpc('accepter_invitation', { p_token: jeton });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  // Le jeton courant ne porte pas encore la nouvelle organisation.
  await supabase.auth.refreshSession();

  redirect('/tableau-de-bord');
}
