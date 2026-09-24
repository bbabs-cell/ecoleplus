-- =============================================================================
-- 0032 — La langue de l'organisation entre dans le jeton
-- =============================================================================
-- Pour que l'interface s'affiche dans la bonne langue et la bonne DIRECTION
-- dès la première requête, `<html lang dir>` doit être posé par la mise en page
-- racine — qui s'exécute avant tout contexte applicatif.
--
-- Le hook est le bon endroit : il stampe déjà l'organisation active. La langue
-- en fait partie, et la faire voyager dans le jeton évite une requête
-- supplémentaire à chaque navigation. Le proxy la recopie ensuite dans un
-- cookie lisible, sans jamais lui faire confiance pour une décision de
-- sécurité — ce n'est qu'un réglage d'affichage.
--
-- Rien d'autre ne change : les claims de sécurité sont identiques.
-- =============================================================================

create or replace function ecoleplus.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_profile_id   uuid  := (event ->> 'user_id')::uuid;
  v_claims       jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  v_org_demandee text  := coalesce(v_claims -> 'user_metadata' ->> 'active_org_id', '');
  v_adhesion     record;
  v_permissions  jsonb;
  v_etablissements jsonb;
  v_locale       text;
begin
  select m.id,
         m.organization_id,
         r.code  as role_code,
         r.scope as role_scope
    into v_adhesion
    from public.organization_memberships m
    join public.roles r         on r.id = m.role_id
    join public.organizations o on o.id = m.organization_id
   where m.profile_id = v_profile_id
     and m.status = 'ACTIVE'
     and o.status in ('TRIAL', 'ACTIVE')
   order by (m.organization_id::text = v_org_demandee) desc, m.created_at asc
   limit 1;

  if v_adhesion.id is null then
    return jsonb_set(event, '{claims}', v_claims || jsonb_build_object(
      'org_id',            null,
      'role_code',         null,
      'role_scope',        null,
      'establishment_ids', '[]'::jsonb,
      'permissions',       '[]'::jsonb,
      'is_platform_admin', false,
      'locale',            null
    ));
  end if;

  select coalesce(jsonb_agg(rp.permission_key), '[]'::jsonb)
    into v_permissions
    from public.role_permissions rp
   where rp.role_id = (select role_id from public.organization_memberships
                        where id = v_adhesion.id);

  select coalesce(jsonb_agg(eu.establishment_id::text), '[]'::jsonb)
    into v_etablissements
    from public.establishment_users eu
    join public.establishments e on e.id = eu.establishment_id
   where eu.membership_id = v_adhesion.id
     and e.status = 'ACTIVE';

  select os.default_locale into v_locale
    from public.organization_settings os
   where os.organization_id = v_adhesion.organization_id;

  return jsonb_set(event, '{claims}', v_claims || jsonb_build_object(
    'org_id',            v_adhesion.organization_id,
    'role_code',         v_adhesion.role_code,
    'role_scope',        v_adhesion.role_scope,
    'establishment_ids', v_etablissements,
    'permissions',       v_permissions,
    'is_platform_admin', v_adhesion.role_scope = 'PLATFORM',
    'locale',            v_locale
  ));
end;
$$;

-- Le hook lit désormais les réglages de l'organisation.
grant select on public.organization_settings to supabase_auth_admin;
