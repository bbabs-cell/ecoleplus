'use server';

import { revalidatePath } from 'next/cache';
import { clientServeur } from '@/lib/supabase/server';
import { exigerPermission } from '@/services/permissions';
import { invitationSchema } from '@/lib/validation';
import { champsInvalides, messageErreur } from '@/services/erreurs';
import type { EtatFormulaire } from '@/services/formulaire';

/**
 * Crée une invitation et renvoie le lien à transmettre.
 *
 * Aucun e-mail n'est envoyé : la phase 1 ne met en place aucun service
 * d'envoi, et prétendre le contraire serait une fonctionnalité simulée
 * (CLAUDE.md, règle 3). Le lien est affiché une fois à l'administrateur, qui le
 * transmet par le canal de son choix. L'envoi automatique viendra avec le
 * module communication (phase 6).
 */
export async function inviterMembreAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('members.invite');

  const saisie = invitationSchema.safeParse({
    email: donnees.get('email'),
    roleId: donnees.get('roleId'),
    etablissements: donnees.getAll('etablissements').map(String).filter(Boolean),
  });

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const supabase = await clientServeur();

  const { data, error } = await supabase.rpc('creer_invitation', {
    p_email: saisie.data.email,
    p_role_id: saisie.data.roleId,
    p_establishment_ids: saisie.data.etablissements,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  const premiere = Array.isArray(data) ? data[0] : null;
  if (!premiere) {
    return { statut: 'erreur', message: "L'invitation n'a pas pu être créée." };
  }

  revalidatePath('/membres');
  return {
    statut: 'succes',
    message: `Invitation créée pour ${saisie.data.email}.`,
    // Le jeton n'existe qu'ici : la base n'en garde que le condensé.
    donnees: { chemin: `/invitation/${premiere.token}` },
  };
}

export async function revoquerInvitationAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('members.invite');

  const id = String(donnees.get('invitationId') ?? '');
  if (!id) return { statut: 'erreur', message: 'Invitation introuvable.' };

  const supabase = await clientServeur();
  const { error } = await supabase.rpc('revoquer_invitation', { p_invitation_id: id });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/membres');
  return { statut: 'succes', message: 'Invitation révoquée.' };
}

export async function changerRoleAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('members.update_role');

  const membershipId = String(donnees.get('membershipId') ?? '');
  const roleId = String(donnees.get('roleId') ?? '');
  const raison = String(donnees.get('raison') ?? '').trim();

  if (!membershipId || !roleId) {
    return { statut: 'erreur', message: 'Membre ou rôle manquant.' };
  }

  const supabase = await clientServeur();

  const { error } = await supabase.rpc('changer_role_membre', {
    p_membership_id: membershipId,
    p_role_id: roleId,
    p_raison: raison || undefined,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/membres');
  return { statut: 'succes', message: 'Rôle mis à jour.' };
}

export async function changerStatutAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('members.suspend');

  const membershipId = String(donnees.get('membershipId') ?? '');
  const suspendre = donnees.get('suspendre') === '1';
  const raison = String(donnees.get('raison') ?? '').trim();

  if (!membershipId) return { statut: 'erreur', message: 'Membre introuvable.' };

  const supabase = await clientServeur();

  const { error } = await supabase.rpc('changer_statut_membre', {
    p_membership_id: membershipId,
    p_statut: suspendre ? 'SUSPENDED' : 'ACTIVE',
    p_raison: raison || undefined,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/membres');
  return {
    statut: 'succes',
    message: suspendre ? 'Membre suspendu.' : 'Membre réactivé.',
  };
}

export async function definirEtablissementsAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('members.update_role');

  const membershipId = String(donnees.get('membershipId') ?? '');
  const etablissements = donnees.getAll('etablissements').map(String).filter(Boolean);

  if (!membershipId) return { statut: 'erreur', message: 'Membre introuvable.' };

  const supabase = await clientServeur();

  const { error } = await supabase.rpc('definir_etablissements_membre', {
    p_membership_id: membershipId,
    p_establishment_ids: etablissements,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/membres');
  return { statut: 'succes', message: 'Rattachements mis à jour.' };
}
