import { cache } from 'react';
import { cookies } from 'next/headers';
import { clientServeur } from '@/lib/supabase/server';
import type {
  Establishment,
  Organization,
  OrganizationMembership,
  OrganizationSettings,
  Profile,
  Role,
} from '@/lib/types/database';

export const COOKIE_ETABLISSEMENT = 'ecoleplus_etablissement';

export interface ContexteSession {
  utilisateur: { id: string; email: string | null };
  profil: Profile;
  /** `null` tant que l'utilisateur n'appartient à aucune organisation active. */
  organisation: Organization | null;
  reglages: OrganizationSettings | null;
  adhesion: (OrganizationMembership & { role: Role }) | null;
  permissions: ReadonlySet<string>;
  etablissements: Establishment[];
  /** Établissement de travail courant, choisi côté serveur uniquement. */
  etablissementActif: Establishment | null;
}

/**
 * Contexte complet de la requête courante.
 *
 * Mémorisé par `cache()` : plusieurs composants de la même page le demandent,
 * et une seule série de requêtes suffit.
 *
 * Les permissions sont relues en base plutôt que dans le JWT. Un jeton peut
 * dater d'avant un changement de rôle ; l'écart joue alors dans le bon sens,
 * puisque RLS — qui, lui, s'appuie sur le jeton — reste l'arbitre final. Cette
 * liste sert à l'affichage et aux gardes serveur, jamais de seule barrière.
 */
export const contexteSession = cache(async (): Promise<ContexteSession | null> => {
  const supabase = await clientServeur();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profil } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profil) return null;

  const utilisateur = { id: user.id, email: user.email ?? null };

  const { data: adhesionBrute } = await supabase
    .from('organization_memberships')
    .select('*, role:roles(*)')
    .eq('profile_id', user.id)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  const adhesion = adhesionBrute as (OrganizationMembership & { role: Role }) | null;

  if (!adhesion) {
    return {
      utilisateur,
      profil,
      organisation: null,
      reglages: null,
      adhesion: null,
      permissions: new Set<string>(),
      etablissements: [],
      etablissementActif: null,
    };
  }

  // RLS restreint déjà chacune de ces lectures à l'organisation du jeton :
  // aucun filtre supplémentaire n'est nécessaire, et en ajouter un donnerait
  // l'illusion que c'est lui qui protège.
  const [organisationRes, reglagesRes, permissionsRes, etablissementsRes] = await Promise.all([
    supabase.from('organizations').select('*').maybeSingle(),
    supabase.from('organization_settings').select('*').maybeSingle(),
    supabase.from('role_permissions').select('permission_key').eq('role_id', adhesion.role_id),
    supabase.from('establishments').select('*').eq('status', 'ACTIVE').order('name'),
  ]);

  const permissions = new Set<string>(
    (permissionsRes.data ?? []).map((ligne) => ligne.permission_key),
  );
  const etablissements = etablissementsRes.data ?? [];

  const magasin = await cookies();
  const demande = magasin.get(COOKIE_ETABLISSEMENT)?.value;

  // Le cookie n'est qu'une préférence : il n'ouvre aucun accès. Un identifiant
  // inconnu ou hors de portée retombe silencieusement sur le premier
  // établissement réellement accessible.
  const etablissementActif =
    etablissements.find((etablissement) => etablissement.id === demande) ??
    etablissements[0] ??
    null;

  return {
    utilisateur,
    profil,
    organisation: organisationRes.data ?? null,
    reglages: reglagesRes.data ?? null,
    adhesion,
    permissions,
    etablissements,
    etablissementActif,
  };
});
