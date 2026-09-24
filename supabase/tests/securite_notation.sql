-- =============================================================================
-- Tests de sécurité et de calcul — notation (phase 3b)
-- =============================================================================
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/securite_notation.sql
--
-- Couverture : les neuf états d'une note, les trois politiques de note
-- manquante, zéro réel contre absence, barèmes /20 /100 lettres et niveaux de
-- maîtrise, coefficients de matière et poids de catégorie, arrondis, conversion
-- d'échelle, tranches chevauchantes refusées, portée « mes matières », cycle
-- saisie → vérification → publication, correction d'une note publiée sans
-- permission refusée et tracée, barème gelé après publication.
--
-- Couvre les scénarios 3, 4 et 10 de @docs/reprise-projet-precedent.md.
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

-- Carol enseignante, Dan personnel administratif.
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
values ((select val from t where cle='org'), (select val from t where cle='lyc'), 'Mathematiques', 'MATH'),
       ((select val from t where cle='org'), (select val from t where cle='lyc'), 'Histoire', 'HIST');
insert into t select 'math', id from public.subjects where code='MATH';
insert into t select 'hist', id from public.subjects where code='HIST';

insert into public.teachers (organization_id, establishment_id, profile_id, given_name, family_name, staff_code)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        (select val from t where cle='carol'), 'Carol', 'Diallo', 'ENS001');
insert into t select 'ens_carol', id from public.teachers where staff_code='ENS001';

insert into public.teachers (organization_id, establishment_id, given_name, family_name, staff_code)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        'Fatou', 'Sarr', 'ENS002');
insert into t select 'ens_fatou', id from public.teachers where staff_code='ENS002';

-- Classe A : Fatou en est titulaire, Carol y enseigne les mathematiques
-- seulement. Cette distinction est ce qui rend la portee « mes matieres »
-- verifiable : titulaire et affectee ne sont pas la meme chose.
insert into public.classes (organization_id, establishment_id, academic_year_id, level_id, name, code, main_teacher_id)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        (select val from t where cle='annee'), (select val from t where cle='niveau'),
        'Seconde A', '2NDA', (select val from t where cle='ens_fatou'));
insert into t select 'classeA', id from public.classes where code='2NDA';

insert into public.teaching_assignments
  (organization_id, establishment_id, class_id, subject_id, teacher_id)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        (select val from t where cle='classeA'), (select val from t where cle='math'),
        (select val from t where cle='ens_carol'));

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

insert into t select 'num20', id from public.grading_systems
  where organization_id = (select val from t where cle='org') and code='NUM20';
insert into t select 'maitrise', id from public.grading_systems
  where organization_id = (select val from t where cle='org') and code='MAITRISE';
insert into t select 'cat_cc', id from public.grading_categories
  where organization_id = (select val from t where cle='org') and code='CC';
insert into t select 'cat_ds', id from public.grading_categories
  where organization_id = (select val from t where cle='org') and code='DS';

-- Barème sur 100, pour éprouver la conversion d'échelle.
insert into public.grading_systems
  (organization_id, establishment_id, name, code, type, min_value, max_value, pass_threshold, decimals)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        'Pourcentage', 'PCT100', 'NUMERIC', 0, 100, 50, 1);
insert into t select 'pct100', id from public.grading_systems where code='PCT100';

update public.classes set grading_system_id = (select val from t where cle='num20')
 where id = (select val from t where cle='classeA');

-- Mathematiques coefficient 3, Histoire coefficient 1.
insert into public.class_subjects
  (organization_id, establishment_id, class_id, subject_id, coefficient)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        (select val from t where cle='classeA'), (select val from t where cle='math'), 3),
       ((select val from t where cle='org'), (select val from t where cle='lyc'),
        (select val from t where cle='classeA'), (select val from t where cle='hist'), 1);

\o
\echo ''
\echo '1. Une note manquante n''est pas un zero — la base le rend impossible'
\o /dev/null

insert into public.assessments
  (organization_id, establishment_id, academic_year_id, academic_term_id, class_id,
   subject_id, teacher_id, category_id, grading_system_id, title, date_on, coefficient)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        (select val from t where cle='annee'), (select val from t where cle='trim1'),
        (select val from t where cle='classeA'), (select val from t where cle='math'),
        (select val from t where cle='ens_carol'), (select val from t where cle='cat_cc'),
        (select val from t where cle='num20'), 'Devoir 1', date '2026-10-20', 1);
insert into t select 'eval1', id from public.assessments where title='Devoir 1';

do $$
declare v_erreur text;
begin
  -- Une absence qui porterait une valeur : la contrainte la refuse.
  begin
    insert into public.assessment_results
      (organization_id, assessment_id, enrollment_id, kind, raw_value)
    values ((select val from t where cle='org'), (select val from t where cle='eval1'),
            (select val from t where cle='insc1'), 'ABSENT', 12);
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  -- Le declencheur de normalisation efface la valeur d'une non-note ; la
  -- contrainte acheve le travail si elle survivait.
  perform pg_temp.verifier(
    (select raw_value is null from public.assessment_results
      where assessment_id = (select val from t where cle='eval1')
        and enrollment_id = (select val from t where cle='insc1'))
    or v_erreur <> 'aucune',
    'Une absence ne peut pas porter de valeur');

  delete from public.assessment_results
   where assessment_id = (select val from t where cle='eval1');

  -- Un score sans valeur : refuse.
  begin
    insert into public.assessment_results
      (organization_id, assessment_id, enrollment_id, kind, raw_value)
    values ((select val from t where cle='org'), (select val from t where cle='eval1'),
            (select val from t where cle='insc1'), 'SCORE', null);
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%assessment_results_valeur_si_score%',
    'Un score sans valeur est refuse par la base');
end $$;

-- Zero reel contre absence : memes lignes, sens opposes.
insert into public.assessment_results
  (organization_id, assessment_id, enrollment_id, kind, raw_value, status)
values ((select val from t where cle='org'), (select val from t where cle='eval1'),
        (select val from t where cle='insc1'), 'SCORE', 0, 'CAPTURED'),
       ((select val from t where cle='org'), (select val from t where cle='eval1'),
        (select val from t where cle='insc2'), 'ABSENT', null, 'CAPTURED');

do $$
declare v_zero numeric; v_abs numeric;
begin
  select normalized_value into v_zero from public.assessment_results
   where enrollment_id = (select val from t where cle='insc1');
  select normalized_value into v_abs from public.assessment_results
   where enrollment_id = (select val from t where cle='insc2');

  perform pg_temp.verifier(v_zero = 0, 'Un zero reel vaut zero dans le calcul');
  perform pg_temp.verifier(v_abs is null, 'Une absence ne vaut rien du tout — pas zero, rien');
  perform pg_temp.verifier(v_zero is distinct from v_abs,
    'Le zero et l''absence ne produisent pas la meme donnee');
end $$;

\o
\echo ''
\echo '2. Les trois politiques de note manquante'
\o /dev/null

do $$
declare v_ratio numeric; v_prises integer; v_ignorees integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  -- SKIP (defaut) : Moussa absent, sa moyenne porte sur les notes presentes.
  select m.ratio, m.notes_prises, m.notes_ignorees into v_ratio, v_prises, v_ignorees
    from public.moyennes_matiere((select val from t where cle='insc2'),
                                 (select val from t where cle='trim1')) m
   where m.subject_id = (select val from t where cle='math');
  perform pg_temp.verifier(v_ratio is null and v_prises = 0 and v_ignorees = 1,
    'SKIP : l''absence est ignoree, aucune moyenne n''est inventee');

  execute 'reset role';

  -- ZERO : choix explicite de l'evaluation.
  update public.assessments set missing_grade_policy = 'ZERO'
   where id = (select val from t where cle='eval1');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  select m.ratio into v_ratio
    from public.moyennes_matiere((select val from t where cle='insc2'),
                                 (select val from t where cle='trim1')) m
   where m.subject_id = (select val from t where cle='math');
  perform pg_temp.verifier(v_ratio = 0, 'ZERO : l''absence compte comme zero, parce qu''on l''a decide');

  execute 'reset role';
  update public.assessments set missing_grade_policy = 'EXCLUDED'
   where id = (select val from t where cle='eval1');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  select m.ratio into v_ratio
    from public.moyennes_matiere((select val from t where cle='insc2'),
                                 (select val from t where cle='trim1')) m
   where m.subject_id = (select val from t where cle='math');
  perform pg_temp.verifier(v_ratio is null, 'EXCLUDED : l''evaluation ne concerne pas cet apprenant');

  execute 'reset role';
  update public.assessments set missing_grade_policy = 'SKIP'
   where id = (select val from t where cle='eval1');
end $$;

-- Une dispense sort du calcul quelle que soit la politique.
update public.assessments set missing_grade_policy = 'ZERO'
 where id = (select val from t where cle='eval1');
update public.assessment_results set kind = 'EXEMPT'
 where enrollment_id = (select val from t where cle='insc2');

do $$
declare v_ratio numeric;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);
  select m.ratio into v_ratio
    from public.moyennes_matiere((select val from t where cle='insc2'),
                                 (select val from t where cle='trim1')) m
   where m.subject_id = (select val from t where cle='math');
  perform pg_temp.verifier(v_ratio is null,
    'Une dispense sort du calcul meme sous politique ZERO — ce n''est pas une note manquante');
  execute 'reset role';
end $$;

update public.assessments set missing_grade_policy = 'SKIP'
 where id = (select val from t where cle='eval1');
update public.assessment_results set kind = 'ABSENT'
 where enrollment_id = (select val from t where cle='insc2');

\o
\echo ''
\echo '3. Coefficients, poids de categorie et arrondis'
\o /dev/null

-- Deuxieme evaluation en mathematiques, categorie « devoir surveille » (poids 2).
insert into public.assessments
  (organization_id, establishment_id, academic_year_id, academic_term_id, class_id,
   subject_id, teacher_id, category_id, grading_system_id, title, date_on, coefficient)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        (select val from t where cle='annee'), (select val from t where cle='trim1'),
        (select val from t where cle='classeA'), (select val from t where cle='math'),
        (select val from t where cle='ens_carol'), (select val from t where cle='cat_ds'),
        (select val from t where cle='num20'), 'Devoir 2', date '2026-11-10', 1);
insert into t select 'eval2', id from public.assessments where title='Devoir 2';

-- Une evaluation d'histoire, pour la moyenne generale.
insert into public.assessments
  (organization_id, establishment_id, academic_year_id, academic_term_id, class_id,
   subject_id, category_id, grading_system_id, title, date_on, coefficient)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        (select val from t where cle='annee'), (select val from t where cle='trim1'),
        (select val from t where cle='classeA'), (select val from t where cle='hist'),
        (select val from t where cle='cat_cc'), (select val from t where cle='num20'),
        'Expose', date '2026-11-12', 1);
insert into t select 'eval3', id from public.assessments where title='Expose';

-- Awa : 8/20 en controle continu (poids 1), 14/20 en devoir surveille (poids 2).
-- Moyenne attendue : (8*1 + 14*2) / 3 = 12.
update public.assessment_results set raw_value = 8
 where enrollment_id = (select val from t where cle='insc1');
insert into public.assessment_results
  (organization_id, assessment_id, enrollment_id, kind, raw_value, status)
values ((select val from t where cle='org'), (select val from t where cle='eval2'),
        (select val from t where cle='insc1'), 'SCORE', 14, 'CAPTURED'),
       ((select val from t where cle='org'), (select val from t where cle='eval3'),
        (select val from t where cle='insc1'), 'SCORE', 16, 'CAPTURED');

do $$
declare v_math numeric; v_hist numeric; v_gen numeric; v_mention text;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  select m.valeur into v_math
    from public.moyennes_matiere((select val from t where cle='insc1'),
                                 (select val from t where cle='trim1')) m
   where m.subject_id = (select val from t where cle='math');
  perform pg_temp.verifier(v_math = 12.00,
    'Le poids de categorie s''applique : (8x1 + 14x2) / 3 = 12');

  select m.valeur into v_hist
    from public.moyennes_matiere((select val from t where cle='insc1'),
                                 (select val from t where cle='trim1')) m
   where m.subject_id = (select val from t where cle='hist');
  perform pg_temp.verifier(v_hist = 16.00, 'Histoire : 16');

  -- Les compteurs comptent des NOTES, pas des lignes d'un produit cartesien.
  -- Deux evaluations en mathematiques, deux notes saisies : ni plus, ni moins.
  perform pg_temp.verifier(
    (select m.notes_prises from public.moyennes_matiere(
       (select val from t where cle='insc1'), (select val from t where cle='trim1')) m
      where m.subject_id = (select val from t where cle='math')) = 2,
    'Deux evaluations notees comptent deux notes prises, pas quatre');
  perform pg_temp.verifier(
    (select m.notes_ignorees from public.moyennes_matiere(
       (select val from t where cle='insc1'), (select val from t where cle='trim1')) m
      where m.subject_id = (select val from t where cle='math')) = 0,
    'Et aucune ignoree');
  perform pg_temp.verifier(
    (select m.notes_prises + m.notes_ignorees from public.moyennes_matiere(
       (select val from t where cle='insc2'), (select val from t where cle='trim1')) m
      where m.subject_id = (select val from t where cle='math')) = 2,
    'Pour un apprenant sans note, les compteurs suivent le nombre d''evaluations');

  -- Coefficients matiere 3 et 1 : (12*3 + 16*1) / 4 = 13.
  select g.valeur, g.mention into v_gen, v_mention
    from public.moyenne_generale((select val from t where cle='insc1'),
                                 (select val from t where cle='trim1')) g;
  perform pg_temp.verifier(v_gen = 13.00,
    'Le coefficient de matiere s''applique : (12x3 + 16x1) / 4 = 13');
  perform pg_temp.verifier(v_mention = 'Assez bien',
    'La tranche se deduit de la moyenne, sur la valeur normalisee');

  execute 'reset role';
end $$;

-- Arrondis : la meme valeur, trois modes.
do $$
declare v numeric;
begin
  perform pg_temp.verifier(
    ecoleplus.arrondir(12.346, 'ROUND', 2) = 12.35, 'Arrondi ROUND a deux decimales');
  perform pg_temp.verifier(
    ecoleplus.arrondir(12.346, 'FLOOR', 2) = 12.34, 'Arrondi FLOOR a deux decimales');
  perform pg_temp.verifier(
    ecoleplus.arrondir(12.341, 'CEIL', 2) = 12.35, 'Arrondi CEIL a deux decimales');
  perform pg_temp.verifier(
    ecoleplus.arrondir(12.6, 'FLOOR', 0) = 12, 'Le nombre de decimales est configurable');
end $$;

\o
\echo ''
\echo '4. Conversion d''echelle : aucun bareme n''est la norme'
\o /dev/null

do $$
declare v_sur20 numeric; v_sur100 numeric;
begin
  -- Un meme ratio, rendu sur deux echelles differentes.
  v_sur20  := ecoleplus.denormaliser(0.75, (select val from t where cle='num20'));
  v_sur100 := ecoleplus.denormaliser(0.75, (select val from t where cle='pct100'));

  perform pg_temp.verifier(v_sur20 = 15.00,  'Le ratio 0,75 vaut 15 sur une echelle de 20');
  perform pg_temp.verifier(v_sur100 = 75.0, 'Le meme ratio vaut 75 sur une echelle de 100');
  perform pg_temp.verifier(
    ecoleplus.denormaliser(0.5, (select val from t where cle='maitrise')) = 2,
    'Et 2 sur une echelle de maitrise 0-3, arrondie a zero decimale');
end $$;

\o
\echo ''
\echo '5. Tranches : chevauchement impossible, trou detecte'
\o /dev/null

do $$
declare v_erreur text; v_n integer;
begin
  begin
    insert into public.grading_scales
      (organization_id, grading_system_id, label, min_score, max_score, position)
    values ((select val from t where cle='org'), (select val from t where cle='num20'),
            'Chevauchante', 15, 17, 9);
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%grading_scales_sans_chevauchement%',
    'Deux tranches qui se recouvrent sont refusees par la base, pas detectees plus tard');

  begin
    insert into public.grading_scales
      (organization_id, grading_system_id, label, min_score, max_score, position)
    values ((select val from t where cle='org'), (select val from t where cle='num20'),
            'Hors echelle', 20, 25, 9);
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_TRANCHE_HORS_ECHELLE%',
    'Une tranche qui deborde de l''echelle est refusee');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  -- Le bareme d'exemple sur 20 est continu : 0-9.99, 10-11.99, ... 16-20.
  select count(*) into v_n from public.verifier_bareme((select val from t where cle='num20'))
   where gravite = 'ERREUR';
  perform pg_temp.verifier(v_n = 0, 'Le bareme sur 20 fourni en exemple ne porte aucune erreur');

  execute 'reset role';
end $$;

-- Un vrai trou, sur un bareme neuf.
insert into public.grading_systems
  (organization_id, establishment_id, name, code, type, min_value, max_value, decimals)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        'Lettres', 'LETTRES', 'LETTER', 0, 20, 2);
insert into t select 'lettres', id from public.grading_systems where code='LETTRES';

insert into public.grading_scales
  (organization_id, grading_system_id, label, min_score, max_score, position)
values ((select val from t where cle='org'), (select val from t where cle='lettres'), 'F',  0,  7.99, 1),
       ((select val from t where cle='org'), (select val from t where cle='lettres'), 'C', 10, 13.99, 2),
       ((select val from t where cle='org'), (select val from t where cle='lettres'), 'A', 14, 20,    3);

do $$
declare v_n integer; v_msg text;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  select count(*) into v_n from public.verifier_bareme((select val from t where cle='lettres'))
   where gravite = 'ERREUR' and code = 'TROU';
  perform pg_temp.verifier(v_n = 1,
    'Le trou entre 7,99 et 10 est signale a la prevision, pas au bulletin');

  execute 'reset role';
end $$;

\o
\echo ''
\echo '6. Portee « mes matieres » de l''enseignant'
\o /dev/null

do $$
declare v_erreur text; v_n integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='carol')), true);

  -- Carol enseigne les mathematiques dans la classe A : elle y cree une evaluation.
  begin
    insert into public.assessments
      (organization_id, establishment_id, academic_year_id, class_id, subject_id,
       grading_system_id, title, date_on)
    values ((select val from t where cle='org'), (select val from t where cle='lyc'),
            (select val from t where cle='annee'), (select val from t where cle='classeA'),
            (select val from t where cle='math'), (select val from t where cle='num20'),
            'Interrogation', date '2026-11-20');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur = 'aucune',
    'L''enseignante cree une evaluation dans la matiere qu''elle enseigne');

  -- Histoire : elle n'y est pas affectee, et elle n'est pas titulaire.
  begin
    insert into public.assessments
      (organization_id, establishment_id, academic_year_id, class_id, subject_id,
       grading_system_id, title, date_on)
    values ((select val from t where cle='org'), (select val from t where cle='lyc'),
            (select val from t where cle='annee'), (select val from t where cle='classeA'),
            (select val from t where cle='hist'), (select val from t where cle='num20'),
            'Controle histoire', date '2026-11-21');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur <> 'aucune',
    'Elle ne cree rien dans une matiere qu''elle n''enseigne pas, meme dans sa classe');

  -- Saisir les notes de l'evaluation d'histoire lui est egalement refuse.
  begin
    perform public.saisir_notes((select val from t where cle='eval3'),
      jsonb_build_array(jsonb_build_object(
        'enrollment_id', (select val from t where cle='insc1'), 'kind', 'SCORE', 'raw_value', 20)));
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_HORS_MES_MATIERES%',
    'Elle ne saisit pas davantage de notes dans cette matiere');

  execute 'reset role';
end $$;

\o
\echo ''
\echo '7. Saisie, verification, publication'
\o /dev/null

delete from public.assessment_results where assessment_id = (select val from t where cle='eval2');

do $$
declare v_erreur text; v_n integer; v_statut public.assessment_status;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='carol')), true);

  -- Saisie d'une feuille complete : un score, une absence, une ligne vide.
  perform public.saisir_notes((select val from t where cle='eval2'),
    jsonb_build_array(
      jsonb_build_object('enrollment_id', (select val from t where cle='insc1'),
                         'kind', 'SCORE', 'raw_value', 14),
      jsonb_build_object('enrollment_id', (select val from t where cle='insc2'),
                         'kind', 'ABSENT'),
      jsonb_build_object('enrollment_id', (select val from t where cle='insc3'),
                         'kind', 'PENDING')));

  select count(*) into v_n from public.assessment_results
   where assessment_id = (select val from t where cle='eval2');
  perform pg_temp.verifier(v_n = 3, 'La feuille entiere part en une seule requete');

  -- Une ligne restee vide empeche la verification : ni note, ni absence.
  begin
    perform public.verifier_evaluation((select val from t where cle='eval2'));
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_SAISIE_INCOMPLETE%',
    'Une ligne sans nature de note bloque la verification');

  -- La troisieme ligne devient une dispense : la nature est desormais explicite.
  perform public.saisir_notes((select val from t where cle='eval2'),
    jsonb_build_array(jsonb_build_object(
      'enrollment_id', (select val from t where cle='insc3'), 'kind', 'EXEMPT')));

  perform public.verifier_evaluation((select val from t where cle='eval2'));

  select status into v_statut from public.assessments
   where id = (select val from t where cle='eval2');
  perform pg_temp.verifier(v_statut = 'VERIFIED', 'L''enseignante verifie sa saisie');

  -- Mais elle ne publie pas : publier engage l'etablissement.
  begin
    perform public.publier_evaluation((select val from t where cle='eval2'));
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%grades.publish%',
    'L''enseignante ne publie pas : la permission est distincte');

  execute 'reset role';

  -- La proprietaire publie.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);
  perform public.publier_evaluation((select val from t where cle='eval2'));

  select count(*) into v_n from public.assessment_results
   where assessment_id = (select val from t where cle='eval2') and status = 'PUBLISHED';
  perform pg_temp.verifier(v_n = 3, 'La publication fige les trois notes');

  execute 'reset role';
end $$;

\o
\echo ''
\echo '8. Une note publiee ne se modifie pas silencieusement'
\o /dev/null

insert into t select 'note_awa', id from public.assessment_results
  where assessment_id = (select val from t where cle='eval2')
    and enrollment_id  = (select val from t where cle='insc1');

do $$
declare v_erreur text; v_n integer; v_valeur numeric;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='carol')), true);

  -- Hors procedure : aucune policy d'ecriture n'existe sur les notes.
  begin
    update public.assessment_results set raw_value = 20
     where id = (select val from t where cle='note_awa');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;

  select raw_value into v_valeur from public.assessment_results
   where id = (select val from t where cle='note_awa');
  perform pg_temp.verifier(v_valeur = 14,
    'Une ecriture directe sur une note publiee ne change rien (scenario 4)');

  -- Une nouvelle saisie de masse ne la touche pas davantage.
  perform public.saisir_notes((select val from t where cle='eval1'),
    jsonb_build_array(jsonb_build_object(
      'enrollment_id', (select val from t where cle='insc1'), 'kind', 'SCORE', 'raw_value', 19)));

  -- Corriger sans la permission : refuse (scenario 3).
  begin
    perform public.corriger_note((select val from t where cle='note_awa'),
      'SCORE'::public.grade_kind, 20, null, 'erreur de report');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%grades.correct%',
    'L''enseignante ne corrige pas une note publiee (scenario 3)');

  execute 'reset role';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  -- Avec la permission mais sans motif : refuse.
  begin
    perform public.corriger_note((select val from t where cle='note_awa'),
      'SCORE'::public.grade_kind, 20, null, '   ');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_MOTIF_REQUIS%',
    'Une correction sans motif est refusee');

  perform public.corriger_note((select val from t where cle='note_awa'),
    'SCORE'::public.grade_kind, 16, null, 'Erreur de report constatee sur la copie');

  select raw_value into v_valeur from public.assessment_results
   where id = (select val from t where cle='note_awa');
  perform pg_temp.verifier(v_valeur = 16, 'La correction passe par la procedure dediee');

  select count(*) into v_n from public.assessment_result_histories
   where result_id = (select val from t where cle='note_awa')
     and action = 'corrected' and reason = 'Erreur de report constatee sur la copie';
  perform pg_temp.verifier(v_n = 1, 'La correction est tracee, avec son motif');

  select count(*) into v_n from public.assessment_results
   where id = (select val from t where cle='note_awa') and status = 'CORRECTED';
  perform pg_temp.verifier(v_n = 1,
    'La note corrigee porte un etat distinct de « publiee » : l''historique reste lisible');

  execute 'reset role';
end $$;

do $$
declare v_erreur text;
begin
  -- L'historique ne se reecrit pas, meme en superutilisateur.
  begin
    update public.assessment_result_histories set reason = 'autre chose'
     where result_id = (select val from t where cle='note_awa');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_HISTORIQUE_IMMUABLE%',
    'L''historique des notes ne se reecrit pas');

  begin
    delete from public.assessment_result_histories
     where result_id = (select val from t where cle='note_awa');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_HISTORIQUE_IMMUABLE%',
    'Il ne se supprime pas davantage');
end $$;

\o
\echo ''
\echo '9. Invalider une note, et geler le bareme publie'
\o /dev/null

do $$
declare v_n integer; v_ratio_avant numeric; v_ratio_apres numeric; v_erreur text;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  select m.ratio into v_ratio_avant
    from public.moyennes_matiere((select val from t where cle='insc1'),
                                 (select val from t where cle='trim1')) m
   where m.subject_id = (select val from t where cle='math');

  perform public.annuler_note((select val from t where cle='note_awa'),
    'Sujet errone distribue a une partie de la classe');

  select m.ratio into v_ratio_apres
    from public.moyennes_matiere((select val from t where cle='insc1'),
                                 (select val from t where cle='trim1')) m
   where m.subject_id = (select val from t where cle='math');

  perform pg_temp.verifier(v_ratio_apres is distinct from v_ratio_avant,
    'Une note invalidee sort des calculs');

  select count(*) into v_n from public.assessment_results
   where id = (select val from t where cle='note_awa');
  perform pg_temp.verifier(v_n = 1,
    'Mais elle ne disparait pas : « invalidee » est un etat, pas une suppression');

  execute 'reset role';
end $$;

do $$
declare v_erreur text;
begin
  -- Scenario 10 : deplacer l'echelle apres publication changerait
  -- retroactivement des bulletins deja remis.
  begin
    update public.grading_systems set max_value = 25
     where id = (select val from t where cle='num20');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_BAREME_PUBLIE%',
    'Un bareme portant des notes publiees ne se modifie plus (scenario 10)');

  begin
    update public.grading_scales set min_score = 15
     where grading_system_id = (select val from t where cle='num20') and label = 'Très bien';
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_BAREME_PUBLIE%',
    'Ses tranches non plus');

  -- Renommer reste possible : seules les colonnes qui changent les calculs sont gelees.
  update public.grading_systems set name = 'Notation sur 20'
   where id = (select val from t where cle='num20');
  perform pg_temp.verifier(true, 'Renommer un bareme publie reste possible');
end $$;

\o
\echo ''
\echo '10. Isolation'
\o /dev/null

do $$
declare v_n integer;
begin
  -- Dan est personnel administratif : il consulte, il ne note pas.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='dan')), true);

  select count(*) into v_n from public.assessments;
  perform pg_temp.verifier(v_n > 0, 'Le personnel administratif consulte les evaluations');

  select count(*) into v_n from public.permissions p
    join public.role_permissions rp on rp.permission_key = p.key
    join public.roles r on r.id = rp.role_id
   where r.code = 'STAFF' and r.organization_id is null and p.key like 'grades.%'
     and p.key <> 'grades.read';
  perform pg_temp.verifier(v_n = 0, 'Mais il n''a aucun droit d''ecriture sur les notes');

  execute 'reset role';
end $$;

\o
\echo ''
\echo '11. Resolution du bareme d''une classe'
\o /dev/null

-- La classe A porte explicitement le bareme sur 20 : c'est lui qui rend la
-- moyenne. On le retire pour eprouver la cascade.
update public.classes set grading_system_id = null
 where id = (select val from t where cle='classeA');

do $$
declare v_bareme uuid; v_valeur numeric;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  -- Sans bareme de classe ni defaut, la moyenne se rend sur l'echelle qui a
  -- servi a noter : une moyenne existe toujours quelque part.
  select g.bareme_id, g.valeur into v_bareme, v_valeur
    from public.moyenne_generale((select val from t where cle='insc1'),
                                 (select val from t where cle='trim1')) g;
  perform pg_temp.verifier(v_bareme is not null and v_valeur is not null,
    'Sans bareme de classe, la moyenne se rend sur l''echelle des evaluations');

  execute 'reset role';
end $$;

-- L'etablissement designe son bareme par defaut : c'est lui qui l'emporte.
update public.grading_systems set is_default = true
 where id = (select val from t where cle='pct100');

do $$
declare v_bareme uuid; v_valeur numeric;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  select g.bareme_id, g.valeur into v_bareme, v_valeur
    from public.moyenne_generale((select val from t where cle='insc1'),
                                 (select val from t where cle='trim1')) g;
  perform pg_temp.verifier(v_bareme = (select val from t where cle='pct100'),
    'Le bareme par defaut de l''etablissement prend le relais');
  perform pg_temp.verifier(v_valeur > 20,
    'Et la meme moyenne se lit sur 100 — aucune echelle n''est la norme');

  execute 'reset role';
end $$;

-- Le bareme pose sur la classe reprend la main.
update public.classes set grading_system_id = (select val from t where cle='num20')
 where id = (select val from t where cle='classeA');

do $$
declare v_bareme uuid;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  select g.bareme_id into v_bareme
    from public.moyenne_generale((select val from t where cle='insc1'),
                                 (select val from t where cle='trim1')) g;
  perform pg_temp.verifier(v_bareme = (select val from t where cle='num20'),
    'Le bareme de la classe l''emporte sur le defaut de l''etablissement');

  execute 'reset role';
end $$;

\o
rollback;
\echo ''
\echo 'Suite terminee.'
