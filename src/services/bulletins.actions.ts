'use server';

import { revalidatePath } from 'next/cache';
import { clientServeur } from '@/lib/supabase/server';
import { exigerEtablissement, exigerPermission } from '@/services/permissions';
import { messageErreur } from '@/services/erreurs';
import type { EtatFormulaire } from '@/services/formulaire';

/**
 * Vérifie un bulletin : fige l'instantané en brouillon vérifié.
 *
 * Distinct de la publication — ce sont deux permissions et deux actes
 * différents (@docs/business-rules/moteur-notation.md, §6).
 */
export async function verifierBulletinAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('reports.verify');

  const inscriptionId = String(donnees.get('inscriptionId') ?? '');
  const periodeId = String(donnees.get('periodeId') ?? '');

  if (!inscriptionId) return { statut: 'erreur', message: 'Inscription introuvable.' };

  const supabase = await clientServeur();
  const { error } = await supabase.rpc('verifier_bulletin', {
    p_enrollment_id: inscriptionId,
    ...(periodeId ? { p_term_id: periodeId } : {}),
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/bulletins');
  return { statut: 'succes', message: 'Bulletin vérifié. Son instantané est figé.' };
}

/** Vérifie toute une classe d'un coup — c'est ainsi que le travail se fait. */
export async function verifierClasseAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('reports.verify');

  const classeId = String(donnees.get('classeId') ?? '');
  const periodeId = String(donnees.get('periodeId') ?? '');

  if (!classeId) return { statut: 'erreur', message: 'Classe introuvable.' };

  const supabase = await clientServeur();

  const { data: inscriptions, error: erreurLecture } = await supabase
    .from('enrollments')
    .select('id')
    .eq('class_id', classeId)
    .in('status', ['PREREGISTERED', 'ENROLLED', 'ACTIVE', 'SUSPENDED']);

  if (erreurLecture) return { statut: 'erreur', message: messageErreur(erreurLecture) };
  if (!inscriptions || inscriptions.length === 0) {
    return { statut: 'erreur', message: 'Aucun apprenant inscrit dans cette classe.' };
  }

  // Séquentiel et non parallèle : le rang se calcule sur la classe entière, et
  // deux calculs concurrents liraient des moyennes en cours d'écriture.
  let faits = 0;
  for (const inscription of inscriptions) {
    const { error } = await supabase.rpc('verifier_bulletin', {
      p_enrollment_id: inscription.id,
      ...(periodeId ? { p_term_id: periodeId } : {}),
    });
    if (error) return { statut: 'erreur', message: messageErreur(error) };
    faits += 1;
  }

  revalidatePath('/bulletins');
  return {
    statut: 'succes',
    message: `${faits} bulletin${faits > 1 ? 's' : ''} vérifié${faits > 1 ? 's' : ''}.`,
  };
}

/**
 * Publie un bulletin : crée une version figée.
 *
 * Republier n'écrase pas la précédente — la famille l'a déjà reçue — et exige
 * donc un motif.
 */
export async function publierBulletinAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('reports.publish');

  const bulletinId = String(donnees.get('bulletinId') ?? '');
  const raison = String(donnees.get('raison') ?? '').trim();

  if (!bulletinId) return { statut: 'erreur', message: 'Bulletin introuvable.' };

  const supabase = await clientServeur();
  const { data, error } = await supabase.rpc('publier_bulletin', {
    p_report_card_id: bulletinId,
    ...(raison ? { p_raison: raison } : {}),
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/bulletins');
  revalidatePath(`/bulletins/${bulletinId}`);
  return { statut: 'succes', message: `Bulletin publié — version ${data}.` };
}

/**
 * Active ou désactive le rang au bulletin.
 *
 * Réglage d'établissement, désactivé par défaut : de nombreux systèmes
 * éducatifs proscrivent le classement des apprenants.
 */
export async function definirRangAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const contexte = await exigerEtablissement('establishments.update');

  const actif = donnees.get('rangActif') === 'on';

  const supabase = await clientServeur();
  const { error } = await supabase.from('establishment_settings').upsert(
    {
      organization_id: contexte.organisation.id,
      establishment_id: contexte.etablissementActif.id,
      key: 'report_card.rank_enabled',
      value: actif,
    },
    { onConflict: 'establishment_id,key' },
  );

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/bulletins');
  return {
    statut: 'succes',
    message: actif
      ? 'Rang activé. Il apparaîtra sur les bulletins vérifiés à partir de maintenant.'
      : 'Rang désactivé.',
  };
}
