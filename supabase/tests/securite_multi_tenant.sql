-- =============================================================================
-- Tests de sécurité multi-tenant
-- =============================================================================
-- Vérifie sur une base réelle ce que les policies prétendent garantir. À jouer
-- après chaque migration touchant RLS, les rôles ou les permissions.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/securite_multi_tenant.sql
--
-- Le script se termine par un ROLLBACK : il ne laisse aucune trace.
-- Couverture : isolation inter-organisations, portée établissement, escalade de
-- privilèges, immuabilité de l'audit, garde du dernier propriétaire,
-- détournement d'invitation.
-- =============================================================================

\set ON_ERROR_STOP on
-- Les résultats de requêtes sont sans intérêt ici : le rapport, ce sont les
-- NOTICE, qui partent sur la sortie d'erreur et restent donc visibles.
\o /dev/null
begin;

create or replace function pg_temp.verifier(p_condition boolean, p_libelle text)
returns void language plpgsql as $$
begin
  if p_condition then
    raise notice '  OK    %', p_libelle;
  else
    raise exception 'ECHEC: %', p_libelle;
  end if;
end;
$$;

-- Rejoue ce que fait le hook à l'émission du jeton, pour tester avec de vrais
-- claims plutôt qu'avec des claims écrits à la main.
-- SECURITY DEFINER parce que `custom_access_token_hook` est justement interdit
-- au rôle `authenticated` (migration 0005) : seul GoTrue l'appelle en vrai.
create or replace function pg_temp.claims_de(p_user uuid)
returns text language plpgsql security definer as $$
declare v_claims jsonb;
begin
  select ecoleplus.custom_access_token_hook(jsonb_build_object(
           'user_id', p_user,
           'claims', jsonb_build_object(
             'sub', p_user::text,
             'iat', extract(epoch from now())::bigint)
         )) -> 'claims'
    into v_claims;
  return v_claims::text;
end;
$$;

create temp table t (cle text primary key, val uuid);
-- Table du harnais, lue par les blocs exécutés sous le rôle `authenticated`.
grant select, insert on t to authenticated;

-- -----------------------------------------------------------------------------
-- Mise en place : deux organisations étanches
-- -----------------------------------------------------------------------------
insert into auth.users (email, raw_user_meta_data) values
  ('alice@alpha.test', '{"given_name":"Alice","family_name":"Nkosi"}'),
  ('bob@beta.test',    '{"given_name":"Bob","family_name":"Traoré"}'),
  ('carol@alpha.test', '{"given_name":"Carol","family_name":"Diallo"}'),
  ('dan@alpha.test',   '{"given_name":"Dan","family_name":"Mensah"}');

insert into t select 'alice', id from auth.users where email = 'alice@alpha.test';
insert into t select 'bob',   id from auth.users where email = 'bob@beta.test';
insert into t select 'carol', id from auth.users where email = 'carol@alpha.test';
insert into t select 'dan',   id from auth.users where email = 'dan@alpha.test';

do $$
begin
  perform pg_temp.verifier(
    (select count(*) from public.profiles) = 4,
    'Le trigger on_auth_user_created crée un profil par inscription');
end $$;

-- Alice crée ALPHA, Bob crée BETA.
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select val from t where cle='alice'))::text, true);
insert into t select 'alpha', public.creer_organisation('École Alpha', 'SN', 'Africa/Dakar', 'XOF', 'fr');

select set_config('request.jwt.claims',
  json_build_object('sub', (select val from t where cle='bob'))::text, true);
insert into t select 'beta', public.creer_organisation('Beta University', 'FR', 'Europe/Paris', 'EUR', 'fr');
reset role;

do $$
begin
  perform pg_temp.verifier(
    (select count(*) from public.organization_settings) = 2,
    'Chaque organisation reçoit ses réglages automatiquement');
  perform pg_temp.verifier(
    (select currency from public.organization_settings
      where organization_id = (select val from t where cle='alpha')) = 'XOF',
    'Les réglages retenus sont ceux choisis, pas les valeurs par défaut');
  perform pg_temp.verifier(
    (select count(*) from public.audit_logs where action = 'organization.created') = 2,
    'Toute création d''organisation est journalisée');
end $$;

-- Alice ajoute deux établissements à ALPHA.
set local role authenticated;
select set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

insert into public.establishments (organization_id, name, code, kind_label)
values ((select val from t where cle='alpha'), 'Lycée Central', 'LYC', 'lycée')
returning id \gset lyc_
insert into t values ('lycee', :'lyc_id');

insert into public.establishments (organization_id, name, code, kind_label)
values ((select val from t where cle='alpha'), 'École Primaire Nord', 'PRIM', 'primaire')
returning id \gset prim_
insert into t values ('primaire', :'prim_id');
reset role;

-- -----------------------------------------------------------------------------
-- 1. Isolation inter-organisations
-- -----------------------------------------------------------------------------
\echo ''
\echo '1. Isolation inter-organisations'

do $$
declare v_n integer; v_maj integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    pg_temp.claims_de((select val from t where cle='alice')), true);

  select count(*) into v_n from public.organizations;
  perform pg_temp.verifier(v_n = 1, 'Alice ne voit que son organisation');

  select count(*) into v_n from public.organizations
   where id = (select val from t where cle='beta');
  perform pg_temp.verifier(v_n = 0, 'BETA est invisible depuis ALPHA');

  -- Une tentative d'écriture croisée ne lève pas d'erreur : elle ne touche
  -- simplement aucune ligne. Le test porte donc sur le nombre de lignes.
  update public.organizations set name = 'Piraté'
   where id = (select val from t where cle='beta');
  get diagnostics v_maj = row_count;
  perform pg_temp.verifier(v_maj = 0, 'Alice ne peut pas modifier la fiche de BETA');

  select count(*) into v_n from public.audit_logs;
  perform pg_temp.verifier(v_n = 1, 'Le journal d''audit de BETA est invisible depuis ALPHA');

  execute 'reset role';
end $$;

do $$
declare v_erreur text;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    pg_temp.claims_de((select val from t where cle='alice')), true);

  begin
    insert into public.establishments (organization_id, name, code)
    values ((select val from t where cle='beta'), 'Annexe pirate', 'PIR');
    v_erreur := 'aucune';
  exception when others then
    v_erreur := sqlstate;
  end;

  perform pg_temp.verifier(v_erreur = '42501',
    'Créer un établissement chez BETA est refusé (violation de policy)');
  execute 'reset role';
end $$;

-- -----------------------------------------------------------------------------
-- 2. Portée établissement
-- -----------------------------------------------------------------------------
\echo ''
\echo '2. Portée établissement'

-- Alice invite Carol comme enseignante, sur le lycée uniquement.
set local role authenticated;
select set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);
select token from public.creer_invitation(
  'carol@alpha.test',
  (select id from public.roles where code = 'TEACHER' and organization_id is null),
  array[(select val from t where cle='lycee')]
) \gset carol_
reset role;

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select val from t where cle='carol'))::text, true);
select public.accepter_invitation(:'carol_token');
reset role;

do $$
declare v_n integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    pg_temp.claims_de((select val from t where cle='carol')), true);

  select count(*) into v_n from public.establishments;
  perform pg_temp.verifier(v_n = 1,
    'Une enseignante ne voit que l''établissement auquel elle est rattachée');

  select count(*) into v_n from public.establishments
   where id = (select val from t where cle='primaire');
  perform pg_temp.verifier(v_n = 0,
    'L''école primaire, hors de sa portée, lui reste invisible');

  execute 'reset role';
end $$;

do $$
declare v_erreur text;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    pg_temp.claims_de((select val from t where cle='carol')), true);

  begin
    insert into public.establishments (organization_id, name, code)
    values ((select val from t where cle='alpha'), 'Sans permission', 'NOPE');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlstate;
  end;

  perform pg_temp.verifier(v_erreur = '42501',
    'Sans establishments.create, l''enseignante ne crée pas d''établissement');
  execute 'reset role';
end $$;

-- -----------------------------------------------------------------------------
-- 3. Escalade de privilèges
-- -----------------------------------------------------------------------------
\echo ''
\echo '3. Escalade de privilèges'

-- Dan devient administrateur d'établissement : il a members.invite mais NI
-- members.update_role NI le droit de nommer un propriétaire.
set local role authenticated;
select set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);
select token from public.creer_invitation(
  'dan@alpha.test',
  (select id from public.roles where code = 'ESTABLISHMENT_ADMIN' and organization_id is null),
  array[(select val from t where cle='lycee')]
) \gset dan_
reset role;

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select val from t where cle='dan'))::text, true);
select public.accepter_invitation(:'dan_token');
reset role;

do $$
declare v_erreur text; v_adhesion uuid;
begin
  select id into v_adhesion from public.organization_memberships
   where profile_id = (select val from t where cle='dan');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    pg_temp.claims_de((select val from t where cle='dan')), true);

  -- Se promouvoir soi-même propriétaire.
  begin
    perform public.changer_role_membre(v_adhesion,
      (select id from public.roles where code = 'OWNER' and organization_id is null));
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm;
  end;
  perform pg_temp.verifier(v_erreur like 'ECOLEPLUS_%',
    'Dan ne peut pas se promouvoir lui-même (' || split_part(v_erreur, ':', 1) || ')');

  -- Modifier directement la table, en contournant la fonction.
  begin
    update public.organization_memberships
       set role_id = (select id from public.roles where code = 'OWNER' and organization_id is null)
     where id = v_adhesion;
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlstate;
  end;
  perform pg_temp.verifier(v_erreur = '42501',
    'Aucune policy UPDATE sur les adhésions : la table est inatteignable directement');

  execute 'reset role';
end $$;

do $$
declare v_erreur text; v_adhesion uuid;
begin
  -- Carol (enseignante) n'a même pas members.update_role.
  select id into v_adhesion from public.organization_memberships
   where profile_id = (select val from t where cle='dan');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    pg_temp.claims_de((select val from t where cle='carol')), true);

  begin
    perform public.changer_role_membre(v_adhesion,
      (select id from public.roles where code = 'DIRECTOR' and organization_id is null));
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm;
  end;
  perform pg_temp.verifier(v_erreur like 'ECOLEPLUS_PERMISSION%',
    'Sans members.update_role, changer le rôle d''un tiers est refusé');

  execute 'reset role';
end $$;

do $$
declare v_erreur text; v_adhesion uuid;
begin
  -- Alice a members.suspend et members.update_role : seule la garde
  -- anti-auto-modification peut encore l'arrêter sur sa propre adhésion.
  select id into v_adhesion from public.organization_memberships
   where profile_id = (select val from t where cle='alice');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    pg_temp.claims_de((select val from t where cle='alice')), true);

  begin
    perform public.changer_statut_membre(v_adhesion, 'SUSPENDED', 'Test');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm;
  end;
  perform pg_temp.verifier(v_erreur like 'ECOLEPLUS_AUTO_MODIFICATION%',
    'Même propriétaire, on ne modifie pas son propre accès');

  execute 'reset role';
end $$;

-- -----------------------------------------------------------------------------
-- 4. Détournement d'invitation
-- -----------------------------------------------------------------------------
\echo ''
\echo '4. Détournement d''invitation'

set local role authenticated;
select set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);
select token from public.creer_invitation(
  'inconnu@alpha.test',
  (select id from public.roles where code = 'STAFF' and organization_id is null),
  array[(select val from t where cle='lycee')]
) \gset vole_
reset role;

-- Rendu accessible aux blocs DO, qui ne voient pas les variables psql.
select set_config('test.token_vole', :'vole_token', true);

do $$
declare v_erreur text; v_n integer;
begin
  execute 'set local role authenticated';
  -- Bob, d'une autre organisation, a intercepté le lien.
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select val from t where cle='bob'))::text, true);

  begin
    perform public.accepter_invitation(current_setting('test.token_vole'));
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm;
  end;

  perform pg_temp.verifier(v_erreur like 'ECOLEPLUS_INVITATION_INVALIDE%',
    'Un lien intercepté ne vaut rien : l''adresse e-mail doit correspondre');

  execute 'reset role';

  select count(*) into v_n from public.organization_memberships
   where profile_id = (select val from t where cle='bob')
     and organization_id = (select val from t where cle='alpha');
  perform pg_temp.verifier(v_n = 0, 'Bob n''a pas rejoint ALPHA');
end $$;

do $$
declare v_n integer;
begin
  select count(*) into v_n from public.organization_invitations
   where token_hash = encode(extensions.digest(current_setting('test.token_vole'), 'sha256'), 'hex');
  perform pg_temp.verifier(v_n = 1, 'L''invitation est retrouvée par le hachage du jeton');

  select count(*) into v_n from public.organization_invitations
   where token_hash = current_setting('test.token_vole');
  perform pg_temp.verifier(v_n = 0, 'Le jeton en clair n''est jamais stocké en base');
end $$;

-- -----------------------------------------------------------------------------
-- 5. Immuabilité du journal d'audit
-- -----------------------------------------------------------------------------
\echo ''
\echo '5. Immuabilité du journal d''audit'

do $$
declare v_erreur text;
begin
  begin
    update public.audit_logs set action = 'falsifié' where id = (select min(id) from public.audit_logs);
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm;
  end;
  perform pg_temp.verifier(v_erreur like 'ECOLEPLUS_AUDIT_IMMUABLE%',
    'Même le superutilisateur ne peut pas réécrire une entrée d''audit');

  begin
    delete from public.audit_logs where id = (select min(id) from public.audit_logs);
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm;
  end;
  perform pg_temp.verifier(v_erreur like 'ECOLEPLUS_AUDIT_IMMUABLE%',
    'Une entrée d''audit ne se supprime pas');
end $$;

-- -----------------------------------------------------------------------------
-- 6. Garde du dernier propriétaire
-- -----------------------------------------------------------------------------
\echo ''
\echo '6. Garde du dernier propriétaire'

do $$
declare v_erreur text; v_adhesion uuid;
begin
  select id into v_adhesion from public.organization_memberships
   where profile_id = (select val from t where cle='alice');

  begin
    update public.organization_memberships set status = 'SUSPENDED' where id = v_adhesion;
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm;
  end;
  perform pg_temp.verifier(v_erreur like 'ECOLEPLUS_DERNIER_PROPRIETAIRE%',
    'Suspendre l''unique propriétaire est refusé');

  begin
    delete from public.organization_memberships where id = v_adhesion;
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm;
  end;
  perform pg_temp.verifier(v_erreur like 'ECOLEPLUS_DERNIER_PROPRIETAIRE%',
    'Retirer l''unique propriétaire est refusé');
end $$;

-- -----------------------------------------------------------------------------
-- 7. Suspension et révocation de session
-- -----------------------------------------------------------------------------
\echo ''
\echo '7. Suspension et révocation de session'

do $$
declare v_adhesion uuid; v_n integer; v_maj integer;
begin
  select id into v_adhesion from public.organization_memberships
   where profile_id = (select val from t where cle='dan');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    pg_temp.claims_de((select val from t where cle='alice')), true);
  perform public.changer_statut_membre(v_adhesion, 'SUSPENDED', 'Test');
  execute 'reset role';

  select count(*) into v_n from public.session_revocations
   where profile_id = (select val from t where cle='dan');
  perform pg_temp.verifier(v_n = 1, 'La suspension révoque immédiatement les sessions en cours');

  -- Jeton émis AVANT la révocation : les écritures doivent être coupées sans
  -- attendre son expiration.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    (pg_temp.claims_de((select val from t where cle='dan'))::jsonb
      || jsonb_build_object(
           'iat', extract(epoch from now() - interval '10 minutes')::bigint,
           'org_id', (select val from t where cle='alpha'),
           'role_scope', 'ESTABLISHMENT',
           'permissions', '["establishments.read","establishments.update"]'::jsonb,
           'establishment_ids',
             jsonb_build_array((select val::text from t where cle='lycee'))
         ))::text, true);

  update public.establishments set name = 'Renommé par un compte suspendu'
   where id = (select val from t where cle='lycee');
  get diagnostics v_maj = row_count;
  perform pg_temp.verifier(v_maj = 0,
    'Un jeton antérieur à la révocation n''écrit plus rien');
  execute 'reset role';

  perform pg_temp.verifier(
    (select name from public.establishments where id = (select val from t where cle='lycee'))
      = 'Lycée Central',
    'L''établissement est resté intact');
end $$;

-- -----------------------------------------------------------------------------
-- 8. Jeton sans contexte
-- -----------------------------------------------------------------------------
\echo ''
\echo '8. Jeton sans contexte'

do $$
declare v_n integer;
begin
  execute 'set local role authenticated';
  -- Un utilisateur authentifié mais membre d'aucune organisation : le hook ne
  -- pose aucun org_id. RLS doit tout refuser, jamais tout ouvrir.
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', (select val from t where cle='carol'),
                       'iat', extract(epoch from now())::bigint)::text, true);

  select count(*) into v_n from public.organizations;
  perform pg_temp.verifier(v_n = 0, 'Sans claim org_id, aucune organisation n''est lisible');

  select count(*) into v_n from public.establishments;
  perform pg_temp.verifier(v_n = 0, 'Sans claim org_id, aucun établissement n''est lisible');

  select count(*) into v_n from public.audit_logs;
  perform pg_temp.verifier(v_n = 0, 'Sans claim org_id, aucun journal n''est lisible');

  execute 'reset role';
end $$;

\echo ''
\echo 'Tous les tests de sécurité sont passés.'

rollback;
