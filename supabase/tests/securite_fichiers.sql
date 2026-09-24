-- =============================================================================
-- Tests de sécurité — fichiers (phase 5)
-- =============================================================================
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/securite_fichiers.sql
--
-- Couvre le scénario n° 7 de @docs/reprise-projet-precedent.md :
-- « téléchargement d'un document non autorisé », sous toutes ses formes —
-- autre organisation, autre établissement, permission manquante, dépôt jamais
-- confirmé, fichier supprimé.
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
create temp table k (cle text primary key, val text);
grant select, insert on t to authenticated;
grant select, insert on k to authenticated;

-- -----------------------------------------------------------------------------
-- Mise en place : deux organisations, deux etablissements dans la premiere
-- -----------------------------------------------------------------------------
insert into auth.users (email, raw_user_meta_data) values
  ('alice@alpha.test', '{"given_name":"Alice","family_name":"Nkosi"}'),
  ('carol@alpha.test', '{"given_name":"Carol","family_name":"Diallo"}'),
  ('dan@alpha.test',   '{"given_name":"Dan","family_name":"Mensah"}'),
  ('bob@beta.test',    '{"given_name":"Bob","family_name":"Traore"}');
insert into t select 'alice', id from auth.users where email='alice@alpha.test';
insert into t select 'carol', id from auth.users where email='carol@alpha.test';
insert into t select 'dan',   id from auth.users where email='dan@alpha.test';
insert into t select 'bob',   id from auth.users where email='bob@beta.test';

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select val from t where cle='alice'))::text, true);
insert into t select 'org', public.creer_organisation('Groupe Alpha', 'SN', 'Africa/Dakar', 'XOF', 'fr');
reset role;

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select val from t where cle='bob'))::text, true);
insert into t select 'org_beta', public.creer_organisation('Groupe Beta', 'FR', 'Europe/Paris', 'EUR', 'fr');
reset role;

insert into public.establishments (organization_id, name, code)
values ((select val from t where cle='org'), 'Lycee Central', 'LYC'),
       ((select val from t where cle='org'), 'Annexe Nord',   'ANX');
insert into t select 'lyc', id from public.establishments where code='LYC';
insert into t select 'anx', id from public.establishments where code='ANX';

insert into public.organization_memberships (profile_id, organization_id, role_id)
select u.id, (select val from t where cle='org'), r.id
  from auth.users u
  cross join lateral (select id from public.roles
     where organization_id is null
       and code = case u.email when 'carol@alpha.test' then 'TEACHER' else 'STAFF' end) r
 where u.email in ('carol@alpha.test', 'dan@alpha.test');

-- Carol sur le lycee, Dan sur l'annexe : deux perimetres disjoints.
insert into public.establishment_users (membership_id, establishment_id)
select m.id, (select val from t where cle='lyc')
  from public.organization_memberships m
  join auth.users u on u.id = m.profile_id where u.email = 'carol@alpha.test';
insert into public.establishment_users (membership_id, establishment_id)
select m.id, (select val from t where cle='anx')
  from public.organization_memberships m
  join auth.users u on u.id = m.profile_id where u.email = 'dan@alpha.test';

insert into public.academic_years (organization_id, establishment_id, name, starts_on, ends_on, is_current)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        '2026-2027', date '2026-10-01', date '2027-07-10', true),
       ((select val from t where cle='org'), (select val from t where cle='anx'),
        '2026-2027', date '2026-10-01', date '2027-07-10', true);
insert into t select 'annee', id from public.academic_years
  where establishment_id = (select val from t where cle='lyc');
insert into t select 'annee_anx', id from public.academic_years
  where establishment_id = (select val from t where cle='anx');

set local role authenticated;
select set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);
select public.inscrire_apprenant((select val from t where cle='lyc'), (select val from t where cle='annee'),
  'Awa','Sow',null,null,null,null,'A1',null,null,'ACTIVE'::public.enrollment_status);
select public.inscrire_apprenant((select val from t where cle='anx'), (select val from t where cle='annee_anx'),
  'Pape','Niang',null,null,null,null,'N1',null,null,'ACTIVE'::public.enrollment_status);
reset role;

insert into t select 'insc_lyc', e.id from public.enrollments e
  join public.learners l on l.id = e.learner_id where l.learner_code='A1';
insert into t select 'insc_anx', e.id from public.enrollments e
  join public.learners l on l.id = e.learner_id where l.learner_code='N1';

\o
\echo ''
\echo '1. Depot en deux temps : un PENDING ne se sert pas'
\o /dev/null

do $$
declare v_id uuid; v_cle text; v_erreur text; v_statut public.file_status;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='carol')), true);

  select f.fichier_id, f.cle_stockage into v_id, v_cle
    from public.preparer_fichier('certificat.pdf', 'application/pdf', 12345,
           'Justificatif', null, (select val from t where cle='insc_lyc'), null) f;
  insert into t values ('fichier', v_id);
  insert into k values ('cle', v_cle);

  perform pg_temp.verifier(v_cle like 'org/%',
    'La cle de stockage suit le motif attendu');
  perform pg_temp.verifier(v_cle not like '%certificat%',
    'Et ne porte AUCUNE trace du nom d''origine');
  perform pg_temp.verifier(v_cle like '%' || v_id::text,
    'Elle derive de l''identifiant du fichier');

  perform pg_temp.verifier(
    (select status from public.files where id = v_id) = 'PENDING',
    'Le fichier nait en attente de confirmation');

  -- Tant que le depot n'est pas constate dans R2, rien ne se telecharge.
  begin
    perform public.fichier_telechargeable(v_id);
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_FICHIER_NON_DISPONIBLE%',
    'Un depot jamais confirme ne se telecharge pas');

  -- Taille discordante : quarantaine, pas mise en service.
  v_statut := public.confirmer_fichier(v_id, 99999);
  perform pg_temp.verifier(v_statut = 'QUARANTINED',
    'Une taille constatee differente de la taille annoncee met en quarantaine');

  begin
    perform public.fichier_telechargeable(v_id);
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_FICHIER_NON_DISPONIBLE%',
    'Et un fichier en quarantaine ne se sert pas davantage');

  execute 'reset role';
end $$;

-- Un depot correct, celui-la.
do $$
declare v_id uuid; v_statut public.file_status; v_cle text;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='carol')), true);

  select f.fichier_id into v_id
    from public.preparer_fichier('justificatif.pdf', 'application/pdf', 4096,
           'Justificatif', null, (select val from t where cle='insc_lyc'), null) f;
  insert into t values ('fichier_ok', v_id);

  v_statut := public.confirmer_fichier(v_id, 4096);
  perform pg_temp.verifier(v_statut = 'STORED', 'Une taille conforme confirme le depot');

  select tf.cle_stockage into v_cle from public.fichier_telechargeable(v_id) tf;
  perform pg_temp.verifier(v_cle is not null, 'Et le fichier devient telechargeable');

  execute 'reset role';
end $$;

\o
\echo ''
\echo '2. Scenario 7 : telechargement d''un document non autorise'
\o /dev/null

do $$
declare v_erreur text; v_n integer;
begin
  -- Dan est sur l'ANNEXE. Le fichier appartient au LYCEE.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='dan')), true);

  select count(*) into v_n from public.files
   where id = (select val from t where cle='fichier_ok');
  perform pg_temp.verifier(v_n = 0,
    'Un fichier d''un autre etablissement est invisible (RLS)');

  begin
    perform public.fichier_telechargeable((select val from t where cle='fichier_ok'));
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_FICHIER_INTROUVABLE%',
    'Et connaitre son identifiant ne suffit pas a l''obtenir (scenario 7)');
  perform pg_temp.verifier(v_erreur not like '%permission%',
    'Le message ne confirme meme pas que le fichier existe ailleurs');

  execute 'reset role';

  -- Bob est dans une AUTRE ORGANISATION.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='bob')), true);

  select count(*) into v_n from public.files;
  perform pg_temp.verifier(v_n = 0, 'Une autre organisation ne voit aucun fichier');

  begin
    perform public.fichier_telechargeable((select val from t where cle='fichier_ok'));
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_FICHIER_INTROUVABLE%',
    'Ni ne peut le telecharger, identifiant en main');

  execute 'reset role';
end $$;

-- Sans claims du tout : echec ferme.
do $$
declare v_erreur text; v_n integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000"}', true);

  select count(*) into v_n from public.files;
  perform pg_temp.verifier(v_n = 0, 'Sans contexte d''organisation, aucun fichier n''est lisible');

  begin
    perform public.fichier_telechargeable((select val from t where cle='fichier_ok'));
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur <> 'aucune', 'Et rien ne se telecharge');

  execute 'reset role';
end $$;

\o
\echo ''
\echo '3. Le rattachement ne franchit pas la frontiere du tenant'
\o /dev/null

do $$
declare v_erreur text;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='carol')), true);

  -- Carol tente de rattacher un fichier a une inscription de l'annexe.
  begin
    perform public.preparer_fichier('tentative.pdf', 'application/pdf', 100, null,
              null, (select val from t where cle='insc_anx'), null);
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%files.upload%' or v_erreur like '%ECOLEPLUS_%',
    'Deposer sur une inscription hors perimetre est refuse');

  -- Deux cibles a la fois : refuse.
  begin
    perform public.preparer_fichier('deux.pdf', 'application/pdf', 100, null,
              (select learner_id from public.enrollments
                where id = (select val from t where cle='insc_lyc')),
              (select val from t where cle='insc_lyc'), null);
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_RATTACHEMENT_INVALIDE%',
    'Un fichier se rattache a exactement une cible');

  execute 'reset role';
end $$;

do $$
declare v_erreur text;
begin
  -- Meme en superutilisateur, une cible d'une autre organisation est refusee
  -- par la cle composite.
  begin
    insert into public.files
      (organization_id, establishment_id, storage_key, original_name, mime_type,
       size_bytes, enrollment_id)
    values ((select val from t where cle='org_beta'), null,
            'org/' || (select val from t where cle='org_beta') || '/' || gen_random_uuid(),
            'vol.pdf', 'application/pdf', 100, (select val from t where cle='insc_lyc'));
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur <> 'aucune',
    'La cle composite refuse un rattachement inter-organisations');
end $$;

\o
\echo ''
\echo '4. Garde-fous de taille, de type et de cle'
\o /dev/null

do $$
declare v_erreur text; v_id uuid;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='carol')), true);

  -- 30 Mio : au-dela du plafond dur.
  begin
    perform public.preparer_fichier('enorme.pdf', 'application/pdf', 31457280, null,
              null, (select val from t where cle='insc_lyc'), null);
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%files_taille%',
    'Le plafond de taille est une contrainte de la base, pas un controle d''ecran');

  -- Type MIME malforme.
  begin
    perform public.preparer_fichier('bizarre', 'pas-un-type', 100, null,
              null, (select val from t where cle='insc_lyc'), null);
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%files_mime_format%',
    'Un type MIME malforme est refuse');

  execute 'reset role';
end $$;

do $$
declare v_erreur text;
begin
  -- La cle de stockage ne se deplace pas, meme en superutilisateur.
  begin
    update public.files set storage_key = 'org/x/y'
     where id = (select val from t where cle='fichier_ok');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_CLE_FIGEE%' or v_erreur like '%files_cle_format%',
    'La cle de stockage est figee : la deplacer ferait pointer ailleurs');

  -- Aucun droit d'ecriture directe sur la table.
  perform pg_temp.verifier(
    (select count(*) from information_schema.role_table_grants
      where table_name = 'files' and grantee = 'authenticated'
        and privilege_type in ('INSERT','UPDATE','DELETE')) = 0,
    'Aucun role applicatif n''ecrit directement dans `files`');
end $$;

\o
\echo ''
\echo '5. Suppression logique, tracee'
\o /dev/null

do $$
declare v_erreur text; v_n integer;
begin
  -- Carol est enseignante : elle depose, elle ne supprime pas.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='carol')), true);

  begin
    perform public.supprimer_fichier((select val from t where cle='fichier_ok'), 'erreur de depot');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%files.delete%',
    'L''enseignante depose mais ne retire rien du dossier');

  execute 'reset role';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  begin
    perform public.supprimer_fichier((select val from t where cle='fichier_ok'), '  ');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_MOTIF_REQUIS%',
    'Une suppression sans motif est refusee');

  perform public.supprimer_fichier((select val from t where cle='fichier_ok'),
    'Piece deposee sur le mauvais dossier');

  select count(*) into v_n from public.files
   where id = (select val from t where cle='fichier_ok');
  perform pg_temp.verifier(v_n = 0, 'Le fichier supprime sort de la vue');

  begin
    perform public.fichier_telechargeable((select val from t where cle='fichier_ok'));
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_FICHIER_INTROUVABLE%',
    'Et ne se telecharge plus, identifiant en main');

  execute 'reset role';
end $$;

do $$
declare v_n integer;
begin
  -- Mais la ligne existe toujours, avec son motif : c'est une suppression
  -- logique, pas un effacement.
  select count(*) into v_n from public.files
   where id = (select val from t where cle='fichier_ok')
     and deleted_at is not null
     and delete_reason = 'Piece deposee sur le mauvais dossier';
  perform pg_temp.verifier(v_n = 1,
    'La ligne demeure, datee et motivee — rien n''est efface');

  select count(*) into v_n from public.audit_logs
   where action = 'files.deleted' and reason = 'Piece deposee sur le mauvais dossier';
  perform pg_temp.verifier(v_n = 1, 'La suppression est journalisee');

  select count(*) into v_n from public.audit_logs where action = 'files.downloaded';
  perform pg_temp.verifier(v_n >= 1, 'Et chaque telechargement laisse une trace');
end $$;

\o
rollback;
\echo ''
\echo 'Suite terminee.'
