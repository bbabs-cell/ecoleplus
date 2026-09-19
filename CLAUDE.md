# EcolePlus — Mémoire projet pour Claude Code

SaaS multi-tenant international de gestion scolaire/universitaire (maternelle → université, tous pays/systèmes éducatifs). Nom provisoire, à centraliser dans `config/brand.ts` — jamais hardcodé ailleurs.

Détails complets : @docs/architecture.md · @docs/roadmap.md · @docs/design-guidelines.md · @docs/regles-code.md

Règles métier des phases à venir : @docs/business-rules/moteur-notation.md · @docs/business-rules/presences.md · @docs/business-rules/finances.md · @docs/reprise-projet-precedent.md

## Stack (ne pas changer sans justification + validation explicite)

- **Frontend** : Next.js (App Router) + TypeScript strict + React + Tailwind
- **Backend** : Supabase (PostgreSQL, Auth, RLS, migrations SQL versionnées) — utiliser le MCP Supabase pour inspecter tables/migrations/advisors, pas de lecture manuelle
- **Hébergement** : Vercel (dev/preview/prod)
- **Fichiers** : Cloudflare R2, privé par défaut, URLs signées, métadonnées en PostgreSQL, jamais de clé R2 côté client

## Règles non négociables

1. **Multi-tenant strict** : toute donnée métier est rattachée à `organization_id` (+ `establishment_id` si pertinent). RLS obligatoire sur toute table exposée — vérification à la fois en RLS *et* côté serveur, jamais seulement masqué en UI.
2. **Rien n'est codé en dur par pays** : système de notation, niveaux, structure de classe, calendrier académique, devise, format de nom → configurables par organisation/établissement/programme.
3. **Jamais de fonctionnalité "prétendue terminée"** si elle est simulée, non connectée à la DB, ou sans vérification de permissions serveur.
4. Une valeur de note manquante ≠ zéro. Distinguer : non saisie / saisie / validée / publiée / absence / dispense / invalidée / N/A / zéro réel.
5. Pas de suppression définitive de données importantes (apprenants, notes, paiements) sans procédure explicite + permission + audit log.
6. Aucun secret (Supabase, R2, env vars) n'est jamais affiché, loggé ou commité.

## Méthode de travail

- **Avant une tâche importante** : inspecter l'existant (via `/inspect` ou lecture directe), annoncer l'objectif, les fichiers touchés, les risques de régression — en une phrase ou deux, pas un rapport pour les tâches triviales.
- **Développement** : par module fonctionnel complet (UI + validation + RLS + tests), jamais de maquette seule.
- **Après modification significative** : lancer typecheck/lint/build/tests réellement disponibles et rapporter les résultats réels — ne jamais affirmer qu'un test a tourné s'il n'a pas tourné.
- Ne pas avancer à la phase de roadmap suivante (@docs/roadmap.md) tant que la phase courante n'est pas stable.

## Commandes utiles

- `/inspect` — inspection complète de l'environnement (phase 0), produit un rapport structuré
- `/new-module <nom>` — cycle complet développement d'un module (planification → code → validation)
- `/security-audit` — passe en revue RLS, permissions, isolation multi-tenant sur les zones touchées récemment
