---
description: Développe un module fonctionnel complet d'EcolePlus (planification -> code -> validation)
argument-hint: <nom du module, ex. "présences">
---

Développe le module **$ARGUMENTS** pour EcolePlus en respectant @CLAUDE.md, @docs/architecture.md et @docs/regles-code.md.

1. **Planifier** (bref si simple) : objectif, fichiers concernés, dépendances, impacts sur d'autres modules, tests à prévoir, risques de régression.
2. **Développer** : le module doit être fonctionnel, validé (client + serveur), sécurisé (RLS + vérif serveur), responsive, intégré à la base de données réelle (pas de simulation), compatible avec le système de permissions.
3. **Valider** : lance réellement typecheck, lint, build, et les tests disponibles. Corrige les erreurs trouvées. Rapporte précisément ce qui a été exécuté et le résultat réel — jamais un résultat supposé.

Ne marque le module comme terminé que si toutes les étapes ci-dessus sont réellement passées.
