-- =============================================================================
-- Tests de sécurité — domaine académique (phase 2)
-- =============================================================================
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/securite_academique.sql
--
-- Couverture : isolation inter-organisations sur les données académiques,
-- portée établissement des apprenants (qui n'ont pas d'establishment_id),
-- cloisonnement par clés composites, permissions, capacité des classes,
-- unicité de l'inscription vivante, et transfert entre établissements.
--
-- Se termine par un ROLLBACK : ne laisse aucune trace.
-- =============================================================================

\set ON_ERROR_STOP on
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

create or replace function pg_temp.claims_de(p_user uuid)
returns text language plpgsql security definer as $$
declare v_claims jsonb;
begin
  select ecoleplus.custom_access_token_hook(jsonb_build_object(
           'user_id', p_user,
           'claims', jsonb_build_object('sub', p_user::text,
                                        'iat', extract(epoch from now())::bigint)
         )) -> 'claims' into v_claims;
  return v_claims::text;
end;
$$;

create temp table t (cle text primary key, val uuid);
grant select, insert on t to authenticated;

-- -----------------------------------------------------------------------------
-- Mise en place
-- -----------------------------------------------------------------------------
insert into auth.users (email, raw_user_meta_data) values
  ('alice@alpha.test', '{"given_name":"Alice","family_name":"Nkosi"}'),
  ('bob@beta.test',    '{"given_name":"Bob","family_name":"Traore"}'),
  ('carol@alpha.test', '{"given_name":"Carol","family_name":"Diallo"}'),
  ('dan@alpha.test',   '{"given_name":"Dan","family_name":"Mensah"}');

insert into t select 'alice', id from auth.users where email='alice@alpha.test';
insert into t select 'bob',   id from auth.users where email='bob@beta.test';
insert into t select 'carol', id from auth.users where email='carol@alpha.test';
insert into t select 'dan',   id from auth.users where email='dan@alpha.test';

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select val from t where cle='alice'))::text, true);
insert into t select 'alpha', public.creer_organisation('Groupe Alpha', 'SN', 'Africa/Dakar', 'XOF', 'fr');

select set_config('request.jwt.claims',
  json_build_object('sub', (select val from t where cle='bob'))::text, true);
insert into t select 'beta', public.creer_organisation('Beta School', 'FR', 'Europe/Paris', 'EUR', 'fr');
reset role;

-- Deux établissements chez ALPHA, un chez BETA.
insert into public.establishments (organization_id, name, code) values
  ((select val from t where cle='alpha'), 'Lycee Central', 'LYC'),
  ((select val from t where cle='alpha'), 'Ecole Primaire', 'PRIM'),
  ((select val from t where cle='beta'),  'Beta Campus',   'BETA');
insert into t select 'lyc',  id from public.establishments where code='LYC';
insert into t select 'prim', id from public.establishments where code='PRIM';
insert into t select 'betae',id from public.establishments where code='BETA';

-- Carol enseignante sur LYC, Dan personnel administratif sur LYC.
insert into public.organization_memberships (profile_id, organization_id, role_id)
select (select val from t where cle='carol'), (select val from t where cle='alpha'),
       id from public.roles where code='TEACHER' and organization_id is null;
insert into public.organization_memberships (profile_id, organization_id, role_id)
select (select val from t where cle='dan'), (select val from t where cle='alpha'),
       id from public.roles where code='STAFF' and organization_id is null;

insert into public.establishment_users (membership_id, establishment_id)
select m.id, (select val from t where cle='lyc')
  from public.organization_memberships m
 where m.profile_id in ((select val from t where cle='carol'), (select val from t where cle='dan'));

-- Référentiel académique, créé par Alice.
set local role authenticated;
select set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

insert into public.academic_years (organization_id, establishment_id, name, starts_on, ends_on)
values ((select val from t where cle='alpha'), (select val from t where cle='lyc'),
        '2026-2027', '2026-09-01', '2027-07-05')
returning id \gset an_lyc_
insert into t values ('an_lyc', :'an_lyc_id');

insert into public.academic_years (organization_id, establishment_id, name, starts_on, ends_on)
values ((select val from t where cle='alpha'), (select val from t where cle='prim'),
        '2026-2027', '2026-09-01', '2027-07-05')
returning id \gset an_prim_
insert into t values ('an_prim', :'an_prim_id');

insert into public.levels (organization_id, establishment_id, name, code, position)
values ((select val from t where cle='alpha'), (select val from t where cle='lyc'), 'Seconde', 'SEC', 1)
returning id \gset niv_lyc_
insert into t values ('niv_lyc', :'niv_lyc_id');

insert into public.levels (organization_id, establishment_id, name, code, position)
values ((select val from t where cle='alpha'), (select val from t where cle='prim'), 'CP', 'CP', 1)
returning id \gset niv_prim_
insert into t values ('niv_prim', :'niv_prim_id');

insert into public.classes (organization_id, establishment_id, academic_year_id, level_id, name, code, capacity)
values ((select val from t where cle='alpha'), (select val from t where cle='lyc'),
        (select val from t where cle='an_lyc'), (select val from t where cle='niv_lyc'),
        'Seconde A', '2NDA', 1)
returning id \gset cls_lyc_
insert into t values ('cls_lyc', :'cls_lyc_id');
reset role;

\o
\echo ''
\echo '1. Isolation inter-organisations'
\o /dev/null

do $$
declare v_n integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='bob')), true);

  select count(*) into v_n from public.academic_years;
  perform pg_temp.verifier(v_n = 0, 'BETA ne voit aucune annee academique d''ALPHA');

  select count(*) into v_n from public.levels;
  perform pg_temp.verifier(v_n = 0, 'BETA ne voit aucun niveau d''ALPHA');

  select count(*) into v_n from public.classes;
  perform pg_temp.verifier(v_n = 0, 'BETA ne voit aucune classe d''ALPHA');

  execute 'reset role';
end $$;

do $$
declare v_erreur text;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='bob')), true);

  begin
    insert into public.academic_years (organization_id, establishment_id, name, starts_on, ends_on)
    values ((select val from t where cle='alpha'), (select val from t where cle='lyc'),
            'Pirate', '2026-09-01', '2027-07-05');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlstate;
  end;
  perform pg_temp.verifier(v_erreur = '42501',
    'BETA ne peut pas creer une annee chez ALPHA');
  execute 'reset role';
end $$;

\o
\echo ''
\echo '2. Cloisonnement par cles etrangeres composites'
\o /dev/null

do $$
declare v_erreur text;
begin
  -- En superutilisateur : RLS est hors jeu, seule la contrainte agit.
  begin
    insert into public.classes (organization_id, establishment_id, academic_year_id, level_id, name, code)
    values ((select val from t where cle='alpha'), (select val from t where cle='lyc'),
            (select val from t where cle='an_lyc'),
            (select val from t where cle='niv_prim'),  -- niveau de l'AUTRE etablissement
            'Incoherente', 'BAD');
    v_erreur := 'aucune';
  exception when foreign_key_violation then v_erreur := 'fk';
           when others then v_erreur := sqlstate;
  end;
  perform pg_temp.verifier(v_erreur = 'fk',
    'Une classe ne peut pas pointer vers le niveau d''un autre etablissement');

  begin
    insert into public.academic_terms (organization_id, academic_year_id, name, position, starts_on, ends_on)
    values ((select val from t where cle='beta'),      -- organisation qui n'est pas celle de l'annee
            (select val from t where cle='an_lyc'), 'T1', 1, '2026-09-01', '2026-12-20');
    v_erreur := 'aucune';
  exception when foreign_key_violation then v_erreur := 'fk';
           when others then v_erreur := sqlstate;
  end;
  perform pg_temp.verifier(v_erreur = 'fk',
    'Une periode ne peut pas etre rattachee a l''annee d''un autre tenant');
end $$;

do $$
declare v_erreur text;
begin
  begin
    insert into public.academic_terms (organization_id, academic_year_id, name, position, starts_on, ends_on)
    values ((select val from t where cle='alpha'), (select val from t where cle='an_lyc'),
            'Hors annee', 1, '2026-08-01', '2026-12-20');  -- commence avant l'annee
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm;
  end;
  perform pg_temp.verifier(v_erreur like 'ECOLEPLUS_PERIODE_HORS_ANNEE%',
    'Une periode doit tenir dans les bornes de son annee');
end $$;

\o
\echo ''
\echo '3. Portee etablissement des apprenants'
\o /dev/null

-- Alice inscrit un eleve au lycee et un autre au primaire.
set local role authenticated;
select set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);
select public.inscrire_apprenant(
  (select val from t where cle='lyc'), (select val from t where cle='an_lyc'),
  'Awa', 'Sow', (select val from t where cle='niv_lyc'), (select val from t where cle='cls_lyc'),
  null, null, 'LYC001', null, null, 'ACTIVE'::public.enrollment_status) \gset app_lyc_
insert into t values ('app_lyc', :'app_lyc_inscrire_apprenant');

select public.inscrire_apprenant(
  (select val from t where cle='prim'), (select val from t where cle='an_prim'),
  'Moussa', 'Ba', (select val from t where cle='niv_prim'), null,
  null, null, 'PRIM001', null, null, 'ACTIVE'::public.enrollment_status) \gset app_prim_
insert into t values ('app_prim', :'app_prim_inscrire_apprenant');
reset role;

do $$
declare v_n integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);
  select count(*) into v_n from public.learners;
  perform pg_temp.verifier(v_n = 2, 'Le proprietaire voit les deux apprenants de l''organisation');
  execute 'reset role';
end $$;

do $$
declare v_n integer;
begin
  execute 'set local role authenticated';
  -- Carol : enseignante rattachee au LYCEE uniquement.
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='carol')), true);

  select count(*) into v_n from public.learners;
  perform pg_temp.verifier(v_n = 1,
    'L''enseignante du lycee ne voit qu''un apprenant, pas celui du primaire');

  select count(*) into v_n from public.learners
   where id = (select val from t where cle='app_prim');
  perform pg_temp.verifier(v_n = 0,
    'L''apprenant du primaire lui est invisible, bien qu''il soit dans son organisation');

  select count(*) into v_n from public.enrollments;
  perform pg_temp.verifier(v_n = 1, 'Elle ne voit que l''inscription de son etablissement');

  select count(*) into v_n from public.classes;
  perform pg_temp.verifier(v_n = 1, 'Elle ne voit que la classe de son etablissement');

  select count(*) into v_n from public.academic_years;
  perform pg_temp.verifier(v_n = 1, 'Elle ne voit que l''annee de son etablissement');

  execute 'reset role';
end $$;

\o
\echo ''
\echo '4. Permissions'
\o /dev/null

do $$
declare v_erreur text;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='carol')), true);

  begin
    insert into public.classes (organization_id, establishment_id, academic_year_id, level_id, name, code)
    values ((select val from t where cle='alpha'), (select val from t where cle='lyc'),
            (select val from t where cle='an_lyc'), (select val from t where cle='niv_lyc'), 'Pirate', 'PIR');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlstate;
  end;
  perform pg_temp.verifier(v_erreur = '42501',
    'Sans classes.manage, l''enseignante ne cree pas de classe');

  begin
    perform public.inscrire_apprenant(
      (select val from t where cle='lyc'), (select val from t where cle='an_lyc'),
      'Test', 'Interdit');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm;
  end;
  perform pg_temp.verifier(v_erreur like 'ECOLEPLUS_PERMISSION%',
    'Sans learners.manage, l''enseignante n''inscrit personne');

  execute 'reset role';
end $$;

do $$
declare v_erreur text; v_n integer;
begin
  execute 'set local role authenticated';
  -- Dan : personnel administratif du lycee. Il PEUT inscrire, chez lui.
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='dan')), true);

  perform public.inscrire_apprenant(
    (select val from t where cle='lyc'), (select val from t where cle='an_lyc'),
    'Fatou', 'Diop', (select val from t where cle='niv_lyc'));
  perform pg_temp.verifier(true, 'Le personnel administratif inscrit dans son etablissement');

  -- Mais pas dans l'etablissement voisin.
  begin
    perform public.inscrire_apprenant(
      (select val from t where cle='prim'), (select val from t where cle='an_prim'),
      'Hors', 'Portee');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm;
  end;
  perform pg_temp.verifier(v_erreur like 'ECOLEPLUS_PERMISSION%',
    'Il ne peut pas inscrire dans un etablissement hors de sa portee');

  select count(*) into v_n from public.learners;
  perform pg_temp.verifier(v_n = 2, 'Il voit les deux apprenants du lycee, pas celui du primaire');

  execute 'reset role';
end $$;

\o
\echo ''
\echo '5. Regles metier'
\o /dev/null

do $$
declare v_erreur text;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  -- La classe 2NDA a une capacite de 1, deja occupee par Awa.
  begin
    perform public.inscrire_apprenant(
      (select val from t where cle='lyc'), (select val from t where cle='an_lyc'),
      'Trop', 'Nombreux', (select val from t where cle='niv_lyc'),
      (select val from t where cle='cls_lyc'));
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm;
  end;
  perform pg_temp.verifier(v_erreur like 'ECOLEPLUS_CLASSE_PLEINE%',
    'Une classe pleine refuse une inscription supplementaire');

  -- Deja inscrit pour cette annee.
  begin
    perform public.reinscrire_apprenant(
      (select val from t where cle='app_lyc'), (select val from t where cle='lyc'),
      (select val from t where cle='an_lyc'));
    v_erreur := 'aucune';
  exception when unique_violation then v_erreur := 'doublon';
           when others then v_erreur := sqlstate;
  end;
  perform pg_temp.verifier(v_erreur = 'doublon',
    'Un apprenant n''a qu''une inscription vivante par annee');

  execute 'reset role';
end $$;

\o
\echo ''
\echo '6. Transfert entre etablissements'
\o /dev/null

do $$
declare v_inscription uuid; v_n integer; v_fin date;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  select id into v_inscription from public.enrollments
   where learner_id = (select val from t where cle='app_lyc');

  perform public.changer_statut_inscription(v_inscription, 'TRANSFERRED', 'Demenagement');

  select ended_on into v_fin from public.enrollments where id = v_inscription;
  perform pg_temp.verifier(v_fin is not null,
    'Un statut terminal pose automatiquement la date de fin');

  -- Le statut terminal libere la contrainte d'inscription vivante.
  perform public.reinscrire_apprenant(
    (select val from t where cle='app_lyc'), (select val from t where cle='prim'),
    (select val from t where cle='an_prim'), (select val from t where cle='niv_prim'));

  select count(*) into v_n from public.enrollments
   where learner_id = (select val from t where cle='app_lyc');
  perform pg_temp.verifier(v_n = 2,
    'Le transfert cree une seconde inscription sans effacer la premiere');

  select count(*) into v_n from public.learners
   where id = (select val from t where cle='app_lyc');
  perform pg_temp.verifier(v_n = 1,
    'Le dossier de l''apprenant, lui, reste unique');

  execute 'reset role';
end $$;

do $$
declare v_n integer;
begin
  execute 'set local role authenticated';
  -- Carol ne devrait plus voir Awa : son inscription au lycee est close et la
  -- nouvelle est au primaire.
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='carol')), true);

  select count(*) into v_n from public.learners
   where id = (select val from t where cle='app_lyc');
  perform pg_temp.verifier(v_n = 1,
    'L''enseignante garde acces au dossier d''un ancien eleve de son etablissement');

  execute 'reset role';
end $$;

\o
\echo ''
\echo '7. Annee courante et audit'
\o /dev/null

do $$
declare v_n integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  perform public.definir_annee_courante((select val from t where cle='an_lyc'));

  select count(*) into v_n from public.academic_years
   where establishment_id = (select val from t where cle='lyc') and is_current;
  perform pg_temp.verifier(v_n = 1, 'Un seul exercice courant par etablissement');

  select count(*) into v_n from public.audit_logs where action = 'learner.enrolled';
  perform pg_temp.verifier(v_n = 3, 'Chaque inscription est journalisee');

  select count(*) into v_n from public.audit_logs where action = 'enrollment.status_changed';
  perform pg_temp.verifier(v_n = 1, 'Le changement de statut est journalise');

  execute 'reset role';
end $$;

\o
\echo ''
\echo 'Tous les tests academiques sont passes.'

rollback;
