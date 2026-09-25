# Design UX/UI — EcolePlus

**Direction** : premium, moderne, chaleureux — pas blanc clinique, pas cyberpunk/glassmorphism/gradients excessifs. Bon contraste, profondeur subtile, icônes modernes, cartes structurées sans surcharge, transitions fluides, hiérarchie visuelle claire.

**À éviter** : interface tout-blanc, néons, ombres lourdes, animations gratuites, textes illisibles, faible contraste, surabondance de cartes.

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

Ce que le script ne voit pas : la hiérarchie visuelle, le contraste réel, la
pertinence d'une mise en page. Il ferme les défauts mécaniques, pas le reste.
