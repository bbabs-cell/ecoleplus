'use server';

import { revalidatePath } from 'next/cache';
import { clientServeur } from '@/lib/supabase/server';
import { exigerEtablissement } from '@/services/permissions';
import { affectationSchema, classeSchema } from '@/lib/validation';
import { champsInvalides, messageErreur } from '@/services/erreurs';
import type { EtatFormulaire } from '@/services/formulaire';

function lireSaisie(donnees: FormData) {
  return classeSchema.safeParse({
    nom: donnees.get('nom'),
    code: donnees.get('code'),
    niveauId: donnees.get('niveauId'),
    capacite: donnees.get('capacite'),
    enseignantPrincipalId: donnees.get('enseignantPrincipalId'),
  });
}

export async function creerClasseAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const contexte = await exigerEtablissement('classes.manage');

  const anneeId = String(donnees.get('anneeId') ?? '');
  if (!anneeId) return { statut: 'erreur', message: 'Sélectionnez une année académique.' };

  const saisie = lireSaisie(donnees);
  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const supabase = await clientServeur();
  const { error } = await supabase.from('classes').insert({
    organization_id: contexte.organisation.id,
    establishment_id: contexte.etablissementActif.id,
    academic_year_id: anneeId,
    level_id: saisie.data.niveauId,
    name: saisie.data.nom,
    code: saisie.data.code,
    capacity: typeof saisie.data.capacite === 'number' ? saisie.data.capacite : null,
    main_teacher_id: saisie.data.enseignantPrincipalId || null,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/classes');
  return { statut: 'succes', message: `Classe « ${saisie.data.nom} » créée.` };
}

export async function modifierClasseAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerEtablissement('classes.manage');

  const id = String(donnees.get('id') ?? '');
  if (!id) return { statut: 'erreur', message: 'Classe introuvable.' };

  const saisie = lireSaisie(donnees);
  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const supabase = await clientServeur();
  const { error, count } = await supabase
    .from('classes')
    .update(
      {
        level_id: saisie.data.niveauId,
        name: saisie.data.nom,
        code: saisie.data.code,
        capacity: typeof saisie.data.capacite === 'number' ? saisie.data.capacite : null,
        main_teacher_id: saisie.data.enseignantPrincipalId || null,
      },
      { count: 'exact' },
    )
    .eq('id', id);

  if (error) return { statut: 'erreur', message: messageErreur(error) };
  if (count === 0) return { statut: 'erreur', message: "Cette classe ne vous est pas accessible." };

  revalidatePath('/classes');
  return { statut: 'succes', message: 'Classe mise à jour.' };
}

export async function basculerClasseAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerEtablissement('classes.manage');

  const id = String(donnees.get('id') ?? '');
  const actif = donnees.get('actif') === '1';
  if (!id) return { statut: 'erreur', message: 'Classe introuvable.' };

  const supabase = await clientServeur();
  const { error } = await supabase.from('classes').update({ is_active: actif }).eq('id', id);

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/classes');
  return { statut: 'succes', message: actif ? 'Classe réactivée.' : 'Classe désactivée.' };
}

export async function creerAffectationAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const contexte = await exigerEtablissement('classes.manage');

  const saisie = affectationSchema.safeParse({
    classeId: donnees.get('classeId'),
    matiereId: donnees.get('matiereId'),
    enseignantId: donnees.get('enseignantId'),
  });

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const supabase = await clientServeur();
  const { error } = await supabase.from('teaching_assignments').insert({
    organization_id: contexte.organisation.id,
    establishment_id: contexte.etablissementActif.id,
    class_id: saisie.data.classeId,
    subject_id: saisie.data.matiereId,
    teacher_id: saisie.data.enseignantId,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/classes');
  return { statut: 'succes', message: 'Affectation enregistrée.' };
}

export async function supprimerAffectationAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerEtablissement('classes.manage');

  const id = String(donnees.get('id') ?? '');
  if (!id) return { statut: 'erreur', message: 'Affectation introuvable.' };

  const supabase = await clientServeur();
  const { error } = await supabase.from('teaching_assignments').delete().eq('id', id);

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/classes');
  return { statut: 'succes', message: 'Affectation retirée.' };
}
