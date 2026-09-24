-- =============================================================================
-- Tests de sécurité et de comptabilité — finances (phase 4)
-- =============================================================================
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/securite_finances.sql
--
-- Couverture : les six scénarios de @docs/business-rules/finances.md §4, plus
-- l'indestructibilité du reçu, le retour du solde après annulation, la
-- séparation encaisser / annuler, et la cohérence du statut dérivé.
--
-- L'unicité du numéro de reçu sous accès RÉELLEMENT concurrent se vérifie par
-- un second harnais, `concurrence_recus.sh`, qui ouvre plusieurs connexions :
-- une transaction unique ne peut pas se concurrencer elle-même. Ici on éprouve
-- ce qui est vérifiable en une session : numéros distincts d'un appel à
-- l'autre, et index d'unicité qui rend le doublon impossible de toute façon.
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
-- Alice proprietaire, Eve comptable (encaisse sans annuler), Dan personnel
-- administratif, Carol enseignante (aucun droit financier).
insert into auth.users (email, raw_user_meta_data) values
  ('alice@alpha.test', '{"given_name":"Alice","family_name":"Nkosi"}'),
  ('eve@alpha.test',   '{"given_name":"Eve","family_name":"Sy"}'),
  ('dan@alpha.test',   '{"given_name":"Dan","family_name":"Mensah"}'),
  ('carol@alpha.test', '{"given_name":"Carol","family_name":"Diallo"}');
insert into t select 'alice', id from auth.users where email='alice@alpha.test';
insert into t select 'eve',   id from auth.users where email='eve@alpha.test';
insert into t select 'dan',   id from auth.users where email='dan@alpha.test';
insert into t select 'carol', id from auth.users where email='carol@alpha.test';

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select val from t where cle='alice'))::text, true);
insert into t select 'org', public.creer_organisation('Groupe Alpha', 'SN', 'Africa/Dakar', 'XOF', 'fr');
reset role;

-- Deux etablissements : le second sert a eprouver l'isolation des recus.
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
       and code = case u.email
                    when 'eve@alpha.test'   then 'ACCOUNTANT'
                    when 'dan@alpha.test'   then 'STAFF'
                    else 'TEACHER' end) r
 where u.email in ('eve@alpha.test', 'dan@alpha.test', 'carol@alpha.test');

-- Eve et Dan sur le lycee seulement.
insert into public.establishment_users (membership_id, establishment_id)
select m.id, (select val from t where cle='lyc')
  from public.organization_memberships m
  join auth.users u on u.id = m.profile_id
 where u.email in ('eve@alpha.test', 'dan@alpha.test', 'carol@alpha.test');

insert into public.academic_years (organization_id, establishment_id, name, starts_on, ends_on, is_current)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        '2026-2027', date '2026-10-01', date '2027-07-10', true),
       ((select val from t where cle='org'), (select val from t where cle='anx'),
        '2026-2027', date '2026-10-01', date '2027-07-10', true);
insert into t select 'annee', id from public.academic_years
  where establishment_id = (select val from t where cle='lyc');
insert into t select 'annee_anx', id from public.academic_years
  where establishment_id = (select val from t where cle='anx');

insert into public.levels (organization_id, establishment_id, name, code, position)
values ((select val from t where cle='org'), (select val from t where cle='lyc'), 'Seconde', '2NDE', 1),
       ((select val from t where cle='org'), (select val from t where cle='anx'), 'Seconde', '2NDE', 1);
insert into t select 'niveau', id from public.levels
  where establishment_id = (select val from t where cle='lyc');

insert into public.classes (organization_id, establishment_id, academic_year_id, level_id, name, code)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        (select val from t where cle='annee'), (select val from t where cle='niveau'),
        'Seconde A', '2NDA');
insert into t select 'classeA', id from public.classes where code='2NDA';

set local role authenticated;
select set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);
select public.inscrire_apprenant((select val from t where cle='lyc'), (select val from t where cle='annee'),
  'Awa','Sow',(select val from t where cle='niveau'),(select val from t where cle='classeA'),
  null,null,'A1',null,null,'ACTIVE'::public.enrollment_status);
select public.inscrire_apprenant((select val from t where cle='lyc'), (select val from t where cle='annee'),
  'Moussa','Ba',(select val from t where cle='niveau'),(select val from t where cle='classeA'),
  null,null,'A2',null,null,'ACTIVE'::public.enrollment_status);
select public.inscrire_apprenant((select val from t where cle='anx'), (select val from t where cle='annee_anx'),
  'Pape','Niang',null,null,null,null,'N1',null,null,'ACTIVE'::public.enrollment_status);
reset role;

insert into t select 'insc1', e.id from public.enrollments e
  join public.learners l on l.id = e.learner_id where l.learner_code='A1';
insert into t select 'insc2', e.id from public.enrollments e
  join public.learners l on l.id = e.learner_id where l.learner_code='A2';
insert into t select 'insc_anx', e.id from public.enrollments e
  join public.learners l on l.id = e.learner_id where l.learner_code='N1';

-- Le lycee travaille en euros, l'annexe garde le franc CFA de l'organisation.
insert into public.establishment_settings (organization_id, establishment_id, key, value)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        'finance.currency', '"EUR"'::jsonb);

\o
\echo ''
\echo '1. Devise de l''etablissement, sans conversion'
\o /dev/null

do $$
begin
  perform pg_temp.verifier(
    ecoleplus.devise_etablissement((select val from t where cle='lyc')) = 'EUR',
    'Le lycee travaille en euros, par reglage d''etablissement');
  perform pg_temp.verifier(
    ecoleplus.devise_etablissement((select val from t where cle='anx')) = 'XOF',
    'L''annexe retombe sur la devise de l''organisation');
end $$;

\o
\echo ''
\echo '2. Unite mineure entiere : aucune perte d''arrondi'
\o /dev/null

-- 1 000,00 EUR en trois echeances. Le tiers ne tombe pas juste : c'est
-- exactement le cas ou un calcul en virgule flottante perdrait un centime.
insert into public.fee_structures
  (organization_id, establishment_id, academic_year_id, name, code, kind,
   amount_minor, currency)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        (select val from t where cle='annee'), 'Scolarite annuelle', 'SCOL',
        'TUITION', 100000, 'EUR');
insert into t select 'frais', id from public.fee_structures where code='SCOL';

insert into public.fee_installments
  (organization_id, fee_structure_id, label, due_on, share_minor, position)
values ((select val from t where cle='org'), (select val from t where cle='frais'),
        'Premier tiers', date '2026-10-15', 33334, 1),
       ((select val from t where cle='org'), (select val from t where cle='frais'),
        'Deuxieme tiers', date '2027-01-15', 33333, 2),
       ((select val from t where cle='org'), (select val from t where cle='frais'),
        'Troisieme tiers', date '2027-04-15', 33333, 3);

do $$
declare v_ecart bigint;
begin
  v_ecart := public.ecart_echeancier((select val from t where cle='frais'));
  perform pg_temp.verifier(v_ecart = 0,
    'Un tiers de 1 000,00 EUR ne tombe pas juste, et l''echeancier totalise exactement le montant');

  perform pg_temp.verifier(
    (select pg_typeof(amount_minor)::text from public.fee_structures
      where id = (select val from t where cle='frais')) = 'bigint',
    'Les montants sont des entiers, jamais des flottants');
end $$;

-- Un echeancier incomplet est refuse a l'affectation, pas plus tard.
insert into public.fee_structures
  (organization_id, establishment_id, academic_year_id, name, code, kind,
   amount_minor, currency)
values ((select val from t where cle='org'), (select val from t where cle='lyc'),
        (select val from t where cle='annee'), 'Transport', 'TRSP', 'TRANSPORT', 60000, 'EUR');
insert into t select 'frais_bancal', id from public.fee_structures where code='TRSP';
insert into public.fee_installments
  (organization_id, fee_structure_id, label, due_on, share_minor, position)
values ((select val from t where cle='org'), (select val from t where cle='frais_bancal'),
        'Acompte', date '2026-10-15', 20000, 1);

do $$
declare v_erreur text;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);
  begin
    perform public.affecter_frais((select val from t where cle='frais_bancal'),
                                  array[(select val from t where cle='insc1')]);
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_ECHEANCIER_INCOHERENT%',
    'Un echeancier dont les parts ne font pas le montant est refuse');
  execute 'reset role';
end $$;

\o
\echo ''
\echo '3. Affectation des frais et statut derive'
\o /dev/null

do $$
declare v_n integer; v_statuts text;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  v_n := public.affecter_frais((select val from t where cle='frais'),
           array[(select val from t where cle='insc1'), (select val from t where cle='insc2')]);
  perform pg_temp.verifier(v_n = 6,
    'Trois echeances pour deux apprenants : six creances');

  select string_agg(distinct o.status::text, ',') into v_statuts
    from public.fee_obligations o
   where o.enrollment_id = (select val from t where cle='insc1');
  perform pg_temp.verifier(v_statuts = 'UNPAID',
    'Sans paiement, toutes les creances sont impayees — statut derive des montants');

  execute 'reset role';
end $$;

-- Le statut est une colonne GENEREE : impossible de le contredire.
do $$
declare v_erreur text;
begin
  begin
    update public.fee_obligations set status = 'PAID'
     where enrollment_id = (select val from t where cle='insc1');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur <> 'aucune',
    'Le statut ne se saisit pas : c''est une colonne generee depuis les montants');
end $$;

\o
\echo ''
\echo '4. Paiement partiel, puis solde'
\o /dev/null

insert into t select 'oblig1', o.id from public.fee_obligations o
  where o.enrollment_id = (select val from t where cle='insc1')
    and o.due_on = date '2026-10-15';

do $$
declare v_recu uuid; v_regle bigint; v_statut public.obligation_status;
begin
  -- Eve est comptable : elle encaisse.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='eve')), true);

  -- 200,00 EUR sur une echeance de 333,34 EUR : paiement partiel.
  v_recu := public.encaisser_paiement(
    (select val from t where cle='insc1'), 20000, 'Especes', 'CAISSE-001',
    date '2026-10-16', null,
    jsonb_build_array(jsonb_build_object(
      'obligation_id', (select val from t where cle='oblig1'), 'amount_minor', 20000)));
  insert into t values ('recu1', v_recu);

  select paid_minor, status into v_regle, v_statut
    from public.fee_obligations where id = (select val from t where cle='oblig1');
  perform pg_temp.verifier(v_regle = 20000 and v_statut = 'PARTIAL',
    'Le paiement partiel se lit dans le solde, et le statut suit');

  -- Le reliquat exact.
  perform public.encaisser_paiement(
    (select val from t where cle='insc1'), 13334, 'Virement', 'VIR-002',
    date '2026-11-02', null,
    jsonb_build_array(jsonb_build_object(
      'obligation_id', (select val from t where cle='oblig1'), 'amount_minor', 13334)));

  select paid_minor, status into v_regle, v_statut
    from public.fee_obligations where id = (select val from t where cle='oblig1');
  perform pg_temp.verifier(v_regle = 33334 and v_statut = 'PAID',
    'Le solde se deduit des paiements : 200,00 puis 133,34 soldent les 333,34');

  execute 'reset role';
end $$;

\o
\echo ''
\echo '5. Le trop-percu est refuse'
\o /dev/null

do $$
declare v_erreur text; v_du bigint;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='eve')), true);

  -- Un centime de plus sur une creance deja soldee.
  begin
    perform public.encaisser_paiement(
      (select val from t where cle='insc1'), 1, 'Especes', null, null, null,
      jsonb_build_array(jsonb_build_object(
        'obligation_id', (select val from t where cle='oblig1'), 'amount_minor', 1)));
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_TROP_PERCU%',
    'Un centime au-dela du du est refuse');

  -- En repartition automatique, au-dela du total du de l'apprenant.
  select sum(o.total_minor - o.paid_minor) into v_du
    from public.fee_obligations o
   where o.enrollment_id = (select val from t where cle='insc1') and o.cancelled_at is null;

  begin
    perform public.encaisser_paiement(
      (select val from t where cle='insc1'), v_du + 100, 'Especes', null, null, null, null);
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_TROP_PERCU%',
    'Et en repartition automatique, rien ne deborde non plus');

  -- La repartition automatique, elle, fonctionne : elle solde les plus
  -- anciennes echeances d'abord.
  perform public.encaisser_paiement(
    (select val from t where cle='insc1'), 33333, 'Mobile money', 'MM-003', null, null, null);

  perform pg_temp.verifier(
    (select count(*) from public.fee_obligations o
      where o.enrollment_id = (select val from t where cle='insc1') and o.status = 'PAID') = 2,
    'La repartition automatique solde la plus ancienne echeance restante');

  execute 'reset role';
end $$;

\o
\echo ''
\echo '6. Encaisser et annuler sont deux droits'
\o /dev/null

do $$
declare v_erreur text; v_n integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='eve')), true);

  begin
    perform public.annuler_recu((select val from t where cle='recu1'), 'erreur de caisse');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%finance.void%',
    'La comptable encaisse mais n''annule pas son propre recu');

  execute 'reset role';

  -- Carol est enseignante : elle ne voit meme pas les creances.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='carol')), true);
  select count(*) into v_n from public.fee_obligations;
  perform pg_temp.verifier(v_n = 0,
    'L''enseignante ne voit aucune creance : la situation d''une famille ne circule pas');
  select count(*) into v_n from public.receipts;
  perform pg_temp.verifier(v_n = 0, 'Ni aucun recu');
  execute 'reset role';

  -- Dan, personnel administratif, encaisse au comptoir mais n'annule pas.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='dan')), true);
  select count(*) into v_n from public.receipts;
  perform pg_temp.verifier(v_n > 0, 'Le personnel administratif voit les recus');
  begin
    perform public.annuler_recu((select val from t where cle='recu1'), 'erreur de caisse');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%finance.void%', 'Mais il n''annule pas davantage');
  execute 'reset role';
end $$;

\o
\echo ''
\echo '7. Un recu s''annule, il ne se supprime pas'
\o /dev/null

do $$
declare v_erreur text; v_regle bigint; v_n integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  begin
    perform public.annuler_recu((select val from t where cle='recu1'), '   ');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_MOTIF_REQUIS%',
    'Une annulation sans motif est refusee : ce serait un effacement');

  perform public.annuler_recu((select val from t where cle='recu1'),
    'Encaissement enregistre deux fois par erreur');

  select paid_minor into v_regle
    from public.fee_obligations where id = (select val from t where cle='oblig1');
  perform pg_temp.verifier(v_regle = 13334,
    'L''annulation rend son solde a la creance, sans rien effacer');

  select count(*) into v_n from public.receipts
   where id = (select val from t where cle='recu1') and voided_at is not null;
  perform pg_temp.verifier(v_n = 1, 'Le recu existe toujours, annule et date');

  select count(*) into v_n from public.audit_logs
   where action = 'finance.receipt_voided'
     and reason = 'Encaissement enregistre deux fois par erreur';
  perform pg_temp.verifier(v_n = 1, 'L''annulation est journalisee avec son motif');

  execute 'reset role';
end $$;

do $$
declare v_erreur text;
begin
  -- Meme en superutilisateur.
  begin
    delete from public.receipts where id = (select val from t where cle='recu1');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_RECU_INDESTRUCTIBLE%',
    'Un recu ne se supprime pas, meme en superutilisateur');

  begin
    delete from public.payments where id = (
      select payment_id from public.receipts where id = (select val from t where cle='recu1'));
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_RECU_INDESTRUCTIBLE%',
    'Le paiement qu''il porte non plus');
end $$;

\o
\echo ''
\echo '8. Numerotation des recus'
\o /dev/null

do $$
declare v_numeros text[]; v_n integer;
begin
  select array_agg(r.number order by r.number) into v_numeros
    from public.receipts r where r.establishment_id = (select val from t where cle='lyc');

  perform pg_temp.verifier(array_length(v_numeros, 1) = 3,
    'Trois encaissements, trois recus');
  perform pg_temp.verifier(
    array_length(v_numeros, 1) = (select count(distinct x) from unnest(v_numeros) x),
    'Les numeros sont tous distincts');
  perform pg_temp.verifier(v_numeros[1] like 'LYC-20%',
    'Le numero porte le code de l''etablissement et l''annee');

  -- L'index d'unicite rend le doublon impossible, quelle que soit la voie.
  select count(*) into v_n from pg_indexes
   where schemaname = 'public' and indexname = 'receipts_numero_unique';
  perform pg_temp.verifier(v_n = 1,
    'Et un index d''unicite (etablissement, numero) ferme la porte au doublon');
end $$;

\o
\echo ''
\echo '9. Isolation entre etablissements'
\o /dev/null

-- Un frais et un encaissement sur l'annexe, ou Eve n'a pas acces.
insert into public.fee_structures
  (organization_id, establishment_id, academic_year_id, name, code, kind,
   amount_minor, currency)
values ((select val from t where cle='org'), (select val from t where cle='anx'),
        (select val from t where cle='annee_anx'), 'Inscription', 'INSC',
        'REGISTRATION', 25000, 'XOF');
insert into t select 'frais_anx', id from public.fee_structures where code='INSC';

do $$
declare v_recu uuid; v_n integer; v_erreur text;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  perform public.affecter_frais((select val from t where cle='frais_anx'),
                                array[(select val from t where cle='insc_anx')]);
  v_recu := public.encaisser_paiement(
    (select val from t where cle='insc_anx'), 25000, 'Especes', null, null, null, null);
  insert into t values ('recu_anx', v_recu);

  perform pg_temp.verifier(
    (select currency from public.payments p
      join public.receipts r on r.payment_id = p.id where r.id = v_recu) = 'XOF',
    'L''encaissement de l''annexe se fait en francs CFA, sans conversion');

  execute 'reset role';

  -- Eve n'a acces qu'au lycee.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='eve')), true);

  select count(*) into v_n from public.receipts
   where id = (select val from t where cle='recu_anx');
  perform pg_temp.verifier(v_n = 0,
    'Le recu d''un autre etablissement est invisible');

  begin
    perform public.annuler_recu((select val from t where cle='recu_anx'), 'tentative');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur <> 'aucune',
    'Et inaccessible a l''annulation, meme en connaissant son identifiant');

  select count(*) into v_n from public.fee_obligations
   where establishment_id = (select val from t where cle='anx');
  perform pg_temp.verifier(v_n = 0, 'Ses creances non plus');

  execute 'reset role';
end $$;

\o
\echo ''
\echo '10. Devise discordante, creance reglee, ajustements'
\o /dev/null

do $$
declare v_erreur text; v_paiement uuid; v_oblig uuid;
begin
  -- Affecter un paiement en EUR a une creance en XOF : refuse, pas converti.
  select id into v_oblig from public.fee_obligations
   where establishment_id = (select val from t where cle='anx') limit 1;
  select p.id into v_paiement from public.payments p
   where p.establishment_id = (select val from t where cle='lyc') limit 1;

  begin
    insert into public.payment_allocations
      (organization_id, payment_id, obligation_id, amount_minor)
    values ((select val from t where cle='org'), v_paiement, v_oblig, 100);
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_DEVISE_DISCORDANTE%'
                        or v_erreur like '%ECOLEPLUS_TROP_PERCU%',
    'Un paiement en euros n''alimente pas une creance en francs CFA');
end $$;

do $$
declare v_erreur text; v_oblig uuid; v_total bigint;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='alice')), true);

  select id into v_oblig from public.fee_obligations
   where enrollment_id = (select val from t where cle='insc1') and status = 'PAID' limit 1;

  begin
    perform public.annuler_creance(v_oblig, 'erreur d''affectation');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_CREANCE_REGLEE%',
    'Une creance deja reglee ne s''annule pas : il faut d''abord annuler les recus');

  -- Remise sur une creance encore impayee.
  select id into v_oblig from public.fee_obligations
   where enrollment_id = (select val from t where cle='insc2') limit 1;
  perform public.ajuster_creance(v_oblig, 3334, 0, 'Bourse partielle accordee');

  select total_minor into v_total from public.fee_obligations where id = v_oblig;
  perform pg_temp.verifier(v_total = 30000,
    'La remise se repercute sur le total du, en unite mineure entiere');

  begin
    perform public.ajuster_creance(v_oblig, 0, 0, '   ');
    v_erreur := 'aucune';
  exception when others then v_erreur := sqlerrm; end;
  perform pg_temp.verifier(v_erreur like '%ECOLEPLUS_MOTIF_REQUIS%',
    'Une remise sans motif est refusee');

  execute 'reset role';
end $$;

\o
\echo ''
\echo '11. Situation financiere'
\o /dev/null

do $$
declare v_du bigint; v_regle bigint; v_solde bigint;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', pg_temp.claims_de((select val from t where cle='eve')), true);

  select s.du_minor, s.regle_minor, s.solde_minor into v_du, v_regle, v_solde
    from public.situation_financiere((select val from t where cle='insc1')) s;

  perform pg_temp.verifier(v_du = 100000,
    'Le du total reste le montant de la scolarite : 1 000,00 EUR');
  perform pg_temp.verifier(v_solde = v_du - v_regle,
    'Le solde est exactement la difference — il ne se stocke nulle part');

  execute 'reset role';
end $$;

\o
rollback;
\echo ''
\echo 'Suite terminee.'
