-- =============================================================================
-- Tests de sécurité — présences (phase 3a)
-- =============================================================================
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/securite_presences.sql
--
-- Couverture : portée « mes classes » de l'enseignant, verrouillage après
-- validation, séparation des permissions appel/validation/correction,
-- immuabilité de l'historique, cohérence inscription-séance, sémantique des
-- drapeaux is_present / counts_absent.
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

-- Carol enseignante, Dan personnel administratif ; tous deux sur le lycée.
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

insert into public.levels (organization_id, establishment_id, name, code, position)
values ((select val from t where cle='org'), (select val from t where cle='lyc'), 'Seconde', '2NDE', 1);
insert into t select 'niveau', id from public.levels;

-- La fiche enseignante de Carol, rattachée à son compte.
insert into public.teachers (organization_id, establishment_id, profile_id, given_name, family_name, staff_code)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        (select val from t where cle='carol'), 'Carol', 'Diallo', 'ENS001');
insert into t select 'ens_carol', id from public.teachers where staff_code='ENS001';

-- Une enseignante SANS compte, titulaire de la classe B.
insert into public.teachers (organization_id, establishment_id, given_name, family_name, staff_code)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        'Fatou', 'Sarr', 'ENS002');
insert into t select 'ens_fatou', id from public.teachers where staff_code='ENS002';

-- Classe A : Carol est professeur principal. Classe B : elle n'y est pas.
insert into public.classes (organization_id, establishment_id, academic_year_id, level_id, name, code, main_teacher_id)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        (select val from t where cle='annee'), (select val from t where cle='niveau'),
        'Seconde A', '2NDA', (select val from t where cle='ens_carol'));
insert into t select 'classeA', id from public.classes where code='2NDA';

insert into public.classes (organization_id, establishment_id, academic_year_id, level_id, name, code, main_teacher_id)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        (select val from t where cle='annee'), (select val from t where cle='niveau'),
        'Seconde B', '2NDB', (select val from t where cle='ens_fatou'));
insert into t select 'classeB', id from public.classes where code='2NDB';

-- Trois apprenants en A, un en B.
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
select public.inscrire_apprenant((select val from t where cle='lyc'), (select val from t where cle='annee'),
  'Pape','Niang',(select val from t where cle='niveau'),(select val from t where cle='classeB'),
  null,null,'B1',null,null,'ACTIVE'::public.enrollment_status);
reset role;

insert into t select 'insc_b', e.id from public.enrollments e
  where e.class_id = (select val from t where cle='classeB');

\o
\echo ''
\echo '1. Statuts de presence : des donnees, pas une enumeration'
\o /dev/null

do $$
declare v_n integer;
begin
  select count(*) into v_n from public.attendance_statuses
   where organization_id = (select val from t where cle='org');
  perform pg_temp.verifier(v_n = 4, 'Quatre statuts de depart poses a la creation de l''organisation');

  select count(*) into v_n from public.attendance_statuses
   where organization_id = (select val from t where cle='org')
     and code = 'RETARD' and is_present and not counts_absent;
  perform pg_temp.verifier(v_n = 1, 'Un retard est une presence qui ne compte pas comme absence');

  select count(*) into v_n from public.attendance_statuses
   where organization_id = (select val from t where cle='org')
     and code = 'EXCUSE' and not is_present and not counts_absent and requires_justification;
  perform pg_temp.verifier(v_n = 1,
    'Une absence justifiee n''est pas une presence et ne compte pas — les deux drapeaux sont independants');
end $$;

-- Statut sur mesure, propre a l'etablissement.
insert into public.attendance_statuses
  (organization_id, establishment_id, name, code, is_present, counts_absent, position)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        'Exclusion temporaire', 'EXCLU', false, true, 5);

do $$
declare v_n integer;
begin
  select count(*) into v_n from public.attendance_statuses
   where establishment_id = (select val from t where cle='lyc') and code = 'EXCLU';
  perform pg_temp.verifier(v_n = 1, 'Un etablissement ajoute son propre statut');
end $$;

\o
\echo ''
\echo '2. Portee « mes classes » de l''enseignant'
\o /dev/null

-- Carol cree une seance sur SA classe.
set local role authenticated;
select set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='carol')), true);
insert into public.attendance_sessions
  (organization_id, establishment_id, academic_year_id, class_id, date_on, kind_label)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        (select val from t where cle='annee'), (select val from t where cle='classeA'),
        date '2026-10-05', 'journee')
returning id \gset s_
insert into t values ('seanceA', :'s_id');
reset role;

do $$
declare v_erreur text; v_n integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='carol')), true);

  perform pg_temp.verifier(true, 'L''enseignante cree une seance sur la classe dont elle est titulaire');

  -- Classe B : elle n'y enseigne pas.
  begin
    insert into public.attendance_sessions
      (organization_id, establishment_id, academic_year_id, class_id, date_on)
    values ((select val from t where cle='org'), (select val from t where cle='lyc'),
            (select val from t where cle='annee'), (select val from t where cle='classeB'),
            date '2026-10-05');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlstate;
  end;
  perform pg_temp.verifier(v_erreur = '42501',
    'Elle ne peut pas creer de seance sur une classe ou elle n''enseigne pas');

  execute 'reset role';
end $$;

-- Une seance sur la classe B, creee par Alice.
set local role authenticated;
select set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);
insert into public.attendance_sessions
  (organization_id, establishment_id, academic_year_id, class_id, date_on)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        (select val from t where cle='annee'), (select val from t where cle='classeB'),
        date '2026-10-05')
returning id \gset sb_
insert into t values ('seanceB', :'sb_id');
reset role;

do $$
declare v_n integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='carol')), true);
  select count(*) into v_n from public.attendance_sessions;
  perform pg_temp.verifier(v_n = 1, 'Elle ne voit que la seance de sa classe, pas celle de la classe B');
  execute 'reset role';

  perform set_config('request.jwt.claims', '', true);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);
  select count(*) into v_n from public.attendance_sessions;
  perform pg_temp.verifier(v_n = 2, 'La proprietaire voit les deux seances : l''affectation ne la restreint pas');
  execute 'reset role';
end $$;

\o
\echo ''
\echo '3. Appel'
\o /dev/null

do $$
declare v_lignes jsonb; v_present uuid; v_absent uuid; v_n integer; v_erreur text;
begin
  select id into v_present from public.attendance_statuses
   where organization_id = (select val from t where cle='org') and code='PRESENT';
  select id into v_absent from public.attendance_statuses
   where organization_id = (select val from t where cle='org') and code='ABSENT';

  -- Le premier apprenant est declare absent, les autres presents.
  select jsonb_agg(jsonb_build_object(
           'enrollment_id', x.id,
           'status_id', case when x.rang = 1 then v_absent else v_present end))
    into v_lignes
    from (select e.id, row_number() over (order by e.id) as rang
            from public.enrollments e
           where e.class_id = (select val from t where cle='classeA')) x;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='carol')), true);

  perform public.enregistrer_appel((select val from t where cle='seanceA'), v_lignes);
  execute 'reset role';

  select count(*) into v_n from public.attendance_records
   where session_id = (select val from t where cle='seanceA');
  perform pg_temp.verifier(v_n = 3, 'La feuille entiere part en un seul appel');

  -- Rejouer l'appel corrige sans dupliquer.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='carol')), true);
  perform public.enregistrer_appel((select val from t where cle='seanceA'), v_lignes);
  execute 'reset role';

  select count(*) into v_n from public.attendance_records
   where session_id = (select val from t where cle='seanceA');
  perform pg_temp.verifier(v_n = 3, 'Rejouer l''appel corrige la saisie sans creer de doublon');
end $$;

do $$
declare v_erreur text; v_present uuid;
begin
  select id into v_present from public.attendance_statuses
   where organization_id = (select val from t where cle='org') and code='PRESENT';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='carol')), true);

  -- Un apprenant de la classe B dans la feuille de la classe A.
  begin
    perform public.enregistrer_appel(
      (select val from t where cle='seanceA'),
      jsonb_build_array(jsonb_build_object(
        'enrollment_id', (select val from t where cle='insc_b'),
        'status_id', v_present)));
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm;
  end;
  perform pg_temp.verifier(v_erreur like 'ECOLEPLUS_HORS_CLASSE%',
    'Un apprenant d''une autre classe ne peut pas etre appele sur cette feuille');

  -- La seance de la classe B ne lui est pas accessible.
  begin
    perform public.enregistrer_appel((select val from t where cle='seanceB'), '[]'::jsonb);
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm;
  end;
  perform pg_temp.verifier(v_erreur like 'ECOLEPLUS_SEANCE_INTROUVABLE%' or v_erreur like 'ECOLEPLUS_HORS_MES_CLASSES%',
    'La seance d''une classe ou elle n''enseigne pas lui reste fermee');

  execute 'reset role';
end $$;

\o
\echo ''
\echo '4. Validation et verrouillage'
\o /dev/null

do $$
declare v_erreur text; v_present uuid;
begin
  select id into v_present from public.attendance_statuses
   where organization_id = (select val from t where cle='org') and code='PRESENT';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  -- La seance B n'a aucune ligne : la valider figerait une ambiguite.
  begin
    perform public.valider_seance((select val from t where cle='seanceB'));
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm;
  end;
  perform pg_temp.verifier(v_erreur like 'ECOLEPLUS_APPEL_INCOMPLET%',
    'Une feuille incomplete ne se valide pas : un apprenant sans statut n''est ni present ni absent');

  execute 'reset role';
end $$;

do $$
declare v_erreur text; v_present uuid;
begin
  select id into v_present from public.attendance_statuses
   where organization_id = (select val from t where cle='org') and code='PRESENT';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='carol')), true);

  perform public.valider_seance((select val from t where cle='seanceA'));
  perform pg_temp.verifier(
    (select status from public.attendance_sessions where id = (select val from t where cle='seanceA')) = 'VALIDATED',
    'L''enseignante valide sa propre feuille');

  -- Seance close : l'appel ne passe plus.
  begin
    perform public.enregistrer_appel(
      (select val from t where cle='seanceA'),
      jsonb_build_array(jsonb_build_object(
        'enrollment_id', (select e.id from public.enrollments e
                           where e.class_id = (select val from t where cle='classeA') limit 1),
        'status_id', v_present)));
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm;
  end;
  perform pg_temp.verifier(v_erreur like 'ECOLEPLUS_SEANCE_VALIDEE%',
    'Une seance validee refuse tout nouvel appel');

  execute 'reset role';
end $$;

\o
\echo ''
\echo '5. Correction : une permission distincte'
\o /dev/null

do $$
declare v_erreur text; v_record uuid; v_retard uuid;
begin
  select r.id into v_record from public.attendance_records r
   where r.session_id = (select val from t where cle='seanceA') limit 1;
  select id into v_retard from public.attendance_statuses
   where organization_id = (select val from t where cle='org') and code='RETARD';

  -- Carol a fait l'appel et l'a valide, mais n'a PAS attendance.correct.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='carol')), true);
  begin
    perform public.corriger_presence(v_record, v_retard, 'Arrive en retard');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm;
  end;
  perform pg_temp.verifier(v_erreur like 'ECOLEPLUS_PERMISSION%',
    'Celui qui a saisi ne peut pas reecrire sa saisie : c''est ce qui donne sa valeur au verrouillage');

  begin
    perform public.rouvrir_seance((select val from t where cle='seanceA'), 'Erreur de saisie');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm;
  end;
  perform pg_temp.verifier(v_erreur like 'ECOLEPLUS_PERMISSION%',
    'Elle ne peut pas davantage rouvrir la seance');
  execute 'reset role';

  -- Dan, personnel administratif, detient attendance.correct.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='dan')), true);
  perform public.corriger_presence(v_record, v_retard, 'Mot des parents recu le lendemain');
  execute 'reset role';

  perform pg_temp.verifier(
    (select status_id from public.attendance_records where id = v_record) = v_retard,
    'Le personnel administratif corrige apres cloture');

  perform pg_temp.verifier(
    (select count(*) from public.attendance_corrections where record_id = v_record) = 1,
    'La correction est tracee, avec son motif');
end $$;

do $$
declare v_erreur text; v_record uuid; v_absent uuid;
begin
  select r.id into v_record from public.attendance_records r
   where r.session_id = (select val from t where cle='seanceA') limit 1;
  select id into v_absent from public.attendance_statuses
   where organization_id = (select val from t where cle='org') and code='ABSENT';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='dan')), true);
  begin
    perform public.corriger_presence(v_record, v_absent, '   ');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm;
  end;
  perform pg_temp.verifier(v_erreur like 'ECOLEPLUS_MOTIF_REQUIS%',
    'Une correction sans motif est refusee');
  execute 'reset role';
end $$;

do $$
declare v_erreur text;
begin
  begin
    update public.attendance_corrections set reason = 'falsifie';
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm;
  end;
  perform pg_temp.verifier(v_erreur like 'ECOLEPLUS_HISTORIQUE_IMMUABLE%',
    'L''historique des corrections ne se reecrit pas, meme en superutilisateur');

  begin
    delete from public.attendance_corrections;
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm;
  end;
  perform pg_temp.verifier(v_erreur like 'ECOLEPLUS_HISTORIQUE_IMMUABLE%',
    'Il ne se supprime pas davantage');
end $$;

\o
\echo ''
\echo '6. Decompte des absences'
\o /dev/null

do $$
declare v_comptees integer; v_presents integer;
begin
  -- Apres correction : un absent est devenu « retard ».
  select count(*) into v_comptees
    from public.attendance_records r
    join public.attendance_statuses s on s.id = r.status_id
   where r.session_id = (select val from t where cle='seanceA') and s.counts_absent;

  select count(*) into v_presents
    from public.attendance_records r
    join public.attendance_statuses s on s.id = r.status_id
   where r.session_id = (select val from t where cle='seanceA') and s.is_present;

  perform pg_temp.verifier(v_comptees = 0,
    'Le decompte d''absences suit counts_absent, pas le libelle du statut');
  perform pg_temp.verifier(v_presents = 3,
    'Les trois apprenants comptent comme presents, retard compris');
end $$;

\o
\echo ''
\echo 'Portee des statuts de presence (audit de securite)'
\o /dev/null

-- Les statuts de presence sont des donnees partagees (@docs/business-rules/presences.md).
-- Un etablissement s'en sert ; il ne les redefinit pas pour les autres.
insert into auth.users (email, raw_user_meta_data)
values ('erika@alpha.test', '{"given_name":"Erika","family_name":"Ba"}');
insert into t select 'erika', id from auth.users where email='erika@alpha.test';

insert into public.establishments (organization_id, name, code)
values ((select val from t where cle='org'), 'Annexe Nord', 'ANX');
insert into t select 'anx', id from public.establishments where code='ANX';

insert into public.organization_memberships (profile_id, organization_id, role_id)
select (select val from t where cle='erika'), (select val from t where cle='org'), id
  from public.roles where organization_id is null and code = 'ESTABLISHMENT_ADMIN';

insert into public.establishment_users (membership_id, establishment_id)
select m.id, (select val from t where cle='anx')
  from public.organization_memberships m
 where m.profile_id = (select val from t where cle='erika');

do $$
declare v_erreur text; v_id uuid; v_etab uuid; v_n integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='erika')), true);

  perform pg_temp.verifier(ecoleplus.has_permission('attendance.configure'),
    'L''administratrice d''annexe a bien attendance.configure');

  -- Creer un statut valable pour toute l'organisation : refuse.
  begin
    insert into public.attendance_statuses
      (organization_id, establishment_id, name, code, is_present, counts_absent)
    values ((select val from t where cle='org'), null, 'Statut impose', 'IMPOSE', true, false);
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%row-level security%',
    'Un etablissement n''impose pas un statut de presence a toute l''organisation');

  -- Son propre statut, en revanche, lui appartient.
  insert into public.attendance_statuses
    (organization_id, establishment_id, name, code, is_present, counts_absent)
  values ((select val from t where cle='org'), (select val from t where cle='anx'),
          'Sortie anticipee', 'SORTIE', true, false)
  returning id into v_id;
  perform pg_temp.verifier(v_id is not null,
    'Mais elle cree librement celui de son etablissement');

  -- Et un statut commun ne se detourne pas vers elle : la RLS ne lui donne
  -- aucune prise en ecriture dessus.
  begin
    update public.attendance_statuses set establishment_id = (select val from t where cle='anx')
     where organization_id = (select val from t where cle='org')
       and establishment_id is null and code = 'ABSENT';
    get diagnostics v_n = row_count;
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; v_n := -1; end;
  perform pg_temp.verifier(v_n = 0,
    'Le statut commun ne se tire pas vers un etablissement');

  select establishment_id into v_etab from public.attendance_statuses
   where organization_id = (select val from t where cle='org') and code = 'ABSENT';
  perform pg_temp.verifier(v_etab is null,
    'Et il reste commun a tous');

  execute 'reset role';
end $$;

\o
\echo ''
\echo 'Tous les tests de presences sont passes.'

rollback;
