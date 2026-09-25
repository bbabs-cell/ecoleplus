'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { clientServeur } from '@/lib/supabase/server';
import { exigerEtablissement, exigerPermission } from '@/services/permissions';
import {
  baremeSchema,
  categorieNotationSchema,
  coefficientMatiereSchema,
  correctionNoteSchema,
  evaluationSchema,
  natureNoteSchema,
  trancheSchema,
} from '@/lib/validation';
import { champsInvalides, messageErreur } from '@/services/erreurs';
import type { EtatFormulaire } from '@/services/formulaire';

// ---------------------------------------------------------------------------
// Référentiel de notation
// ---------------------------------------------------------------------------

export async function creerBaremeAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const contexte = await exigerEtablissement('grades.configure');

  const saisie = baremeSchema.safeParse({
    nom: donnees.get('nom'),
    code: donnees.get('code'),
    type: donnees.get('type'),
    minimum: donnees.get('minimum'),
    maximum: donnees.get('maximum'),
    unite: donnees.get('unite'),
    seuilReussite: donnees.get('seuilReussite') || '',
    arrondi: donnees.get('arrondi'),
    decimales: donnees.get('decimales'),
    moyennable: donnees.get('moyennable') === 'on',
  });

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const supabase = await clientServeur();
  const { error } = await supabase.from('grading_systems').insert({
    organization_id: contexte.organisation.id,
    establishment_id: contexte.etablissementActif.id,
    name: saisie.data.nom,
    code: saisie.data.code,
    type: saisie.data.type,
    min_value: saisie.data.minimum,
    max_value: saisie.data.maximum,
    unit: saisie.data.unite || null,
    pass_threshold:
      saisie.data.seuilReussite === '' || saisie.data.seuilReussite === undefined
        ? null
        : saisie.data.seuilReussite,
    rounding_mode: saisie.data.arrondi,
    decimals: saisie.data.decimales,
    allows_averaging: saisie.data.moyennable,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/baremes');
  return { statut: 'succes', message: 'Barème créé.' };
}

export async function ajouterTrancheAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const contexte = await exigerEtablissement('grades.configure');

  const baremeId = String(donnees.get('baremeId') ?? '');
  if (!baremeId) return { statut: 'erreur', message: 'Barème introuvable.' };

  const saisie = trancheSchema.safeParse({
    libelle: donnees.get('libelle'),
    minimum: donnees.get('minimum'),
    maximum: donnees.get('maximum'),
    reussite: donnees.get('reussite') === 'on',
  });

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const supabase = await clientServeur();

  const { count } = await supabase
    .from('grading_scales')
    .select('id', { count: 'exact', head: true })
    .eq('grading_system_id', baremeId);

  const { error } = await supabase.from('grading_scales').insert({
    organization_id: contexte.organisation.id,
    grading_system_id: baremeId,
    label: saisie.data.libelle,
    min_score: saisie.data.minimum,
    max_score: saisie.data.maximum,
    is_passing: saisie.data.reussite,
    position: (count ?? 0) + 1,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/baremes');
  return { statut: 'succes', message: 'Tranche ajoutée.' };
}

export async function supprimerTrancheAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('grades.configure');

  const trancheId = String(donnees.get('trancheId') ?? '');
  if (!trancheId) return { statut: 'erreur', message: 'Tranche introuvable.' };

  const supabase = await clientServeur();
  // Le déclencheur `bareme_fige` refuse si le barème porte des notes publiées.
  const { error } = await supabase.from('grading_scales').delete().eq('id', trancheId);

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/baremes');
  return { statut: 'succes', message: 'Tranche retirée.' };
}

export async function creerCategorieAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const contexte = await exigerEtablissement('grades.configure');

  const saisie = categorieNotationSchema.safeParse({
    nom: donnees.get('nom'),
    code: donnees.get('code'),
    poids: donnees.get('poids'),
  });

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const supabase = await clientServeur();
  const { error } = await supabase.from('grading_categories').insert({
    organization_id: contexte.organisation.id,
    establishment_id: contexte.etablissementActif.id,
    name: saisie.data.nom,
    code: saisie.data.code,
    weight: saisie.data.poids,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/baremes');
  return { statut: 'succes', message: 'Catégorie créée.' };
}

/**
 * Coefficient d'une matière dans une classe.
 *
 * Manque n° 2 de @docs/reprise-projet-precedent.md : sans parcours, c'est la
 * classe qui porte les coefficients.
 */
export async function definirCoefficientAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const contexte = await exigerEtablissement('grades.configure');

  const classeId = String(donnees.get('classeId') ?? '');
  if (!classeId) return { statut: 'erreur', message: 'Classe introuvable.' };

  const saisie = coefficientMatiereSchema.safeParse({
    matiereId: donnees.get('matiereId'),
    coefficient: donnees.get('coefficient'),
    baremeId: donnees.get('baremeId'),
  });

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const supabase = await clientServeur();
  const { error } = await supabase.from('class_subjects').upsert(
    {
      organization_id: contexte.organisation.id,
      establishment_id: contexte.etablissementActif.id,
      class_id: classeId,
      subject_id: saisie.data.matiereId,
      coefficient: saisie.data.coefficient,
      grading_system_id: saisie.data.baremeId || null,
    },
    { onConflict: 'class_id,subject_id' },
  );

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/baremes');
  return { statut: 'succes', message: 'Coefficient enregistré.' };
}

// ---------------------------------------------------------------------------
// Évaluations
// ---------------------------------------------------------------------------

export async function creerEvaluationAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const contexte = await exigerEtablissement('grades.manage');

  const anneeId = String(donnees.get('anneeId') ?? '');
  if (!anneeId) return { statut: 'erreur', message: 'Sélectionnez une année académique.' };

  const saisie = evaluationSchema.safeParse({
    classeId: donnees.get('classeId'),
    matiereId: donnees.get('matiereId'),
    baremeId: donnees.get('baremeId'),
    titre: donnees.get('titre'),
    date: donnees.get('date'),
    periodeId: donnees.get('periodeId'),
    categorieId: donnees.get('categorieId'),
    enseignantId: donnees.get('enseignantId'),
    coefficient: donnees.get('coefficient'),
    politiqueNoteManquante: donnees.get('politiqueNoteManquante'),
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
    .from('assessments')
    .insert({
      organization_id: contexte.organisation.id,
      establishment_id: contexte.etablissementActif.id,
      academic_year_id: anneeId,
      academic_term_id: saisie.data.periodeId || null,
      class_id: saisie.data.classeId,
      subject_id: saisie.data.matiereId,
      teacher_id: saisie.data.enseignantId || null,
      category_id: saisie.data.categorieId || null,
      grading_system_id: saisie.data.baremeId,
      title: saisie.data.titre,
      date_on: saisie.data.date,
      coefficient: saisie.data.coefficient,
      missing_grade_policy: saisie.data.politiqueNoteManquante,
    })
    .select('id')
    .maybeSingle();

  if (error) return { statut: 'erreur', message: messageErreur(error) };
  if (!data) return { statut: 'erreur', message: "L'évaluation n'a pas pu être créée." };

  redirect(`/evaluations/${data.id}`);
}

/**
 * Saisie de toute la feuille en une requête.
 *
 * Chaque apprenant porte une NATURE explicite : `SCORE`, `ABSENT`, `EXCUSED`,
 * `EXEMPT`, `NOT_APPLICABLE` ou `PENDING`. Une case laissée vide reste
 * `PENDING` — elle ne devient jamais un zéro (@CLAUDE.md, règle 4).
 */
export async function saisirNotesAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('grades.enter');

  const evaluationId = String(donnees.get('evaluationId') ?? '');
  if (!evaluationId) return { statut: 'erreur', message: 'Évaluation introuvable.' };

  const lignes: {
    enrollment_id: string;
    kind: string;
    raw_value?: number;
    comment?: string;
  }[] = [];

  for (const [cle, valeur] of donnees.entries()) {
    if (!cle.startsWith('nature:')) continue;

    const nature = natureNoteSchema.safeParse(String(valeur));
    if (!nature.success) continue;

    const inscriptionId = cle.slice('nature:'.length);
    const brute = String(donnees.get(`valeur:${inscriptionId}`) ?? '').trim();
    const commentaire = String(donnees.get(`commentaire:${inscriptionId}`) ?? '').trim();

    // Une note chiffrée sans valeur est une saisie incomplète, pas un zéro :
    // on la renvoie telle quelle et la base refusera.
    if (nature.data === 'SCORE' && brute === '') {
      return {
        statut: 'erreur',
        message: 'Une note chiffrée sans valeur : choisissez une valeur, ou une absence.',
      };
    }

    const nombre = Number(brute.replace(',', '.'));
    if (nature.data === 'SCORE' && !Number.isFinite(nombre)) {
      return { statut: 'erreur', message: `Valeur numérique invalide : « ${brute} ».` };
    }

    lignes.push({
      enrollment_id: inscriptionId,
      kind: nature.data,
      ...(nature.data === 'SCORE' ? { raw_value: nombre } : {}),
      ...(commentaire ? { comment: commentaire } : {}),
    });
  }

  if (lignes.length === 0) return { statut: 'erreur', message: 'Aucune ligne à enregistrer.' };

  const supabase = await clientServeur();
  const { error } = await supabase.rpc('saisir_notes', {
    p_assessment_id: evaluationId,
    p_lignes: lignes,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath(`/evaluations/${evaluationId}`);
  revalidatePath('/evaluations');
  return {
    statut: 'succes',
    message: `Saisie enregistrée pour ${lignes.length} apprenant${lignes.length > 1 ? 's' : ''}.`,
  };
}

export async function verifierEvaluationAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('grades.verify');

  const evaluationId = String(donnees.get('evaluationId') ?? '');
  if (!evaluationId) return { statut: 'erreur', message: 'Évaluation introuvable.' };

  const supabase = await clientServeur();
  const { error } = await supabase.rpc('verifier_evaluation', {
    p_assessment_id: evaluationId,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath(`/evaluations/${evaluationId}`);
  revalidatePath('/evaluations');
  return { statut: 'succes', message: 'Saisie vérifiée. Elle peut être publiée.' };
}

export async function publierEvaluationAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('grades.publish');

  const evaluationId = String(donnees.get('evaluationId') ?? '');
  if (!evaluationId) return { statut: 'erreur', message: 'Évaluation introuvable.' };

  const supabase = await clientServeur();
  const { error } = await supabase.rpc('publier_evaluation', {
    p_assessment_id: evaluationId,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath(`/evaluations/${evaluationId}`);
  revalidatePath('/evaluations');
  return {
    statut: 'succes',
    message: 'Notes publiées. Elles ne se modifient plus que par correction motivée.',
  };
}

export async function corrigerNoteAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('grades.correct');

  const evaluationId = String(donnees.get('evaluationId') ?? '');

  const saisie = correctionNoteSchema.safeParse({
    noteId: donnees.get('noteId'),
    nature: donnees.get('nature'),
    valeur: donnees.get('valeur') || '',
    raison: donnees.get('raison'),
  });

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const supabase = await clientServeur();

  // `p_raw_value` et `p_scale_id` sont des paramètres SQL sans défaut : le
  // générateur les type non-nuls alors que la fonction accepte null, et c'est
  // précisément null qu'il faut transmettre pour une absence ou une dispense —
  // d'où ces deux conversions, qui ne masquent aucune incertitude de type.
  const valeur =
    saisie.data.nature === 'SCORE' && typeof saisie.data.valeur === 'number'
      ? saisie.data.valeur
      : (null as unknown as number);

  const { error } = await supabase.rpc('corriger_note', {
    p_result_id: saisie.data.noteId,
    p_kind: saisie.data.nature,
    p_raw_value: valeur,
    p_scale_id: null as unknown as string,
    p_raison: saisie.data.raison,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  if (evaluationId) revalidatePath(`/evaluations/${evaluationId}`);
  return { statut: 'succes', message: 'Correction enregistrée et tracée.' };
}

export async function annulerNoteAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('grades.correct');

  const noteId = String(donnees.get('noteId') ?? '');
  const raison = String(donnees.get('raison') ?? '').trim();
  const evaluationId = String(donnees.get('evaluationId') ?? '');

  if (!noteId) return { statut: 'erreur', message: 'Note introuvable.' };
  if (!raison) return { statut: 'erreur', message: 'Invalider une note exige un motif.' };

  const supabase = await clientServeur();
  const { error } = await supabase.rpc('annuler_note', {
    p_result_id: noteId,
    p_raison: raison,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  if (evaluationId) revalidatePath(`/evaluations/${evaluationId}`);
  return {
    statut: 'succes',
    message: 'Note invalidée. Elle sort des calculs sans disparaître.',
  };
}

/**
 * Désigne le barème par défaut.
 *
 * Le défaut se pose DANS LA PORTÉE du barème, jamais en déplaçant celui-ci :
 * un barème d'organisation reste partagé, un barème d'établissement reste
 * propre à son établissement. L'audit de sécurité avait montré qu'autoriser le
 * déplacement laissait un établissement s'approprier le référentiel commun —
 * la base le refuse désormais, et cette action ne le tente plus.
 */
export async function definirBaremeParDefautAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const contexte = await exigerEtablissement('grades.configure');

  const baremeId = String(donnees.get('baremeId') ?? '');
  if (!baremeId) return { statut: 'erreur', message: 'Barème introuvable.' };

  const supabase = await clientServeur();

  const { data: bareme, error: erreurLecture } = await supabase
    .from('grading_systems')
    .select('id, name, establishment_id')
    .eq('id', baremeId)
    .maybeSingle();

  if (erreurLecture) return { statut: 'erreur', message: messageErreur(erreurLecture) };
  if (!bareme) return { statut: 'erreur', message: 'Barème introuvable.' };

  const porteeOrganisation = bareme.establishment_id === null;

  if (!porteeOrganisation && bareme.establishment_id !== contexte.etablissementActif.id) {
    return {
      statut: 'erreur',
      message: "Ce barème appartient à un autre établissement.",
    };
  }

  // L'index d'unicité n'autorise qu'un défaut par portée : on libère la place
  // avant de la prendre. La RLS refusera l'écriture au niveau organisation
  // pour un rôle de portée établissement.
  const liberation = supabase.from('grading_systems').update({ is_default: false });
  const { error: erreurLiberation } = await (porteeOrganisation
    ? liberation.is('establishment_id', null).eq('is_default', true)
    : liberation
        .eq('establishment_id', contexte.etablissementActif.id)
        .eq('is_default', true));

  if (erreurLiberation) {
    return { statut: 'erreur', message: messageErreur(erreurLiberation) };
  }

  // `establishment_id` n'est PAS touché : seule la valeur par défaut change.
  const { error } = await supabase
    .from('grading_systems')
    .update({ is_default: true })
    .eq('id', baremeId);

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/baremes');
  return {
    statut: 'succes',
    message: porteeOrganisation
      ? `« ${bareme.name} » devient le barème par défaut de l'organisation.`
      : `« ${bareme.name} » devient le barème par défaut de l'établissement.`,
  };
}

/** Barème par défaut d'une classe — il l'emporte sur celui de l'établissement. */
export async function definirBaremeClasseAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('grades.configure');

  const classeId = String(donnees.get('classeId') ?? '');
  const baremeId = String(donnees.get('baremeId') ?? '');
  if (!classeId) return { statut: 'erreur', message: 'Classe introuvable.' };

  const supabase = await clientServeur();
  const { error } = await supabase
    .from('classes')
    .update({ grading_system_id: baremeId || null })
    .eq('id', classeId);

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/baremes');
  revalidatePath('/bulletins');
  return {
    statut: 'succes',
    message: baremeId
      ? 'Barème de la classe enregistré.'
      : "Barème de la classe retiré — celui de l'établissement s'applique.",
  };
}
