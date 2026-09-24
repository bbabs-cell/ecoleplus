-- =============================================================================
-- 0024 — Résolution du barème d'une classe
-- =============================================================================
-- Une classe sans barème ne produisait aucune moyenne : `denormaliser` rendait
-- null, et le bulletin affichait « non calculable » sans dire pourquoi.
--
-- La résolution suit désormais une cascade explicite :
--
--   1. le barème posé sur la matière dans cette classe (`class_subjects`)
--   2. le barème de la classe
--   3. le barème par défaut de l'ÉTABLISSEMENT
--   4. le barème par défaut de l'ORGANISATION
--
-- Aucun barème n'est semé comme défaut à la création d'une organisation : ce
-- serait désigner une norme, précisément ce que @CLAUDE.md règle 2 interdit.
-- Les deux exemples fournis (sur 20, niveaux de maîtrise) restent des
-- propositions que l'établissement retient, renomme ou ignore.
-- =============================================================================

create or replace function ecoleplus.bareme_de_classe(p_class_id uuid)
returns uuid
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(
    c.grading_system_id,
    (select gs.id from public.grading_systems gs
      where gs.establishment_id = c.establishment_id and gs.is_default
      limit 1),
    (select gs.id from public.grading_systems gs
      where gs.organization_id = c.organization_id
        and gs.establishment_id is null and gs.is_default
      limit 1)
  )
  from public.classes c
  where c.id = p_class_id;
$$;

grant execute on function ecoleplus.bareme_de_classe(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Les deux fonctions de moyenne reprennent la cascade
-- -----------------------------------------------------------------------------

create or replace function public.moyennes_matiere(
  p_enrollment_id uuid,
  p_term_id       uuid default null
)
returns table (
  subject_id     uuid,
  subject_name   text,
  coefficient    numeric,
  notes_prises   integer,
  notes_ignorees integer,
  ratio          numeric,
  valeur         numeric,
  bareme_id      uuid,
  mention        text
)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_inscription public.enrollments;
  v_bareme_classe uuid;
begin
  select * into v_inscription from public.enrollments where id = p_enrollment_id;

  if v_inscription.id is null
     or not ecoleplus.can_read(v_inscription.organization_id, 'grades.read',
                               v_inscription.establishment_id) then
    raise exception 'ECOLEPLUS_INSCRIPTION_INTROUVABLE: inscription hors de votre périmètre'
      using errcode = 'no_data_found';
  end if;

  v_bareme_classe := ecoleplus.bareme_de_classe(v_inscription.class_id);

  return query
  with notes as (
    select
      a.subject_id,
      a.coefficient * coalesce(gc.weight, 1) as poids,
      case
        -- La note est là.
        when r.kind = 'SCORE' and r.status <> 'CANCELLED' then r.normalized_value
        -- Dispense, sans objet, note annulée : hors calcul, toujours.
        when r.kind in ('EXEMPT', 'NOT_APPLICABLE') then null
        when r.status = 'CANCELLED' then null
        -- Absence, absence justifiée, ligne vide, ou aucune ligne : c'est la
        -- politique de l'évaluation qui tranche, et elle seule.
        when a.missing_grade_policy = 'ZERO' then 0
        else null
      end as valeur,
      (r.kind = 'SCORE' and r.status <> 'CANCELLED') as saisie
      from public.assessments a
      join public.classes c on c.id = a.class_id
      join public.grading_systems gs on gs.id = a.grading_system_id
      left join public.grading_categories gc on gc.id = a.category_id
      left join public.assessment_results r
             on r.assessment_id = a.id and r.enrollment_id = p_enrollment_id
     where c.id = v_inscription.class_id
       and a.status <> 'CANCELLED'
       and gs.allows_averaging
       and (p_term_id is null or a.academic_term_id = p_term_id)
  ),
  agregat as (
    select n.subject_id,
           sum(n.valeur * n.poids) filter (where n.valeur is not null) as somme,
           sum(n.poids)            filter (where n.valeur is not null) as poids_total,
           count(*) filter (where n.saisie)::integer                   as prises,
           count(*) filter (where n.valeur is null)::integer           as ignorees,
           -- Dernier recours : le barème effectivement utilisé pour noter cette
           -- matière. Une moyenne existe toujours sur l'échelle où elle a été
           -- construite, même si la classe n'a pas de barème déclaré.
           min(a2.grading_system_id::text)::uuid                       as bareme_evaluations
      from notes n
      left join public.assessments a2
             on a2.subject_id = n.subject_id and a2.class_id = v_inscription.class_id
     group by n.subject_id
  )
  select
    s.id,
    s.name,
    coalesce(cs.coefficient, 1)::numeric,
    ag.prises,
    ag.ignorees,
    case when ag.poids_total > 0 then ag.somme / ag.poids_total end,
    ecoleplus.denormaliser(
      case when ag.poids_total > 0 then ag.somme / ag.poids_total end,
      coalesce(cs.grading_system_id, v_bareme_classe, ag.bareme_evaluations)),
    coalesce(cs.grading_system_id, v_bareme_classe, ag.bareme_evaluations),
    public.libelle_tranche(
      case when ag.poids_total > 0 then ag.somme / ag.poids_total end,
      coalesce(cs.grading_system_id, v_bareme_classe, ag.bareme_evaluations))
    from agregat ag
    join public.subjects s on s.id = ag.subject_id
    left join public.class_subjects cs
           on cs.class_id = v_inscription.class_id and cs.subject_id = ag.subject_id
   order by s.name;
end;
$$;

create or replace function public.moyenne_generale(
  p_enrollment_id uuid,
  p_term_id       uuid default null
)
returns table (
  ratio     numeric,
  valeur    numeric,
  matieres  integer,
  bareme_id uuid,
  mention   text
)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_bareme uuid;
begin
  select ecoleplus.bareme_de_classe(e.class_id) into v_bareme
    from public.enrollments e where e.id = p_enrollment_id;

  return query
  with m as (
    select * from public.moyennes_matiere(p_enrollment_id, p_term_id)
     where moyennes_matiere.ratio is not null
  ),
  g as (
    select case when sum(m.coefficient) > 0
                then sum(m.ratio * m.coefficient) / sum(m.coefficient) end as r,
           count(*)::integer as n,
           -- À défaut de barème de classe, celui des matières notées.
           min(m.bareme_id::text)::uuid as b
      from m
  )
  select g.r,
         ecoleplus.denormaliser(g.r, coalesce(v_bareme, g.b)),
         g.n,
         coalesce(v_bareme, g.b),
         public.libelle_tranche(g.r, coalesce(v_bareme, g.b))
    from g;
end;
$$;
