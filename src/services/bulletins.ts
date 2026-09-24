import { clientServeur } from '@/lib/supabase/server';
import type {
  AcademicTerm,
  Classe,
  Json,
  Learner,
  ReportCard,
  ReportCardPublication,
} from '@/lib/types/database';

/**
 * Instantané d'un bulletin.
 *
 * Tout ce que le bulletin affiche vit dans ce JSON figé : c'est ce qui permet
 * à un bulletin remis en décembre de rester tel quel après une correction de
 * note en mars. On le relit, on ne le recalcule pas.
 */
export interface MatiereBulletin {
  subject_id: string;
  nom: string;
  coefficient: number | null;
  notes_prises: number | null;
  notes_ignorees: number | null;
  ratio: number | null;
  valeur: number | null;
  mention: string | null;
  bareme_id: string | null;
}

export interface InstantaneBulletin {
  version_instantane: number;
  genere_le: string;
  apprenant: {
    id: string;
    given_name: string;
    family_name: string;
    learner_code: string | null;
    birth_date: string | null;
  };
  classe: { id: string; name: string; code: string | null } | null;
  niveau: { id: string; name: string } | null;
  annee: { id: string; name: string } | null;
  periode: { id: string; name: string; position: number; weight: number } | null;
  etablissement: { id: string; name: string; code: string | null } | null;
  reglages: {
    locale: string;
    timezone: string;
    date_format: string;
    currency: string;
    name_display_format: string;
  } | null;
  moyenne_generale: {
    ratio: number | null;
    valeur: number | null;
    mention: string | null;
    matieres: number | null;
    bareme_id: string | null;
  } | null;
  matieres: MatiereBulletin[];
  rang?: { rang: number | null; sur: number | null };
  anomalies?: { bareme: string; gravite: string; code: string; message: string }[];
}

/**
 * Le JSON vient de PostgreSQL, pas du navigateur : il est produit par
 * `ecoleplus.construire_bulletin`, jamais reçu d'un client. La conversion est
 * donc sûre, mais reste isolée ici pour n'apparaître qu'une fois.
 */
export function lireInstantane(valeur: Json): InstantaneBulletin {
  return valeur as unknown as InstantaneBulletin;
}

export async function previsualiserBulletin(
  inscriptionId: string,
  periodeId: string | null,
): Promise<InstantaneBulletin> {
  const supabase = await clientServeur();
  const { data, error } = await supabase.rpc('previsualiser_bulletin', {
    p_enrollment_id: inscriptionId,
    ...(periodeId ? { p_term_id: periodeId } : {}),
  });

  if (error) throw error;
  return lireInstantane(data);
}

export interface BulletinDetaille extends ReportCard {
  inscription: {
    id: string;
    apprenant: Pick<Learner, 'id' | 'given_name' | 'family_name' | 'learner_code'>;
  } | null;
  classe: Pick<Classe, 'id' | 'name' | 'code'> | null;
  periode: Pick<AcademicTerm, 'id' | 'name' | 'position'> | null;
}

export async function listerBulletins(
  classeId: string,
  periodeId: string | null,
): Promise<BulletinDetaille[]> {
  const supabase = await clientServeur();

  let requete = supabase
    .from('report_cards')
    .select(
      '*, inscription:enrollments(id, apprenant:learners(id, given_name, family_name, learner_code)),' +
        ' classe:classes(id, name, code), periode:academic_terms(id, name, position)',
    )
    .eq('class_id', classeId);

  requete = periodeId ? requete.eq('academic_term_id', periodeId) : requete.is('academic_term_id', null);

  const { data, error } = await requete;
  if (error) throw error;

  return ((data ?? []) as unknown as BulletinDetaille[]).sort((a, b) => {
    const na = a.inscription?.apprenant;
    const nb = b.inscription?.apprenant;
    if (!na || !nb) return 0;
    return `${na.family_name} ${na.given_name}`.localeCompare(
      `${nb.family_name} ${nb.given_name}`,
      'fr',
    );
  });
}

export async function bulletin(bulletinId: string): Promise<BulletinDetaille | null> {
  const supabase = await clientServeur();
  const { data } = await supabase
    .from('report_cards')
    .select(
      '*, inscription:enrollments(id, apprenant:learners(id, given_name, family_name, learner_code)),' +
        ' classe:classes(id, name, code), periode:academic_terms(id, name, position)',
    )
    .eq('id', bulletinId)
    .maybeSingle();

  return (data as unknown as BulletinDetaille) ?? null;
}

/** Les versions remises, de la plus récente à la plus ancienne. */
export async function versionsPubliees(bulletinId: string): Promise<ReportCardPublication[]> {
  const supabase = await clientServeur();
  const { data, error } = await supabase
    .from('report_card_publications')
    .select('*')
    .eq('report_card_id', bulletinId)
    .order('version', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** Inscriptions vivantes d'une classe — le périmètre d'une campagne de bulletins. */
export async function inscriptionsDeLaClasse(classeId: string): Promise<
  { id: string; apprenant: Pick<Learner, 'id' | 'given_name' | 'family_name' | 'learner_code'> }[]
> {
  const supabase = await clientServeur();
  const { data, error } = await supabase
    .from('enrollments')
    .select('id, apprenant:learners(id, given_name, family_name, learner_code)')
    .eq('class_id', classeId)
    .in('status', ['PREREGISTERED', 'ENROLLED', 'ACTIVE', 'SUSPENDED']);

  if (error) throw error;

  type Ligne = {
    id: string;
    apprenant: Pick<Learner, 'id' | 'given_name' | 'family_name' | 'learner_code'>;
  };

  return ((data ?? []) as unknown as Ligne[]).sort((a, b) =>
    `${a.apprenant.family_name} ${a.apprenant.given_name}`.localeCompare(
      `${b.apprenant.family_name} ${b.apprenant.given_name}`,
      'fr',
    ),
  );
}

/** Le rang est-il activé pour cet établissement ? Défaut : non. */
export async function rangActive(etablissementId: string): Promise<boolean> {
  const supabase = await clientServeur();
  const { data } = await supabase
    .from('establishment_settings')
    .select('value')
    .eq('establishment_id', etablissementId)
    .eq('key', 'report_card.rank_enabled')
    .maybeSingle();

  return data?.value === true;
}
