---
description: Audit de sécurité multi-tenant sur les zones récemment modifiées d'EcolePlus
---

Audite la sécurité des zones du projet EcolePlus récemment modifiées (regarde `git diff`/`git log` pour cibler), en te concentrant sur :

- Isolation multi-tenant : une organisation ne peut jamais lire/écrire les données d'une autre
- RLS PostgreSQL réellement active et correcte sur les tables touchées (utilise le MCP Supabase : `get_advisors` avec le type sécurité, `execute_sql` pour vérifier les policies)
- Permissions vérifiées côté serveur, pas seulement masquées en UI
- Routes API/Server Actions : contrôle d'accès, pas de confiance aux identifiants envoyés par le frontend
- Fichiers Cloudflare R2 : accès par URL signée uniquement, jamais par simple connaissance de l'URL
- Absence de secret exposé côté client ou dans les logs/erreurs

Rapporte chaque faille trouvée avec fichier, ligne, scénario d'exploitation concret, et corrige les failles confirmées (pas les suppositions).
