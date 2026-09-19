-- =============================================================================
-- 0018 — Rattrapage des statuts de présence
-- =============================================================================
-- Le déclencheur de la migration 0015 ne pose les statuts qu'à la CRÉATION
-- d'une organisation. Toute organisation existant déjà au moment où 0015 a été
-- appliquée se retrouve donc sans aucun statut — et l'écran d'appel n'aurait
-- rien à proposer.
--
-- Idempotente : ne touche que les organisations réellement dépourvues.
-- =============================================================================

insert into public.attendance_statuses
  (organization_id, name, code, is_present, counts_absent, requires_justification, position, color)
select o.id, v.nom, v.code, v.present, v.compte, v.justificatif, v.rang, v.couleur
  from public.organizations o
  cross join (values
    ('Présent',           'PRESENT', true,  false, false, 1::smallint, '#2f6b45'),
    ('Absent',            'ABSENT',  false, true,  false, 2::smallint, '#9b2f2f'),
    ('Retard',            'RETARD',  true,  false, false, 3::smallint, '#8a5a12'),
    ('Absence justifiée', 'EXCUSE',  false, false, true,  4::smallint, '#1e5f57')
  ) as v(nom, code, present, compte, justificatif, rang, couleur)
 where not exists (
   select 1 from public.attendance_statuses s
    where s.organization_id = o.id and s.establishment_id is null
 );
