-- =============================================================================
-- 0014 — Permissions du domaine académique
-- =============================================================================
-- Comme en phase 1, chaque clé listée ici est réellement exigée par une policy
-- de la migration 0012 ou par une fonction de la 0013. Aucune permission
-- décorative.
--
-- La remise à plat ne touche que les modules de cette migration : les
-- attributions de la phase 1 ne sont pas balayées, et rejouer ce fichier seul
-- reste sans effet de bord.
-- =============================================================================

insert into public.permissions (key, module, description) values
  ('academic.read',      'academic',  'Voir les années, périodes, niveaux et matières'),
  ('academic.manage',    'academic',  'Créer et modifier années, périodes, niveaux et matières'),
  ('teachers.read',      'teachers',  'Voir les enseignants'),
  ('teachers.manage',    'teachers',  'Créer et modifier les fiches enseignants'),
  ('classes.read',       'classes',   'Voir les classes, groupes et affectations'),
  ('classes.manage',     'classes',   'Créer et modifier classes, groupes et affectations'),
  ('learners.read',      'learners',  'Voir les apprenants et leurs inscriptions'),
  ('learners.manage',    'learners',  'Créer et modifier les dossiers apprenants'),
  ('enrollments.manage', 'learners',  'Inscrire, réinscrire, changer de statut, affecter à une classe')
on conflict (key) do update
  set module = excluded.module, description = excluded.description;

delete from public.role_permissions rp
 using public.roles r, public.permissions p
 where r.id = rp.role_id
   and r.is_system
   and p.key = rp.permission_key
   and p.module in ('academic', 'teachers', 'classes', 'learners');

with attributions (role_code, permission_key) as (
  values
    -- Propriétaire et super administrateur : tout le domaine académique.
    ('OWNER', 'academic.read'),   ('OWNER', 'academic.manage'),
    ('OWNER', 'teachers.read'),   ('OWNER', 'teachers.manage'),
    ('OWNER', 'classes.read'),    ('OWNER', 'classes.manage'),
    ('OWNER', 'learners.read'),   ('OWNER', 'learners.manage'),
    ('OWNER', 'enrollments.manage'),

    ('SUPER_ADMIN', 'academic.read'),   ('SUPER_ADMIN', 'academic.manage'),
    ('SUPER_ADMIN', 'teachers.read'),   ('SUPER_ADMIN', 'teachers.manage'),
    ('SUPER_ADMIN', 'classes.read'),    ('SUPER_ADMIN', 'classes.manage'),
    ('SUPER_ADMIN', 'learners.read'),   ('SUPER_ADMIN', 'learners.manage'),
    ('SUPER_ADMIN', 'enrollments.manage'),

    -- Administrateur d'établissement : idem, mais borné à SES établissements
    -- par la portée de son rôle, pas par ses permissions.
    ('ESTABLISHMENT_ADMIN', 'academic.read'),   ('ESTABLISHMENT_ADMIN', 'academic.manage'),
    ('ESTABLISHMENT_ADMIN', 'teachers.read'),   ('ESTABLISHMENT_ADMIN', 'teachers.manage'),
    ('ESTABLISHMENT_ADMIN', 'classes.read'),    ('ESTABLISHMENT_ADMIN', 'classes.manage'),
    ('ESTABLISHMENT_ADMIN', 'learners.read'),   ('ESTABLISHMENT_ADMIN', 'learners.manage'),
    ('ESTABLISHMENT_ADMIN', 'enrollments.manage'),

    -- Directeur : pilotage pédagogique. Compose les classes et suit les
    -- inscriptions, mais ne redéfinit pas le référentiel de l'établissement.
    ('DIRECTOR', 'academic.read'), ('DIRECTOR', 'teachers.read'),
    ('DIRECTOR', 'classes.read'),  ('DIRECTOR', 'classes.manage'),
    ('DIRECTOR', 'learners.read'), ('DIRECTOR', 'enrollments.manage'),

    -- Personnel administratif : le guichet des inscriptions.
    ('STAFF', 'academic.read'), ('STAFF', 'teachers.read'),
    ('STAFF', 'classes.read'),  ('STAFF', 'learners.read'),
    ('STAFF', 'learners.manage'), ('STAFF', 'enrollments.manage'),

    -- Enseignant : lecture seule sur le socle académique. Ses droits de saisie
    -- (présences, notes) viendront avec les phases 3.
    ('TEACHER', 'academic.read'), ('TEACHER', 'teachers.read'),
    ('TEACHER', 'classes.read'),  ('TEACHER', 'learners.read'),

    -- Comptable : voit les apprenants, qu'il devra facturer en phase 4.
    ('ACCOUNTANT', 'academic.read'), ('ACCOUNTANT', 'learners.read')

    -- GUARDIAN et LEARNER n'obtiennent rien ici : leur accès passera par les
    -- portails dédiés de la phase 6, avec une portée limitée à leur propre
    -- dossier. Leur ouvrir `learners.read` leur donnerait tout l'établissement.
)
insert into public.role_permissions (role_id, permission_key)
select r.id, a.permission_key
  from attributions a
  join public.roles r on r.code = a.role_code and r.organization_id is null
on conflict do nothing;
