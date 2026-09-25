# Design UX/UI — EcolePlus

**Direction** : premium, moderne, chaleureux et **coloré**. Bon contraste, profondeur, icônes modernes, hiérarchie visuelle claire.

**Jamais de blanc pur** — ni en fond (`--surface`), ni sur les cartes (`--carte`). En clair, du papier chaud ; en sombre, de la terre sombre. Une carte est du papier, pas un écran allumé.

## La couleur dit où l'on est

Sept teintes de domaine, une par famille d'écrans, définies dans `globals.css` :

| Teinte | Écrans |
|---|---|
| `socle` | tableau de bord, établissements |
| `academique` | années, niveaux, matières |
| `personnes` | enseignants, classes, apprenants |
| `presences` | présences |
| `notation` | évaluations, barèmes, bulletins |
| `finances` | finances |
| `admin` | membres, journal, organisation |

La même teinte porte l'entrée de navigation, la barre du titre de page et les
pastilles d'indicateurs : on arrive sur un écran avec le repère qu'on vient de
cliquer. `TEINTE_PAR_ICONE` (`components/coque/navigation.tsx`) est la seule
table de correspondance — ne pas en créer une seconde.

**Les classes de teinte s'écrivent en toutes lettres.** Tailwind ne voit pas un
nom construit à l'exécution : `bg-teinte-${x}` ne produit aucun style.

## Le mouvement

Les animations sont **voulues**, pas tolérées. Trois durées et deux courbes
(`--duree-vive`, `--duree`, `--duree-ample`, `--elan`, `--elan-doux`) ; au-delà,
l'incohérence se voit.

- `.anim-apparition` — entrée d'un écran ou d'un bloc.
- `.anim-cascade` — les enfants entrent l'un après l'autre, décalage plafonné.
- `.anim-echelle`, `.anim-fondu` — apparitions brèves.
- `.releve` — la carte se soulève au survol, sur pointeur seulement.

Une règle demeure : **`prefers-reduced-motion` désactive tout**, y compris les
cascades. Qui a demandé moins d'animation reçoit l'interface immobile. Ce n'est
pas une préférence esthétique mais une condition d'accès — certaines personnes
ont des vertiges devant une interface qui bouge.

**À éviter** : néons, verre dépoli, dégradés criards, textes illisibles, faible
contraste, surabondance de cartes.

**Responsive réel** (pas juste desktop réduit), attention particulière : saisie présences, saisie notes, fiche apprenant, enregistrement paiement, consultation reçu/bulletin, tableaux de données, formulaires longs, modales.

**Accessibilité** : contraste suffisant, navigation clavier, labels explicites, focus visible, états loading/vide/erreur, HTML sémantique.

## Vérifier plutôt que supposer

« Responsive réel » et « cibles tactiles » sont des consignes qu'on ne tient
qu'en les mesurant. `scripts/audit-responsive.mjs` charge chaque écran à huit
largeurs (320 → 1920 px) et signale deux défauts :

- **le débordement horizontal** — une page plus large que la fenêtre ;
- **les cibles sous 44 px** en dessous de 1024 px de large, en mesurant la zone
  cliquable réelle : pour une case à cocher, c'est son libellé, pas le contrôle.

Playwright n'est pas une dépendance du projet : le script s'installe à part,
comme `supabase/tests/concurrence_recus.sh`. Le mode d'emploi est en tête du
fichier.

`scripts/verifier-contrastes.mjs` fait de même pour la palette : il lit les
jetons de `globals.css` et refuse tout ce qui passe sous le seuil WCAG AA, en
clair comme en sombre. Une couleur qui « a l'air bien » n'est pas une couleur
lisible — trois contrastes insuffisants ont été corrigés grâce à lui, dont des
bordures trop discrètes pour découper les cartes.

Ce que ces scripts ne voient pas : la hiérarchie visuelle, la pertinence d'une
mise en page, le plaisir qu'on a à s'en servir. Ils ferment les défauts
mécaniques, pas le reste.
