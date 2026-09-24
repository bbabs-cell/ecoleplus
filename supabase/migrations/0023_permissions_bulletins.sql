-- =============================================================================
-- 0023 — Permissions des bulletins
-- =============================================================================
-- « Prévisualisation, vérification puis publication sont trois permissions
-- distinctes » (@docs/business-rules/moteur-notation.md, §6).
--
--   reports.read    — consulter un bulletin déjà établi
--   reports.preview — calculer un aperçu, sans rien écrire
--   reports.verify  — figer l'instantané en brouillon vérifié
--   reports.publish — remettre le bulletin à la famille
--
-- Le personnel administratif prépare et vérifie les bulletins ; il ne les
-- publie pas. Publier est l'acte de l'établissement, pas celui du bureau.
-- =============================================================================

insert into public.permissions (key, module, description) values
  ('reports.read',    'reports', 'Consulter les bulletins'),
  ('reports.preview', 'reports', 'Prévisualiser un bulletin sans l''enregistrer'),
  ('reports.verify',  'reports', 'Vérifier un bulletin et figer son instantané'),
  ('reports.publish', 'reports', 'Publier un bulletin')
on conflict (key) do update
  set module = excluded.module, description = excluded.description;

delete from public.role_permissions rp
 using public.roles r, public.permissions p
 where r.id = rp.role_id and r.is_system
   and p.key = rp.permission_key and p.module = 'reports';

with attributions (role_code, permission_key) as (
  values
    ('OWNER', 'reports.read'),   ('OWNER', 'reports.preview'),
    ('OWNER', 'reports.verify'), ('OWNER', 'reports.publish'),

    ('SUPER_ADMIN', 'reports.read'),   ('SUPER_ADMIN', 'reports.preview'),
    ('SUPER_ADMIN', 'reports.verify'), ('SUPER_ADMIN', 'reports.publish'),

    ('ESTABLISHMENT_ADMIN', 'reports.read'),   ('ESTABLISHMENT_ADMIN', 'reports.preview'),
    ('ESTABLISHMENT_ADMIN', 'reports.verify'), ('ESTABLISHMENT_ADMIN', 'reports.publish'),

    ('DIRECTOR', 'reports.read'),   ('DIRECTOR', 'reports.preview'),
    ('DIRECTOR', 'reports.verify'), ('DIRECTOR', 'reports.publish'),

    -- L'enseignant voit les bulletins de ses classes et peut les prévisualiser
    -- pour contrôler sa contribution. Il ne les fige pas.
    ('TEACHER', 'reports.read'), ('TEACHER', 'reports.preview'),

    -- Le personnel administratif prépare et vérifie ; il ne publie pas.
    ('STAFF', 'reports.read'), ('STAFF', 'reports.preview'), ('STAFF', 'reports.verify')
)
insert into public.role_permissions (role_id, permission_key)
select r.id, a.permission_key
  from attributions a
  join public.roles r on r.code = a.role_code and r.organization_id is null
on conflict do nothing;
