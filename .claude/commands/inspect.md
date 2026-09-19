---
description: Inspection complète de l'environnement EcolePlus avant tout développement majeur
---

Inspecte l'environnement du projet EcolePlus sans rien modifier. Utilise le MCP Supabase disponible (list_tables, list_migrations, list_extensions, get_advisors) plutôt que de deviner l'état de la base.

Vérifie :
- Structure du projet, `package.json`, versions Node/Next.js, dépendances installées
- Fichiers de config (`.env.example`, `next.config`, `middleware.ts`, config Vercel/R2 si présente)
- Config Supabase, migrations existantes, tables, extensions, RLS activée ou non
- Routes, composants, services déjà présents
- Erreurs de compilation/lint/typecheck actuelles
- Tests existants et leur état réel (les exécuter, ne pas supposer)
- Risques de sécurité visibles (secrets exposés, RLS manquante, permissions non vérifiées côté serveur) — utilise `get_advisors` (sécurité) si un projet Supabase est connecté

Ne révèle jamais la valeur d'un secret trouvé — signale seulement sa présence/absence.

Produis un rapport structuré :
1. Ce qui existe déjà
2. Ce qui fonctionne
3. Ce qui ne fonctionne pas
4. Ce qui manque
5. Risques techniques identifiés
6. Recommandations prioritaires
7. Plan de travail proposé (aligné sur @docs/roadmap.md)

Ne fais aucune modification massive dans cette commande — seulement des correctifs triviaux et sans risque si évidents.
