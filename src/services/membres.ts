import { clientServeur } from '@/lib/supabase/server';
import type {
  Establishment,
  OrganizationInvitation,
  OrganizationMembership,
  Profile,
  Role,
} from '@/lib/types/database';
import { TAILLE_PAGE, type PageResultats } from '@/services/etablissements';

export interface MembreDetaille extends OrganizationMembership {
  role: Role;
  profil: Profile;
  etablissements: Pick<Establishment, 'id' | 'name'>[];
}

/**
 * Membres de l'organisation, paginés.
 *
 * L'adresse e-mail n'apparaît pas : elle vit dans `auth.users`, que le client
 * n'interroge pas. Seules les invitations en portent une, le temps d'être
 * acceptées.
 */
export async function listerMembres(page = 1): Promise<PageResultats<MembreDetaille>> {
  const supabase = await clientServeur();
  const depuis = (page - 1) * TAILLE_PAGE;

  const { data, count, error } = await supabase
    .from('organization_memberships')
    .select(
      '*, role:roles(*), profil:profiles(*), rattachements:establishment_users(establishment:establishments(id, name))',
      { count: 'exact' },
    )
    .order('created_at')
    .range(depuis, depuis + TAILLE_PAGE - 1);

  if (error) throw error;

  type LigneBrute = OrganizationMembership & {
    role: Role;
    profil: Profile;
    rattachements: { establishment: Pick<Establishment, 'id' | 'name'> | null }[] | null;
  };

  const lignes = ((data ?? []) as unknown as LigneBrute[]).map((ligne) => ({
    ...ligne,
    etablissements: (ligne.rattachements ?? [])
      .map((rattachement) => rattachement.establishment)
      .filter((etablissement): etablissement is Pick<Establishment, 'id' | 'name'> =>
        Boolean(etablissement),
      ),
  }));

  const total = count ?? 0;

  return { lignes, total, page, pages: Math.max(1, Math.ceil(total / TAILLE_PAGE)) };
}

export interface InvitationDetaillee extends OrganizationInvitation {
  role: Role;
}

export async function listerInvitationsEnAttente(): Promise<InvitationDetaillee[]> {
  const supabase = await clientServeur();

  const { data, error } = await supabase
    .from('organization_invitations')
    .select('*, role:roles(*)')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as InvitationDetaillee[];
}

/**
 * Rôles attribuables dans l'organisation.
 *
 * Les rôles de portée PLATFORM sont exclus : ils ne s'attribuent que dans
 * l'organisation interne, et la migration 0003 le refuse de toute façon.
 */
export async function listerRolesAttribuables(): Promise<Role[]> {
  const supabase = await clientServeur();

  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .neq('scope', 'PLATFORM')
    .order('scope')
    .order('label');

  if (error) throw error;
  return data ?? [];
}
