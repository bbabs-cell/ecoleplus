-- =============================================================================
-- Tests de sécurité et de gel — bulletins (phase 3b)
-- =============================================================================
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/securite_bulletins.sql
--
-- Couverture : les trois permissions distinctes (prévisualiser / vérifier /
-- publier), le gel de l'instantané, la republication en nouvelle version sans
-- écrasement, l'immuabilité des versions remises, et le rang — désactivé par
-- défaut, activé par réglage d'établissement, ex aequo partagés.
--
-- Se termine par un ROLLBACK.
-- =============================================================================

\set ON_ERROR_STOP on
\o /dev/null
begin;

create or replace function pg_temp.verifier(p_condition boolean, p_libelle text)
returns void language plpgsql as $$
begin
  if p_condition then raise notice '  OK    %', p_libelle;
  else raise exception 'ECHEC: %', p_libelle; end if;
end; $$;

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
end; $$;

create temp table t (cle text primary key, val uuid);
grant select, insert on t to authenticated;

-- -----------------------------------------------------------------------------
-- Mise en place
-- -----------------------------------------------------------------------------
insert into auth.users (email, raw_user_meta_data) values
  ('alice@alpha.test', '{"given_name":"Alice","family_name":"Nkosi"}'),
  ('carol@alpha.test', '{"given_name":"Carol","family_name":"Diallo"}'),
  ('dan@alpha.test',   '{"given_name":"Dan","family_name":"Mensah"}');
insert into t select 'alice', id from auth.users where email='alice@alpha.test';
insert into t select 'carol', id from auth.users where email='carol@alpha.test';
insert into t select 'dan',   id from auth.users where email='dan@alpha.test';

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select val from t where cle='alice'))::text, true);
insert into t select 'org', public.creer_organisation('Groupe Alpha', 'SN', 'Africa/Dakar', 'XOF', 'fr');
reset role;

insert into public.establishments (organization_id, name, code)
values ((select val from t where cle='org'), 'Lycee Central', 'LYC');
insert into t select 'lyc', id from public.establishments where code='LYC';

insert into public.organization_memberships (profile_id, organization_id, role_id)
select u.id, (select val from t where cle='org'), r.id
  from auth.users u
  cross join lateral (select id from public.roles
     where organization_id is null
       and code = case when u.email='carol@alpha.test' then 'TEACHER' else 'STAFF' end) r
 where u.email in ('carol@alpha.test', 'dan@alpha.test');

insert into public.establishment_users (membership_id, establishment_id)
select m.id, (select val from t where cle='lyc')
  from public.organization_memberships m
  join auth.users u on u.id = m.profile_id
 where u.email in ('carol@alpha.test', 'dan@alpha.test');

insert into public.academic_years (organization_id, establishment_id, name, starts_on, ends_on, is_current)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        '2026-2027', date '2026-10-01', date '2027-07-10', true);
insert into t select 'annee', id from public.academic_years;

insert into public.academic_terms (organization_id, academic_year_id, name, position, starts_on, ends_on)
values ((select val from t where cle='org'), (select val from t where cle='annee'),
        'Trimestre 1', 1, date '2026-10-01', date '2026-12-20');
insert into t select 'trim1', id from public.academic_terms where position=1;

insert into public.levels (organization_id, establishment_id, name, code, position)
values ((select val from t where cle='org'), (select val from t where cle='lyc'), 'Seconde', '2NDE', 1);
insert into t select 'niveau', id from public.levels;

insert into public.subjects (organization_id, establishment_id, name, code)
values ((select val from t where cle='org'), (select val from t where cle='lyc'), 'Mathematiques', 'MATH');
insert into t select 'math', id from public.subjects where code='MATH';

insert into public.teachers (organization_id, establishment_id, profile_id, given_name, family_name, staff_code)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        (select val from t where cle='carol'), 'Carol', 'Diallo', 'ENS001');
insert into t select 'ens_carol', id from public.teachers where staff_code='ENS001';

insert into public.classes (organization_id, establishment_id, academic_year_id, level_id, name, code, main_teacher_id)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        (select val from t where cle='annee'), (select val from t where cle='niveau'),
        'Seconde A', '2NDA', (select val from t where cle='ens_carol'));
insert into t select 'classeA', id from public.classes where code='2NDA';

insert into t select 'num20', id from public.grading_systems
  where organization_id = (select val from t where cle='org') and code='NUM20';
update public.classes set grading_system_id = (select val from t where cle='num20')
 where id = (select val from t where cle='classeA');

insert into public.class_subjects
  (organization_id, establishment_id, class_id, subject_id, coefficient)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        (select val from t where cle='classeA'), (select val from t where cle='math'), 1);

set local role authenticated;
select set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);
select public.inscrire_apprenant((select val from t where cle='lyc'), (select val from t where cle='annee'),
  'Awa','Sow',(select val from t where cle='niveau'),(select val from t where cle='classeA'),
  null,null,'A1',null,null,'ACTIVE'::public.enrollment_status);
select public.inscrire_apprenant((select val from t where cle='lyc'), (select val from t where cle='annee'),
  'Moussa','Ba',(select val from t where cle='niveau'),(select val from t where cle='classeA'),
  null,null,'A2',null,null,'ACTIVE'::public.enrollment_status);
select public.inscrire_apprenant((select val from t where cle='lyc'), (select val from t where cle='annee'),
  'Fatou','Diop',(select val from t where cle='niveau'),(select val from t where cle='classeA'),
  null,null,'A3',null,null,'ACTIVE'::public.enrollment_status);
reset role;

insert into t select 'insc1', e.id from public.enrollments e
  join public.learners l on l.id = e.learner_id where l.learner_code='A1';
insert into t select 'insc2', e.id from public.enrollments e
  join public.learners l on l.id = e.learner_id where l.learner_code='A2';
insert into t select 'insc3', e.id from public.enrollments e
  join public.learners l on l.id = e.learner_id where l.learner_code='A3';

insert into public.assessments
  (organization_id, establishment_id, academic_year_id, academic_term_id, class_id,
   subject_id, grading_system_id, title, date_on, coefficient)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        (select val from t where cle='annee'), (select val from t where cle='trim1'),
        (select val from t where cle='classeA'), (select val from t where cle='math'),
        (select val from t where cle='num20'), 'Devoir 1', date '2026-10-20', 1);
insert into t select 'eval1', id from public.assessments where title='Devoir 1';

-- Awa 16, Moussa 16 (ex aequo), Fatou 8.
insert into public.assessment_results
  (organization_id, assessment_id, enrollment_id, kind, raw_value, status)
values ((select val from t where cle='org'), (select val from t where cle='eval1'),
        (select val from t where cle='insc1'), 'SCORE', 16, 'VERIFIED'),
       ((select val from t where cle='org'), (select val from t where cle='eval1'),
        (select val from t where cle='insc2'), 'SCORE', 16, 'VERIFIED'),
       ((select val from t where cle='org'), (select val from t where cle='eval1'),
        (select val from t where cle='insc3'), 'SCORE', 8, 'VERIFIED');
update public.assessments set status = 'VERIFIED' where id = (select val from t where cle='eval1');

set local role authenticated;
select set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);
select public.publier_evaluation((select val from t where cle='eval1'));
reset role;

\o
\echo ''
\echo '1. Trois permissions distinctes'
\o /dev/null

do $$
declare v_erreur text; v_bulletin jsonb;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='carol')), true);

  -- L'enseignante previsualise le bulletin de sa classe.
  v_bulletin := public.previsualiser_bulletin((select val from t where cle='insc1'),
                                              (select val from t where cle='trim1'));
  perform pg_temp.verifier((v_bulletin -> 'moyenne_generale' ->> 'valeur')::numeric = 16,
    'L''enseignante previsualise : moyenne 16');

  -- Mais elle ne fige pas l'instantane.
  begin
    perform public.verifier_bulletin((select val from t where cle='insc1'),
                                     (select val from t where cle='trim1'));
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%reports.verify%',
    'Elle ne verifie pas le bulletin : la permission est distincte');

  execute 'reset role';

  -- Dan, personnel administratif : il verifie mais ne publie pas.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='dan')), true);

  insert into t select 'bull1', public.verifier_bulletin(
    (select val from t where cle='insc1'), (select val from t where cle='trim1'));
  perform pg_temp.verifier(true, 'Le personnel administratif verifie le bulletin');

  begin
    perform public.publier_bulletin((select val from t where cle='bull1'), null);
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%reports.publish%',
    'Mais il ne le publie pas : publier est l''acte de l''etablissement');

  execute 'reset role';
end $$;

\o
\echo ''
\echo '2. Publier fige un instantane'
\o /dev/null

do $$
declare v_version integer; v_n integer; v_valeur text;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  v_version := public.publier_bulletin((select val from t where cle='bull1'), null);
  perform pg_temp.verifier(v_version = 1, 'La premiere publication porte la version 1');

  select snapshot -> 'moyenne_generale' ->> 'valeur' into v_valeur
    from public.report_card_publications
   where report_card_id = (select val from t where cle='bull1') and version = 1;
  perform pg_temp.verifier(v_valeur::numeric = 16, 'La version remise porte la moyenne du moment');

  execute 'reset role';
end $$;

-- La note change apres la remise du bulletin.
do $$
declare v_note uuid; v_valeur text;
begin
  select id into v_note from public.assessment_results
   where enrollment_id = (select val from t where cle='insc1');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  perform public.corriger_note(v_note, 'SCORE'::public.grade_kind, 10, null,
    'Erreur de report constatee apres remise du bulletin');

  -- L'instantane deja remis ne bouge pas.
  select snapshot -> 'moyenne_generale' ->> 'valeur' into v_valeur
    from public.report_card_publications
   where report_card_id = (select val from t where cle='bull1') and version = 1;
  perform pg_temp.verifier(v_valeur::numeric = 16,
    'Le bulletin deja remis ne bouge pas quand une note change apres coup');

  -- Le recalcul, lui, voit bien la correction.
  perform pg_temp.verifier(
    (public.previsualiser_bulletin((select val from t where cle='insc1'),
                                   (select val from t where cle='trim1'))
     -> 'moyenne_generale' ->> 'valeur')::numeric = 10,
    'Mais un nouvel apercu tient compte de la correction');

  execute 'reset role';
end $$;

\o
\echo ''
\echo '3. Republier cree une version, sans ecraser la precedente'
\o /dev/null

do $$
declare v_erreur text; v_version integer; v_n integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  perform public.verifier_bulletin((select val from t where cle='insc1'),
                                   (select val from t where cle='trim1'));

  -- Republier sans motif : refuse. La famille a deja recu la version 1.
  begin
    perform public.publier_bulletin((select val from t where cle='bull1'), null);
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_MOTIF_REQUIS%',
    'Republier un bulletin deja remis exige un motif');

  v_version := public.publier_bulletin((select val from t where cle='bull1'),
    'Correction de la note de mathematiques');
  perform pg_temp.verifier(v_version = 2, 'La republication porte la version 2');

  select count(*) into v_n from public.report_card_publications
   where report_card_id = (select val from t where cle='bull1');
  perform pg_temp.verifier(v_n = 2, 'Les deux versions coexistent');

  perform pg_temp.verifier(
    (select snapshot -> 'moyenne_generale' ->> 'valeur'
       from public.report_card_publications
      where report_card_id = (select val from t where cle='bull1') and version = 1)::numeric = 16
    and
    (select snapshot -> 'moyenne_generale' ->> 'valeur'
       from public.report_card_publications
      where report_card_id = (select val from t where cle='bull1') and version = 2)::numeric = 10,
    'La version 1 garde ce qui a ete remis, la version 2 porte la correction');

  execute 'reset role';
end $$;

do $$
declare v_erreur text;
begin
  begin
    update public.report_card_publications set snapshot = '{}'::jsonb
     where report_card_id = (select val from t where cle='bull1');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_HISTORIQUE_IMMUABLE%',
    'Une version remise ne se reecrit pas, meme en superutilisateur');

  begin
    delete from public.report_card_publications
     where report_card_id = (select val from t where cle='bull1');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_HISTORIQUE_IMMUABLE%',
    'Elle ne se supprime pas davantage');
end $$;

\o
\echo ''
\echo '4. Le rang est optionnel'
\o /dev/null

do $$
declare v_rang integer; v_snapshot jsonb;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  select rank into v_rang from public.report_cards
   where id = (select val from t where cle='bull1');
  perform pg_temp.verifier(v_rang is null,
    'Par defaut aucun rang : de nombreux systemes educatifs le proscrivent');

  select snapshot into v_snapshot from public.report_cards
   where id = (select val from t where cle='bull1');
  perform pg_temp.verifier(not (v_snapshot ? 'rang'),
    'L''instantane ne porte meme pas la cle');

  execute 'reset role';
end $$;

-- L'etablissement active le rang.
insert into public.establishment_settings (organization_id, establishment_id, key, value)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        'report_card.rank_enabled', 'true'::jsonb);

-- Awa est redescendue a 10 ; Moussa reste a 16, Fatou a 8.
do $$
declare v_rang integer; v_sur integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  perform public.verifier_bulletin((select val from t where cle='insc2'),
                                   (select val from t where cle='trim1'));
  select rc.rank, rc.rank_of into v_rang, v_sur from public.report_cards rc
   where rc.enrollment_id = (select val from t where cle='insc2');
  perform pg_temp.verifier(v_rang = 1 and v_sur = 3,
    'Rang active : Moussa, 16 de moyenne, est premier sur trois');

  perform public.verifier_bulletin((select val from t where cle='insc3'),
                                   (select val from t where cle='trim1'));
  select rc.rank into v_rang from public.report_cards rc
   where rc.enrollment_id = (select val from t where cle='insc3');
  perform pg_temp.verifier(v_rang = 3, 'Fatou, 8 de moyenne, est troisieme');

  execute 'reset role';
end $$;

-- Ex aequo : Fatou remonte a 10, comme Awa.
do $$
declare v_awa integer; v_fatou integer; v_note uuid;
begin
  select r.id into v_note from public.assessment_results r
   where r.enrollment_id = (select val from t where cle='insc3');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  perform public.corriger_note(v_note, 'SCORE'::public.grade_kind, 10, null, 'Copie reevaluee');

  perform public.verifier_bulletin((select val from t where cle='insc1'),
                                   (select val from t where cle='trim1'));
  perform public.verifier_bulletin((select val from t where cle='insc3'),
                                   (select val from t where cle='trim1'));

  select rc.rank into v_awa from public.report_cards rc
   where rc.enrollment_id = (select val from t where cle='insc1');
  select rc.rank into v_fatou from public.report_cards rc
   where rc.enrollment_id = (select val from t where cle='insc3');

  perform pg_temp.verifier(v_awa = 2 and v_fatou = 2,
    'Deux moyennes egales partagent le meme rang : departager serait une invention');

  execute 'reset role';
end $$;

-- Et il se desactive.
update public.establishment_settings set value = 'false'::jsonb
 where establishment_id = (select val from t where cle='lyc')
   and key = 'report_card.rank_enabled';

do $$
declare v_rang integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  perform public.verifier_bulletin((select val from t where cle='insc2'),
                                   (select val from t where cle='trim1'));
  select rc.rank into v_rang from public.report_cards rc
   where rc.enrollment_id = (select val from t where cle='insc2');
  perform pg_temp.verifier(v_rang is null, 'Desactive, le rang disparait du bulletin');

  execute 'reset role';
end $$;

\o
\echo ''
\echo '5. Garde-fous'
\o /dev/null

-- Aucun role applicatif ne peut inserer un bulletin directement : la table
-- n'accorde que SELECT. Le brouillon de ce test est donc pose hors RLS.
do $$
declare v_n integer;
begin
  select count(*) into v_n from information_schema.role_table_grants
   where table_name = 'report_cards' and grantee = 'authenticated'
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE');
  perform pg_temp.verifier(v_n = 0,
    'Un bulletin ne s''ecrit que par fonction : aucun droit direct');
end $$;

insert into public.report_cards
  (organization_id, establishment_id, enrollment_id, academic_year_id, class_id,
   status, snapshot)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        (select val from t where cle='insc3'), (select val from t where cle='annee'),
        (select val from t where cle='classeA'), 'DRAFT', '{}'::jsonb);

do $$
declare v_erreur text; v_id uuid;
begin
  select id into v_id from public.report_cards
   where enrollment_id = (select val from t where cle='insc3') and status = 'DRAFT';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  begin
    perform public.publier_bulletin(v_id, null);
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_NON_VERIFIE%',
    'Un bulletin en brouillon ne se publie pas');

  -- Les reglages descendent bien a l'etablissement.
  perform pg_temp.verifier(
    ecoleplus.reglage_etablissement((select val from t where cle='lyc'),
      'reglage.inexistant', '"defaut"'::jsonb) = '"defaut"'::jsonb,
    'Un reglage absent retombe sur le defaut fourni');

  execute 'reset role';
end $$;

\o
rollback;
\echo ''
\echo 'Suite terminee.'
