-- =============================================================================
-- 0017 — Permissions des présences
-- =============================================================================
-- Quatre droits distincts, et cette séparation est le cœur du module :
--
--   attendance.record    — faire l'appel
--   attendance.validate  — clore la feuille
--   attendance.correct   — modifier après clôture, ou rouvrir
--   attendance.configure — définir les statuts de l'établissement
--
-- Si « corriger » découlait de « faire l'appel », le verrouillage ne vaudrait
-- rien : celui qui a saisi pourrait réécrire sa saisie sans laisser de trace
-- exploitable. C'est précisément ce que le module est censé empêcher, l'appel
-- étant une pièce administrative parfois opposable.
-- =============================================================================

insert into public.permissions (key, module, description) values
  ('attendance.read',      'attendance', 'Consulter les présences et les feuilles d''appel'),
  ('attendance.record',    'attendance', 'Créer une séance et faire l''appel'),
  ('attendance.validate',  'attendance', 'Valider une feuille d''appel'),
  ('attendance.correct',   'attendance', 'Corriger une présence après validation et rouvrir une séance'),
  ('attendance.configure', 'attendance', 'Définir les statuts de présence de l''établissement')
on conflict (key) do update
  set module = excluded.module, description = excluded.description;

delete from public.role_permissions rp
 using public.roles r, public.permissions p
 where r.id = rp.role_id and r.is_system
   and p.key = rp.permission_key and p.module = 'attendance';

with attributions (role_code, permission_key) as (
  values
    ('OWNER', 'attendance.read'),     ('OWNER', 'attendance.record'),
    ('OWNER', 'attendance.validate'), ('OWNER', 'attendance.correct'),
    ('OWNER', 'attendance.configure'),

    ('SUPER_ADMIN', 'attendance.read'),     ('SUPER_ADMIN', 'attendance.record'),
    ('SUPER_ADMIN', 'attendance.validate'), ('SUPER_ADMIN', 'attendance.correct'),
    ('SUPER_ADMIN', 'attendance.configure'),

    ('ESTABLISHMENT_ADMIN', 'attendance.read'),     ('ESTABLISHMENT_ADMIN', 'attendance.record'),
    ('ESTABLISHMENT_ADMIN', 'attendance.validate'), ('ESTABLISHMENT_ADMIN', 'attendance.correct'),
    ('ESTABLISHMENT_ADMIN', 'attendance.configure'),

    -- Le directeur valide et corrige, sans avoir à configurer le référentiel.
    ('DIRECTOR', 'attendance.read'),     ('DIRECTOR', 'attendance.record'),
    ('DIRECTOR', 'attendance.validate'), ('DIRECTOR', 'attendance.correct'),

    -- L'enseignant fait l'appel dans SES classes et valide sa feuille. Il ne
    -- corrige pas après clôture : c'est ce qui rend la validation signifiante.
    ('TEACHER', 'attendance.read'), ('TEACHER', 'attendance.record'),
    ('TEACHER', 'attendance.validate'),

    -- Le personnel administratif saisit les justificatifs et corrige : c'est
    -- lui qui reçoit les mots des familles après coup.
    ('STAFF', 'attendance.read'), ('STAFF', 'attendance.record'),
    ('STAFF', 'attendance.correct')
)
insert into public.role_permissions (role_id, permission_key)
select r.id, a.permission_key
  from attributions a
  join public.roles r on r.code = a.role_code and r.organization_id is null
on conflict do nothing;
