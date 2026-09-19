'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { clientServeur } from '@/lib/supabase/server';
import { exigerEtablissement, exigerPermission } from '@/services/permissions';
import { seanceSchema } from '@/lib/validation';
import { champsInvalides, messageErreur } from '@/services/erreurs';
import type { EtatFormulaire } from '@/services/formulaire';

export async function creerSeanceAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const contexte = await exigerEtablissement('attendance.record');

  const anneeId = String(donnees.get('anneeId') ?? '');
  if (!anneeId) return { statut: 'erreur', message: 'Sélectionnez une année académique.' };

  const saisie = seanceSchema.safeParse({
    classeId: donnees.get('classeId'),
    date: donnees.get('date'),
    matiereId: donnees.get('matiereId'),
    enseignantId: donnees.get('enseignantId'),
    type: donnees.get('type'),
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

  const { data, error } = await supabase
    .from('attendance_sessions')
    .insert({
      organization_id: contexte.organisation.id,
      establishment_id: contexte.etablissementActif.id,
      academic_year_id: anneeId,
      class_id: saisie.data.classeId,
      subject_id: saisie.data.matiereId || null,
      teacher_id: saisie.data.enseignantId || null,
      date_on: saisie.data.date,
      starts_at: saisie.data.debut || null,
      ends_at: saisie.data.fin || null,
      kind_label: saisie.data.type || null,
    })
    .select('id')
    .maybeSingle();

  if (error) return { statut: 'erreur', message: messageErreur(error) };
  if (!data) return { statut: 'erreur', message: "La séance n'a pas pu être créée." };

  // On enchaîne directement sur la feuille : créer une séance sans la remplir
  // n'a pas d'intérêt.
  redirect(`/presences/${data.id}`);
}

/**
 * Enregistre la feuille entière.
 *
 * Les statuts arrivent sous la forme `statut:<enrollment_id>` — un champ par
 * apprenant. Le formulaire fonctionne donc sans JavaScript, et l'ensemble part
 * en une seule requête : l'appel se fait debout en classe, souvent sur une
 * connexion médiocre.
 */
export async function enregistrerAppelAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('attendance.record');

  const seanceId = String(donnees.get('seanceId') ?? '');
  if (!seanceId) return { statut: 'erreur', message: 'Séance introuvable.' };

  const lignes: { enrollment_id: string; status_id: string; comment?: string }[] = [];

  for (const [cle, valeur] of donnees.entries()) {
    if (!cle.startsWith('statut:')) continue;
    const statutId = String(valeur);
    if (!statutId) continue;

    const inscriptionId = cle.slice('statut:'.length);
    const commentaire = String(donnees.get(`commentaire:${inscriptionId}`) ?? '').trim();

    lignes.push({
      enrollment_id: inscriptionId,
      status_id: statutId,
      ...(commentaire ? { comment: commentaire } : {}),
    });
  }

  if (lignes.length === 0) {
    return { statut: 'erreur', message: 'Aucun statut saisi.' };
  }

  const supabase = await clientServeur();
  const { error } = await supabase.rpc('enregistrer_appel', {
    p_session_id: seanceId,
    p_lignes: lignes,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath(`/presences/${seanceId}`);
  revalidatePath('/presences');
  return {
    statut: 'succes',
    message: `Appel enregistré pour ${lignes.length} apprenant${lignes.length > 1 ? 's' : ''}.`,
  };
}

export async function validerSeanceAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('attendance.validate');

  const seanceId = String(donnees.get('seanceId') ?? '');
  if (!seanceId) return { statut: 'erreur', message: 'Séance introuvable.' };

  const supabase = await clientServeur();
  const { error } = await supabase.rpc('valider_seance', { p_session_id: seanceId });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath(`/presences/${seanceId}`);
  revalidatePath('/presences');
  return { statut: 'succes', message: 'Feuille validée et close.' };
}

export async function rouvrirSeanceAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('attendance.correct');

  const seanceId = String(donnees.get('seanceId') ?? '');
  const raison = String(donnees.get('raison') ?? '').trim();

  if (!seanceId) return { statut: 'erreur', message: 'Séance introuvable.' };
  if (!raison) return { statut: 'erreur', message: 'Rouvrir une séance close exige un motif.' };

  const supabase = await clientServeur();
  const { error } = await supabase.rpc('rouvrir_seance', {
    p_session_id: seanceId,
    p_raison: raison,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath(`/presences/${seanceId}`);
  revalidatePath('/presences');
  return { statut: 'succes', message: 'Séance rouverte.' };
}

export async function corrigerPresenceAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('attendance.correct');

  const recordId = String(donnees.get('recordId') ?? '');
  const statutId = String(donnees.get('statutId') ?? '');
  const raison = String(donnees.get('raison') ?? '').trim();
  const seanceId = String(donnees.get('seanceId') ?? '');

  if (!recordId || !statutId) {
    return { statut: 'erreur', message: 'Enregistrement ou statut manquant.' };
  }
  if (!raison) return { statut: 'erreur', message: 'Une correction exige un motif.' };

  const supabase = await clientServeur();
  const { error } = await supabase.rpc('corriger_presence', {
    p_record_id: recordId,
    p_new_status_id: statutId,
    p_raison: raison,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  if (seanceId) revalidatePath(`/presences/${seanceId}`);
  return { statut: 'succes', message: 'Correction enregistrée et tracée.' };
}
