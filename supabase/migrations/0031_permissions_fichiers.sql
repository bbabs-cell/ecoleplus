-- =============================================================================
-- 0031 — Permissions des fichiers
-- =============================================================================
--   files.read   — consulter et télécharger les documents de son périmètre
--   files.upload — déposer un document
--   files.delete — retirer un document (suppression logique, motif obligatoire)
--
-- L'enseignant dépose et lit : c'est lui qui reçoit le mot d'un parent ou le
-- certificat médical qui justifie une absence. Il ne supprime pas — retirer une
-- pièce d'un dossier engage l'établissement.
-- =============================================================================

insert into public.permissions (key, module, description) values
  ('files.read',   'files', 'Consulter et télécharger les documents'),
  ('files.upload', 'files', 'Déposer un document'),
  ('files.delete', 'files', 'Retirer un document du dossier')
on conflict (key) do update
  set module = excluded.module, description = excluded.description;

delete from public.role_permissions rp
 using public.roles r, public.permissions p
 where r.id = rp.role_id and r.is_system
   and p.key = rp.permission_key and p.module = 'files';

with attributions (role_code, permission_key) as (
  values
    ('OWNER', 'files.read'), ('OWNER', 'files.upload'), ('OWNER', 'files.delete'),
    ('SUPER_ADMIN', 'files.read'), ('SUPER_ADMIN', 'files.upload'), ('SUPER_ADMIN', 'files.delete'),
    ('ESTABLISHMENT_ADMIN', 'files.read'), ('ESTABLISHMENT_ADMIN', 'files.upload'),
    ('ESTABLISHMENT_ADMIN', 'files.delete'),
    ('DIRECTOR', 'files.read'), ('DIRECTOR', 'files.upload'), ('DIRECTOR', 'files.delete'),

    -- Le personnel administratif tient les dossiers.
    ('STAFF', 'files.read'), ('STAFF', 'files.upload'), ('STAFF', 'files.delete'),

    -- L'enseignant dépose les justificatifs qu'il reçoit ; il ne retire rien.
    ('TEACHER', 'files.read'), ('TEACHER', 'files.upload'),

    -- Le comptable consulte les pièces des dossiers qu'il traite.
    ('ACCOUNTANT', 'files.read'), ('ACCOUNTANT', 'files.upload')
)
insert into public.role_permissions (role_id, permission_key)
select r.id, a.permission_key
  from attributions a
  join public.roles r on r.code = a.role_code and r.organization_id is null
on conflict do nothing;
