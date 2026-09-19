# EcolePlus

SaaS multi-tenant de gestion scolaire et universitaire, de la maternelle à
l'enseignement supérieur, sans présupposé de pays ni de système éducatif.

Next.js (App Router) · TypeScript strict · Tailwind · Supabase (PostgreSQL, Auth, RLS)

La mémoire projet et les règles de contribution sont dans [`CLAUDE.md`](./CLAUDE.md) ;
l'architecture, la feuille de route, les règles de code et les principes de design
sont dans [`docs/`](./docs).

---

## État d'avancement

**Phase 1 — Fondation SaaS : terminée.** Organisations, établissements, comptes,
rôles, permissions, RLS, journal d'audit, authentification, navigation et
paramètres de base.

La phase 2 (années académiques, niveaux, classes, matières, apprenants,
inscriptions) n'est pas commencée.

---

## Installation

### 1. Dépendances

```bash
npm install
```

### 2. Projet Supabase

Créez un projet sur [supabase.com](https://supabase.com), puis appliquez les
migrations **dans l'ordre**. Avec la CLI Supabase :

```bash
supabase link --project-ref <ref-du-projet>
supabase db push
```

Ou, sans la CLI, en collant chaque fichier de `supabase/migrations/` dans le
SQL Editor du tableau de bord, du plus petit numéro au plus grand.

### 3. Activer le hook JWT — indispensable

Tableau de bord Supabase → **Authentication → Hooks → Customize Access Token (JWT) Claims**
→ sélectionner `ecoleplus.custom_access_token_hook`.

Sans cette étape, aucun jeton ne porte d'organisation : RLS refuse tout et
l'application reste vide. L'échec est volontairement fermé, jamais ouvert.

### 4. Variables d'environnement

```bash
cp .env.example .env.local
```

Renseignez `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(Settings → API). Ne placez **jamais** la clé `service_role` dans une variable
`NEXT_PUBLIC_*` : elle contourne RLS.

### 5. Lancer

```bash
npm run dev
```

Créez un compte, puis votre organisation. Le premier compte en devient
propriétaire.

---

## Commandes

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run typecheck` | Vérification TypeScript (`tsc --noEmit`) |
| `npm run lint` | ESLint |

### Tests de sécurité

30 assertions couvrant l'isolation inter-organisations, la portée
établissement, l'escalade de privilèges, le détournement d'invitation,
l'immuabilité du journal d'audit et la révocation de session :

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/securite_multi_tenant.sql
```

Le script se termine par un `ROLLBACK` : il ne laisse aucune trace. À rejouer
après toute migration touchant RLS, les rôles ou les permissions.

---

## Organisation du code

```
src/
├── app/            Routes (App Router). Server Components par défaut.
├── components/     ui/ = primitives réutilisables ; coque/ = navigation.
├── config/         brand.ts — nom du produit, jamais codé en dur ailleurs.
├── lib/            Supabase, validation Zod, formatage localisé, référentiels.
└── services/       Logique métier. *.actions.ts = Server Actions.

supabase/
├── migrations/     SQL versionné. Ne jamais modifier une migration appliquée.
└── tests/          Tests de sécurité multi-tenant.
```

## Modèle de sécurité

Quatre garanties, chacune vérifiée par les tests :

1. **Cloisonnement** — toute donnée porte un `organization_id`, RLS est active
   sur chaque table, et l'absence de policy vaut refus.
2. **Le client ne décide de rien** — organisation, rôle, portée et permissions
   sont gravés dans le JWT par un hook serveur à l'émission du jeton.
3. **Double contrôle** — RLS *et* garde serveur (`exigerPermission`). Masquer un
   bouton ne protège rien : une Server Action est une route appelable
   directement.
4. **Traçabilité** — les opérations sensibles passent par des fonctions SQL qui
   journalisent dans un `audit_logs` que personne ne peut réécrire.

Les permissions déclarées dans la migration `0008` sont toutes réellement
appliquées. Les modules des phases suivantes apporteront les leurs avec leur
code, pas avant.
