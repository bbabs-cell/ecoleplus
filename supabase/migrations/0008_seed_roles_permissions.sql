-- =============================================================================
-- 0008 — Référentiel des rôles et permissions
-- =============================================================================
-- Seules figurent ici les permissions RÉELLEMENT appliquées par une policy RLS
-- ou par une fonction de la migration 0007. Déclarer des permissions pour des
-- modules qui n'existent pas encore donnerait l'illusion d'un contrôle d'accès
-- là où il n'y en a aucun : les phases 2 à 5 apporteront les leurs avec leur
-- code (CLAUDE.md, règle 3).
--
-- Archiver un établissement est un UPDATE du statut : c'est donc
-- `establishments.update` qui s'applique, et non une permission distincte.
-- =============================================================================

insert into public.permissions (key, module, description) values
  ('organization.read',           'organization',   'Voir la fiche de l''organisation'),
  ('organization.update',         'organization',   'Modifier la fiche de l''organisation'),
  ('organization.settings.update','organization',   'Modifier les paramètres (langue, fuseau, devise, formats)'),
  ('establishments.read',         'establishments', 'Voir les établissements accessibles'),
  ('establishments.create',       'establishments', 'Créer un établissement'),
  ('establishments.update',       'establishments', 'Modifier ou archiver un établissement'),
  ('members.read',                'members',        'Voir les membres de l''organisation'),
  ('members.invite',              'members',        'Inviter un membre et révoquer une invitation'),
  ('members.update_role',         'members',        'Changer le rôle et les établissements d''un membre'),
  ('members.suspend',             'members',        'Suspendre ou réactiver un membre'),
  ('audit.read',                  'audit',          'Consulter le journal d''audit')
on conflict (key) do update
  set module = excluded.module, description = excluded.description;

-- -----------------------------------------------------------------------------
-- Rôles système
-- -----------------------------------------------------------------------------
-- Les neuf rôles du cahier des charges. La portée décide de ce que le rôle voit :
-- ESTABLISHMENT = uniquement les établissements auxquels le membre est rattaché.

insert into public.roles (code, scope, label, description, is_system) values
  ('SUPER_ADMIN',          'PLATFORM',     'Super administrateur EcolePlus', 'Administration de la plateforme. Tout accès à des données client est journalisé.', true),
  ('OWNER',                'ORGANIZATION', 'Propriétaire d''organisation',   'Contrôle total sur son organisation. Une organisation en conserve toujours un actif.', true),
  ('ESTABLISHMENT_ADMIN',  'ESTABLISHMENT','Administrateur d''établissement','Gère les établissements qui lui sont rattachés.', true),
  ('DIRECTOR',             'ESTABLISHMENT','Directeur / responsable',        'Pilotage pédagogique d''un ou plusieurs établissements.', true),
  ('TEACHER',              'ESTABLISHMENT','Enseignant',                     'Accès aux classes et aux apprenants de ses établissements.', true),
  ('ACCOUNTANT',           'ESTABLISHMENT','Comptable / financier',          'Accès aux données financières de ses établissements.', true),
  ('STAFF',                'ESTABLISHMENT','Personnel administratif',        'Tâches administratives courantes.', true),
  ('GUARDIAN',             'ESTABLISHMENT','Parent / tuteur',                'Suivi des apprenants dont il est responsable. Portail dédié en phase 6.', true),
  ('LEARNER',              'ESTABLISHMENT','Apprenant',                      'Consultation de son propre dossier. Portail dédié en phase 6.', true)
on conflict (code) where organization_id is null do update
  set scope = excluded.scope, label = excluded.label, description = excluded.description;

-- -----------------------------------------------------------------------------
-- Attribution des permissions
-- -----------------------------------------------------------------------------
-- Rejouable : on remet à plat les permissions des rôles système à chaque
-- exécution, pour que la migration reste la source de vérité.

delete from public.role_permissions rp
 using public.roles r
 where r.id = rp.role_id and r.is_system;

with attributions (role_code, permission_key) as (
  values
    -- Propriétaire et super administrateur : l'intégralité du socle.
    ('OWNER', 'organization.read'),            ('OWNER', 'organization.update'),
    ('OWNER', 'organization.settings.update'), ('OWNER', 'establishments.read'),
    ('OWNER', 'establishments.create'),        ('OWNER', 'establishments.update'),
    ('OWNER', 'members.read'),                 ('OWNER', 'members.invite'),
    ('OWNER', 'members.update_role'),          ('OWNER', 'members.suspend'),
    ('OWNER', 'audit.read'),

    ('SUPER_ADMIN', 'organization.read'),            ('SUPER_ADMIN', 'organization.update'),
    ('SUPER_ADMIN', 'organization.settings.update'), ('SUPER_ADMIN', 'establishments.read'),
    ('SUPER_ADMIN', 'establishments.create'),        ('SUPER_ADMIN', 'establishments.update'),
    ('SUPER_ADMIN', 'members.read'),                 ('SUPER_ADMIN', 'members.invite'),
    ('SUPER_ADMIN', 'members.update_role'),          ('SUPER_ADMIN', 'members.suspend'),
    ('SUPER_ADMIN', 'audit.read'),

    -- Administrateur d'établissement : tout sur SES établissements, mais ni la
    -- fiche de l'organisation, ni la nomination de propriétaires.
    ('ESTABLISHMENT_ADMIN', 'organization.read'),   ('ESTABLISHMENT_ADMIN', 'establishments.read'),
    ('ESTABLISHMENT_ADMIN', 'establishments.update'),('ESTABLISHMENT_ADMIN', 'members.read'),
    ('ESTABLISHMENT_ADMIN', 'members.invite'),      ('ESTABLISHMENT_ADMIN', 'audit.read'),

    ('DIRECTOR', 'organization.read'), ('DIRECTOR', 'establishments.read'),
    ('DIRECTOR', 'members.read'),

    -- Les rôles ci-dessous n'ont encore que la lecture du socle : leurs droits
    -- métier (présences, notes, paiements) viendront avec les modules
    -- correspondants, phases 3 et 4.
    ('TEACHER',    'organization.read'), ('TEACHER',    'establishments.read'),
    ('ACCOUNTANT', 'organization.read'), ('ACCOUNTANT', 'establishments.read'),
    ('STAFF',      'organization.read'), ('STAFF',      'establishments.read'),
    ('GUARDIAN',   'organization.read'),
    ('LEARNER',    'organization.read')
)
insert into public.role_permissions (role_id, permission_key)
select r.id, a.permission_key
  from attributions a
  join public.roles r on r.code = a.role_code and r.organization_id is null
on conflict do nothing;
