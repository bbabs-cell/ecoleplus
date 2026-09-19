-- =============================================================================
-- 0012 — RLS sur le domaine académique
-- =============================================================================
-- Même doctrine qu'en phase 1 : RLS partout, refus par défaut, et une policy
-- DELETE seulement là où supprimer est légitime.
--
-- Pas de suppression possible sur les années, les niveaux, les classes, les
-- enseignants, les apprenants et les inscriptions : ces données portent — ou
-- porteront — des présences, des notes et des paiements (CLAUDE.md, règle 5).
-- On les désactive, on les archive, on change leur statut. Les tables
-- réellement jetables (périodes, matières, groupes, affectations) gardent leur
-- policy DELETE.
-- =============================================================================

alter table public.academic_years      enable row level security;
alter table public.academic_terms      enable row level security;
alter table public.levels              enable row level security;
alter table public.subjects            enable row level security;
alter table public.teachers            enable row level security;
alter table public.learners            enable row level security;
alter table public.enrollments         enable row level security;
alter table public.classes             enable row level security;
alter table public.groups              enable row level security;
alter table public.group_members       enable row level security;
alter table public.teaching_assignments enable row level security;

revoke all on
  public.academic_years, public.academic_terms, public.levels, public.subjects,
  public.teachers, public.learners, public.enrollments, public.classes,
  public.groups, public.group_members, public.teaching_assignments
from anon, authenticated;

grant select, insert, update on
  public.academic_years, public.teachers, public.learners,
  public.enrollments, public.classes
to authenticated;

grant select, insert, update, delete on
  public.academic_terms, public.subjects, public.groups,
  public.group_members, public.teaching_assignments
to authenticated;

grant select, insert, update on public.levels to authenticated;

-- -----------------------------------------------------------------------------
-- Portée des apprenants
-- -----------------------------------------------------------------------------
-- `learners` n'a pas d'`establishment_id` : un apprenant appartient à
-- l'organisation, et c'est son inscription qui le rattache à un établissement.
-- Un rôle de portée ESTABLISHMENT ne doit donc voir que les apprenants inscrits
-- chez lui — ce que cette fonction établit en consultant les inscriptions.
--
-- SECURITY DEFINER pour ne pas repasser par les policies d'`enrollments`, ce
-- qui provoquerait une récursion.
--
-- Conséquence assumée : un apprenant sans aucune inscription est invisible aux
-- rôles établissement. C'est pourquoi la création passe par
-- `public.inscrire_apprenant` (migration 0013), qui crée l'apprenant ET son
-- inscription dans la même transaction. Aucun dossier orphelin n'est produit
-- par l'application.

create or replace function ecoleplus.apprenant_dans_ma_portee(p_learner_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when coalesce(ecoleplus.current_role_scope(), '') <> 'ESTABLISHMENT' then true
    else exists (
      select 1
        from public.enrollments e
       where e.learner_id = p_learner_id
         and ecoleplus.can_access_establishment(e.establishment_id)
    )
  end;
$$;

grant execute on function ecoleplus.apprenant_dans_ma_portee(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Référentiel académique
-- -----------------------------------------------------------------------------

create policy academic_years_select on public.academic_years
  for select to authenticated
  using (ecoleplus.can_read(organization_id, 'academic.read', establishment_id));

create policy academic_years_insert on public.academic_years
  for insert to authenticated
  with check (ecoleplus.can_write(organization_id, 'academic.manage', establishment_id));

create policy academic_years_update on public.academic_years
  for update to authenticated
  using (ecoleplus.can_write(organization_id, 'academic.manage', establishment_id))
  with check (ecoleplus.can_write(organization_id, 'academic.manage', establishment_id));

-- Les périodes héritent de la portée de leur année : la jointure est nécessaire
-- car `academic_terms` ne porte pas d'`establishment_id`.
create policy academic_terms_select on public.academic_terms
  for select to authenticated
  using (exists (
    select 1 from public.academic_years a
     where a.id = academic_terms.academic_year_id
       and ecoleplus.can_read(a.organization_id, 'academic.read', a.establishment_id)
  ));

create policy academic_terms_ecriture on public.academic_terms
  for all to authenticated
  using (exists (
    select 1 from public.academic_years a
     where a.id = academic_terms.academic_year_id
       and ecoleplus.can_write(a.organization_id, 'academic.manage', a.establishment_id)
  ))
  with check (exists (
    select 1 from public.academic_years a
     where a.id = academic_terms.academic_year_id
       and ecoleplus.can_write(a.organization_id, 'academic.manage', a.establishment_id)
  ));

create policy levels_select on public.levels
  for select to authenticated
  using (ecoleplus.can_read(organization_id, 'academic.read', establishment_id));

create policy levels_insert on public.levels
  for insert to authenticated
  with check (ecoleplus.can_write(organization_id, 'academic.manage', establishment_id));

create policy levels_update on public.levels
  for update to authenticated
  using (ecoleplus.can_write(organization_id, 'academic.manage', establishment_id))
  with check (ecoleplus.can_write(organization_id, 'academic.manage', establishment_id));

create policy subjects_select on public.subjects
  for select to authenticated
  using (ecoleplus.can_read(organization_id, 'academic.read', establishment_id));

create policy subjects_ecriture on public.subjects
  for all to authenticated
  using (ecoleplus.can_write(organization_id, 'academic.manage', establishment_id))
  with check (ecoleplus.can_write(organization_id, 'academic.manage', establishment_id));

-- -----------------------------------------------------------------------------
-- Enseignants
-- -----------------------------------------------------------------------------

create policy teachers_select on public.teachers
  for select to authenticated
  using (ecoleplus.can_read(organization_id, 'teachers.read', establishment_id));

create policy teachers_insert on public.teachers
  for insert to authenticated
  with check (ecoleplus.can_write(organization_id, 'teachers.manage', establishment_id));

create policy teachers_update on public.teachers
  for update to authenticated
  using (ecoleplus.can_write(organization_id, 'teachers.manage', establishment_id))
  with check (ecoleplus.can_write(organization_id, 'teachers.manage', establishment_id));

-- -----------------------------------------------------------------------------
-- Apprenants et inscriptions
-- -----------------------------------------------------------------------------

create policy learners_select on public.learners
  for select to authenticated
  using (
    ecoleplus.can_read(organization_id, 'learners.read')
    and ecoleplus.apprenant_dans_ma_portee(id)
  );

create policy learners_insert on public.learners
  for insert to authenticated
  with check (ecoleplus.can_write(organization_id, 'learners.manage'));

create policy learners_update on public.learners
  for update to authenticated
  using (
    ecoleplus.can_write(organization_id, 'learners.manage')
    and ecoleplus.apprenant_dans_ma_portee(id)
  )
  with check (ecoleplus.can_write(organization_id, 'learners.manage'));

create policy enrollments_select on public.enrollments
  for select to authenticated
  using (ecoleplus.can_read(organization_id, 'learners.read', establishment_id));

create policy enrollments_insert on public.enrollments
  for insert to authenticated
  with check (ecoleplus.can_write(organization_id, 'enrollments.manage', establishment_id));

create policy enrollments_update on public.enrollments
  for update to authenticated
  using (ecoleplus.can_write(organization_id, 'enrollments.manage', establishment_id))
  with check (ecoleplus.can_write(organization_id, 'enrollments.manage', establishment_id));

-- -----------------------------------------------------------------------------
-- Classes, groupes, affectations
-- -----------------------------------------------------------------------------

create policy classes_select on public.classes
  for select to authenticated
  using (ecoleplus.can_read(organization_id, 'classes.read', establishment_id));

create policy classes_insert on public.classes
  for insert to authenticated
  with check (ecoleplus.can_write(organization_id, 'classes.manage', establishment_id));

create policy classes_update on public.classes
  for update to authenticated
  using (ecoleplus.can_write(organization_id, 'classes.manage', establishment_id))
  with check (ecoleplus.can_write(organization_id, 'classes.manage', establishment_id));

create policy groups_select on public.groups
  for select to authenticated
  using (ecoleplus.can_read(organization_id, 'classes.read', establishment_id));

create policy groups_ecriture on public.groups
  for all to authenticated
  using (ecoleplus.can_write(organization_id, 'classes.manage', establishment_id))
  with check (ecoleplus.can_write(organization_id, 'classes.manage', establishment_id));

create policy group_members_select on public.group_members
  for select to authenticated
  using (exists (
    select 1 from public.groups g
     where g.id = group_members.group_id
       and ecoleplus.can_read(g.organization_id, 'classes.read', g.establishment_id)
  ));

create policy group_members_ecriture on public.group_members
  for all to authenticated
  using (exists (
    select 1 from public.groups g
     where g.id = group_members.group_id
       and ecoleplus.can_write(g.organization_id, 'classes.manage', g.establishment_id)
  ))
  with check (exists (
    select 1 from public.groups g
     where g.id = group_members.group_id
       and ecoleplus.can_write(g.organization_id, 'classes.manage', g.establishment_id)
  ));

create policy teaching_assignments_select on public.teaching_assignments
  for select to authenticated
  using (ecoleplus.can_read(organization_id, 'classes.read', establishment_id));

create policy teaching_assignments_ecriture on public.teaching_assignments
  for all to authenticated
  using (ecoleplus.can_write(organization_id, 'classes.manage', establishment_id))
  with check (ecoleplus.can_write(organization_id, 'classes.manage', establishment_id));
