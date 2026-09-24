import { clientServeur } from '@/lib/supabase/server';
import type {
  Assessment,
  AssessmentResult,
  AssessmentResultHistory,
  Classe,
  ClassSubject,
  GradingCategory,
  GradingScale,
  GradingSystem,
  Learner,
  Subject,
  Teacher,
} from '@/lib/types/database';
import { TAILLE_PAGE, type PageResultats } from '@/services/etablissements';

/**
 * Barèmes utilisables par un établissement.
 *
 * Comme pour les statuts de présence, un barème propre à l'établissement
 * coexiste avec ceux de l'organisation : une classe peut être notée sur 20
 * pendant qu'une formation professionnelle fonctionne par niveaux de maîtrise.
 */
export async function baremesUtilisables(etablissementId: string): Promise<GradingSystem[]> {
  const supabase = await clientServeur();
  const { data, error } = await supabase
    .from('grading_systems')
    .select('*')
    .or(`establishment_id.is.null,establishment_id.eq.${etablissementId}`)
    .order('name');

  if (error) throw error;
  return data ?? [];
}

export async function tranchesDuBareme(baremeId: string): Promise<GradingScale[]> {
  const supabase = await clientServeur();
  const { data, error } = await supabase
    .from('grading_scales')
    .select('*')
    .eq('grading_system_id', baremeId)
    .order('position');

  if (error) throw error;
  return data ?? [];
}

export async function toutesLesTranches(baremeIds: string[]): Promise<Map<string, GradingScale[]>> {
  const parBareme = new Map<string, GradingScale[]>();
  if (baremeIds.length === 0) return parBareme;

  const supabase = await clientServeur();
  const { data, error } = await supabase
    .from('grading_scales')
    .select('*')
    .in('grading_system_id', baremeIds)
    .order('position');

  if (error) throw error;

  for (const tranche of data ?? []) {
    const liste = parBareme.get(tranche.grading_system_id) ?? [];
    liste.push(tranche);
    parBareme.set(tranche.grading_system_id, liste);
  }
  return parBareme;
}

export async function categoriesUtilisables(etablissementId: string): Promise<GradingCategory[]> {
  const supabase = await clientServeur();
  const { data, error } = await supabase
    .from('grading_categories')
    .select('*')
    .eq('is_active', true)
    .or(`establishment_id.is.null,establishment_id.eq.${etablissementId}`)
    .order('position');

  if (error) throw error;
  return data ?? [];
}

export interface AnomalieBareme {
  gravite: string;
  code: string;
  message: string;
}

/**
 * Contrôle de configuration d'un barème.
 *
 * Se fait à la prévisualisation, pas au moment du bulletin : une échelle
 * incohérente découverte sur un document déjà remis est irrattrapable.
 */
export async function anomaliesDuBareme(baremeId: string): Promise<AnomalieBareme[]> {
  const supabase = await clientServeur();
  const { data, error } = await supabase.rpc('verifier_bareme', { p_system_id: baremeId });
  if (error) throw error;
  return (data ?? []) as AnomalieBareme[];
}

export interface CoefficientMatiere extends ClassSubject {
  matiere: Pick<Subject, 'id' | 'name' | 'code'> | null;
}

export async function coefficientsDeLaClasse(classeId: string): Promise<CoefficientMatiere[]> {
  const supabase = await clientServeur();
  const { data, error } = await supabase
    .from('class_subjects')
    .select('*, matiere:subjects(id, name, code)')
    .eq('class_id', classeId)
    .order('position');

  if (error) throw error;
  return (data ?? []) as unknown as CoefficientMatiere[];
}

export interface EvaluationDetaillee extends Assessment {
  classe: Pick<Classe, 'id' | 'name' | 'code'> | null;
  matiere: Pick<Subject, 'id' | 'name'> | null;
  enseignant: Pick<Teacher, 'id' | 'given_name' | 'family_name'> | null;
  categorie: Pick<GradingCategory, 'id' | 'name' | 'weight'> | null;
  bareme: Pick<GradingSystem, 'id' | 'name' | 'min_value' | 'max_value' | 'decimals' | 'type'> | null;
}

export async function listerEvaluations(
  anneeId: string,
  page = 1,
  classeId?: string,
): Promise<PageResultats<EvaluationDetaillee & { saisies: number; attendus: number }>> {
  const supabase = await clientServeur();
  const depuis = (page - 1) * TAILLE_PAGE;

  let requete = supabase
    .from('assessments')
    .select(
      '*, classe:classes(id, name, code), matiere:subjects(id, name),' +
        ' enseignant:teachers(id, given_name, family_name),' +
        ' categorie:grading_categories(id, name, weight),' +
        ' bareme:grading_systems(id, name, min_value, max_value, decimals, type)',
      { count: 'exact' },
    )
    .eq('academic_year_id', anneeId);

  if (classeId) requete = requete.eq('class_id', classeId);

  const { data, count, error } = await requete
    .order('date_on', { ascending: false })
    .range(depuis, depuis + TAILLE_PAGE - 1);

  if (error) throw error;

  const evaluations = (data ?? []) as unknown as EvaluationDetaillee[];
  const identifiants = evaluations.map((e) => e.id);

  // Nombre de notes réellement saisies — une ligne « en attente » n'en est pas
  // une : elle n'est ni une note, ni une absence.
  const saisies = new Map<string, number>();
  if (identifiants.length > 0) {
    const { data: lignes } = await supabase
      .from('assessment_results')
      .select('assessment_id, kind')
      .in('assessment_id', identifiants);

    for (const ligne of lignes ?? []) {
      if (ligne.kind === 'PENDING') continue;
      saisies.set(ligne.assessment_id, (saisies.get(ligne.assessment_id) ?? 0) + 1);
    }
  }

  // Effectif attendu par classe.
  const classes = [...new Set(evaluations.map((e) => e.class_id))];
  const effectifs = new Map<string, number>();
  if (classes.length > 0) {
    const { data: inscrits } = await supabase
      .from('enrollments')
      .select('class_id')
      .in('class_id', classes)
      .in('status', ['PREREGISTERED', 'ENROLLED', 'ACTIVE', 'SUSPENDED']);

    for (const ligne of inscrits ?? []) {
      if (!ligne.class_id) continue;
      effectifs.set(ligne.class_id, (effectifs.get(ligne.class_id) ?? 0) + 1);
    }
  }

  const total = count ?? 0;
  return {
    lignes: evaluations.map((evaluation) => ({
      ...evaluation,
      saisies: saisies.get(evaluation.id) ?? 0,
      attendus: effectifs.get(evaluation.class_id) ?? 0,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / TAILLE_PAGE)),
  };
}

export interface LigneNote {
  enrollmentId: string;
  apprenant: Pick<Learner, 'id' | 'given_name' | 'family_name' | 'learner_code'>;
  noteId: string | null;
  nature: AssessmentResult['kind'];
  valeur: number | null;
  commentaire: string | null;
  statut: AssessmentResult['status'] | null;
  corrections: number;
}

export interface FeuilleNotes {
  evaluation: EvaluationDetaillee;
  tranches: GradingScale[];
  lignes: LigneNote[];
}

/**
 * Feuille de notes d'une évaluation.
 *
 * `nature` vaut 'PENDING' tant que rien n'a été saisi : ce n'est ni une note,
 * ni une absence, et l'écran doit le montrer comme tel (@CLAUDE.md, règle 4).
 */
export async function feuilleDeNotes(evaluationId: string): Promise<FeuilleNotes | null> {
  const supabase = await clientServeur();

  const { data: brute } = await supabase
    .from('assessments')
    .select(
      '*, classe:classes(id, name, code), matiere:subjects(id, name),' +
        ' enseignant:teachers(id, given_name, family_name),' +
        ' categorie:grading_categories(id, name, weight),' +
        ' bareme:grading_systems(id, name, min_value, max_value, decimals, type)',
    )
    .eq('id', evaluationId)
    .maybeSingle();

  if (!brute) return null;
  const evaluation = brute as unknown as EvaluationDetaillee;

  const [inscriptionsRes, notesRes, tranchesRes] = await Promise.all([
    supabase
      .from('enrollments')
      .select('id, apprenant:learners(id, given_name, family_name, learner_code)')
      .eq('class_id', evaluation.class_id)
      .in('status', ['PREREGISTERED', 'ENROLLED', 'ACTIVE', 'SUSPENDED']),
    supabase
      .from('assessment_results')
      .select('id, enrollment_id, kind, raw_value, comment, status')
      .eq('assessment_id', evaluationId),
    supabase
      .from('grading_scales')
      .select('*')
      .eq('grading_system_id', evaluation.grading_system_id)
      .order('position'),
  ]);

  if (inscriptionsRes.error) throw inscriptionsRes.error;

  const identifiants = (notesRes.data ?? []).map((n) => n.id);
  const corrections = new Map<string, number>();
  if (identifiants.length > 0) {
    const { data } = await supabase
      .from('assessment_result_histories')
      .select('result_id')
      .in('result_id', identifiants)
      .eq('action', 'corrected');
    for (const ligne of data ?? []) {
      corrections.set(ligne.result_id, (corrections.get(ligne.result_id) ?? 0) + 1);
    }
  }

  const parInscription = new Map((notesRes.data ?? []).map((n) => [n.enrollment_id, n]));

  type LigneBrute = {
    id: string;
    apprenant: Pick<Learner, 'id' | 'given_name' | 'family_name' | 'learner_code'>;
  };

  const lignes: LigneNote[] = ((inscriptionsRes.data ?? []) as unknown as LigneBrute[])
    .map((inscription) => {
      const note = parInscription.get(inscription.id);
      return {
        enrollmentId: inscription.id,
        apprenant: inscription.apprenant,
        noteId: note?.id ?? null,
        nature: (note?.kind ?? 'PENDING') as AssessmentResult['kind'],
        valeur: note?.raw_value ?? null,
        commentaire: note?.comment ?? null,
        statut: note?.status ?? null,
        corrections: note ? (corrections.get(note.id) ?? 0) : 0,
      };
    })
    .sort((a, b) =>
      `${a.apprenant.family_name} ${a.apprenant.given_name}`.localeCompare(
        `${b.apprenant.family_name} ${b.apprenant.given_name}`,
        'fr',
      ),
    );

  return { evaluation, tranches: tranchesRes.data ?? [], lignes };
}

export async function historiqueNote(noteId: string): Promise<AssessmentResultHistory[]> {
  const supabase = await clientServeur();
  const { data, error } = await supabase
    .from('assessment_result_histories')
    .select('*')
    .eq('result_id', noteId)
    .order('changed_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}
