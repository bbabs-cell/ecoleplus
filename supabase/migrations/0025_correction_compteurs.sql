-- =============================================================================
-- 0025 — Correction des compteurs de notes
-- =============================================================================
-- La migration 0024 joignait `assessments` une seconde fois à l'intérieur de
-- l'agrégat pour retrouver le barème de repli. Cette jointure multipliait les
-- lignes par le nombre d'évaluations de la matière : avec deux évaluations en
-- mathématiques, chaque note était comptée deux fois.
--
-- La moyenne, elle, restait juste — la duplication étant uniforme, le rapport
-- somme pondérée / somme des poids ne bougeait pas. Mais `notes_prises` et
-- `notes_ignorees` annonçaient le double, et ces compteurs sont précisément ce
-- qui permet de lire une moyenne : « 14 sur deux notes » et « 14 sur douze »
-- ne disent pas la même chose.
--
-- Le barème de repli se lit désormais dans la ligne elle-même, sans jointure
-- supplémentaire.
-- =============================================================================

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
  -- Une ligne par ÉVALUATION de la classe, et une seule. Toute jointure
  -- supplémentaire ici fausserait les compteurs.
  with notes as (
    select
      a.subject_id,
      a.grading_system_id as bareme_eval,
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
      join public.grading_systems gs on gs.id = a.grading_system_id
      left join public.grading_categories gc on gc.id = a.category_id
      left join public.assessment_results r
             on r.assessment_id = a.id and r.enrollment_id = p_enrollment_id
     where a.class_id = v_inscription.class_id
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
           -- Dernier recours : le barème qui a servi à noter. Une moyenne
           -- existe toujours sur l'échelle où elle a été construite, même si
           -- la classe n'a pas de barème déclaré.
           min(n.bareme_eval::text)::uuid                              as bareme_evaluations
      from notes n
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
