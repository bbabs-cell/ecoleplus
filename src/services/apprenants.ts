import { clientServeur } from '@/lib/supabase/server';
import type { Classe, Enrollment, Learner, Level } from '@/lib/types/database';
import { TAILLE_PAGE, type PageResultats } from '@/services/etablissements';

export interface InscriptionDetaillee extends Enrollment {
  apprenant: Learner;
  niveau: Pick<Level, 'id' | 'name'> | null;
  classe: Pick<Classe, 'id' | 'name' | 'code'> | null;
}

/**
 * Inscriptions d'une année, avec le dossier de l'apprenant.
 *
 * On parcourt les inscriptions plutôt que les apprenants : c'est l'inscription
 * qui porte l'année, l'établissement, le niveau et la classe. RLS restreint
 * déjà la liste à ce que l'appelant peut voir.
 */
export async function listerInscriptions(
  anneeId: string,
  page = 1,
  recherche?: string | undefined,
): Promise<PageResultats<InscriptionDetaillee>> {
  const supabase = await clientServeur();
  const depuis = (page - 1) * TAILLE_PAGE;

  let requete = supabase
    .from('enrollments')
    .select(
      '*, apprenant:learners!inner(*), niveau:levels(id, name), classe:classes(id, name, code)',
      { count: 'exact' },
    )
    .eq('academic_year_id', anneeId);

  if (recherche && recherche.trim().length > 0) {
    // `or` porte sur la table embarquée : on filtre sur le nom de l'apprenant.
    const motif = `%${recherche.trim()}%`;
    requete = requete.or(`given_name.ilike.${motif},family_name.ilike.${motif}`, {
      referencedTable: 'learners',
    });
  }

  const { data, count, error } = await requete
    .order('created_at', { ascending: false })
    .range(depuis, depuis + TAILLE_PAGE - 1);

  if (error) throw error;

  const total = count ?? 0;
  return {
    lignes: (data ?? []) as unknown as InscriptionDetaillee[],
    total,
    page,
    pages: Math.max(1, Math.ceil(total / TAILLE_PAGE)),
  };
}

export interface DossierApprenant {
  apprenant: Learner;
  inscriptions: (Enrollment & {
    niveau: Pick<Level, 'id' | 'name'> | null;
    classe: Pick<Classe, 'id' | 'name' | 'code'> | null;
    annee: { id: string; name: string } | null;
    etablissement: { id: string; name: string } | null;
  })[];
}

/** Dossier complet : identité et historique des inscriptions, toutes années. */
export async function lireDossier(apprenantId: string): Promise<DossierApprenant | null> {
  const supabase = await clientServeur();

  const { data: apprenant } = await supabase
    .from('learners')
    .select('*')
    .eq('id', apprenantId)
    .maybeSingle();

  if (!apprenant) return null;

  const { data: inscriptions, error } = await supabase
    .from('enrollments')
    .select(
      '*, niveau:levels(id, name), classe:classes(id, name, code), annee:academic_years(id, name), etablissement:establishments(id, name)',
    )
    .eq('learner_id', apprenantId)
    .order('enrolled_on', { ascending: false });

  if (error) throw error;

  return {
    apprenant,
    inscriptions: (inscriptions ?? []) as unknown as DossierApprenant['inscriptions'],
  };
}

/** Répartition par statut, pour le bandeau de la liste. */
export async function repartitionStatuts(anneeId: string): Promise<Record<string, number>> {
  const supabase = await clientServeur();

  const { data, error } = await supabase
    .from('enrollments')
    .select('status')
    .eq('academic_year_id', anneeId);

  if (error) throw error;

  const compte: Record<string, number> = {};
  for (const ligne of data ?? []) {
    compte[ligne.status] = (compte[ligne.status] ?? 0) + 1;
  }
  return compte;
}
