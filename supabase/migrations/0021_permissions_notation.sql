-- =============================================================================
-- 0021 — Permissions du moteur de notation
-- =============================================================================
-- Sept droits, et leur découpage est le cycle de vie d'une note :
--
--   grades.read      — consulter évaluations, notes et moyennes
--   grades.manage    — créer et cadrer une évaluation (date, coefficient, barème)
--   grades.enter     — saisir les notes
--   grades.verify    — vérifier avant publication
--   grades.publish   — publier : remettre la note à la famille
--   grades.correct   — modifier une note publiée, ou l'invalider
--   grades.configure — barèmes, tranches, catégories, coefficients de matière
--
-- L'enseignant saisit et vérifie sa propre saisie. Il ne PUBLIE pas et ne
-- CORRIGE pas après publication : publier engage l'établissement vis-à-vis de
-- la famille, et pouvoir réécrire sa propre note publiée viderait le
-- verrouillage de son sens.
-- =============================================================================

insert into public.permissions (key, module, description) values
  ('grades.read',      'grades', 'Consulter les évaluations, les notes et les moyennes'),
  ('grades.manage',    'grades', 'Créer et cadrer une évaluation'),
  ('grades.enter',     'grades', 'Saisir les notes d''une évaluation'),
  ('grades.verify',    'grades', 'Vérifier une saisie avant publication'),
  ('grades.publish',   'grades', 'Publier les notes d''une évaluation'),
  ('grades.correct',   'grades', 'Corriger ou invalider une note publiée'),
  ('grades.configure', 'grades', 'Définir les barèmes, catégories et coefficients')
on conflict (key) do update
  set module = excluded.module, description = excluded.description;

delete from public.role_permissions rp
 using public.roles r, public.permissions p
 where r.id = rp.role_id and r.is_system
   and p.key = rp.permission_key and p.module = 'grades';

with attributions (role_code, permission_key) as (
  values
    ('OWNER', 'grades.read'),    ('OWNER', 'grades.manage'),
    ('OWNER', 'grades.enter'),   ('OWNER', 'grades.verify'),
    ('OWNER', 'grades.publish'), ('OWNER', 'grades.correct'),
    ('OWNER', 'grades.configure'),

    ('SUPER_ADMIN', 'grades.read'),    ('SUPER_ADMIN', 'grades.manage'),
    ('SUPER_ADMIN', 'grades.enter'),   ('SUPER_ADMIN', 'grades.verify'),
    ('SUPER_ADMIN', 'grades.publish'), ('SUPER_ADMIN', 'grades.correct'),
    ('SUPER_ADMIN', 'grades.configure'),

    ('ESTABLISHMENT_ADMIN', 'grades.read'),    ('ESTABLISHMENT_ADMIN', 'grades.manage'),
    ('ESTABLISHMENT_ADMIN', 'grades.enter'),   ('ESTABLISHMENT_ADMIN', 'grades.verify'),
    ('ESTABLISHMENT_ADMIN', 'grades.publish'), ('ESTABLISHMENT_ADMIN', 'grades.correct'),
    ('ESTABLISHMENT_ADMIN', 'grades.configure'),

    -- Le directeur mène la chaîne jusqu'à la publication, sans redéfinir le
    -- référentiel de notation de l'établissement.
    ('DIRECTOR', 'grades.read'),    ('DIRECTOR', 'grades.manage'),
    ('DIRECTOR', 'grades.enter'),   ('DIRECTOR', 'grades.verify'),
    ('DIRECTOR', 'grades.publish'), ('DIRECTOR', 'grades.correct'),

    -- L'enseignant, dans SES matières et SES classes.
    ('TEACHER', 'grades.read'),  ('TEACHER', 'grades.manage'),
    ('TEACHER', 'grades.enter'), ('TEACHER', 'grades.verify'),

    -- Le personnel administratif consulte : il édite les bulletins, il ne note pas.
    ('STAFF', 'grades.read')
)
insert into public.role_permissions (role_id, permission_key)
select r.id, a.permission_key
  from attributions a
  join public.roles r on r.code = a.role_code and r.organization_id is null
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Jeux d'exemple
-- -----------------------------------------------------------------------------
-- Deux barèmes posés à la création d'une organisation, et AUCUN des deux n'est
-- traité comme la norme : le /20 français et les niveaux de maîtrise coexistent,
-- désactivés par défaut. L'établissement choisit, renomme ou en crée d'autres.

create or replace function ecoleplus.creer_baremes_exemple(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_numerique uuid;
  v_maitrise  uuid;
begin
  insert into public.grading_systems
    (organization_id, name, code, type, min_value, max_value, unit,
     pass_threshold, rounding_mode, decimals, status)
  values
    (p_org_id, 'Note sur 20', 'NUM20', 'NUMERIC', 0, 20, 'points', 10, 'ROUND', 2, 'DRAFT')
  returning id into v_numerique;

  insert into public.grading_scales
    (organization_id, grading_system_id, label, min_score, max_score, position, is_passing)
  values
    (p_org_id, v_numerique, 'Insuffisant',   0,  9.99, 1, false),
    (p_org_id, v_numerique, 'Passable',     10, 11.99, 2, true),
    (p_org_id, v_numerique, 'Assez bien',   12, 13.99, 3, true),
    (p_org_id, v_numerique, 'Bien',         14, 15.99, 4, true),
    (p_org_id, v_numerique, 'Très bien',    16, 20,    5, true);

  insert into public.grading_systems
    (organization_id, name, code, type, min_value, max_value,
     rounding_mode, decimals, status, allows_averaging)
  values
    (p_org_id, 'Niveaux de maîtrise', 'MAITRISE', 'MASTERY', 0, 3,
     'ROUND', 0, 'DRAFT', false)
  returning id into v_maitrise;

  insert into public.grading_scales
    (organization_id, grading_system_id, label, min_score, max_score, position, is_passing)
  values
    (p_org_id, v_maitrise, 'Non acquis',              0, 0, 1, false),
    (p_org_id, v_maitrise, 'En cours d''acquisition', 1, 1, 2, false),
    (p_org_id, v_maitrise, 'Acquis',                  2, 2, 3, true),
    (p_org_id, v_maitrise, 'Maîtrise assurée',        3, 3, 4, true);

  insert into public.grading_categories
    (organization_id, name, code, weight, position)
  values
    (p_org_id, 'Contrôle continu', 'CC',     1, 1),
    (p_org_id, 'Devoir surveillé', 'DS',     2, 2),
    (p_org_id, 'Examen',           'EXAMEN', 3, 3);
end;
$$;

create or replace function ecoleplus.declencher_baremes_exemple()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform ecoleplus.creer_baremes_exemple(new.id);
  return new;
end;
$$;

create trigger organizations_creer_baremes_exemple
  after insert on public.organizations
  for each row execute function ecoleplus.declencher_baremes_exemple();

-- Rattrapage pour les organisations créées avant cette migration : le
-- déclencheur ne se serait jamais exécuté pour elles.
do $$
declare v_org record;
begin
  for v_org in
    select o.id from public.organizations o
     where not exists (select 1 from public.grading_systems gs
                        where gs.organization_id = o.id)
  loop
    perform ecoleplus.creer_baremes_exemple(v_org.id);
  end loop;
end;
$$;
