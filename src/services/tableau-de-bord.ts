import { clientServeur } from '@/lib/supabase/server';

export interface StatistiquesSocle {
  etablissements: number;
  membres: number;
  invitationsEnAttente: number | null;
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
