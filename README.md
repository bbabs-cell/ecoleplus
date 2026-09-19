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

**Phase 2 — Gestion académique : terminée.** Années académiques et leur
découpage, niveaux, matières, enseignants, classes, groupes, affectations
enseignant × matière × classe, dossiers apprenants et inscriptions avec les
huit statuts du cycle de vie.

La phase 3 (présences, évaluations, systèmes de notation configurables,
bulletins) n'est pas commencée.

---

## Installation

Le projet Supabase et le projet Vercel sont déjà provisionnés et reliés. Pour
travailler en local :

```bash
npm install
cp .env.example .env.local   # puis renseigner les deux valeurs
npm run dev
```

Les deux variables se trouvent dans Supabase → Settings → API, et sont déjà
posées sur Vercel (production, preview, development). Ne placez **jamais** la
clé `service_role` dans une variable `NEXT_PUBLIC_*` : elle contourne RLS.

### Étape manuelle restante : activer le hook JWT

Tableau de bord Supabase → **Authentication → Hooks → Customize Access Token
(JWT) Claims** → sélectionner `ecoleplus.custom_access_token_hook`.

L'API de configuration Auth n'est pas exposée par la CLI : cette bascule se
fait à la main, une fois. Sans elle, aucun jeton ne porte d'organisation, RLS
refuse tout et l'application reste vide. L'échec est fermé par conception,
jamais ouvert.

Ensuite : créer un compte, puis son organisation. Le premier compte en devient
propriétaire.

### Régénérer les types après une migration

```bash
npx supabase gen types typescript --project-id oaloryktutwwgjqknmbm \
  --schema public > src/lib/types/database.generated.ts
```

`database.generated.ts` ne se modifie pas à la main ; les alias lisibles vivent
à côté, dans `database.ts`.

### Appliquer une nouvelle migration

Ajouter un fichier numéroté dans `supabase/migrations/`, puis `supabase db push`
(ou le SQL Editor). Ne jamais modifier une migration déjà appliquée.

---

## Commandes

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run typecheck` | Vérification TypeScript (`tsc --noEmit`) |
| `npm run lint` | ESLint |

### Tests de sécurité

57 assertions réparties en deux suites. À rejouer après toute migration
touchant RLS, les rôles ou les permissions.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/securite_multi_tenant.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/securite_academique.sql
```

- **`securite_multi_tenant.sql`** (30) — isolation inter-organisations,
  escalade de privilèges, détournement d'invitation, immuabilité du journal
  d'audit, révocation de session.
- **`securite_academique.sql`** (27) — portée établissement des apprenants,
  cloisonnement par clés composites, permissions académiques, capacité des
  classes, unicité de l'inscription vivante, transfert entre établissements.

Chaque script se termine par un `ROLLBACK` : il ne laisse aucune trace.

---

## Organisation du code

```
src/
├── app/            Routes (App Router). Server Components par défaut.
├── components/     ui/ = primitives réutilisables ; coque/ = navigation.
├── config/         brand.ts — nom du produit, jamais codé en dur ailleurs.
├── lib/            Supabase, types générés, validation Zod, formatage, référentiels.
└── services/       Logique métier. *.actions.ts = Server Actions.

supabase/
├── migrations/     SQL versionné. Ne jamais modifier une migration appliquée.
└── tests/          Tests de sécurité multi-tenant.
```

## Modèle de sécurité

Cinq garanties, chacune vérifiée par les tests :

1. **Cloisonnement** — toute donnée porte un `organization_id`, RLS est active
   sur chaque table, et l'absence de policy vaut refus.
2. **Le client ne décide de rien** — organisation, rôle, portée et permissions
   sont gravés dans le JWT par un hook serveur à l'émission du jeton.
3. **Double contrôle** — RLS *et* garde serveur (`exigerPermission`). Masquer un
   bouton ne protège rien : une Server Action est une route appelable
   directement.
4. **Traçabilité** — les opérations sensibles passent par des fonctions SQL qui
   journalisent dans un `audit_logs` que personne ne peut réécrire.
5. **Cohérence structurelle** — les tables du domaine académique référencent
   leur parent sur `(id, organization_id)` ou `(id, establishment_id)`.
   PostgreSQL refuse alors physiquement qu'une classe pointe vers le niveau
   d'un autre établissement : la garantie ne dépend d'aucun code.

Les 20 permissions déclarées dans les migrations `0008` et `0014` sont toutes
réellement appliquées par une policy ou par une fonction. Les modules des
phases suivantes apporteront les leurs avec leur code, pas avant.
