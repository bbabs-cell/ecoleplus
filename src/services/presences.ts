import { clientServeur } from '@/lib/supabase/server';
import type {
  AttendanceCorrection,
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  Classe,
  Learner,
  Subject,
  Teacher,
} from '@/lib/types/database';
import { TAILLE_PAGE, type PageResultats } from '@/services/etablissements';

/**
 * Statuts de présence utilisables.
 *
 * Un statut propre à l'établissement masque celui de l'organisation qui porte
 * le même code : c'est ce qui permet à un établissement de redéfinir « retard »
 * pour lui seul sans toucher aux autres.
 */
export async function statutsUtilisables(etablissementId: string): Promise<AttendanceStatus[]> {
  const supabase = await clientServeur();

  const { data, error } = await supabase
    .from('attendance_statuses')
    .select('*')
    .eq('is_active', true)
    .or(`establishment_id.is.null,establishment_id.eq.${etablissementId}`)
    .order('position');

  if (error) throw error;

  const parCode = new Map<string, AttendanceStatus>();
  for (const statut of data ?? []) {
    const existant = parCode.get(statut.code);
    // À code égal, la définition de l'établissement l'emporte.
    if (!existant || statut.establishment_id !== null) parCode.set(statut.code, statut);
  }

  return [...parCode.values()].sort((a, b) => a.position - b.position);
}

export interface SeanceDetaillee extends AttendanceSession {
  classe: Pick<Classe, 'id' | 'name' | 'code'> | null;
  matiere: Pick<Subject, 'id' | 'name'> | null;
  enseignant: Pick<Teacher, 'id' | 'given_name' | 'family_name'> | null;
}

export async function listerSeances(
  anneeId: string,
  page = 1,
): Promise<PageResultats<SeanceDetaillee & { appeles: number }>> {
  const supabase = await clientServeur();
  const depuis = (page - 1) * TAILLE_PAGE;

  const { data, count, error } = await supabase
    .from('attendance_sessions')
    .select(
      '*, classe:classes(id, name, code), matiere:subjects(id, name), enseignant:teachers(id, given_name, family_name)',
      { count: 'exact' },
    )
    .eq('academic_year_id', anneeId)
    .order('date_on', { ascending: false })
    .order('starts_at', { ascending: true, nullsFirst: true })
    .range(depuis, depuis + TAILLE_PAGE - 1);

  if (error) throw error;

  const seances = (data ?? []) as unknown as SeanceDetaillee[];

  // Nombre d'apprenants déjà pointés, pour signaler les feuilles incomplètes.
  const identifiants = seances.map((seance) => seance.id);
  const comptes = new Map<string, number>();

  if (identifiants.length > 0) {
    const { data: lignes } = await supabase
      .from('attendance_records')
      .select('session_id')
      .in('session_id', identifiants);

    for (const ligne of lignes ?? []) {
      comptes.set(ligne.session_id, (comptes.get(ligne.session_id) ?? 0) + 1);
    }
  }

  const total = count ?? 0;
  return {
    lignes: seances.map((seance) => ({ ...seance, appeles: comptes.get(seance.id) ?? 0 })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / TAILLE_PAGE)),
  };
}

export interface LigneAppel {
  enrollmentId: string;
  apprenant: Pick<Learner, 'id' | 'given_name' | 'family_name' | 'learner_code'>;
  statutId: string | null;
  commentaire: string | null;
  recordId: string | null;
  corrections: number;
}

export interface FeuilleAppel {
  seance: SeanceDetaillee;
  lignes: LigneAppel[];
}

/**
 * Feuille d'appel : tous les inscrits vivants de la classe, avec le statut déjà
 * posé s'il existe.
 *
 * Les inscriptions terminées (transfert, abandon, diplôme) sont exclues : on
 * n'appelle pas un élève qui a quitté l'établissement.
 */
export async function feuilleDAppel(seanceId: string): Promise<FeuilleAppel | null> {
  const supabase = await clientServeur();

  const { data: seanceBrute } = await supabase
    .from('attendance_sessions')
    .select(
      '*, classe:classes(id, name, code), matiere:subjects(id, name), enseignant:teachers(id, given_name, family_name)',
    )
    .eq('id', seanceId)
    .maybeSingle();

  if (!seanceBrute) return null;
  const seance = seanceBrute as unknown as SeanceDetaillee;

  const [inscriptionsRes, recordsRes] = await Promise.all([
    supabase
      .from('enrollments')
      .select('id, apprenant:learners(id, given_name, family_name, learner_code)')
      .eq('class_id', seance.class_id)
      .in('status', ['PREREGISTERED', 'ENROLLED', 'ACTIVE', 'SUSPENDED']),
    supabase
      .from('attendance_records')
      .select('id, enrollment_id, status_id, comment')
      .eq('session_id', seanceId),
  ]);

  if (inscriptionsRes.error) throw inscriptionsRes.error;

  const identifiants = (recordsRes.data ?? []).map((r) => r.id);
  const corrections = new Map<string, number>();
  if (identifiants.length > 0) {
    const { data } = await supabase
      .from('attendance_corrections')
      .select('record_id')
      .in('record_id', identifiants);
    for (const ligne of data ?? []) {
      corrections.set(ligne.record_id, (corrections.get(ligne.record_id) ?? 0) + 1);
    }
  }

  const parInscription = new Map(
    (recordsRes.data ?? []).map((r) => [r.enrollment_id, r]),
  );

  type LigneBrute = {
    id: string;
    apprenant: Pick<Learner, 'id' | 'given_name' | 'family_name' | 'learner_code'>;
  };

  const lignes: LigneAppel[] = ((inscriptionsRes.data ?? []) as unknown as LigneBrute[])
    .map((inscription) => {
      const record = parInscription.get(inscription.id);
      return {
        enrollmentId: inscription.id,
        apprenant: inscription.apprenant,
        statutId: record?.status_id ?? null,
        commentaire: record?.comment ?? null,
        recordId: record?.id ?? null,
        corrections: record ? (corrections.get(record.id) ?? 0) : 0,
      };
    })
    .sort((a, b) =>
      `${a.apprenant.family_name} ${a.apprenant.given_name}`.localeCompare(
        `${b.apprenant.family_name} ${b.apprenant.given_name}`,
        'fr',
      ),
    );

  return { seance, lignes };
}

export async function historiqueCorrections(
  recordId: string,
): Promise<(AttendanceCorrection & { record: Pick<AttendanceRecord, 'id'> | null })[]> {
  const supabase = await clientServeur();
  const { data, error } = await supabase
    .from('attendance_corrections')
    .select('*')
    .eq('record_id', recordId)
    .order('changed_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as (AttendanceCorrection & {
    record: Pick<AttendanceRecord, 'id'> | null;
  })[];
}
