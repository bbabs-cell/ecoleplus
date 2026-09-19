'use server';

import { revalidatePath } from 'next/cache';
import { clientServeur } from '@/lib/supabase/server';
import { exigerEtablissement, exigerPermission } from '@/services/permissions';
import {
  apprenantSchema,
  inscriptionApprenantSchema,
  statutInscriptionSchema,
} from '@/lib/validation';
import { champsInvalides, messageErreur } from '@/services/erreurs';
import type { EtatFormulaire } from '@/services/formulaire';

/**
 * Inscrit un nouvel apprenant.
 *
 * Passe par la fonction SQL `inscrire_apprenant`, qui crée le dossier ET
 * l'inscription dans la même transaction — sans quoi un dossier sans
 * inscription serait invisible aux rôles de portée établissement.
 */
export async function inscrireApprenantAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const contexte = await exigerEtablissement('enrollments.manage');

  const saisie = inscriptionApprenantSchema.safeParse({
    prenom: donnees.get('prenom'),
    nom: donnees.get('nom'),
    anneeId: donnees.get('anneeId'),
    niveauId: donnees.get('niveauId'),
    classeId: donnees.get('classeId'),
    dateNaissance: donnees.get('dateNaissance'),
    genre: donnees.get('genre'),
    matricule: donnees.get('matricule'),
    email: donnees.get('email'),
    telephone: donnees.get('telephone'),
    statut: donnees.get('statut'),
  });

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const supabase = await clientServeur();

  const { error } = await supabase.rpc('inscrire_apprenant', {
    p_establishment_id: contexte.etablissementActif.id,
    p_academic_year_id: saisie.data.anneeId,
    p_given_name: saisie.data.prenom || '',
    p_family_name: saisie.data.nom,
    p_level_id: saisie.data.niveauId || undefined,
    p_class_id: saisie.data.classeId || undefined,
    p_birth_date: saisie.data.dateNaissance || undefined,
    p_gender_label: saisie.data.genre || undefined,
    p_learner_code: saisie.data.matricule || undefined,
    p_email: saisie.data.email || undefined,
    p_phone: saisie.data.telephone || undefined,
    p_status: saisie.data.statut,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/apprenants');
  return { statut: 'succes', message: `${saisie.data.nom} est inscrit.` };
}

export async function reinscrireApprenantAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const contexte = await exigerEtablissement('enrollments.manage');

  const apprenantId = String(donnees.get('apprenantId') ?? '');
  const anneeId = String(donnees.get('anneeId') ?? '');
  const niveauId = String(donnees.get('niveauId') ?? '');
  const classeId = String(donnees.get('classeId') ?? '');

  if (!apprenantId || !anneeId) {
    return { statut: 'erreur', message: 'Apprenant ou année manquant.' };
  }

  const supabase = await clientServeur();

  const { error } = await supabase.rpc('reinscrire_apprenant', {
    p_learner_id: apprenantId,
    p_establishment_id: contexte.etablissementActif.id,
    p_academic_year_id: anneeId,
    p_level_id: niveauId || undefined,
    p_class_id: classeId || undefined,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath(`/apprenants/${apprenantId}`);
  revalidatePath('/apprenants');
  return { statut: 'succes', message: 'Réinscription enregistrée.' };
}

export async function changerStatutInscriptionAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('enrollments.manage');

  const inscriptionId = String(donnees.get('inscriptionId') ?? '');
  const raison = String(donnees.get('raison') ?? '').trim();
  const statut = statutInscriptionSchema.safeParse(donnees.get('statut'));

  if (!inscriptionId || !statut.success) {
    return { statut: 'erreur', message: 'Inscription ou statut invalide.' };
  }

  const supabase = await clientServeur();

  const { error } = await supabase.rpc('changer_statut_inscription', {
    p_enrollment_id: inscriptionId,
    p_statut: statut.data,
    p_raison: raison || undefined,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/apprenants', 'layout');
  return { statut: 'succes', message: 'Statut mis à jour.' };
}

export async function affecterClasseAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('enrollments.manage');

  const inscriptionId = String(donnees.get('inscriptionId') ?? '');
  const classeId = String(donnees.get('classeId') ?? '');

  if (!inscriptionId) return { statut: 'erreur', message: 'Inscription introuvable.' };

  const supabase = await clientServeur();

  const { error } = await supabase.rpc('affecter_classe', {
    p_enrollment_id: inscriptionId,
    // Chaîne vide = retirer de la classe.
    p_class_id: classeId || (null as unknown as string),
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/apprenants', 'layout');
  return { statut: 'succes', message: classeId ? 'Classe affectée.' : 'Retiré de la classe.' };
}

export async function modifierApprenantAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('learners.manage');

  const id = String(donnees.get('id') ?? '');
  if (!id) return { statut: 'erreur', message: 'Apprenant introuvable.' };

  const saisie = apprenantSchema.safeParse({
    prenom: donnees.get('prenom'),
    nom: donnees.get('nom'),
    dateNaissance: donnees.get('dateNaissance'),
    lieuNaissance: donnees.get('lieuNaissance'),
    genre: donnees.get('genre'),
    nationalite: donnees.get('nationalite'),
    matricule: donnees.get('matricule'),
    email: donnees.get('email'),
    telephone: donnees.get('telephone'),
    adresse: donnees.get('adresse'),
  });

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const supabase = await clientServeur();

  const { error, count } = await supabase
    .from('learners')
    .update(
      {
        given_name: saisie.data.prenom || '',
        family_name: saisie.data.nom,
        birth_date: saisie.data.dateNaissance || null,
        birth_place: saisie.data.lieuNaissance || null,
        gender_label: saisie.data.genre || null,
        nationality: saisie.data.nationalite || null,
        learner_code: saisie.data.matricule || null,
        email: saisie.data.email || null,
        phone: saisie.data.telephone || null,
        address: saisie.data.adresse || null,
      },
      { count: 'exact' },
    )
    .eq('id', id);

  if (error) return { statut: 'erreur', message: messageErreur(error) };
  if (count === 0) return { statut: 'erreur', message: "Ce dossier ne vous est pas accessible." };

  revalidatePath(`/apprenants/${id}`);
  return { statut: 'succes', message: 'Dossier mis à jour.' };
}
