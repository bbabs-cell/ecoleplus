'use server';

import { revalidatePath } from 'next/cache';
import { clientServeur } from '@/lib/supabase/server';
import { exigerEtablissement } from '@/services/permissions';
import { anneeSchema, matiereSchema, niveauSchema, periodeSchema } from '@/lib/validation';
import { champsInvalides, messageErreur } from '@/services/erreurs';
import type { EtatFormulaire } from '@/services/formulaire';

// -----------------------------------------------------------------------------
// Années académiques
// -----------------------------------------------------------------------------

export async function creerAnneeAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const contexte = await exigerEtablissement('academic.manage');

  const saisie = anneeSchema.safeParse({
    nom: donnees.get('nom'),
    debut: donnees.get('debut'),
    fin: donnees.get('fin'),
  });

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const supabase = await clientServeur();
  const { error } = await supabase.from('academic_years').insert({
    organization_id: contexte.organisation.id,
    establishment_id: contexte.etablissementActif.id,
    name: saisie.data.nom,
    starts_on: saisie.data.debut,
    ends_on: saisie.data.fin,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/annees');
  return { statut: 'succes', message: `Année « ${saisie.data.nom} » créée.` };
}

export async function definirAnneeCouranteAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerEtablissement('academic.manage');

  const id = String(donnees.get('anneeId') ?? '');
  if (!id) return { statut: 'erreur', message: 'Année introuvable.' };

  const supabase = await clientServeur();
  const { error } = await supabase.rpc('definir_annee_courante', { p_academic_year_id: id });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/annees');
  revalidatePath('/', 'layout');
  return { statut: 'succes', message: 'Année courante mise à jour.' };
}

export async function creerPeriodeAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const contexte = await exigerEtablissement('academic.manage');

  const anneeId = String(donnees.get('anneeId') ?? '');
  if (!anneeId) return { statut: 'erreur', message: 'Année introuvable.' };

  const saisie = periodeSchema.safeParse({
    nom: donnees.get('nom'),
    type: donnees.get('type'),
    position: donnees.get('position'),
    debut: donnees.get('debut'),
    fin: donnees.get('fin'),
  });

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const supabase = await clientServeur();
  const { error } = await supabase.from('academic_terms').insert({
    organization_id: contexte.organisation.id,
    academic_year_id: anneeId,
    name: saisie.data.nom,
    kind_label: saisie.data.type || null,
    position: saisie.data.position,
    starts_on: saisie.data.debut,
    ends_on: saisie.data.fin,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/annees');
  return { statut: 'succes', message: `Période « ${saisie.data.nom} » ajoutée.` };
}

export async function supprimerPeriodeAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerEtablissement('academic.manage');

  const id = String(donnees.get('periodeId') ?? '');
  if (!id) return { statut: 'erreur', message: 'Période introuvable.' };

  const supabase = await clientServeur();
  const { error } = await supabase.from('academic_terms').delete().eq('id', id);

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/annees');
  return { statut: 'succes', message: 'Période supprimée.' };
}

// -----------------------------------------------------------------------------
// Niveaux
// -----------------------------------------------------------------------------

export async function creerNiveauAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const contexte = await exigerEtablissement('academic.manage');

  const saisie = niveauSchema.safeParse({
    nom: donnees.get('nom'),
    code: donnees.get('code'),
    cycle: donnees.get('cycle'),
    position: donnees.get('position'),
  });

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const supabase = await clientServeur();
  const { error } = await supabase.from('levels').insert({
    organization_id: contexte.organisation.id,
    establishment_id: contexte.etablissementActif.id,
    name: saisie.data.nom,
    code: saisie.data.code,
    stage_label: saisie.data.cycle || null,
    position: saisie.data.position,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/niveaux');
  return { statut: 'succes', message: `Niveau « ${saisie.data.nom} » créé.` };
}

export async function modifierNiveauAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerEtablissement('academic.manage');

  const id = String(donnees.get('id') ?? '');
  if (!id) return { statut: 'erreur', message: 'Niveau introuvable.' };

  const saisie = niveauSchema.safeParse({
    nom: donnees.get('nom'),
    code: donnees.get('code'),
    cycle: donnees.get('cycle'),
    position: donnees.get('position'),
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
    .from('levels')
    .update(
      {
        name: saisie.data.nom,
        code: saisie.data.code,
        stage_label: saisie.data.cycle || null,
        position: saisie.data.position,
      },
      { count: 'exact' },
    )
    .eq('id', id);

  if (error) return { statut: 'erreur', message: messageErreur(error) };
  if (count === 0) return { statut: 'erreur', message: "Ce niveau ne vous est pas accessible." };

  revalidatePath('/niveaux');
  return { statut: 'succes', message: 'Niveau mis à jour.' };
}

/** Un niveau se désactive : le supprimer effacerait le niveau d'inscriptions passées. */
export async function basculerNiveauAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerEtablissement('academic.manage');

  const id = String(donnees.get('id') ?? '');
  const actif = donnees.get('actif') === '1';
  if (!id) return { statut: 'erreur', message: 'Niveau introuvable.' };

  const supabase = await clientServeur();
  const { error } = await supabase.from('levels').update({ is_active: actif }).eq('id', id);

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/niveaux');
  return { statut: 'succes', message: actif ? 'Niveau réactivé.' : 'Niveau désactivé.' };
}

// -----------------------------------------------------------------------------
// Matières
// -----------------------------------------------------------------------------

export async function creerMatiereAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const contexte = await exigerEtablissement('academic.manage');

  const saisie = matiereSchema.safeParse({
    nom: donnees.get('nom'),
    code: donnees.get('code'),
    description: donnees.get('description'),
  });

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const supabase = await clientServeur();
  const { error } = await supabase.from('subjects').insert({
    organization_id: contexte.organisation.id,
    establishment_id: contexte.etablissementActif.id,
    name: saisie.data.nom,
    code: saisie.data.code,
    description: saisie.data.description || null,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/matieres');
  return { statut: 'succes', message: `Matière « ${saisie.data.nom} » créée.` };
}

export async function modifierMatiereAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerEtablissement('academic.manage');

  const id = String(donnees.get('id') ?? '');
  if (!id) return { statut: 'erreur', message: 'Matière introuvable.' };

  const saisie = matiereSchema.safeParse({
    nom: donnees.get('nom'),
    code: donnees.get('code'),
    description: donnees.get('description'),
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
    .from('subjects')
    .update(
      {
        name: saisie.data.nom,
        code: saisie.data.code,
        description: saisie.data.description || null,
      },
      { count: 'exact' },
    )
    .eq('id', id);

  if (error) return { statut: 'erreur', message: messageErreur(error) };
  if (count === 0) return { statut: 'erreur', message: "Cette matière ne vous est pas accessible." };

  revalidatePath('/matieres');
  return { statut: 'succes', message: 'Matière mise à jour.' };
}

export async function supprimerMatiereAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerEtablissement('academic.manage');

  const id = String(donnees.get('id') ?? '');
  if (!id) return { statut: 'erreur', message: 'Matière introuvable.' };

  const supabase = await clientServeur();
  const { error } = await supabase.from('subjects').delete().eq('id', id);

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/matieres');
  revalidatePath('/classes');
  return { statut: 'succes', message: 'Matière supprimée.' };
}
