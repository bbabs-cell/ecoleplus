'use server';

import { revalidatePath } from 'next/cache';
import { clientServeur } from '@/lib/supabase/server';
import { exigerEtablissement } from '@/services/permissions';
import { enseignantSchema } from '@/lib/validation';
import { champsInvalides, messageErreur } from '@/services/erreurs';
import type { EtatFormulaire } from '@/services/formulaire';

function lireSaisie(donnees: FormData) {
  return enseignantSchema.safeParse({
    prenom: donnees.get('prenom'),
    nom: donnees.get('nom'),
    email: donnees.get('email'),
    telephone: donnees.get('telephone'),
    code: donnees.get('code'),
    dateEmbauche: donnees.get('dateEmbauche'),
  });
}

export async function creerEnseignantAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const contexte = await exigerEtablissement('teachers.manage');
  const saisie = lireSaisie(donnees);

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const supabase = await clientServeur();
  const { error } = await supabase.from('teachers').insert({
    organization_id: contexte.organisation.id,
    establishment_id: contexte.etablissementActif.id,
    given_name: saisie.data.prenom || '',
    family_name: saisie.data.nom,
    email: saisie.data.email || null,
    phone: saisie.data.telephone || null,
    staff_code: saisie.data.code || null,
    hired_on: saisie.data.dateEmbauche || null,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/enseignants');
  return { statut: 'succes', message: `Enseignant « ${saisie.data.nom} » ajouté.` };
}

export async function modifierEnseignantAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerEtablissement('teachers.manage');

  const id = String(donnees.get('id') ?? '');
  if (!id) return { statut: 'erreur', message: 'Enseignant introuvable.' };

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
    .from('teachers')
    .update(
      {
        given_name: saisie.data.prenom || '',
        family_name: saisie.data.nom,
        email: saisie.data.email || null,
        phone: saisie.data.telephone || null,
        staff_code: saisie.data.code || null,
        hired_on: saisie.data.dateEmbauche || null,
      },
      { count: 'exact' },
    )
    .eq('id', id);

  if (error) return { statut: 'erreur', message: messageErreur(error) };
  if (count === 0) return { statut: 'erreur', message: "Cet enseignant ne vous est pas accessible." };

  revalidatePath('/enseignants');
  return { statut: 'succes', message: 'Fiche mise à jour.' };
}

/**
 * Désactive ou réactive un enseignant.
 *
 * Pas de suppression : la fiche est référencée par les classes et les
 * affectations, et le sera par les notes en phase 3.
 */
export async function basculerEnseignantAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerEtablissement('teachers.manage');

  const id = String(donnees.get('id') ?? '');
  const actif = donnees.get('actif') === '1';
  if (!id) return { statut: 'erreur', message: 'Enseignant introuvable.' };

  const supabase = await clientServeur();
  const { error } = await supabase
    .from('teachers')
    .update({ status: actif ? 'ACTIVE' : 'INACTIVE' })
    .eq('id', id);

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/enseignants');
  return { statut: 'succes', message: actif ? 'Enseignant réactivé.' : 'Enseignant désactivé.' };
}
