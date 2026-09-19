import { clientServeur } from '@/lib/supabase/server';

export interface StatistiquesSocle {
  etablissements: number;
  membres: number;
  invitationsEnAttente: number | null;
}

export interface StatistiquesAcademiques {
  anneeNom: string | null;
  apprenantsActifs: number;
  classes: number;
  enseignants: number;
}

/**
 * Compteurs du tableau de bord.
 *
 * Les décomptes passent par RLS : un enseignant rattaché à un seul
 * établissement lit « 1 », un propriétaire lit le total réel. Chaque chiffre
 * reflète donc ce que l'utilisateur peut effectivement consulter.
 */
export async function statistiquesSocle(peutVoirInvitations: boolean): Promise<StatistiquesSocle> {
  const supabase = await clientServeur();

  const [etablissements, membres, invitations] = await Promise.all([
    supabase
      .from('establishments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ACTIVE'),
    supabase
      .from('organization_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ACTIVE'),
    peutVoirInvitations
      ? supabase
          .from('organization_invitations')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'PENDING')
      : Promise.resolve({ count: null }),
  ]);

  return {
    etablissements: etablissements.count ?? 0,
    membres: membres.count ?? 0,
    invitationsEnAttente: invitations.count ?? null,
  };
}

/**
 * Chiffres de l'année en cours dans l'établissement de travail.
 *
 * Tous passent par RLS : un enseignant y lit ce que sa portée lui laisse voir,
 * un propriétaire le total de l'établissement. « Apprenants actifs » ne compte
 * que les inscriptions vivantes — un diplômé n'est plus un effectif.
 */
export async function statistiquesAcademiques(
  etablissementId: string,
): Promise<StatistiquesAcademiques> {
  const supabase = await clientServeur();

  const { data: annee } = await supabase
    .from('academic_years')
    .select('id, name')
    .eq('establishment_id', etablissementId)
    .eq('is_current', true)
    .maybeSingle();

  if (!annee) {
    const { count } = await supabase
      .from('teachers')
      .select('id', { count: 'exact', head: true })
      .eq('establishment_id', etablissementId)
      .eq('status', 'ACTIVE');

    return { anneeNom: null, apprenantsActifs: 0, classes: 0, enseignants: count ?? 0 };
  }

  const [apprenants, classes, enseignants] = await Promise.all([
    supabase
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('academic_year_id', annee.id)
      .in('status', ['PREREGISTERED', 'ENROLLED', 'ACTIVE', 'SUSPENDED']),
    supabase
      .from('classes')
      .select('id', { count: 'exact', head: true })
      .eq('academic_year_id', annee.id)
      .eq('is_active', true),
    supabase
      .from('teachers')
      .select('id', { count: 'exact', head: true })
      .eq('establishment_id', etablissementId)
      .eq('status', 'ACTIVE'),
  ]);

  return {
    anneeNom: annee.name,
    apprenantsActifs: apprenants.count ?? 0,
    classes: classes.count ?? 0,
    enseignants: enseignants.count ?? 0,
  };
}
