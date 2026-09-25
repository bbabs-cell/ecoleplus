-- =============================================================================
-- Départ en production — suppression des données et des comptes de démonstration
-- =============================================================================
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/operations/depart_production.sql
--
-- Ce script supprime définitivement l'organisation de démonstration et les deux
-- comptes qui l'accompagnent. Il n'existe volontairement aucune fonctionnalité
-- équivalente dans l'application : la règle 5 de @CLAUDE.md interdit la
-- suppression définitive de données importantes sans procédure explicite.
-- Celle-ci EST la procédure explicite.
--
-- Il refuse de s'exécuter tant que l'instance n'a pas d'autre propriétaire
-- capable de se connecter. C'est le seul garde-fou qui compte : supprimer le
-- propriétaire avant d'en avoir un autre ferme l'instance à tout le monde,
-- définitivement.
--
-- Tout se passe dans UNE transaction. Au moindre refus, rien n'est supprimé.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- -----------------------------------------------------------------------------
-- Ce qui va disparaître
-- -----------------------------------------------------------------------------
create temp table cible_comptes (email text primary key);
insert into cible_comptes values ('demo@ecoleplus.test'), ('prof@ecoleplus.test');

create temp table cible_org as
select o.id, o.name
  from public.organizations o
 where o.id = (
   select m.organization_id
     from public.organization_memberships m
     join auth.users u on u.id = m.profile_id
     join public.roles r on r.id = m.role_id
    where u.email = 'demo@ecoleplus.test' and r.code = 'OWNER'
 );

-- -----------------------------------------------------------------------------
-- Garde-fou 1 — il reste un propriétaire, hors comptes de démonstration
-- -----------------------------------------------------------------------------
do $$
declare v_survivant record;
begin
  select u.email, o.name as organisation, u.email_confirmed_at is not null as confirme
    into v_survivant
    from public.organization_memberships m
    join auth.users u on u.id = m.profile_id
    join public.roles r on r.id = m.role_id
    join public.organizations o on o.id = m.organization_id
   where r.code = 'OWNER'
     and m.status = 'ACTIVE'
     and u.email not in (select email from cible_comptes)
     and m.organization_id is distinct from (select id from cible_org)
   limit 1;

  if v_survivant is null then
    raise exception
      'REFUS : aucun propriétaire ne survivrait à cette suppression. '
      'Créez votre organisation réelle avec votre compte avant de relancer.';
  end if;

  -- Un compte dont l'adresse n'est pas confirmée ne peut pas se connecter si la
  -- confirmation est exigée : le laisser seul propriétaire revient à fermer la
  -- porte et à jeter la clé.
  if not v_survivant.confirme then
    raise exception
      'REFUS : le propriétaire survivant (%) n''a pas d''adresse confirmée. '
      'Confirmez-la avant de relancer.', v_survivant.email;
  end if;

  raise notice 'Propriétaire survivant : % — organisation « % »',
    v_survivant.email, v_survivant.organisation;
end $$;

-- -----------------------------------------------------------------------------
-- Garde-fou 2 — on ne supprime que ce qui est nommé ici
-- -----------------------------------------------------------------------------
do $$
declare v_org record; v_comptes integer;
begin
  select * into v_org from cible_org;
  if v_org is null then
    raise notice 'Aucune organisation de démonstration : rien à supprimer de ce côté.';
  else
    raise notice 'Organisation supprimée : « % » (%)', v_org.name, v_org.id;
    raise notice '  apprenants : %, notes : %, paiements : %, reçus : %',
      (select count(*) from public.learners where organization_id = v_org.id),
      (select count(*) from public.assessment_results ar
         join public.assessments a on a.id = ar.assessment_id
        where a.organization_id = v_org.id),
      (select count(*) from public.payments where organization_id = v_org.id),
      (select count(*) from public.receipts where organization_id = v_org.id);
  end if;

  select count(*) into v_comptes from auth.users u
   where u.email in (select email from cible_comptes);
  raise notice 'Comptes supprimés : %', v_comptes;
end $$;

-- -----------------------------------------------------------------------------
-- Suppression
-- -----------------------------------------------------------------------------
-- L'organisation emporte en cascade établissements, apprenants, classes, notes,
-- présences, frais, paiements et reçus. `audit_logs` est en SET NULL : les
-- lignes d'audit survivent, sans organisation. L'audit ne se purge jamais.
delete from public.organizations where id in (select id from cible_org);

-- Les comptes emportent profils, appartenances et sessions. Les colonnes de
-- traçabilité (qui a saisi, qui a encaissé, qui a annulé) passent à NULL : sans
-- conséquence ici puisque les données qu'elles signaient viennent de partir.
delete from auth.users where email in (select email from cible_comptes);

-- -----------------------------------------------------------------------------
-- Constat final
-- -----------------------------------------------------------------------------
do $$
declare v_restants integer;
begin
  select count(*) into v_restants from auth.users
   where email in (select email from cible_comptes);
  if v_restants <> 0 then
    raise exception 'REFUS : % compte(s) de démonstration subsistent.', v_restants;
  end if;
  raise notice 'Terminé. Vérifiez la liste ci-dessous avant de valider.';
end $$;

select u.email, o.name as organisation, r.code as role
  from auth.users u
  left join public.organization_memberships m on m.profile_id = u.id
  left join public.organizations o on o.id = m.organization_id
  left join public.roles r on r.id = m.role_id
 order by u.created_at;

-- Remplacez par COMMIT une fois la liste ci-dessus vérifiée.
rollback;
